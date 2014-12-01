var _ = require('underscore');
var inherits = require('inherits');
var EventEmitter = require('node-event-emitter');

var _nextId = 1;

/**
 * A wrapper around the server-side implementation of WebSocket.
 * Provides serialization, deserialization and additional events.
 */
function Channel(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	/**
	 * @property
	 */
	_this.id = _nextId++;
	
	// Apply the property values passed to the constructor:
	_.extend(_this, options);
	
	// Private properties:
	_this._ws = null;
}
inherits(Channel, EventEmitter);
_.extend(Channel.prototype, {
	accept: function (ws) {
		var _this = this;
		
		if (_this._ws) { throw new Error(__filename + ': Socket exists, close first.'); }
		
		if (!ws) { throw new Error(__filename + ': Argument "ws" is empty.'); }
		
		_this.emit('connecting', _this);
		
		_this._ws = ws;
		
		ws.on('message', function (data) {
			_this.receive(data);
		});

		ws.on('close', function () {
			_this.emit('disconnected', _this);
		});
		
		_this.emit('connected', _this);
	},
	
	send: function (message) {
		var _this = this;
		
		if (!_this._ws) { throw new Error(__filename + ': No socket.'); }
		
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
			_this.emit('transport-error', _this, { message: ex.message });
		}
	},
	
	close: function () {
		var _this = this;
		
		if (!_this._ws) { throw new Error(__filename + ': No socket.'); }
		
		_this.emit('disconnecting', _this);
		
		_this._ws = null;
		
		_this.emit('disconnected', _this);
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
	}
});

module.exports = Channel;
