var logger = require('./logger');

var subscribers = [];

function sendUpdates(payload) {
	subscribers.forEach(function (channel) {
		channel.send({
			action: 'update',
			payload: payload
		});
	});
}

function lookup(next) {
	// Simulate async data retrieval:
	setTimeout(function () {
		var now = Date.now();
		
		// Simulate the data flow with random time-based data:
		sendUpdates({
			cpu: {
				data: [ { x: now, y: Math.abs(Math.sin(now)) * Math.random() } ],
			},
			memory: {
				data: [ { x: now, y: Math.abs(Math.cos(now)) * Math.random() } ]
			}
		});
		
		next();
	}, 10);
}

var timer = null;
var started = false;
function lookupDelayed() {
	clearTimeout(timer);
	timer = setTimeout(function () {
		lookup(function () {
			if (started) { lookupDelayed(); }
		});
	}, 1000);
}

function start() {
	started = true;
	lookup(function () {
		if (started) { lookupDelayed(); }
	});
}
function stop() {
	started = false;
	clearTimeout(timer);
}

/**
 * App-level protocol.
 * Receives messages and responds to them.
 */
module.exports = {
	setup: function (channel) {
	}, 
	receive: function (channel, message) {
		switch (message.action) {
		case 'hello':
			channel.send({
				action: 'welcome'
			});
			
			subscribers.push(channel);
			if (subscribers.length === 1) {
				start();
			}
			break;
		}
	},
	teardown: function (channel) {
		var index = subscribers.indexOf(channel);
		subscribers.splice(index, 1);
		if (subscribers.length === 0) {
			stop();
		}
	}
};
