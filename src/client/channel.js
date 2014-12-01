var _ = require('underscore');
var inherits = require('inherits');
var EventEmitter = require('node-event-emitter');
var WebSocket = global.WebSocket;
var setTimeout = global.setTimeout;
var clearTimeout = global.clearTimeout;
var console = global.console;

var __filename = module.id;

var _nextId = 1;

/**
 * A wrapper around the browser's WebSocket implementation.
 * Provides socket reuse, reconnection, serialization, deserialization and additional events.
 */
function Channel(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	/**
	 * @property
	 */
	_this.id = _nextId++;
	
	/**
	 * @property
	 */
	_this.url = null;
	
	/**
	 * @property
	 */
	_this.reconnectDelayBase = 2000;
	
	/**
	 * @property
	 */
	_this.reconnectCoeffBase = 1.1;
	
	/**
	 * @property
	 */
	_this.reconnectDelay = 0;
	
	/**
	 * @property
	 */
	_this.reconnectDelayCoeff = 0;
	
	// Apply the property values passed to the constructor:
	_.extend(_this, options);
	
	// Private properties:
	_this._ws = null;
	_this._reconnectTimer = null;
}
inherits(Channel, EventEmitter);
_.extend(Channel.prototype, {
	open: function () {
		var _this = this;
		
		if (_this._ws) { throw new Error(__filename + ': Socket exists, close first.'); }
		
		_this._reconnectReset();
		
		_this.emit('connecting', _this);
		
		_this._createSocket();
	},
	
	send: function (message) {
		var _this = this;
		
		if (!_this._ws) { throw new Error(__filename + ': No socket.'); }
		
		_this.emit('sending', _this, message);
		
		message = _this.extendMessage(message);
		
		_this._ws.send(_this.serializeMessage(message));
		
		_this.emit('sent', _this, message);
	},
	
	receive: function (data) {
		var _this = this;
		
		if (!_this._ws) { throw new Error(__filename + ': No socket.'); }
		
		try {
			var message = _this.deserializeMessage(data);
			_this.emit('message', _this, message);
		}
		catch (ex) {
			ex.data = data;
			_this.emit('transport-error', _this, ex);
		}
	},
	
	close: function () {
		var _this = this;
		
		if (!_this._ws) { throw new Error(__filename + ': No socket.'); }
		
		_this._reconnectReset();
		
		_this.emit('disconnecting', _this);
		
		_this._destroySocket();
	},
	
	extendMessage: function (message) {
		return _.extend({
			timestamp: (new Date()).getTime(),
			action: 'message',
			data: {}
		}, message);
	},
	
	serializeMessage: function (message) {
		return JSON.stringify(message);
	},
	
	deserializeMessage: function (data) {
		return JSON.parse(data);
	},
	
	_destroySocket: function () {
		var _this = this;
		
		var ws = _this._ws;
		_this._ws = null;
		
		if (ws) {
			ws.onopen = null;
			ws.onclose = null;
			ws.onmessage = null;
			ws.onerror = null;
			
			ws.close();
		}
	},
	
	_createSocket: function () {
		var _this = this;
		
		var ws = new WebSocket(_this.url);
		
		_this._ws = ws;
		
		ws.onopen = function () {
			_this.emit('connected', _this);
		};
		ws.onclose = function (e) {
			_this.emit('disconnected', _this);
			
			_this._destroySocket();
			
			if (e.wasClean) {
				_this._reconnectReset();
			}
			else {
				_this._reconnectSchedule();
			}
		};
		ws.onmessage = function (e) {
			_this.receive(e.data);
		};
		ws.onerror = function () {
			if (ws.readyState === ws.CLOSING || ws.readyState === ws.CLOSED) {
				_this._destroySocket();
				_this._reconnectSchedule();
			}
			else {
				_this.emit('transport-error', _this, new Error());
			}
		};
	},
	
	_reconnectReset: function () {
		var _this = this;
		
		_this._reconnectCancel();
		
		_this.reconnectDelay = _this.reconnectDelayBase;
		_this.reconnectDelayCoeff = _this.reconnectCoeffBase;
	},
	_reconnectSchedule: function () {
		var _this = this;
		
		_this._reconnectCancel();
		_this._destroySocket();
		
		_this._reconnectTimer = setTimeout(function () {
			_this.emit('reconnecting', _this);
			
			_this._createSocket();
			
			_this.reconnectDelay = Math.ceil(_this.reconnectDelayCoeff * _this.reconnectDelay);
		}, _this.reconnectDelay);
		
		_this.emit('reconnect-scheduled', _this);
	},
	_reconnectCancel: function () {
		var _this = this;
		
		clearTimeout(_this._reconnectTimer);
		_this._reconnectTimer = null;
	}
});

module.exports = Channel;
