'use strict';

var _ = require('underscore');
var $ = require('jquery');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');
var assert = require('assert');

var logger = require('./logger');

var PersistentConnection = require('./persistent-connection');

var setTimeout = global.setTimeout;
var clearTimeout = global.clearTimeout;
var XMLHttpRequest = global.XMLHttpRequest;


/**
 * Receives data on a `PersistentConnection`.
 * Emits a 'data' event when some data is received through the persistent connection.
 * Provides methods to reconnect if required.
 *
 * Implements sliding reconnect. The implementation mimics double buffering:
 * while the front connection is receiving data, the back connection is connecting;
 * when the back connection is ready, it becomes the active connection.
 *
 * @param {string} [options.logPrefix=''] The prefix to add to the log messages.
 * @param {number} [options.reconnectDelay=2000] The initial reconnect delay.
 * @param {number} [options.reconnectDelayCoeff=1.1] The multiplier to apply to the delay for the next reconnect.
 */
function PersistentConnectionPair(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._options = _.extend({
		logPrefix: ''
	}, options);
	
	_this._url = null;
	
	_this._connections = [];
	
	[ 0, 1 ].forEach(function (index) {
		var logPrefix;
		
		if (options.logPrefix) {
			logPrefix = (options.logPrefix + '[' + (index + 1) + '] ');
		}
		
		var conn = new PersistentConnection(_.extend({}, options, {
			logPrefix: logPrefix
		}));
		
		var descriptor = {
			conn: conn,
			index: index,
			disabled: false
		};
		
		function addListener(event, handler) {
			conn.on(event, function () {
				if (!descriptor.disabled) {
					var args = [].slice.apply(arguments);
					handler.apply(_this, [ descriptor ].concat(args));
				}
			});
		}
		
		addListener('connecting', _this._onConnConnecting);
		addListener('connected', _this._onConnConnected);
		addListener('data', _this._onConnData);
		addListener('error', _this._onConnError);
		addListener('end', _this._onConnEnd);
		
		_this._connections.push(descriptor);
	});
	
	_this._frontIndex = 1;
	_this._backIndex = 0;
	
	_this.disconnect();
}
inherits(PersistentConnectionPair, EventEmitter);
_.extend(PersistentConnectionPair.prototype, {
	
	/**
	 * @return {boolean}
	 */
	isConnecting: function () {
		return this._isConnecting;
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
		return this._isReconnecting;
	},
	
	/**
	 * Opens a persistent connection on a given URL.
	 * The server is expected to keep the connection open forever and push the data.
	 *
	 * @param {string} url The URL to request. May be updated later via `setUrl`.
	 */
	connect: function (url) {
		var _this = this;
		
		_this._url = url;
		
		logger.log(_this._options.logPrefix + 'Connect: ' +
			'back = [' + (_this._backIndex + 1) + '].');
		
		_this._connections[_this._backIndex].conn.connect(_this._url);
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
	 * Reconnects while having an active connection.
	 * If there is an active connection, the reconnect happens with a delay.
	 * If the delay is not needed, use `connect`.
	 */
	reconnect: function () {
		var _this = this;
		
		if (!_this._url) {
			throw new Error('PersistentConnectionPair#reconnect: Missing URL.');
		}
		
		logger.log(_this._options.logPrefix + 'Reconnect: ' +
			'back = [' + (_this._backIndex + 1) + '].');
		
		var conn = _this._connections[_this._backIndex].conn;
		if (conn.getUrl()) {
			conn.reconnect();
		}
		else {
			conn.connect(_this._url);
		}
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
	
	_onReconnecting: function () {
		logger.log(this._options.logPrefix + 'Reconnecting...');
		this.emit('reconnecting');
	},
	
	_onReconnected: function () {
		logger.log(this._options.logPrefix + 'Reconnected.');
		this.emit('reconnected');
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
	
	_onConnConnecting: function (descriptor) {
		var _this = this;
		if (descriptor.index === _this._frontIndex) {
			// This can only happen on front connection reconnect.
		}
		else {
			if (!_this._isConnected) {
				_this._isConnecting = true;
				
				logger.log(_this._options.logPrefix + 'Connecting: ' +
					'front = [' + (_this._frontIndex + 1) + '], back = [' + (_this._backIndex + 1) + '].');
				
				_this._onConnecting();
			}
			else {
				_this._isReconnecting = true;
				
				logger.log(_this._options.logPrefix + 'Reconnecting: ' +
					'front = [' + (_this._frontIndex + 1) + '], back = [' + (_this._backIndex + 1) + '].');
				
				_this._onReconnecting();
			}
		}
	},
	
	_onConnConnected: function (descriptor) {
		var _this = this;
		if (descriptor.index === _this._frontIndex) {
			// This can only happen on front connection reconnect.
		}
		else {
			var frontIndex = _this._frontIndex;
			var wasConnected = _this._isConnected;
			
			// Swap the connections.
			logger.log(_this._options.logPrefix + 'Swap connections: ' +
				'front = [' + (descriptor.index + 1) + '], back = [' + (frontIndex + 1) + '].');
			
			_this._backIndex = frontIndex;
			_this._frontIndex = descriptor.index;
			
			_this._isReconnecting = false;
			
			if (wasConnected) {
				// Disconnect the front connection.
				logger.log(_this._options.logPrefix + 'Disconnect: ' +
					'front = [' + (frontIndex + 1) + '].');
				
				var frontDescriptor = _this._connections[frontIndex];
				frontDescriptor.disabled = true;
				frontDescriptor.conn.disconnect();
				frontDescriptor.disabled = false;
				
				_this._onReconnected();
			}
			else {
				_this._isConnecting = false;
				_this._isConnected = true;
				_this._onConnected();
			}
		}
	},
	
	_onConnData: function (descriptor, data) {
		var _this = this;
		if (descriptor.index === _this._frontIndex) {
			_this._onData(data);
		}
		else {
			// This should not happen.
			throw new Error('PersistentConnectionPair#_onConnData: Got data from back connection.');
		}
	},
	
	_onConnError: function (descriptor, error) {
		var _this = this;
		if (descriptor.index === _this._frontIndex) {
			_this._dropConnection(error);
		}
		else {
			if (_this._isConnecting || _this._isReconnecting) {
				_this._dropConnection(error);
			}
			else if (_this._isConnected) {
				descriptor.conn.reconnect();
			}
		}
	},
	
	_onConnEnd: function (descriptor) {
		var _this = this;
		if (descriptor.index === _this._frontIndex) {
			_this._dropConnection();
		}
		else {
			if (_this._isConnecting || _this._isReconnecting) {
				_this._dropConnection();
			}
			else if (_this._isConnected) {
				descriptor.conn.reconnect();
			}
		}
	},
	
	_resetReconnectParams: function () {
		var _this = this;
		
		_this._connections.forEach(function (descriptor) {
			descriptor.conn.reset();
		});
	},
	
	_dropConnection: function (error) {
		var _this = this;
		
		var wasConnected = _this._isConnected;
		
		_this._connections.forEach(function (descriptor) {
			descriptor.disabled = true;
			descriptor.conn.disconnect();
			descriptor.disabled = false;
		});
		
		_this._isReconnecting = false;
		_this._isConnecting = false;
		_this._isConnected = false;
		
		if (error) {
			_this._onError(error);
		}
		else if (wasConnected) {
			_this._onEnd();
		}
	}
	
});

module.exports = PersistentConnectionPair;
