'use strict';

var _ = require('underscore');
var $ = require('jquery');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');
var assert = require('assert');

var logger = require('./logger');

var setTimeout = global.setTimeout;
var clearTimeout = global.clearTimeout;
var XMLHttpRequest = global.XMLHttpRequest;


/**
 * Receives data on a persistent connection opened via `XMLHttpRequest`.
 * Emits a 'data' event when some data is received through the persistent connection.
 * Provides methods to reconnect if required, and maintains reconnect delays.
 *
 * @param {string} [options.logPrefix=''] The prefix to add to the log messages.
 * @param {number} [options.reconnectDelay=2000] The initial reconnect delay.
 * @param {number} [options.reconnectDelayCoeff=1.1] The multiplier to apply to the delay for the next reconnect.
 */
function PersistentConnection(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._options = _.extend({
		logPrefix: '',
		reconnectDelay: 2000,
		reconnectDelayCoeff: 1.1
	}, options);
	
	_this._url = null;
	
	_this.disconnect();
}
inherits(PersistentConnection, EventEmitter);
_.extend(PersistentConnection.prototype, {
	
	/**
	 * @return {boolean}
	 */
	isConnecting: function () {
		return (!!this._xhr && !this._isConnected);
	},
	
	/**
	 * @return {boolean}
	 */
	isConnected: function () {
		return this._isConnected;
	},
	
	/**
	 * @return {boolean}
	 */
	isReconnecting: function () {
		return !!this._reconnectTimer;
	},
	
	/**
	 * Opens a persistent connection on a given URL.
	 * The server is expected to keep the connection open forever and push the data.
	 *
	 * @param {string} url The URL to request. May be updated later via `setUrl`.
	 */
	connect: function (url) {
		var _this = this;
		
		_this._dropConnection();
		
		_this._url = url;
		
		_this._resetReconnectParams();
		
		_this._establishConnection();
	},
	
	/**
	 * Returns the URL.
	 */
	getUrl: function () {
		return this._url;
	},
	
	/**
	 * Updates the URL for future reconnects.
	 */
	setUrl: function (url) {
		this._url = url;
	},
	
	/**
	 * Disconnects and schedules a reconnect after a delay.
	 * The delay is then increased to have the subsequent reconnects happen less often.
	 */
	reconnect: function () {
		var _this = this;
		
		if (!_this._url) {
			throw new Error('PersistentConnection#reconnect: Missing URL.');
		}
		
		_this._dropConnection();
		
		// Store the previous delay to report it in the event below:
		var reconnectDelay = _this._reconnectDelay;
		
		// Schedule a reconnect:
		_this._reconnectTimer = setTimeout(function () {
			_this._reconnectTimer = null;
			
			if (_this._isConnected) {
				return;
			}
			
			_this._onReconnecting();
			
			_this._establishConnection();
		}, reconnectDelay);
		
		// Increase the reconnect delay for future reconnects:
		_this._reconnectDelay = Math.ceil(_this._reconnectDelayCoeff * _this._reconnectDelay);
		
		_this._onReconnectScheduled({
			reconnectDelay: reconnectDelay
		});
	},
	
	/**
	 * Drops the current connection.
	 * No-op if not connected.
	 */
	disconnect: function () {
		this._dropConnection();
	},
	
	/**
	 * Drops the current connection and resets the reconnect delay parameters.
	 */
	reset: function () {
		var _this = this;
		
		_this._dropConnection();
		
		_this._resetReconnectParams();
	},
	
	_onConnecting: function () {
		logger.log(this._options.logPrefix + 'Connecting...');
		this.emit('connecting');
	},
	
	_onConnected: function () {
		logger.log(this._options.logPrefix + 'Connected.');
		this.emit('connected');
	},
	
	_onReconnectScheduled: function (args) {
		logger.warn(this._options.logPrefix + 'Will reconnect in ' + args.reconnectDelay + 'ms.');
	},
	
	_onReconnecting: function () {
		logger.warn(this._options.logPrefix + 'Reconnecting...');
	},
	
	_onData: function (data) {
		//logger.log(this._options.logPrefix + 'Data:', data);
		this.emit('data', data);
	},
	
	_onEnd: function () {
		logger.warn(this._options.logPrefix + 'End.');
		this.emit('end');
	},
	
	_onError: function (error) {
		logger.error(this._options.logPrefix + 'Error:', error);
		this.emit('error', error);
	},
	
	_resetReconnectParams: function () {
		var _this = this;
		
		_this._reconnectDelay = _this._options.reconnectDelay;
		_this._reconnectDelayCoeff = _this._options.reconnectDelayCoeff;
	},
	
	_establishConnection: function () {
		var _this = this;
		
		assert(!_this._isConnected);
		
		_this._onConnecting();
		
		var xhr = _this._xhr = new XMLHttpRequest();
		
		var readIndex = 0;
		
		xhr.onload = function (event) {
			_this._dropConnection();
		};
		
		xhr.onabort = xhr.onerror = function (event) {
			_this._dropConnection(new Error());
		};
		
		xhr.onreadystatechange = function () {
			if (xhr.readyState > 2 && xhr.status === 200) {
				if (!_this._isConnected) {
					_this._isConnected = true;
					
					_this._resetReconnectParams();
					
					_this._onConnected();
				}
				
				var responseText = xhr.responseText;
				
				if (readIndex < responseText.length) {
					var data = responseText.substring(readIndex);
					readIndex += data.length;
					
					_this._onData(data);
				}
			}
		};
		
		xhr.open('GET', _this._url, true);
		
		xhr.send(null);
	},
	
	_dropConnection: function (error) {
		var _this = this;
		
		var wasConnected = _this._isConnected;
		
		clearTimeout(_this._reconnectTimer);
		_this._reconnectTimer = null;
		
		var xhr = _this._xhr;
		_this._xhr = null;
		
		if (xhr) {
			// Clear the handlers to prevent memory leaks and
			// prevent the handlers from being called on abort:
			xhr.onload = xhr.onabort = xhr.onerror = xhr.onreadystatechange = null;
			
			// Abort the connection (no-op if not needed):
			xhr.abort();
			
			// Just-in-case nullification:
			xhr = null;
		}
		
		_this._isConnected = false;
		
		if (error) {
			_this._onError(error);
		}
		else if (wasConnected) {
			_this._onEnd();
		}
	}
	
});

module.exports = PersistentConnection;
