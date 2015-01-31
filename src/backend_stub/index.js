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
		var logic = require('./logic')(config);
		
		var app = express(http.createServer());
		var appServer;
		
		/* DEBUG: For testing connection outage. */
		// Maintain a hash of all connected sockets:
		var sockets = {}, nextSocketId = 0;
		var appServerRestarting = false;
		app.get('/_restart', cors(), function (req, res) {
			res.setHeader('Content-Type', 'text/plain; charset=utf-8');
			
			if (appServerRestarting) {
				res.write('Sir, I\'m already restarting...\n');
				res.end();
				return;
			}
			
			res.write('Sir, yes, sir!\n');
			res.end();
			
			logger.info('HTTP server restart requested.');
			process.nextTick(function () {
				if (appServer) {
					appServerRestarting = true;
					
					// Stop the server (waits for all sockets to close).
					appServer.close(function () {
						var restartInterval = 5000;
						
						logger.info('HTTP server will restart in ' +
							restartInterval + 'ms.');
						
						setTimeout(function () {
							logger.info('HTTP server restarting...');
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
		
		app.get('/layout', cors(), function (req, res) {
			res.json(logic.getLayout(req.query));
		});
		
		app.get('/meta', cors(), function (req, res) {
			res.json(logic.getMeta(req.query));
		});
		
		var nextStreamIndex = 0;
		
		app.get('/data', cors(), function (req, res) {
			++nextStreamIndex;
			
			var streamLogPrefix = '';
			streamLogPrefix += '[' + req.query.series_id + ';' + req.query.since + '] ';
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
				logger.info(streamLogPrefix + 'Sending a sample.');
				
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
				logger.info(streamLogPrefix + 'Writing chunk: ' +
					escapeStringForLogging(chunkString));
				
				// If `Transfer-Encoding: chunked` header is set, 
				// the `http` module sends the `write`s in chunks automagically.
				// @see https://github.com/joyent/node/blob/v0.11.16/lib/_http_outgoing.js#L315
				// @see https://github.com/joyent/node/blob/v0.11.16/lib/_http_outgoing.js#L442
				res.write(chunkString);
			}
			
			function writeJson(payload) {
				// Serialize the payload, add the payload separator.
				var payloadString = JSON.stringify(payload) + "\n";
				
				logger.info(streamLogPrefix + 'Splitting payload: ' +
					escapeStringForLogging(payloadString));
				
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
				logger.info('HTTP server listening at ' +
					'http://localhost:' + config.httpPort
				);
			});
			appServer.on('close', function () {
				logger.info('HTTP server stopped.');
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
		
		var staticServer = express(http.createServer())
			.use(serveStatic(config.staticPath))
			.listen(config.staticPort);
		
		staticServer.on('listening', function () {
			logger.info('Static files server listening at ' +
				'http://localhost:' + config.staticPort
			);
		});
	}
};

if (!module.parent) {
	module.exports.start(require('./config'));
}
