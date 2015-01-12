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
		var appServerStopping = false;
		app.get('/_restart', cors(), function (req, res) {
			res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
			
			if (appServerStopping) {
				res.write('Sir, I\'m already restarting...\n');
				res.end();
				return;
			}
			
			res.write('Sir, yes, sir!\n');
			res.end();
			
			appServerStopping = true;
			logger.info('HTTP server restart requested.');
			process.nextTick(function () {
				if (appServer) {
					appServer.close(function () {
						logger.info('HTTP server stopped.');
						appServerStopping = false;
						
						var restartInterval = 5000;
						logger.info('HTTP server will restart in ' + restartInterval + 'ms.');
						setTimeout(function () {
							logger.info('HTTP server restarting...');
							appStart();
						}, restartInterval);
					});
					appServer = null;
					
					// Destroy all open sockets
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
			
			var streamLogPrefix = '[' + req.query.series_id + ';' + req.query.since + '] (' + nextStreamIndex + ') ';
			var stream;
			
			logger.info(streamLogPrefix + 'Client connected.');
			
			res.setHeader('Content-Type', 'application/json; charset=UTF-8');
			res.setHeader('Transfer-Encoding', 'chunked');
			
			// Write some data to flush the headers:
			writeJson({});
			
			logger.info(streamLogPrefix + 'Headers sent.');
			
			req.on("close", function () {
				logger.info(streamLogPrefix + 'Client disconnected unexpectedly.');
				if (stream) {
					stream.stop();
					stream = null;
				}
			});
			
			req.on("end", function () {
				logger.info(streamLogPrefix + 'Client disconnected.');
				if (stream) {
					stream.stop();
					stream = null;
				}
			});
			
			stream = logic.streamData(req.query, function (chunk) {
				logger.info(streamLogPrefix + 'Sending ' + chunk.value0.data.length + ' samples.');
				
				writeJson(chunk);
			}, {
				logPrefix: streamLogPrefix
			});
			
			function escapeStringForLogging(data) {
				// HACK: Quick & dirty way to escape special chars:
				return JSON.stringify(String(data)).replace(/^"|"$/g, '').replace(/\\"/g, '"');
			}
			
			function writeChunk(chunkString) {
				logger.info(streamLogPrefix + 'Writing chunk: ' + escapeStringForLogging(chunkString));
				
				// Conforms to the `Transfer-Encoding: chunked` specs: chunk length in hex, CRLF, chunk body, CRLF.
				res.write(chunkString.length.toString(16) + "\r\n" + chunkString + "\r\n");
			}
			
			function writeJson(payload) {
				// Serialize the payload, add the payload separator.
				var payloadString = JSON.stringify(payload) + "\n";
				
				logger.info(streamLogPrefix + 'Splitting payload: ' + escapeStringForLogging(payloadString));
				
				// Split into chunks of random length.
				var splitStart = 0;
				var splitEnd = 0;
				
				while (splitStart < payloadString.length) {
					splitEnd = splitStart + Math.ceil(Math.random() * (payloadString.length - splitStart));
					
					writeChunk(payloadString.substring(splitStart, splitEnd));
					
					splitStart = splitEnd;
				}
			}
		});
		
		function appStart() {
			appServer = app.listen(config.httpPort);
			logger.info('HTTP server listening at http://localhost:' + config.httpPort);
		
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
		
		express(http.createServer()).use(serveStatic(config.staticPath)).listen(config.staticPort);
		logger.info('Static files server listening at http://localhost:' + config.staticPort);
	}
};

if (!module.parent) {
	module.exports.start(require('./config'));
}
