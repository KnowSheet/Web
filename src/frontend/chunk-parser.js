'use strict';

var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');

var ParserBuffer = require('./parser-buffer');

var console = global.console;


var CRLF = "\r\n";

// Parser states:
var S_ERROR = 1;
var S_END = 2;
var S_CHUNK_LENGTH = 3;
var S_CHUNK_BODY = 4;

// Parser result codes:
var R_CONTINUE = 1;
var R_NEED_DATA = 2;
var R_ERROR = 3;
var R_END = 4;


/**
 * Performs parsing of `Transfer-Encoding: chunked` chunks.
 * Emits a 'data' event when a chunk body is parsed out.
 * Does not perform parsing of the chunk data itself.
 *
 * @param {string} [options.logPrefix=''] The prefix to add to the console messages.
 */
function ChunkParser(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._options = _.extend({
		logPrefix: ''
	}, options);
	
	_this._buffer = new ParserBuffer();
	
	_this.reset();
}
inherits(ChunkParser, EventEmitter);
_.extend(ChunkParser.prototype, {
	
	/**
	 * Adds data to the parser.
	 * Performs parsing until the data is unparseable.
	 *
	 * @param {string} data The data to add.
	 */
	write: function (data) {
		var _this = this;
		
		_this._buffer.write(data);
		
		_this._parse();
	},
	
	/**
	 * Resets the parser state and buffers.
	 */
	reset: function () {
		var _this = this;
		
		_this._buffer.reset();
		
		_this._state = S_CHUNK_LENGTH;
		
		_this._chunkLength = 0;
	},
	
	_onData: function (data) {
		console.log(this._options.logPrefix + 'Data:', data);
		this.emit('data', data);
	},
	
	_onEnd: function () {
		console.warn(this._options.logPrefix + 'End.');
		this.emit('end');
	},
	
	_onError: function (error) {
		console.error(this._options.logPrefix + 'Error:', error);
		this.emit('error', error);
	},
	
	_parse: function () {
		var _this = this;
		
		while (true) {
			switch (_this._state) {
			case S_CHUNK_LENGTH:
				if (_this._parseChunkLength() !== R_CONTINUE) {
					return;
				}
				break;
			
			case S_CHUNK_BODY:
				if (_this._parseChunkBody() !== R_CONTINUE) {
					return;
				}
				break;
			
			default:
				return;
			}
		}
	},
	
	_parseChunkLength: function () {
		var _this = this;
		
		// The chunk length is followed by CRLF:
		var data = _this._buffer.peekUntil(CRLF);
		
		if (data === false) {
			return R_NEED_DATA;
		}
		
		// Chunk length is hexadecimal:
		_this._chunkLength = parseInt(data, 16);
		
		// If we cannot parse the length, it's an error:
		if (isNaN(_this._chunkLength) || _this._chunkLength < 0) {
			_this._state = S_ERROR;
			_this._onError(new Error('Expected hexadecimal chunk length, got "' + _this._buffer.escapeStringForLogging(data) + '" near "' + _this._buffer.getContextString() + '".'));
			return R_ERROR;
		}
		
		// If the length is zero, it's the terminating chunk:
		if (_this._chunkLength === 0) {
			_this._state = S_END;
			_this._onEnd();
			return R_END;
		}
		
		// Skip the chunk length and the following CRLF:
		_this._buffer.advance(data.length + CRLF.length);
		
		// Expecting chunk body:
		_this._state = S_CHUNK_BODY;
		
		return R_CONTINUE;
	},
	
	_parseChunkBody: function () {
		var _this = this;
		
		// Read the chunk body of the length given before:
		var data = _this._buffer.peek(_this._chunkLength);
		
		if (data === false) {
			return R_NEED_DATA;
		}
		
		var chunkBody = data;
		
		// Read the following CRLF:
		data = _this._buffer.peek(CRLF.length, chunkBody.length);
		
		if (data === false) {
			return R_NEED_DATA;
		}
		
		if (data !== CRLF) {
			_this._state = S_ERROR;
			_this._onError(new Error('Expected \\r\\n (CRLF), got "' + _this._buffer.escapeStringForLogging(data) + '" near "' + _this._buffer.getContextString() + '".'));
			return R_ERROR;
		}
		
		_this._onData(chunkBody);
		
		// Skip the chunk body and the following CRLF:
		_this._buffer.advance(chunkBody.length + CRLF.length);
		
		// Expecting chunk length:
		_this._state = S_CHUNK_LENGTH;
		
		return R_CONTINUE;
	},
	
	

});

module.exports = ChunkParser;
