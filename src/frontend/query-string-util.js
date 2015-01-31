'use strict';

var $ = require('jquery');

var parse = function (queryString) {
	var params = {}, pairs, pair, i, ic;

	// Split into key/value pairs:
	pairs = queryString.split('&');

	// Convert the array of strings into an object:
	for (i = 0, ic = pairs.length; i < ic; i++) {
		pair = pairs[i].split('=');
		params[pair[0]] = pair[1];
	}

	return params;
};

var stringify = function (params) {
	return $.param(params || {});
};

var extend = function (url, params) {
	var index = url.indexOf('?');
	var beforeQueryString = (index < 0 ? url : url.substring(0, index));
	var queryString = (index < 0 ? '' : url.substring(index + 1));
	url = beforeQueryString + '?' + stringify($.extend(true, parse(queryString), params));
	return url;
};

module.exports = {
	parse: parse,
	stringify: stringify,
	extend: extend
};
