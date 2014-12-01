var Channel = require('./channel');
var Dashboard = require('./dashboard');
var console = global.console;

console.log('App loaded ' + (new Date()));


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
	})
	.on('sent', function (channel, message) {
		console.info('Channel sent message:', message);
	})
	.on('message', function (channel, message) {
		console.info('Channel received message:', message);
		
		if (message.action === 'data') {
			dashboard.accept(message.data);
		}
	})
	.on('transport-error', function (channel, error) {
		console.error('Channel error occurred:', error);
	})
	.on('reconnect-scheduled', function (channel) {
		console.log('Channel will reconnect in ' + channel.reconnectDelay + 'ms.');
	})
	.on('reconnecting', function (channel) {
		console.log('Channel is reconnecting to "' + channel.url + '"...');
	});

channel.open();
