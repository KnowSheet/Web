'use strict';

var $ = require('jquery');
var _ = require('underscore');

var Rickshaw = require('rickshaw');
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
	
	var $el = _this.$el = $('<div class="' + blockCssClass + '">' +
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
		
		var graph = _this._graph = new Rickshaw.Graph({
			element: _this.$plot[0],
			width: _this.$plot.width(),
			height: _this.$plot.height(),
			renderer: _this._options.renderer,
			preserve: true,
			series: [
				{
					color: _this._options.color,
					data: _this._data
				}
			],
			min: _this._options.min,
			max: _this._options.max,
			interpolation: _this._options.interpolation
		});
		
		var ticksTreatment = 'glow';
		
		var xAxisTimeUnit = _this._xAxisTimeUnit = {
			seconds: _this._getTimeTickInterval(),
			formatter: function (d) {
				return moment(d).format(_this._options.tick_format);
			}
		};
		
		var xAxis = _this._xAxis = new Rickshaw.Graph.Axis.Time({
			graph: graph,
			ticksTreatment: ticksTreatment,
			timeUnit: xAxisTimeUnit
		});
		
		var yAxis = _this._yAxis = new Rickshaw.Graph.Axis.Y({
			graph: graph,
			tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
			ticksTreatment: ticksTreatment
		});
		
		_this._updateSize();
		_this._renderPlot();
		_this._renderData();
		
		_this._layoutStore.on('layout-resized', _this._layoutResizedListener = function () {
			_this._updateSize();
			_this._renderPlot();
		});
		
		_this._dataStore.on('data-updated', _this._dataUpdatedListener = function (args) {
			if (!args || !args.dataUrl || args.dataUrl === _this._dataUrl) {
				_this._renderData();
			}
		});
	},
	
	componentWillUnmount: function () {
		var _this = this;
		
		_this._layoutStore.removeListener('layout-resized', _this._layoutResizedListener);
		_this._layoutResizedListener = null;
		
		_this._dataStore.removeListener('data-updated', _this._dataUpdatedListener);
		_this._dataUpdatedListener = null;
		
		_this.$plot.empty();
		_this.$header.empty();
		
		_this._graph = null;
		_this._xAxis = null;
		_this._xAxisTimeUnit = null;
		_this._yAxis = null;
	},
	
	_renderPlot: function () {
		var _this = this;
		
		_this._graph.render();
		_this._xAxis.render();
		_this._yAxis.render();
	},
	
	_updateSize: function () {
		var _this = this;
		
		var $plotWrapper = _this.$plotWrapper;
		var $plot = _this.$plot;
		
		$plot.hide();
		
		_this._plotWidth = $plotWrapper.width();
		_this._plotHeight = $plotWrapper.height();
		
		_this._graph.configure({
			width: _this._plotWidth,
			height: _this._plotHeight
		});
		
		$plot.show();
	},
	
	_renderData: function () {
		var _this = this;
		
		var seriesData = _this._dataStore.getData(_this._dataUrl);
		
		if (seriesData) {
			var plotData = _this._data;
			
			var selectedData = [],
				ic = seriesData.length,
				i = ic-1,
				timeInterval = _this._options.time_interval;
			
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
			
			// Convert to seconds (Rickshaw requires this time format):
			plotData.forEach(function (point) {
				point.x /= 1000;
			});
			
			_this._renderTimeTicks();
			
			_this._graph.render();
		}
	},
	
	_getTimeTickInterval: function () {
		var _this = this;
		
		var plotData = _this._data;
		
		var timeIntervalDefault = 10 * 1000;
		
		var timeInterval = (typeof _this._options.time_interval === 'number'
			? _this._options.time_interval
			: (plotData.length >= 2
				? ((plotData[plotData.length-1].x - plotData[0].x) * 1000)
				: timeIntervalDefault
			)
		);
		
		var tickCount = _this._options.tick_count;
		
		// HACK: If the space between ticks is too small, let there be one tick per plot.
		var minWidthBetweenTicksInPixels = 70;
		if (
			_this._plotWidth > 0 &&
			(_this._plotWidth / tickCount) < minWidthBetweenTicksInPixels
		) {
			tickCount = 1;
		}
		
		var chartTickInterval = Math.ceil((timeInterval / 1000) / tickCount);
		
		return chartTickInterval;
	},
	
	_renderTimeTicks: function () {
		var _this = this,
			chartTickInterval;
		
		if (_this._xAxisTimeUnit) {
			chartTickInterval = _this._getTimeTickInterval();
			if (chartTickInterval !== _this._xAxisTimeUnit.seconds) {
				_this._xAxisTimeUnit.seconds = chartTickInterval;
				
				if (_this._xAxis) {
					_this._xAxis.render();
				}
			}
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
