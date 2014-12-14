'use strict';

var _ = require('underscore');
var logger = require('./logger');


function Store() {
	this._data = {};
	this._options = {};
}
Store.prototype.getSeriesIds = function () {
	return Object.keys(this._data);
};
Store.prototype.getData = function (seriesId) {
	return this._data[seriesId];
};
Store.prototype.getDataSince = function (seriesId, since) {
	var _this = this,
		updatesData = [],
		storeData = _this.getData(seriesId),
		ic = storeData.length,
		i = ic-1;
	
	while (i >= 0) {
		if (storeData[i].x >= since) {
			updatesData.unshift(storeData[i]);
		}
		
		--i;
	}
	
	return updatesData;
};
Store.prototype.addSeries = function (seriesId, options) {
	var seriesData = this._data[seriesId] = this._data[seriesId] || [];
	this._options[seriesId] = _.extend({}, options);
};
Store.prototype.addData = function (seriesId, updateData) {
	var seriesData = this._data[seriesId];
	
	if (updateData && updateData.length) {
		seriesData.push.apply(seriesData, updateData);
	}
};
Store.prototype.collectData = function (seriesId) {
	var seriesData = this._data[seriesId];
	
	var collectFn = this._options[seriesId].collectFn;
	
	if (seriesData && collectFn) {
		collectFn(function (value) {
			var now = Date.now();
			
			seriesData.push({
				x: now,
				y: value
			});
		});
	}
};


function Timer(interval, action) {
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
			action(function () {
				_this._wait();
			});
		}
	};
}
Timer.prototype.start = function () {
	var _this = this;
	
	_this._started = true;
	_this._continue();
};
Timer.prototype.stop = function () {
	var _this = this;
	
	_this._started = false;
	clearTimeout(_this._timer);
};


function Writer(store) {
	var _this = this;
	
	_this._since = Date.now();
	
	_this._timer = new Timer(1000, function (next) {
		store.getSeriesIds().forEach(function (seriesId) {
			store.collectData(seriesId);
			
			//logger.info('Collected ' + seriesId + ', samples: ' + store.getData(seriesId).length);
		});
		
		next();
	});
}
Writer.prototype.start = function () { this._timer.start(); };
Writer.prototype.stop = function () { this._timer.stop(); };


function Reader(store, seriesId, since, callbackFn) {
	var _this = this;
	
	_this._since = since;
	
	_this._timer = new Timer(1000, function (next) {
		var dataSince = store.getDataSince(seriesId, _this._since);
		
		_this._since = Date.now();
		
		callbackFn(dataSince);
		
		next();
	});
}
Reader.prototype.start = function () { this._timer.start(); };
Reader.prototype.stop = function () { this._timer.stop(); };


var _store = new Store();

_store.addSeries('cpu', {
	collectFn: function (callbackFn) {
		var now = Date.now();
		callbackFn(Math.abs(Math.sin(now)) * Math.random());
	}
});

_store.addSeries('memory', {
	collectFn: function (callbackFn) {
		var now = Date.now();
		callbackFn(Math.abs(Math.cos(now)) * Math.random());
	}
});


var _writer = new Writer(_store);

_writer.start();


/**
 * App-level logic for receiving messages and responding to them.
 */
module.exports = function (config) {
	
	function makeMetaUrl(metaId) {
		return 'http://localhost:' + config.httpPort + '/meta?meta_id=' + metaId;
	}
	
	function makeDataUrl(seriesId) {
		return 'http://localhost:' + config.httpPort + '/data?series_id=' + seriesId;
	}
	
	var meta = {
		"1": {
			data_url: makeDataUrl('cpu'),
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
			data_url: makeDataUrl('memory'),
			visualizer_name: 'plot-visualizer',
			visualizer_options: {
				header_text: 'Memory Footprint',
				min: 0.0,
				max: 1.0,
				time_interval: 10 * 1000
			}
		},
		"3": {
			data_url: makeDataUrl('cpu'),
			visualizer_name: 'plot-visualizer',
			visualizer_options: {
				header_text: 'CPU Load copy',
				color: 'red',
				min: 0.0,
				max: 1.0,
				time_interval: 20 * 1000
			}
		}
	};
	
	return {
		setup: function (channel) {
			
		},
		
		receive: function (channel, message) {
			
		},
		
		teardown: function (channel) {
			
		},
		
		getLayout: function () {
			var layout = {
				col: [
					{
						row: [
							{
								cell: {
									meta_url: makeMetaUrl('1')
								}
							},
							{
								cell: {
									meta_url: makeMetaUrl('2')
								}
							}
						]
					},
					{
						row: [
							{
								cell: {
									meta_url: makeMetaUrl('3')
								}
							}
						]
					}
				]
			};
			
			return {
				value0: layout
			};
		},
		
		getMeta: function (params) {
			var metaId = params.meta_id;
			
			return {
				value0: meta[metaId]
			};
		},
		
		streamData: function (params, writeFn, options) {
			var seriesId = params.series_id;
			var since = params.since || Date.now();
			
			var streamLogPrefix = (options && options.logPrefix ? options.logPrefix : '[' + seriesId + ';' + since + '] ');
			
			logger.info(streamLogPrefix + 'Requested stream since ' + since + '.');
			
			var reader = new Reader(_store, seriesId, since, function (data) {
				logger.info(streamLogPrefix + 'Reading ' + data.length + ' samples.');
				
				writeFn({
					value0: {
						data: data
					}
				});
			});
			
			reader.start();
			
			return {
				stop: function () {
					reader.stop();
				}
			};
		}
	};
};
