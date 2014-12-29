'use strict';

var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');

var ParserBuffer = require('./parser-buffer');

var console = global.console;


// Parser states:
var S_ERROR = 1;
var S_END = 2;
var S_JSON = 3;

// Parser result codes:
var R_CONTINUE = 1;
var R_NEED_DATA = 2;
var R_ERROR = 3;
var R_END = 4;


/**
 * Performs parsing of JSON that comes in chunks.
 * Emits a 'data' event when a JSON object is parsed out.
 *
 * @param {string} [options.logPrefix=''] The prefix to add to the console messages.
 * @param {string} [options.separator=''] The separator between the JSON objects. If non-empty, the parser fails on missing separator.
 */
function ChunkJsonParser(options) {
	var _this = this;
	
	_this._options = _.extend({
		logPrefix: '',
		separator: ''
	}, options);
	
	_this._buffer = new ParserBuffer();
	
	_this.reset();
}
inherits(ChunkJsonParser, EventEmitter);
_.extend(ChunkJsonParser.prototype, {
	
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
		
		_this._state = S_JSON;
	},
	
	_onData: function (jsonObject) {
		console.log(this._options.logPrefix + 'Data:', jsonObject);
		this.emit('data', jsonObject);
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
			if (_this._parseJson() !== R_CONTINUE) {
				return;
			}
		}
	},
	
	_parseJson: function () {
		var _this = this;
		
		var separator = _this._options.separator;
		
		var data = _this._buffer.peek(1);
		
		if (data === false) {
			return R_NEED_DATA;
		}
		
		// Trying to find the longest parseable JSON string:
		var firstToken = data;
		var lastToken;
		
		if (firstToken === '{') {
			lastToken = '}';
		}
		else if (firstToken === '[') {
			lastToken = ']';
		}
		
		var lastTokenIndex = _this._buffer.getRemainingLength();
		data = _this._buffer.peek(lastTokenIndex);
		
		var jsonString;
		var jsonObject;
		while (lastTokenIndex > 0 && typeof jsonObject === 'undefined') {
			jsonString = data.substring(0, lastTokenIndex + lastToken.length);
			
			try {
				jsonObject = JSON.parse(jsonString);
			}
			catch (ex) {}
			
			if (typeof lastToken !== 'undefined') {
				lastTokenIndex = data.lastIndexOf(lastToken, lastTokenIndex - lastToken.length);
			}
			else {
				lastTokenIndex -= 1;
			}
		}
		
		if (typeof jsonObject === 'undefined') {
			// If parse failed, just wait for more data:
			return R_NEED_DATA;
		}
		
		if (separator.length > 0) {
			// Read the following separator:
			data = _this._buffer.peek(separator.length, jsonString.length);
		
			if (data === false) {
				return R_NEED_DATA;
			}
		
			if (data !== separator) {
				_this._state = S_ERROR;
				_this._onError(new Error('Expected "' + _this._buffer.escapeString(separator) + '" (separator), got "' + _this._buffer.escapeString(data) + '" near "' + _this._buffer.getContextString() + '".'));
				return R_ERROR;
			}
		}
		
		_this._onData(jsonObject);
		
		_this._buffer.advance(jsonString.length + separator.length);
		
		// Expecting JSON:
		_this._state = S_JSON;
		
		return R_CONTINUE;
	}
});

module.exports = ChunkJsonParser;
