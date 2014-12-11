var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');

var Channel = require('./channel');
var Dashboard = require('./dashboard');
var DashboardDataStore = require('./dashboard-data-store');
var DashboardLayoutStore = require('./dashboard-layout-store');
var config = require('./config');

require('./index.less');

var console = global.console;
var setTimeout = global.setTimeout;

var logPrefix = '[frontend] ';


console.log(logPrefix + 'Loaded at ' + (new Date()));


function init() {
	var dispatcher = new EventEmitter();
	
	var dashboardDataStore = new DashboardDataStore(dispatcher);
	
	var dashboardLayoutStore = new DashboardLayoutStore(dispatcher);
	
	var dashboard = new Dashboard({
		getDataStore: function () { return dashboardDataStore; },
		getLayoutStore: function () { return dashboardLayoutStore; }
	}, {
	});
	
	dashboard.mount( $('body').addClass('knsh-root') );
	
	var channel = new Channel({
		url: config.backend.wsUrl
	})
		.on('connecting', function (channel) {
			console.log(logPrefix + 'Channel is connecting to "' + channel.url + '"...');
		})
		.on('connected', function (channel) {
			console.log(logPrefix + 'Channel has connected to "' + channel.url + '".');
			
			channel.send({
				action: 'hello'
			});
		})
		.on('disconnected', function (channel) {
			console.log(logPrefix + 'Channel has disconnected from "' + channel.url + '".');
			
			// TODO: Handle loss of periodic updates (when disconnected for a moment). Currently the chart does not look pretty in this case.
		})
		.on('sent', function (channel, message) {
			console.info(logPrefix + 'Channel sent a message:', message);
		})
		.on('message', function (channel, message) {
			console.info(logPrefix + 'Channel received a message:', message);
			
			switch (message.action) {
				case 'update':
					dispatcher.emit('receive-data-updates', message.payload);
					break;
			}
		})
		.on('error', function (channel, error) {
			console.error(logPrefix + 'Channel got an error:', error);
		})
		.on('reconnect-scheduled', function (channel) {
			console.log(logPrefix + 'Channel will reconnect in ' + channel.reconnectDelay + 'ms.');
		})
		.on('reconnecting', function (channel) {
			console.log(logPrefix + 'Channel is reconnecting to "' + channel.url + '"...');
		});
	
	
	var layoutLoading = false;
	function loadLayout() {
		var _this = this;
		
		if (layoutLoading) { return; }
		
		layoutLoading = true;
		
		// TODO: Add a message/spinner that the new layout is loading.
		
		var deferred = $.Deferred();
		
		deferred
			.then(function (layout) {
				layoutLoading = false;
				
				dispatcher.emit('receive-layout', layout);
			}, function (error) {
				layoutLoading = false;
				
				console.error(logPrefix + 'Layout loading error:', error);
				
				if (global.confirm('An error occurred while loading the layout. Try again?')) {
					loadLayout();
				}
			});
		
		// Simulate loading the layout from the backend asynchronously:
		setTimeout(function () {
			
			// TODO: Request the layout from the backend.
			var layout = {
				col: [
					{
						row: [
							{
								cell: {
									visualizer: {
										name: 'plot-visualizer',
										options: {
											headerText: 'value0',
											seriesId: 'value0',
											color: 'blue'
										}
									}
								}
							}
						]
					},
					{
						row: [
							{
								cell: {
									visualizer: {
										name: 'plot-visualizer',
										options: {
											headerText: 'CPU Load',
											seriesId: 'cpu',
											color: 'purple',
											min: 0.0,
											max: 1.0,
											timeInterval: 10 * 1000
										}
									}
								}
							},
							{
								cell: {
									visualizer: {
										name: 'plot-visualizer',
										options: {
											headerText: 'Memory Footprint',
											seriesId: 'memory',
											min: 0.0,
											max: 1.0,
											timeInterval: 10 * 1000
										}
									}
								}
							}
						]
					},
					{
						row: [
							{
								cell: {
									visualizer: {
										name: 'plot-visualizer',
										options: {
											headerText: 'CPU Load copy',
											seriesId: 'cpu',
											color: 'red',
											min: 0.0,
											max: 1.0,
											timeInterval: 20 * 1000
										}
									}
								}
							}
						]
					}
				]
			};
			
			deferred.resolve(layout);
			
		}, 2000);
		
		return deferred.promise();
	}
	
	function loadMeta() {
		var url = config.backend.httpUrl + '/meta';
		
		$.ajax({
			url: url,
			dataType: 'json'
		}).then(function (response) {
			var meta = response;
			
			if (meta) {
				//console.log('Received meta:', meta);
				
				for (var seriesId in meta) { if (meta.hasOwnProperty(seriesId)) {
					loadData(seriesId, meta[seriesId]);	
				} }
			}
		}, function (jqXHR) {
			console.error(logPrefix + 'Meta loading error:', url, jqXHR);
			
			global.alert('An error occurred while loading meta from ' + url + '.');
		});
	}
	
	function loadData(seriesId, meta) {
		var url = meta.data_url;
		
		$.ajax({
			url: url,
			dataType: 'json'
		}).then(function (response) {
			var data = (response && response[seriesId] && response[seriesId].data);
			
			if (data && data.length > 0) {
				//console.log('Received data:', data);
				
				var updates = {};
				
				updates[seriesId] = {
					data: data,
					replace: true
				};
				
				dispatcher.emit('receive-data-updates', updates);
			}
		}, function (jqXHR) {
			console.error(logPrefix + 'Data loading error:', url, jqXHR);
			
			global.alert('An error occurred while loading data from ' + url + '.');
		});
	}
	
	
	$(global).on('resize orientationchange', _.throttle(function () {
		dispatcher.emit('resize-window');
	}, 50));
	
	
	loadLayout();
	
	loadMeta();
	
	channel.open();
	
	console.log(logPrefix + 'Initialized at ' + (new Date()));
}

$(global).on('load', init);
