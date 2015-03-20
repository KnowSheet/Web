'use strict';

// Note: Not using more full-fledged query string modules because they are rather large.

var $ = require('jquery');


/**
 * Borrowed from `qs` module.
 * @see https://github.com/hapijs/qs/blob/master/lib/utils.js#L68
 */
function decode(str) {
	try {
		return decodeURIComponent(str.replace(/\+/g, ' '));
	}
	catch (err) {
		return str;
	}
}

/**
 * Parses the query string in a simplest way.
 * Only supports non-nested query strings with non-repeating keys.
 *
 * @param {string} queryString The query string.
 * @return {Object} The query params.
 */
function parse(queryString) {
	var params = {}, pairs, pair, i, ic;

	// Return non-empty object only for non-empty query-string.
	if (queryString) {
		// Split into key/value pairs:
		pairs = queryString.split('&');

		// Convert the array of strings into an object:
		for (i = 0, ic = pairs.length; i < ic; i++) {
			pair = pairs[i].split('=');
			params[decode(pair[0])] = decode(pair[1] || '');
		}
	}

	return params;
}

/**
 * Re-uses `jQuery.param` for building query strings.
 *
 * @param {Object} params The query params.
 * @return {string} The query string.
 */
function stringify(params) {
	return $.param(params || {});
}

/**
 * Extends the query string of an existing URL.
 *
 * @param {string} url The initial URL.
 * @param {Object} params The params that need ot be updated.
 * @return {string} The updated URL.
 */
function extend(url, params) {
	var index = url.indexOf('?');
	var beforeQueryString = (index < 0 ? url : url.substring(0, index));
	var queryString = (index < 0 ? '' : url.substring(index + 1));
	url = beforeQueryString + '?' + stringify($.extend(parse(queryString), params));
	return url;
}


module.exports = {
	parse: parse,
	stringify: stringify,
	extend: extend
};
