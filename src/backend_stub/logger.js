var winston = require('winston');

var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			colorize: true,
			timestamp: true,
			label: 'backend_stub'
		})
	]
});

module.exports = logger;
