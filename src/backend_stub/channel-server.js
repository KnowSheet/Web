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
	 * App-level logic handlers.
	 * @property
	 */
	_this._logic = {
		setup: function ( /*channel*/ ) {},
		receive: function ( /*channel, message*/ ) {},
		teardown: function ( /*channel*/ ) {}
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
			
			_this.logic.setup(channel);
			
			_this.emit('channel-connected', _this, channel);
		});
	
		channel.on('sent', function (channel, message) {
			logger.info('Channel sent a message: %j', { message: message }, {});
		});
	
		channel.on('message', function (channel, message) {
			logger.info('Channel received a message: %j', { message: message }, {});
		
			_this.logic.receive(channel, message);
		});

		channel.on('error', function (channel, error) {
			logger.error('Channel got an error: %j', { error: error }, {});
		});

		channel.on('disconnected', function (channel) {
			logger.info('Channel disconnected.');
			
			_this.logic.teardown(channel);
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
