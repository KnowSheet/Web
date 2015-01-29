'use strict';

var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');

var PersistentConnection = require('./persistent-connection');
var ChunkParser = require('./chunk-parser');
var JsonPerLineParser = require('./json-per-line-parser');

var Dashboard = require('./dashboard');
var DashboardDataStore = require('./dashboard-data-store');
var DashboardLayoutStore = require('./dashboard-layout-store');
var config = require('./config');

require('./index.less');


var logger = require('./logger');

var logPrefix = '[frontend] ';


logger.log(logPrefix + 'Loaded at ' + (new Date()));


function init() {
	var dispatcher = new EventEmitter();
	
	var backendApi = {
		baseUrl: config.backend.httpBaseUrl,
		normalizeUrl: function (url) {
			if (!/^(https?:)?\/\//.test(url)) {
				url = this.baseUrl + url;
			}
			return url;
		},
		loadLayout: function (layoutUrl) {
			$.ajax({
				url: this.normalizeUrl(layoutUrl),
				dataType: 'json'
			}).then(function (response) {
				var layout = response.layout;
			
				if (layout) {
					logger.log(logPrefix + 'Loaded layout from ' + layoutUrl + ':', layout);
				
					dispatcher.emit('receive-layout', {
						layoutUrl: layoutUrl,
						layout: layout
					});
				}
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load layout from ' + layoutUrl + ':', jqXHR);
				
				global.alert('An error occurred while loading meta from ' + layoutUrl + '.');
			});
		},
		
		loadMeta: function (metaUrl) {
			$.ajax({
				url: this.normalizeUrl(metaUrl),
				dataType: 'json'
			}).then(function (response) {
				var meta = response.meta;
				
				if (meta) {
					logger.log(logPrefix + 'Loaded meta from ' + metaUrl + ':', meta);
					
					dispatcher.emit('receive-meta', {
						metaUrl: metaUrl,
						meta: meta
					});
				}
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load meta from ' + metaUrl + ':', jqXHR);
				
				global.alert('An error occurred while loading meta from ' + metaUrl + '.');
			});
		},
		
		streamData: function (dataUrl, timeInterval) {
			var _this = this;
			
			var stopping = false;
			
			if (typeof timeInterval !== 'number' || timeInterval < 0) {
				timeInterval = 0;
			}
			
			var queryParams = {
				since: ((new Date()).getTime() - timeInterval)
			};
			
			var persistentConnection = new PersistentConnection({
				logPrefix: 	logPrefix + ' [' + dataUrl + '] [PersistentConnection] '
			});
			
			var jsonPerLineParser = new JsonPerLineParser({
				logPrefix: 	logPrefix + ' [' + dataUrl + '] [JsonPerLineParser] '
			});
			
			function reconnectOnError() {
				if (!stopping && !persistentConnection.isConnecting()) {
					persistentConnection.reconnect();
				}
			}
			
			persistentConnection.on('connected', function (data) {
				jsonPerLineParser.reset();
			});
			persistentConnection.on('data', function (data) {
				jsonPerLineParser.write(data);
			});
			persistentConnection.on('end', reconnectOnError);
			persistentConnection.on('error', reconnectOnError);
			
			jsonPerLineParser.on('data', function (data) {
				if (data && typeof data.x === 'number' && typeof data.y === 'number') {
					// Advance the time that will go in the next request
					// to the latest data sample time (add 1 to avoid duplicates):
					queryParams.since = data.x + 1;
					persistentConnection.setQuery(queryParams);
					
					// Notify that the data has been received:
					dispatcher.emit('receive-data', {
						dataUrl: dataUrl,
						data: [ data ]
					});
				}
			});
			jsonPerLineParser.on('error', reconnectOnError);
			
			persistentConnection.connect(_this.normalizeUrl(dataUrl), queryParams);
			
			return {
				stop: function () {
					stopping = true;
					persistentConnection.disconnect();
				}
			};
		}
	};
	
	var dashboardDataStore = new DashboardDataStore(dispatcher, backendApi);
	
	var dashboardLayoutStore = new DashboardLayoutStore(dispatcher, backendApi);
	
	var dashboard = new Dashboard({
		getDataStore: function () { return dashboardDataStore; },
		getLayoutStore: function () { return dashboardLayoutStore; }
	}, {
	});
	
	dashboard.mount( $('body').addClass('knsh-root') );
	
	$(global).on('load resize orientationchange', _.throttle(function () {
		dispatcher.emit('resize-window');
	}, 50));
	
	backendApi.loadLayout( '/layout' );
	
	logger.log(logPrefix + 'Initialized at ' + (new Date()));
}

$(global).on('load', init);
