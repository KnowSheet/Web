/*global window*/
'use strict';

var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var URL = require('url');

var queryStringUtil = require('./query-string-util');

var PersistentConnection = require('./persistent-connection');
var JsonPerLineParser = require('./json-per-line-parser');

var Dashboard = require('./dashboard');
var DashboardDataStore = require('./dashboard-data-store');
var DashboardLayoutStore = require('./dashboard-layout-store');

require('./index.less');


var logger = require('./logger');

var logPrefix = '[frontend] ';


logger.log(logPrefix + 'Loaded at ' + (new Date()));


function init() {
	var dispatcher = new EventEmitter();
	
	var config = null;
	var dataHostnamesRoundRobin = 0;
	
	var backendApi = {
		/**
		 * Loads the config from the backend, then loads the layout.
		 * The config includes "layout_url" which is the base for other URLs.
		 * The config includes "data_hostnames" which is an array of hostnames 
		 * that resolve to the backend to fool the browser's domain connection limit.
		 */
		loadConfig: function () {
			// Load the config from the backend.
			// The backend should guarantee `pathname` to have a trailing slash.
			var baseUrl = window.location.pathname;
			var configUrl = baseUrl + 'config.json';
			
			$.ajax({
				url: configUrl,
				dataType: 'json'
			}).then(function (response) {
				config = _.extend({
					layout_url: null,
					data_hostnames: []
				}, response && response.config);
				
				if (!config.layout_url) {
					logger.error(logPrefix + 'Empty "layout_url" in config from ' + configUrl + ':', config);
					window.alert('Got invalid config from ' + configUrl + '.');
					return;
				}
				
				backendApi.loadLayout();
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load config from ' + configUrl + ':', jqXHR);
				window.alert('An error occurred while loading config from ' + configUrl + '.');
			});
		},
		
		/**
		 * Loads the layout via the URL from the config.
		 */
		loadLayout: function () {
			var layoutUrl = config.layout_url;
			
			$.ajax({
				url: layoutUrl,
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
				window.alert('An error occurred while loading layout from ' + layoutUrl + '.');
			});
		},
		
		/**
		 * Loads the metadata for a single layout cell.
		 */
		loadMeta: function (metaUrl) {
			var metaUrlFull = config.layout_url + metaUrl;
			
			$.ajax({
				url: metaUrlFull,
				dataType: 'json'
			}).then(function (response) {
				var meta = response.meta;
				
				if (meta) {
					logger.log(logPrefix + 'Loaded meta from ' + metaUrlFull + ':', meta);
					
					dispatcher.emit('receive-meta', {
						metaUrl: metaUrl,
						meta: meta
					});
				}
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load meta from ' + metaUrlFull + ':', jqXHR);
				window.alert('An error occurred while loading meta from ' + metaUrlFull + '.');
			});
		},
		
		/**
		 * Connects to the data stream with a persistent connection
		 * and triggers updates when new data arrives.
		 * Uses "dataHostnames" to find the hostname to connect to.
		 */
		streamData: function (dataUrl, timeInterval) {
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
				if (data && typeof data.x === 'number') {
					// Advance the time that will go in the next request
					// to the latest data sample time.
					// HACK: Add a small number to avoid last point duplicate.
					queryParams.since = data.x + 1e-3;
					persistentConnection.setUrl(
						queryStringUtil.extend(
							persistentConnection.getUrl(),
							queryParams
						)
					);
					
					// Notify that the data has been received:
					dispatcher.emit('receive-data', {
						dataUrl: dataUrl,
						data: [ data ]
					});
				}
			});
			jsonPerLineParser.on('error', reconnectOnError);
			
			var dataUrlFull = config.layout_url + dataUrl;
			
			// Use the next hostname from the config, if available.
			var dataUrlParsed = URL.parse(dataUrlFull);
			var dataHostnames = config.data_hostnames;
			if (
				dataHostnames && dataHostnames.length > 0
				&& (dataUrlParsed.hostname === 'localhost' || (
					!dataUrlParsed.hostname
					&& window.location.hostname === 'localhost'
				))
			) {
				dataUrlParsed.protocol = dataUrlParsed.protocol || window.location.protocol;
				dataUrlParsed.hostname = dataHostnames[dataHostnamesRoundRobin];
				dataUrlParsed.port = dataUrlParsed.port || window.location.port;
				dataHostnamesRoundRobin++;
				if (dataHostnamesRoundRobin >= dataHostnames.length) {
					dataHostnamesRoundRobin = 0;
				}
				dataUrlFull = URL.format(dataUrlParsed);
			}
			
			persistentConnection.connect(dataUrlFull, queryParams);
			
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
	
	logger.log(logPrefix + 'Initialized at ' + (new Date()));
	
	backendApi.loadConfig();
}

$(global).on('load', init);
