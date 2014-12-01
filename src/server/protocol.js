var usage = require('usage');

var logger = require('./logger');

var subscribers = [];

function lookup(next) {
	usage.lookup(process.pid, function (err, result) {
		logger.info('usage lookup finished: %j', { error: err, result: result }, {});
		
		if (err) {
			return next();
		}
		
		subscribers.forEach(function (channel) {
			channel.send({
				action: 'usage',
				data: {
					cpu: result.cpu,
					memory: result.memory
				}
			});
		});
		next();
	});
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
	lookupDelayed();
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
