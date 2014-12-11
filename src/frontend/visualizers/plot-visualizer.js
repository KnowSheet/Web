var $ = require('jquery');
var _ = require('underscore');

var Rickshaw = require('rickshaw');
var moment = require('moment');

require('./plot-visualizer.less');


function PlotVisualizer(locator, options) {
	var _this = this;
	
	_this._locator = locator;
	
	_this._layoutStore = _this._locator.getLayoutStore();
	_this._dataStore = _this._locator.getDataStore();
	
	_this._options = _.extend({
		headerText: '',
		seriesId: undefined,
		renderer: 'lineplot',
		color: 'rgba(0,0,0,1)',
		interpolation: 'none',
		min: undefined,
		max: undefined,
		timeInterval: null,
		tickCount: 5,
		tickFormat: 'HH:mm:ss'
	}, options);
	
	_this._data = [];
	
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
		
		_this.$header.text( _this._options.headerText );
		
		var graph = _this._graph = new Rickshaw.Graph({
			element: _this.$plot[0],
			width: _this.$plot.width(),
			height: _this.$plot.height(),
			renderer: _this._options.renderer,
			preserve: true,
			series: [
				{
					name: _this._options.seriesId,
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
				return moment(d).format(_this._options.tickFormat);
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
			if (!args || !args.seriesId || args.seriesId === _this._options.seriesId) {
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
		
		var $el = _this.$el;
		var $plot = _this.$plot;
		
		$plot.hide();
		
		_this._graph.configure({
			width: $el.width(),
			height: $el.height()
		});
		
		$plot.show();
	},
	
	_renderData: function () {
		var _this = this;
		
		var series = _this._dataStore.getData(_this._options.seriesId);
		
		if (series) {
			var plotData = _this._data;
			
			var storeData = series.data;
			
			var selectedData = [],
				ic = storeData.length,
				i = ic-1,
				timeInterval = _this._options.timeInterval;
			
			// Add new data:
			while (i >= 0) {
				// Push backwards to concat later:
				selectedData.unshift({ x: storeData[i].x, y: storeData[i].y });
				
				// Add until we get enough points to fill the required time interval:
				if (timeInterval !== null && (selectedData[selectedData.length-1].x - selectedData[0].x) > timeInterval) {
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
		
		var timeInterval = (_this._options.timeInterval === null
			? (plotData.length >= 2 ? ((plotData[plotData.length-1].x - plotData[0].x) * 1000) : timeIntervalDefault)
			: _this._options.timeInterval
		);
		
		var chartTickInterval = Math.ceil((timeInterval / 1000) / _this._options.tickCount);
		
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
		var timeInterval = _this._options.timeInterval;
		
		// WARNING: Assuming a time-based data that comes each second, so we stub each second back until we fill the whole time interval.
		// TODO: Either update the stubbing to support various domains or remove if we don't need it.
		
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
