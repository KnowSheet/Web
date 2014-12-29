'use strict';

var _ = require('underscore');


/**
 * Provides low-level utility to manage a buffer for a stream string parser.
 */
function ParserBuffer() {
	var _this = this;
	
	_this.reset();
}
_.extend(ParserBuffer.prototype, {
	
	/**
	 * Adds data to the buffer.
	 *
	 * @param {string} data The data to add.
	 */
	write: function (data) {
		var _this = this;
		
		_this._buffer += data;
	},
	
	/**
	 * Resets the buffer.
	 */
	reset: function () {
		var _this = this;
		
		_this._buffer = '';
		_this._readIndex = 0;
	},
	
	/**
	 * Returns the number of string characters that has been consumed via `advance` since last reset or instantiation.
	 *
	 * @return {number} The number of string characters consumed.
	 */
	getConsumedLength: function () {
		var _this = this;
		
		return _this._readIndex;
	},
	
	/**
	 * Returns the number of string characters that remains in the buffer.
	 *
	 * @return {number} The number of string characters remaining.
	 */
	getRemainingLength: function () {
		var _this = this;
		
		return (_this._buffer.length - _this._readIndex);
	},
	
	/**
	 * Returns the part of the buffer till the first occurrence of the specified delimiter.
	 * If the delimiter is not found in the buffer, returns `false`.
	 *
	 * @return {string|boolean}
	 */
	peekUntil: function (delimiter) {
		var _this = this;
		
		var index = _this._buffer.indexOf(delimiter, _this._readIndex);
		
		if (index < 0) {
			return false;
		}
		
		var data = _this.peek(index - _this._readIndex);
		
		return data;
	},
	
	/**
	 * Returns the specified number of string characters from the buffer.
	 * May skip some characters from the buffer start if required.
	 * If there is not enough characters in the buffer, returns `false`.
	 *
	 * @param {number} length The number of string characters to return.
	 * @param {number} [skip=0] The number of string characters to skip from the buffer start.
	 *
	 * @return {string|boolean}
	 */
	peek: function (length, skip) {
		var _this = this;
		
		if (typeof skip === 'undefined') {
			skip = 0;
		}
		
		var startIndex = _this._readIndex + skip;
		var endIndex = startIndex + length;
		
		if (endIndex > _this._buffer.length) {
			return false;
		}
		
		var data = _this._buffer.substring(startIndex, endIndex);
		
		return data;
	},
	
	/**
	 * Moves the internal pointer of the buffer forward by the specified number of string characters.
	 *
	 * @param {number} length The number of string characters to advance by.
	 *
	 * @return {boolean} `true` on success; `false` if there is not enough characters in the buffer.
	 */
	advance: function (length) {
		var _this = this;
		
		if ((_this._readIndex + length) > _this._buffer.length) {
			return false;
		}
		
		_this._readIndex += length;
		
		return true;
	},
	
	/**
	 * Returns a string describing the current buffer state.
	 * Useful for error or log messages.
	 * 
	 * @return {string}
	 */
	getContextString: function () {
		var _this = this;
		
		var ret = '';
		
		if (_this.getConsumedLength() > 0) {
			ret += '...';
		}
		
		var contextLength = 10;
		var context = _this.peek(Math.min(_this.getRemainingLength(), contextLength));
		
		if (context.length > 0) {
			ret += _this.escapeString(context);
		}
		
		if ((_this.getRemainingLength() - context.length) > 0) {
			ret += '...';
		}
		else {
			ret += '<EOF>';
		}
		
		return ret;
	},
	
	/**
	 * Escapes the control characters in the given data string.
	 * Useful for error or log messages.
	 * 
	 * @param {string} data The data to process.
	 *
	 * @return {string}
	 */
	escapeString: function (data) {
		// HACK: Quick & dirty way to escape special chars:
		return JSON.stringify(String(data)).replace(/^"|"$/g, '').replace(/\\"/g, '"');
	}
});

module.exports = ParserBuffer;
