'use strict';

var $ = require('jquery');
var _ = require('underscore');

var Rickshaw = require('rickshaw');
var moment = require('moment');

require('./value-visualizer.less');


function ValueVisualizer(locator, options, dataUrl) {
	var _this = this;
	
	_this._locator = locator;
	
	_this._layoutStore = _this._locator.getLayoutStore();
	_this._dataStore = _this._locator.getDataStore();
	
	_this._dataUrl = dataUrl;
	
	_this._options = _.extend({
		header_text: '',
		min: 0.0,
		max: 1.0,
		fraction_digits_min: 4,
		fraction_digits_max: 4,
		low_is_bad: false
	}, options);
	
	var blockCssClass = 'knsh-value-visualizer';
	
	var $el = _this.$el = $('<div class="' + blockCssClass + '">' +
		'<div class="' + blockCssClass + '__header"></div>' +
		'<div class="' + blockCssClass + '__wrapper">' +
			'<div class="' + blockCssClass + '__figure"></div>' +
		'</div>' +
	'</div>');
	
	_this.$header = $el.find('.' + blockCssClass + '__header');
	_this.$figure = $el.find('.' + blockCssClass + '__figure');
}
require('../util-mount-unmount')(ValueVisualizer.prototype, 'ValueVisualizer');
_.extend(ValueVisualizer.prototype, {
	componentDidMount: function () {
		var _this = this;
		
		_this.$header.text( _this._options.header_text );
		
		_this._renderData();
		
		_this._dataStore.on('data-updated', _this._dataUpdatedListener = function (args) {
			if (!args || !args.dataUrl || args.dataUrl === _this._dataUrl) {
				_this._renderData();
			}
		});
	},
	
	componentWillUnmount: function () {
		var _this = this;
		
		_this._dataStore.removeListener('data-updated', _this._dataUpdatedListener);
		_this._dataUpdatedListener = null;
		
		_this.$figure.empty();
		_this.$header.empty();
	},
	
	_renderData: function () {
		var _this = this;
		
		var seriesData = _this._dataStore.getData(_this._dataUrl);
		
		if (seriesData && seriesData.length) {
			var data = seriesData[seriesData.length-1];
			
			_this.$figure.text( _this._formatValue(data.y) );
			
			_this.$figure.css({
				color: _this._getValueColor(data.y)
			});
		}
	},
	
	_formatValue: function (value) {
		var _this = this;
		
		var power = Math.pow(10, _this._options.fraction_digits_max);
		
		var rounded = ( Math.round(value * power) / power );
		
		return String( rounded.toFixed(_this._options.fraction_digits_min) );
	},
	
	_getValueColor: function (value) {
		var _this = this,
			r = 0,
			g = 0,
			b = 0;
		
		value = ((value - _this._options.min) / (_this._options.max - _this._options.min));
		
		// Default is to display low values as good ones (green), invert if opposite:
		if (_this._options.low_is_bad) {
			value = (1.0 - value);
		}
		
		// Simple red-to-green gradient:
		r = Math.round(value * 255);
		g = Math.round((1.0 - value) * 255);
		
		return 'rgb(' + r + ',' + g + ',' + b + ')';
	}
});

module.exports = ValueVisualizer;
