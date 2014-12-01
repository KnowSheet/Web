var _ = require('underscore');
var inherits = require('inherits');
var path = require('path');
var http = require('http');
var express = require('express');
var serveStatic = require('serve-static');

var ChannelServer = require('./channel-server');
var logger = require('./logger');

module.exports = {
	start: function () {
		var config = require('./config');
		var webpackConfig = require('../../webpack.config.js');
		
		var channelServer = new ChannelServer({
			protocol: require('./protocol')
		});
		channelServer.listen(config.wsPort);
		logger.info('WebSocket server listening at ws://localhost:' + config.wsPort);
		
		var appHttpServer = http.createServer();
		var app = express(appHttpServer);
		app.use(serveStatic(webpackConfig.output.path));
		app.listen(config.appPort);
		logger.info('App server listening at http://localhost:' + config.appPort);
	}
};
