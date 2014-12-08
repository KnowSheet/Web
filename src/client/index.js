var $ = require('jquery');
var Channel = require('./channel');
var Dashboard = require('./dashboard');
var console = global.console;
var setTimeout = global.setTimeout;

console.log('App loaded ' + (new Date()));


$(global).on('load', function () {

var dashboard = new Dashboard();


// TODO: Maybe build the WebSocket endpoint URL from the same config as on the server-side (?).
var channelUrl = 'ws://localhost:3002';

var channel = new Channel({
	url: channelUrl
})
	.on('connecting', function (channel) {
		console.log('Channel is connecting to "' + channel.url + '"...');
	})
	.on('connected', function (channel) {
		console.log('Channel has connected to "' + channel.url + '".');
		
		channel.send({
			action: 'hello'
		});
	})
	.on('disconnected', function (channel) {
		console.log('Channel has disconnected from "' + channel.url + '".');
		
		// TODO: Handle loss of periodic updates (when disconnected for a moment). Currently the chart does not look pretty in this case.
	})
	.on('sent', function (channel, message) {
		console.info('Channel sent a message:', message);
	})
	.on('message', function (channel, message) {
		console.info('Channel received a message:', message);
		
		switch (message.action) {
			case 'update':
				dashboard.updateCharts(message.payload);
				break;
		}
	})
	.on('error', function (channel, error) {
		console.error('Channel got an error:', error);
	})
	.on('reconnect-scheduled', function (channel) {
		console.log('Channel will reconnect in ' + channel.reconnectDelay + 'ms.');
	})
	.on('reconnecting', function (channel) {
		console.log('Channel is reconnecting to "' + channel.url + '"...');
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
			
			dashboard.updateLayout(layout);
		}, function (error) {
			layoutLoading = false;
			
			console.error(error);
			
			if (global.confirm('An error occurred while loading the layout. Try again?')) {
				loadLayout();
			}
		});
	
	// Simulate loading the layout from the server asynchronously:
	setTimeout(function () {
		
		// TODO: Request the layout from the server-side.
		var layout = {
			col: [
				{
					row: [
						{
							cell: {
								header: {
									text: 'value0'
								},
								chart: {
									seriesId: 'value0',
									color: 'blue'
								}
							}
						}
					]
				},
				{
					row: [
						{
							cell: {
								header: {
									text: 'CPU Load'
								},
								chart: {
									seriesId: 'cpu',
									color: 'purple',
									min: 0.0,
									max: 1.0,
									timeInterval: 10 * 1000
								}
							}
						},
						{
							cell: {
								header: {
									text: 'Memory Footprint'
								},
								chart: {
									seriesId: 'memory',
									min: 0.0,
									max: 1.0,
									timeInterval: 10 * 1000
								}
							}
						}
					]
				},
				{
					row: [
						{
							cell: {
								header: {
									text: 'CPU Load copy'
								},
								chart: {
									seriesId: 'cpu',
									color: 'red',
									min: 0.0,
									max: 1.0,
									timeInterval: 20 * 1000
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
	$.ajax({
		url: 'http://localhost:8080/meta',
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
		console.error(jqXHR);
		
		global.alert('An error occurred while loading meta.');
	});
}

function loadData(seriesId, meta) {
	$.ajax({
		url: meta.data_url,
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
			
			dashboard.updateCharts(updates);
		}
	}, function (jqXHR) {
		console.error(jqXHR);
		
		global.alert('An error occurred while loading data.');
	});
}

loadLayout();

loadMeta();

channel.open();


});
