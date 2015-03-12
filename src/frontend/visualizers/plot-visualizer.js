'use strict';

var $ = require('jquery');
var _ = require('underscore');

var flot = require('flot');
require('flot-plugin-resize');
require('flot-plugin-time');

var moment = require('moment');

require('./plot-visualizer.less');


function PlotVisualizer(locator, options, dataUrl) {
	var _this = this;
	
	_this._locator = locator;
	
	_this._layoutStore = _this._locator.getLayoutStore();
	_this._dataStore = _this._locator.getDataStore();
	
	_this._dataUrl = dataUrl;
	
	_this._options = _.extend({
		header_text: '',
		renderer: 'lineplot',
		color: 'rgba(0,0,0,1)',
		interpolation: 'none',
		min: undefined,
		max: undefined,
		time_interval: null,
		tick_count: 5,
		tick_format: 'HH:mm:ss'
	}, options);
	
	_this._data = [];
	
	_this._plotWidth = 0;
	_this._plotHeight = 0;
	
	var blockCssClass = 'knsh-plot-visualizer';
	var additionalCssClasses = ' ' + require('../util-css-classes')(_this._options.css_classes);
	
	var $el = _this.$el = $('<div class="' + blockCssClass + additionalCssClasses + '">' +
		'<div class="' + blockCssClass + '__header"></div>' +
		'<div class="' + blockCssClass + '__plot-wrapper">' +
			'<div class="' + blockCssClass + '__plot"></div>' +
		'</div>' +
	'</div>');
	
	_this.$header = $el.find('.' + blockCssClass + '__header');
	_this.$plotWrapper = $el.find('.' + blockCssClass + '__plot-wrapper');
	_this.$plot = $el.find('.' + blockCssClass + '__plot');
}
require('../util-mount-unmount')(PlotVisualizer.prototype, 'PlotVisualizer');
_.extend(PlotVisualizer.prototype, {
	componentDidMount: function () {
		var _this = this;
		
		_this.$header.text( _this._options.header_text );
		
		// The series object is reused on plot updates, keeping the reference to the data.
		_this._series = [
			{
				color: _this._options.color,
				data: _this._data
			}
		];
		
		_this._flot = flot(
			_this.$plot[0],
			_this._series,
			{
				series: {
					lines: { show: true },
					points: { show: true },
					shadowSize: 0	// Drawing is faster without shadows
				},
				xaxis: {
					mode: "time",
					tickFormatter: function (d) {
						return moment(d).format(_this._options.tick_format);
					}
				},
				yaxis: {
					min: _this._options.min,
					max: _this._options.max
				},
				legend: {
					show: true
				}
			}
		);
		
		_this._renderPlot();
		_this._renderData();
		
		// The plot is resized automagically via CSS and the `flot-plugin-resize` module, no need for handling the `layout-resized` event and resizing manually.
		
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
		
		_this._flot.shutdown();
		_this._flot = null;
		
		_this.$plot.empty();
		_this.$header.empty();
	},
	
	_renderPlot: function () {
		var _this = this;
		
		_this._flot.draw();
	},
	
	_renderData: function () {
		var _this = this;
		
		var seriesData = _this._dataStore.getData(_this._dataUrl);
		
		if (seriesData) {
			var plotData = _this._data;
			
			var selectedData = [],
				ic = seriesData.length,
				i = ic-1,
				timeInterval = _this._options.time_interval,
				xMin, xMax;
			
			// Add new data:
			while (i >= 0) {
				// Push backwards to concat later:
				selectedData.unshift({ x: seriesData[i].x, y: seriesData[i].y });
				
				// Add until we get enough points to fill the required time interval:
				if (typeof timeInterval === 'number' && (selectedData[selectedData.length-1].x - selectedData[0].x) > timeInterval) {
					break;
				}
				
				--i;
			}
			
			// Note: Update chart data in-place because our graph has a reference to it:
			plotData.splice.apply(plotData, [ 0, plotData.length ].concat(selectedData));
			
			_this._stubData();
			
			// Convert to arrays (flot required this structure):
			plotData.forEach(function (point, index) {
				plotData[index] = [ point.x, point.y ];
				if (point.x < xMin || xMin === undefined) { xMin = point.x; }
				if (point.x > xMax || xMax === undefined) { xMax = point.x; }
			});
			
			_this._flot.getOptions().xaxes[0].min = xMin;
			_this._flot.getOptions().xaxes[0].max = xMax;
			_this._flot.setupGrid();
			_this._flot.setData(_this._series);
			_this._flot.draw();
		}
	},
	
	_stubData: function () {
		var _this = this;
		
		var plotData = _this._data;
		var timeInterval = _this._options.time_interval;
		
		// WARNING: Assuming a time-based data that comes each second,
		// so we stub each second back until we fill the whole time interval.
		
		// TODO: Remove the stubbing when proper backend with historical data is ready.
		
		var nowX = (new Date()).getTime();
		
		if (plotData.length <= 0) {
			plotData.push({
				x: nowX,
				y: 0,
				stub: true
			});
		}
		
		while ((plotData[plotData.length-1].x - plotData[0].x) <= timeInterval) {
			plotData.unshift({
				x: plotData[0].x - 1000,
				y: 0,
				stub: true
			});
		}
	}
});

module.exports = PlotVisualizer;
