var usage = require('usage');
var osUtils = require('os-utils');

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
	
	/**
	osUtils.cpuUsage(function (cpuUsage) {
		var memory = osUtils.freememPercentage();
		
		sendUpdates({
			cpu: {
				data: [ cpuUsage ],
			},
			memory: {
				data: [ memory ]
			}
		});
		
		next();
	});
	// */
	
	/**/
	usage.lookup(process.pid, function (err, result) {
		//logger.info('usage lookup finished: %j', { error: err, result: result }, {});
		
		if (err) {
			return next();
		}
		
		sendUpdates({
			cpu: {
				data: [ result.cpu / 100 ],
			},
			memory: {
				data: [ osUtils.freemem() / osUtils.totalmem() ]
			}
		});
		next();
	});
	// */
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
 * Provides a random periodical CPU load.
 */
function doSomeCalculations() {
	var i = 20000,
		results = [];
	
	while (i-- > 0) {
		var value = String(Math.tan(Math.random()));
		results.unshift(value);
	}
	
	setTimeout(doSomeCalculations, 2000 + Math.random() * 1000);
}
setTimeout(doSomeCalculations, 500);


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
