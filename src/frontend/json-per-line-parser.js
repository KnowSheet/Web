'use strict';

var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');

var ParserBuffer = require('./parser-buffer');

var console = global.console;


// Parser states:
var S_ERROR = 1;
var S_JSON = 2;

// Parser result codes:
var R_CONTINUE = 1;
var R_NEED_DATA = 2;
var R_ERROR = 3;


/**
 * Performs parsing of JSON that comes in chunks.
 * Emits a 'data' event when a JSON object is parsed out.
 *
 * @param {string} [options.logPrefix=''] The prefix to add to the console messages.
 * @param {string} [options.separator=''] The separator between the JSON objects. If non-empty, the parser fails on missing separator.
 */
function JsonPerLineParser(options) {
	var _this = this;
	
	_this._options = _.extend({
		logPrefix: ''
	}, options);
	
	_this._buffer = new ParserBuffer();
	
	_this.reset();
}
inherits(JsonPerLineParser, EventEmitter);
_.extend(JsonPerLineParser.prototype, {
	
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
			switch (_this._state) {
			case S_JSON:
				if (_this._parseJson() !== R_CONTINUE) {
					return;
				}
				break;
			default:
				return;
			}
		}
	},
	
	_parseJson: function () {
		var _this = this;
		
		var separator = '\n';
		
		var jsonString = _this._buffer.peekUntil(separator);
		
		if (jsonString === false) {
			return R_NEED_DATA;
		}
		
		var jsonObject;
		try {
			jsonObject = JSON.parse(jsonString);
		}
		catch (ex) {}
		
		if (typeof jsonObject === 'undefined') {
			_this._state = S_ERROR;
			
			_this._onError(new Error('Expected a valid JSON value, got "' +
				_this._buffer.escapeStringForLogging(jsonString) +
				'" near "' +
				_this._buffer.getContextString() +
				'".'
			));
			
			return R_ERROR;
		}
		
		_this._onData(jsonObject);
		
		_this._buffer.advance(jsonString.length + separator.length);
		
		// Expecting JSON:
		_this._state = S_JSON;
		
		return R_CONTINUE;
	}
});

module.exports = JsonPerLineParser;
