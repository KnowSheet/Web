'use strict';

var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');


function DashboardDataStore(dispatcher, backendApi) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._backendApi = backendApi;
	
	/**
	 * Contains metadata for each data stream.
	 * Indexed by dataUrl.
	 */
	_this._meta = {};
	
	/**
	 * Contains cached data samples.
	 * Indexed by dataUrl.
	 */
	_this._data = {};
	
	/**
	 * Contains started streams.
	 * Indexed by dataUrl.
	 */
	_this._streams = {};
	
	dispatcher.on('receive-layout', function () {
		_this._stopAllStreams();
	});
	
	dispatcher.on('receive-meta', function (args) {
		_this._handleMeta(args);
	});
	
	dispatcher.on('receive-data', function (args) {
		_this._handleData(args);
	});
	
	// Silence the 'possible EventEmitter memory leak detected' warning
	// when there are many visualizers (each subscribes to 'data-updated').
	_this.setMaxListeners( 200 );
}
inherits(DashboardDataStore, EventEmitter);
_.extend(DashboardDataStore.prototype, {
	getData: function (dataUrl) {
		return this._data[dataUrl];
	},
	
	_stopAllStreams: function () {
		var _this = this;
		
		_.each(_this._streams, function (stream, dataUrl) {
			_this._streams[dataUrl] = null;
			
			if (stream) {
				stream.stop();
				stream = null;
			}
		});
	},
	
	_handleMeta: function (args) {
		var _this = this,
			meta = args.meta,
			dataUrl = meta.data_url;
		
		// WARNING: The frontend assumes unique data URLs.
		
		// Update the meta cache:
		_this._meta[dataUrl] = meta;
		
		// Create the data array if required:
		_this._data[dataUrl] = _this._data[dataUrl] || [];
		
		// Start a data stream if not yet started:
		if (!_this._streams[dataUrl]) {
			_this._streams[dataUrl] = _this._backendApi.streamData(meta);
		}
		
		// Notify that the new data set has appeared: 
		_this.emit('data-updated', {
			dataUrl: dataUrl
		});
	},
	
	_handleData: function (args) {
		var _this = this,
			dataUrl = args.dataUrl,
			data = args.data,
			meta = _this._meta[dataUrl],
			timeInterval = (meta.visualizer_options && meta.visualizer_options.time_interval);
		
		// WARNING: The frontend assumes unique data URLs.
		
		// Create the data array if required:
		var seriesData = _this._data[dataUrl] = _this._data[dataUrl] || [];
		
		// Add new data:
		if (args.replace) {
			seriesData.splice.apply(seriesData, [ 0, seriesData.length ].concat(data));
		}
		else {
			seriesData.push.apply(seriesData, data);
		}
		
		// Truncate old data:
		if (typeof timeInterval === 'number') {
			var shiftIndex = 0;
			while ( (seriesData[seriesData.length-1].x - seriesData[shiftIndex].x) > (1.5 * timeInterval) ) {
				++shiftIndex;
			}
			if (shiftIndex > 0) {
				seriesData.splice(0, shiftIndex);
			}
		}
		
		// Notify the data has updated:
		_this.emit('data-updated', {
			dataUrl: dataUrl
		});
	}
});

module.exports = DashboardDataStore;
