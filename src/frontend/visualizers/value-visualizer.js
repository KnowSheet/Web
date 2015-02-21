'use strict';

var $ = require('jquery');
var _ = require('underscore');

require('./value-visualizer.less');


function ValueVisualizer(locator, options, dataUrl) {
	var _this = this;
	
	_this._dataStore = locator.getDataStore();
	
	_this._dataUrl = dataUrl;
	
	_this._options = _.extend({
		header_text: '',
		min: 0.0,
		max: 1.0,
		fraction_digits: 4,
		higher_is_better: false
	}, options);
	
	var blockCssClass = 'knsh-value-visualizer';
	var additionalCssClasses = ' ' + require('../util-css-classes')(_this._options.css_classes);
	
	var $el = _this.$el = $('<div class="' + blockCssClass + additionalCssClasses + '">' +
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
		
		return value.toFixed(_this._options.fraction_digits);
	},
	
	_getValueColor: function (value) {
		var _this = this,
			r = 0,
			g = 0,
			b = 0;
		
		value = ((value - _this._options.min) / (_this._options.max - _this._options.min));
		
		// Default is to display low values as good ones (green), invert if opposite:
		if (_this._options.higher_is_better) {
			value = (1.0 - value);
		}
		
		// Simple red-to-green gradient:
		r = Math.round(value * 255);
		g = Math.round((1.0 - value) * 255);
		
		return 'rgb(' + r + ',' + g + ',' + b + ')';
	}
});

module.exports = ValueVisualizer;
