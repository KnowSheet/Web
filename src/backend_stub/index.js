var _ = require('underscore');
var inherits = require('inherits');
var path = require('path');
var http = require('http');
var express = require('express');
var serveStatic = require('serve-static');

var ChannelServer = require('./channel-server');
var logger = require('./logger');

module.exports = {
	start: function (config) {
		var channelServer = new ChannelServer({
			logic: require('./logic')
		});
		channelServer.listen(config.wsPort);
		logger.info('WebSocket server listening at ws://localhost:' + config.wsPort);
		
		var httpServer = http.createServer();
		var app = express(httpServer);
		app.use(serveStatic(config.staticPath));
		app.listen(config.httpPort);
		logger.info('App server listening at http://localhost:' + config.appPort);
	}
};
