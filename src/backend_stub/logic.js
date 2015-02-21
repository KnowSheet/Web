'use strict';

var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');

var logger = require('./logger');


/**
 * Stores data points and filters them.
 * Emits `'data'` events when new data is added to the stream.
 */
function DataStream() {
	var _this = this;
	
	_this._data = [];
}
inherits(DataStream, EventEmitter);
_.extend(DataStream.prototype, {
	/**
	 * @param {number} since The value of `x` to get the data since.
	 */
	getDataSince: function (since) {
		var _this = this,
			filteredData = [],
			storedData = _this._data,
			ic = storedData.length,
			i = ic-1;
		
		while (i >= 0) {
			if (storedData[i].x >= since) {
				filteredData.unshift(storedData[i]);
			}
		
			--i;
		}
		
		return filteredData;
	},
	addData: function (updateData) {
		var _this = this,
			storedData = _this._data;
		
		if (storedData && updateData && updateData.length) {
			storedData.push.apply(storedData, updateData);
		}
		
		_this.emit('data');
	}
});


/**
 * A wrapper around `setTimeout` that adds `start`/`stop` and preserves the callback.
 * 
 * @param {number} interval An interval to wait between for the next call.
 * @param {function(next:function)} A callback that is called periodically. Takes `next` for asynchrony.
 */
function Timer(interval, actionFn) {
	var _this = this;
	
	_this._started = false;
	_this._timer = null;
	
	_this._wait = function () {
		clearTimeout(_this._timer);
		_this._timer = setTimeout(function () {
			_this._continue();
		}, interval);
	};
	
	_this._continue = function () {
		if (_this._started) {
			actionFn(function () {
				_this._wait();
			});
		}
	};
}
_.extend(Timer.prototype, {
	start: function () {
		var _this = this;
		
		_this._started = true;
		_this._continue();
	},
	stop: function () {
		var _this = this;
		
		_this._started = false;
		clearTimeout(_this._timer);
	}
});


/**
 * Periodically writes to the given data stream.
 *
 * @param {DataStream} dataStream A data stream to write to.
 * @param {number} interval An interval to repeat writes.
 * @param {function(callbackFn:function(x:number,y:number))} collectFn A callback to collect the data to write.
 */
function Writer(dataStream, interval, collectFn) {
	var _this = this;
	
	_this._since = Date.now();
	
	_this._timer = new Timer(interval, function (next) {
		var updateData = [];
		
		collectFn(function (x, y) {
			updateData.push({
				x: x,
				y: y
			});
		});
		
		dataStream.addData(updateData);
		
		next();
	});
}
_.extend(Writer.prototype, {
	start: function () { this._timer.start(); },
	stop: function () { this._timer.stop(); }
});


/**
 * Sequentially reads from the given data stream.
 *
 * @param {DataStream} dataStream A data stream to read from
 */
function Reader(dataStream) {
	var _this = this;
	
	_this._dataStream = dataStream;
}
inherits(Reader, EventEmitter);
_.extend(Reader.prototype, {
	/**
	 * @param {number} since The value of `x` to get the data since.
	 */
	start: function (since) {
		var _this = this;
		
		if (_this._dataHandler) {
			_this.stop();
		}
		
		_this._since = since;
		
		_this._dataHandler = function () {
			var dataSince = _this._dataStream.getDataSince(_this._since);
			
			if (dataSince.length > 0) {
				// HACK: Add a small number to avoid last point duplicate.
				_this._since = dataSince[dataSince.length - 1].x + 1e-3;
				
				_this.emit('data', dataSince);
			}
		};
		
		_this._dataHandler();
		
		_this._dataStream.on('data', _this._dataHandler);
	},
	stop: function () {
		var _this = this;
		
		if (!_this._dataHandler) { return; }
		
		_this._dataStream.removeListener('data', _this._dataHandler);
		_this._dataHandler = null;
	}
});


var _dataStreams = {};

_dataStreams['cpu'] = new DataStream();
new Writer(_dataStreams['cpu'], 1000, function (callbackFn) {
	var now = Date.now();
	callbackFn(now, Math.abs(Math.sin(now)) * Math.random());
}).start();

_dataStreams['memory'] = new DataStream();
new Writer(_dataStreams['memory'], 1000, function (callbackFn) {
	var now = Date.now();
	callbackFn(now, Math.abs(Math.cos(now)) * Math.random());
}).start();


var TEST_DATA_STREAMS_COUNT = 10;

(function () {
	for (var ic = TEST_DATA_STREAMS_COUNT, i = 0; i < ic; ++i) {
		_dataStreams['data' + i] = new DataStream();
		new Writer(_dataStreams['data' + i], (i + 1) * 1000, function (callbackFn) {
			var now = Date.now();
			callbackFn(now, Math.abs(0.6 * Math.cos(now) + 0.4 * Math.random()));
		}).start();
	}
}());


_dataStreams['lorempixel'] = new DataStream();
new Writer(_dataStreams['lorempixel'], 10000, function (callbackFn) {
	var now = Date.now();
	var categories = [
		'abstract',
		'animals',
		'business',
		'cats',
		'city',
		'food',
		'nightlife',
		'fashion',
		'people',
		'nature',
		'sports',
		'technics',
		'transport'
	];
	var category = categories[now % categories.length];
	var index = (now % 10);
	callbackFn(now, 'http://lorempixel.com/400/200/' + category + '/' + index + '/');
}).start();


/**
 * App-level logic for receiving messages and responding to them.
 */
module.exports = function (config) {
	
	function makeMetaUrl(metaId) {
		// Relative to the layout URL.
		return '/meta?meta_id=' + metaId;
	}
	
	function makeDataUrl(metaId, seriesId) {
		// Relative to the layout URL.
		// WARNING: The frontend assumes unique data URLs, so we include metaId.
		return '/data?meta_id=' + metaId + '&series_id=' + seriesId;
	}
	
	function makeLayoutCell(metaId, options) {
		return {
			cell: {
				css_classes: {
					'knsh-theme-popout': options && options.isPopout,
					'knsh-theme-accented': options && options.isAccented
				},
				meta_url: makeMetaUrl(metaId)
			}
		};
	}
	
	var meta = {
		"1": {
			data_url: makeDataUrl('1', 'cpu'),
			visualizer_name: 'plot-visualizer',
			visualizer_options: {
				header_text: 'CPU Load',
				color: 'purple',
				min: 0.0,
				max: 1.0,
				time_interval: 10 * 1000
			}
		},
		"2": {
			data_url: makeDataUrl('2', 'memory'),
			visualizer_name: 'plot-visualizer',
			visualizer_options: {
				header_text: 'Memory Footprint',
				min: 0.0,
				max: 1.0,
				time_interval: 10 * 1000
			}
		},
		"3": {
			data_url: makeDataUrl('3', 'cpu'),
			visualizer_name: 'plot-visualizer',
			visualizer_options: {
				header_text: 'CPU Load copy',
				color: 'red',
				min: 0.0,
				max: 1.0,
				time_interval: 20 * 1000
			}
		},
		"4": {
			data_url: makeDataUrl('4', 'cpu'),
			visualizer_name: 'value-visualizer',
			visualizer_options: {
				header_text: 'CPU Load Value',
				min: 0.0,
				max: 1.0,
				time_interval: 1000
			}
		},
		"lorempixel": {
			data_url: makeDataUrl('lorempixel', 'lorempixel'),
			visualizer_name: 'image-visualizer',
			visualizer_options: {
				header_text: 'Random Images from lorempixel.com',
				empty_text: 'No image.',
				time_interval: 10000
			}
		}
	};
	
	(function () {
		for (var ic = TEST_DATA_STREAMS_COUNT, i = 0; i < ic; ++i) {
			meta['data' + i] = {
				data_url: makeDataUrl('data' + i, 'data' + i),
				visualizer_name: 'plot-visualizer',
				visualizer_options: {
					css_classes: 'knsh-theme-accented',
					header_text: 'Data ' + i,
					color: 'blue',
					min: 0.0,
					max: 1.0,
					time_interval: TEST_DATA_STREAMS_COUNT * 1000
				}
			};
		}
	}());
	
	return {
		getLayout: function () {
			var layout = {
				col: [
					// --- Basic layout ---
					{
						css_classes: 'knsh-theme-accented',
						row: [
							makeLayoutCell('1'),
							makeLayoutCell('2'),
							makeLayoutCell('4'),
							makeLayoutCell('lorempixel')
						]
					},
					makeLayoutCell('3'),
					
					// --- Performance ---
					// The same data stream:
					{
						row: [
							makeLayoutCell('data0', {
								isPopout: true
							}),
							makeLayoutCell('data0', {
								isPopout: true
							}),
							makeLayoutCell('data0', {
								isPopout: true
							}),
							makeLayoutCell('data0', {
								isPopout: true
							}),
							makeLayoutCell('data0', {
								isPopout: true
							})
						]
					},
					
					// Different data streams:
					{
						row: [
							makeLayoutCell('data0', {
								isPopout: true,
								isAccented: true
							}),
							makeLayoutCell('data1'),
							makeLayoutCell('data2'),
							makeLayoutCell('data3'),
							makeLayoutCell('data4'),
							makeLayoutCell('data5'),
							makeLayoutCell('data6')
						]
					}
				]
			};
			
			return layout;
		},
		
		getMeta: function (params) {
			var metaId = params.meta_id;
			
			return meta[metaId];
		},
		
		streamData: function (params, writeFn, options) {
			var seriesId = params.series_id;
			var since = params.since;
			
			var dataStream = _dataStreams[seriesId];
			if (!dataStream) {
				throw new Error('Stream ' + seriesId + ' not found.');
			}
			
			// Assume all streams are time-based:
			since = since || Date.now();
			
			var streamLogPrefix = (options && options.logPrefix ? options.logPrefix : '[' + seriesId + ';' + since + '] ');
			
			logger.info(streamLogPrefix + 'Requested stream since ' + since + '.');
			
			var reader = new Reader(dataStream);
			
			reader.on('data', function (data) {
				logger.info(streamLogPrefix + 'Reading ' + data.length + ' samples.');
				
				// Send one top-level JSON object per data sample:
				for (var ic = data.length, i = 0; i < ic; ++i) {
					writeFn(data[i]);
				}
			});
			
			reader.start(since);
			
			return {
				stop: function () {
					reader.stop();
				}
			};
		}
	};
};
