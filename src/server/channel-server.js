var _ = require('underscore');
var inherits = require('inherits');
var http = require('http');
var WebSocketServer = require('ws').Server;
var EventEmitter = require('node-event-emitter');
var Channel = require('./channel');

var logger = require('./logger');

/**
 * A wrapper around the server-side implementation of the WebSocket server.
 * Provides connections wrapped with our wrapper and supports app-level protocol definition.
 */
function ChannelServer(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	/**
	 * App-level protocol definition.
	 * @property
	 */
	_this.protocol = {
		receive: function () {},
		cleanup: function () {}
	};
	
	// Apply the property values passed to the constructor:
	_.extend(_this, options);
	
	// Private properties:
	_this._wsHttpServer = http.createServer();
	
	_this._wss = new WebSocketServer({
		server: _this._wsHttpServer
	});

	_this._wss.on('connection', function (ws) {
		var channel = new Channel();
	
		channel.on('connected', function (channel) {
			logger.info('Channel connected.');
			
			_this.emit('channel-connected', _this, channel);
		});
	
		channel.on('sent', function (channel, message) {
			logger.info('Channel message sent: %j', { message: message }, {});
		});
	
		channel.on('message', function (channel, message) {
			logger.info('Channel message received: %j', { message: message }, {});
		
			_this.protocol.receive(channel, message);
		});

		channel.on('transport-error', function (channel, error) {
			logger.error('Channel transport error: %j', { error: error }, {});
		});

		channel.on('disconnected', function (channel) {
			logger.info('Channel disconnected.');
			
			_this.protocol.cleanup(channel);
		});
	
		channel.accept(ws);
	});
}
inherits(ChannelServer, EventEmitter);
_.extend(ChannelServer.prototype, {
	listen: function (port) {
		this._wsHttpServer.listen(port);
	}
});

module.exports = ChannelServer;
