'use strict';

var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');

var Dashboard = require('./dashboard');
var DashboardDataStore = require('./dashboard-data-store');
var DashboardLayoutStore = require('./dashboard-layout-store');
var config = require('./config');

require('./index.less');

var console = global.console;
var setTimeout = global.setTimeout;
var clearTimeout = global.clearTimeout;
var XMLHttpRequest = global.XMLHttpRequest;

var logPrefix = '[frontend] ';


console.log(logPrefix + 'Loaded at ' + (new Date()));


function init() {
	var dispatcher = new EventEmitter();
	
	var backendApi = {
		loadLayout: function (layoutUrl) {
			$.ajax({
				url: layoutUrl,
				dataType: 'json'
			}).then(function (response) {
				var layout = response.value0;
			
				if (layout) {
					console.log(logPrefix + 'Loaded layout from ' + layoutUrl + ':', layout);
				
					dispatcher.emit('receive-layout', {
						layoutUrl: layoutUrl,
						layout: layout
					});
				}
			}, function (jqXHR) {
				console.error(logPrefix + 'Failed to load layout from ' + layoutUrl + ':', jqXHR);
				
				global.alert('An error occurred while loading meta from ' + layoutUrl + '.');
			});
		},
		
		loadMeta: function (metaUrl) {
			$.ajax({
				url: metaUrl,
				dataType: 'json'
			}).then(function (response) {
				var meta = response.value0;
				
				if (meta) {
					console.log(logPrefix + 'Loaded meta from ' + metaUrl + ':', meta);
					
					dispatcher.emit('receive-meta', {
						metaUrl: metaUrl,
						meta: meta
					});
				}
			}, function (jqXHR) {
				console.error(logPrefix + 'Failed to load meta from ' + metaUrl + ':', jqXHR);
				
				global.alert('An error occurred while loading meta from ' + metaUrl + '.');
			});
		},
		
		streamData: function (dataUrl, timeInterval) {
			var xhr;
			var connected = false;
			var stopping = false;
			
			var reconnectTimer;
			var reconnectDelay = 2000;
			var reconnectDelayCoeff = 1.1;
			
			var since = ((new Date()).getTime() - (typeof timeInterval !== 'number' ? 0 : timeInterval));
			
			function onChunk(chunk) {
				console.log(logPrefix + ' [' + dataUrl + '] Got chunk:', chunk);
				
				var chunkParsed = null;
				
				try {
					chunkParsed = JSON.parse(chunk);
				}
				catch (ex) {
					console.error(logPrefix + ' [' + dataUrl + '] Error parsing chunk:', chunk, ex);
				}
				
				var data = (chunkParsed && chunkParsed.value0 && chunkParsed.value0.data);
				
				if (data && data.length > 0) {
					// Advance the time that will go in the next request to the latest data sample time (add 1 to avoid duplicates):
					since = data[data.length-1].x + 1;
					
					// Notify that the data has been received:
					dispatcher.emit('receive-data', {
						dataUrl: dataUrl,
						data: data
					});
				}
			}
			
			function onEnd() {
				console.log(logPrefix + ' [' + dataUrl + '] Got terminating chunk.');
				
				// Reconnect on stream end:
				reconnect();
				return;
			}
			
			function onError(error) {
				console.error(logPrefix + ' [' + dataUrl + '] ' + error.message);
				
				// Reconnect on transport error:
				reconnect();
			}
			
			function cleanup() {
				clearTimeout(reconnectTimer);
				
				if (xhr) {
					xhr.onload = xhr.onabort = xhr.onerror = xhr.onreadystatechange = null;
					xhr.abort();
					xhr = null;
				}
				
				connected = false;
			}
			
			function reconnect() {
				if (stopping) {
					return;
				}
				
				if (xhr) {
					cleanup();
				}
				
				console.log(logPrefix + ' [' + dataUrl + '] Connecting...');
				
				xhr = new XMLHttpRequest();
				
				xhr.onload = xhr.onabort = xhr.onerror = function () {
					console.log(logPrefix + ' [' + dataUrl + '] Disconnected.');
					
					cleanup();
					
					if (!stopping) {
						console.warn(logPrefix + ' [' + dataUrl + '] Will reconnect in ' + reconnectDelay + 'ms.');
						
						reconnectTimer = setTimeout(reconnect, reconnectDelay);
						reconnectDelay = Math.ceil(reconnectDelayCoeff * reconnectDelay);
					}
				};
				
				// Chunked transfer encoding parser state:
				var chunkParserIndex = 0;
				var chunkParserState = 0;
				var chunkLength = 0;
				
				xhr.onreadystatechange = function () {
					if (stopping) {
						return;
					}
					
					if (xhr.readyState > 2 && xhr.status === 200) {
						if (!connected) {
							connected = true;
							
							reconnectDelay = 2000;
							reconnectDelayCoeff = 1.1;
							
							console.log(logPrefix + ' [' + dataUrl + '] Connected. Receiving...');
						}
						
						// Chunked transfer encoding parser:
						var responseText = xhr.responseText;
						
						var CRLF = "\r\n";
						var token;
						var index;
						
						while ( chunkParserState !== 3 ) {
							if (chunkParserState === 0) {
								index = responseText.indexOf(CRLF, chunkParserIndex);
								if (index < 0) {
									// Wait for CRLF after the chunk length.
									break;
								}
								
								// Read the chunk length:
								token = responseText.substring(chunkParserIndex, index);
								
								// Chunk length is hexadecimal:
								chunkLength = parseInt(token, 16);
								
								// If we cannot parse the length, it's an error:
								if (isNaN(chunkLength) || chunkLength < 0) {
									return onError(new Error('Chunk length parse error: ' + token));
								}
								
								// If the length is zero, it's the terminating chunk:
								if (chunkLength === 0) {
									chunkParserState = 3;
									return onEnd();
								}
								
								// Advance the parser:
								chunkParserIndex = index + CRLF.length;
								chunkParserState = 1;
							}
							else if (chunkParserState === 1) {
								if (responseText.length < chunkParserIndex + chunkLength + CRLF.length) {
									// Wait for CRLF at the end of the chunk body.
									break;
								}
								
								// Try reading the CRLF at the end of the chunk body:
								index = responseText.indexOf(CRLF, chunkParserIndex + chunkLength);
								
								// If CRLF is not there, it's an error.
								if (index !== chunkParserIndex + chunkLength) {
									onError(new Error('Chunk length mismatch.'));
								}
								
								// Read the chunk body:
								token = responseText.substring(chunkParserIndex, index);
								
								// Advance the parser:
								chunkParserIndex = index + CRLF.length;
								chunkParserState = 0;
								
								// Notify of the chunk:
								onChunk(token);
							}
						}
					}
				};
				
				var requestUrl = dataUrl;
				requestUrl += (dataUrl.indexOf('?') < 0 ? '?' : '&');
				requestUrl += 'since=' + since;
				
				xhr.open("GET", requestUrl, true);
				
				xhr.send(null);
			}
			
			reconnect();
			
			return {
				stop: function () {
					stopping = true;
					cleanup();
				}
			};
		}
	};
	
	var dashboardDataStore = new DashboardDataStore(dispatcher, backendApi);
	
	var dashboardLayoutStore = new DashboardLayoutStore(dispatcher, backendApi);
	
	var dashboard = new Dashboard({
		getDataStore: function () { return dashboardDataStore; },
		getLayoutStore: function () { return dashboardLayoutStore; }
	}, {
	});
	
	dashboard.mount( $('body').addClass('knsh-root') );
	
	$(global).on('resize orientationchange', _.throttle(function () {
		dispatcher.emit('resize-window');
	}, 50));
	
	backendApi.loadLayout( config.backend.httpUrl + '/layout' );
	
	console.log(logPrefix + 'Initialized at ' + (new Date()));
}

$(global).on('load', init);
