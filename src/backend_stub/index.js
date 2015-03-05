'use strict';

var _ = require('underscore');
var inherits = require('inherits');
var path = require('path');
var http = require('http');
var express = require('express');
var cors = require('cors');
var serveStatic = require('serve-static');

var logger = require('./logger');


module.exports = {
	start: function (config) {
		// Normalize the `baseUrl` to have both leading and trailing slashes.
		config.baseUrl = config.baseUrl.replace(/\/+$/, '') + '/';
		config.baseUrl = '/' + config.baseUrl.replace(/^\/+/, '');
		
		var logic = require('./logic')(config);
		
		var app = express(http.createServer());
		var appServer;
		
		app.use(config.baseUrl + 'static', serveStatic(config.staticPath));
		
		app.get(config.baseUrl, function (req, res) {
			if (!/\/$/.test(req.path)) {
				// Redirect from a URL without a trailing slash to the URL with it.
				// This guarantees that the relative URLs in HTML are resolved correctly.
				res.redirect(config.baseUrl);
				return;
			}
			
			res.sendFile('index.html', {
				root: config.staticPath
			});
		});
		
		/* DEBUG: For testing connection outage. */
		// Maintain a hash of all connected sockets:
		var sockets = {}, nextSocketId = 0;
		var appServerRestarting = false;
		app.get(config.baseUrl + '_restart', cors(), function (req, res) {
			res.setHeader('Content-Type', 'text/plain; charset=utf-8');
			
			if (appServerRestarting) {
				res.write('Sir, I\'m already restarting...\n');
				res.end();
				return;
			}
			
			res.write('Sir, yes, sir!\n');
			res.end();
			
			logger.info('Server restart requested.');
			process.nextTick(function () {
				if (appServer) {
					appServerRestarting = true;
					
					// Stop the server (waits for all sockets to close).
					appServer.close(function () {
						var restartInterval = 5000;
						
						logger.info('Server will restart in ' +
							restartInterval + 'ms.');
						
						setTimeout(function () {
							logger.info('Server restarting...');
							appStart();
						}, restartInterval);
					});
					
					appServer = null;
					
					// Destroy all open sockets:
					for (var socketId in sockets) {
						sockets[socketId].destroy();
					}
				}
			});
		});
		// DEBUG */
		
		// Provide the frontend config from the backend.
		app.get(config.baseUrl + 'config', cors(), function (req, res) {
			// Read the dashboard template from the file.
			// TODO(sompylasar): Build templates from HTML and LESS instead of the single HTML+CSS file.
			// TODO(sompylasar): Personalized templates (?).
			var dashboardTemplateHtml = require('fs').readFileSync(__dirname + '/../templates/knowsheet-demo.html', {
				encoding: 'utf8'
			});
			
			// Compose the frontend configuration object.
			var frontendConfig = {
				layout_url: config.baseUrl + 'layout',
				data_hostnames: config.dataHostnames,
				dashboard_template: dashboardTemplateHtml
			};
			
			// Respond with the configuration.
			var responseJson = {
				config: frontendConfig
			};
			logger.info('Config requested. Response: ' + JSON.stringify(responseJson));
			res.json(responseJson);
		});
		
		app.get(config.baseUrl + 'layout', cors(), function (req, res) {
			var responseJson = {
				layout: logic.getLayout()
			};
			logger.info('Layout requested. Response: ' + JSON.stringify(responseJson));
			res.json(responseJson);
		});
		
		app.get(config.baseUrl + 'layout/meta', cors(), function (req, res) {
			var responseJson = {
				meta: logic.getMeta(req.query)
			};
			logger.info('Meta ' + JSON.stringify(req.query) + ' requested. Response: ' + JSON.stringify(responseJson));
			res.json(responseJson);
		});
		
		var nextStreamIndex = 0;
		
		app.get(config.baseUrl + 'layout/data', cors(), function (req, res) {
			++nextStreamIndex;
			
			var streamLogPrefix = '';
			streamLogPrefix += JSON.stringify(req.query) + ' ';
			streamLogPrefix += '(' + nextStreamIndex + ') ';
			
			var stream;
			
			
			logger.info(streamLogPrefix + 'Client connected.');
			
			
			req.on('close', function () {
				logger.info(streamLogPrefix + 'Client disconnected unexpectedly.');
				if (stream) {
					stream.stop();
					stream = null;
				}
			});
			
			req.on('end', function () {
				logger.info(streamLogPrefix + 'Client disconnected.');
				if (stream) {
					stream.stop();
					stream = null;
				}
			});
			
			
			// This will build the HTTP response to send back headers:
			res.writeHead(200, {
				'Connection': 'keep-alive',
				'Content-Type': 'application/json; charset=utf-8',
				'Transfer-Encoding': 'chunked'
			});
			// HACK: Write the headers without buffering.
			// @see http://michaelheap.com/force-flush-headers-using-the-http-module-for-nodejs/
			// Write the headers directly to the socket:
			res.socket.write(res._header);
			// Mark the headers as sent:
			res._headerSent = true;
			
			logger.info(streamLogPrefix + 'Headers sent.');
			
			
			stream = logic.streamData(req.query, function (data) {
				logger.info(streamLogPrefix + 'Sending a sample: ' + JSON.stringify(data));
				
				writeJson(data);
			}, {
				logPrefix: streamLogPrefix
			});
			
			
			function escapeStringForLogging(data) {
				// HACK: Quick & dirty way to escape special chars:
				return (
					JSON.stringify(String(data))
						.replace(/^"|"$/g, '')
						.replace(/\\"/g, '"')
				);
			}
			
			function writeChunk(chunkString) {
				//logger.info(streamLogPrefix + 'Writing chunk: ' +
				//	escapeStringForLogging(chunkString));
				
				// If `Transfer-Encoding: chunked` header is set, 
				// the `http` module sends the `write`s in chunks automagically.
				// @see https://github.com/joyent/node/blob/v0.11.16/lib/_http_outgoing.js#L315
				// @see https://github.com/joyent/node/blob/v0.11.16/lib/_http_outgoing.js#L442
				res.write(chunkString);
			}
			
			function writeJson(payload) {
				// Serialize the payload, add the payload separator.
				var payloadString = JSON.stringify(payload) + "\n";
				
				//logger.info(streamLogPrefix + 'Splitting payload: ' +
				//	escapeStringForLogging(payloadString));
				
				// Split into chunks of random length.
				var splitStart = 0;
				var splitEnd = 0;
				
				while (splitStart < payloadString.length) {
					splitEnd = (
						splitStart +
						Math.ceil(Math.random() * (payloadString.length - splitStart))
					);
					
					writeChunk(payloadString.substring(splitStart, splitEnd));
					
					splitStart = splitEnd;
				}
			}
		});
		
		function appStart() {
			appServer = app.listen(config.httpPort);
			
			appServer.on('listening', function () {
				appServerRestarting = false;
				logger.info('Server listening at port ' + config.httpPort);
			});
			appServer.on('close', function () {
				logger.info('Server stopped.');
			});
			
			/* DEBUG: For testing connection outage. */
			appServer.on('connection', function (socket) {
				// Add a newly connected socket:
				var socketId = nextSocketId++;
				sockets[socketId] = socket;
				// Remove the socket when it closes:
				socket.on('close', function () {
					delete sockets[socketId];
				});
			});
			// DEBUG */
		}
		
		appStart();
	}
};

if (!module.parent) {
	module.exports.start(require('./config'));
}
