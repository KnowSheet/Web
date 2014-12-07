var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');
var Rickshaw = require('rickshaw');
var moment = require('moment');
var console = global.console;
var setTimeout = global.setTimeout;

require('./dashboard.less');


var CHART_DEFAULTS = {
	TIME_INTERVAL: 10 * 1000,
	TICK_COUNT: 5
};


function Dashboard(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this.selector = 'body';
	
	_this._layout = {};
	_this._layoutLoading = false;
	
	_this._series = {};
	
	_.extend(_this, options);
	
	_this.$el = $(_this.selector).addClass('wsdash-root');
	
	_this._renderLayout();
	
	$(global).on('resize orientationchange', _.throttle(function () {
		_this._resizeLayout();
	}, 10));
}
inherits(Dashboard, EventEmitter);
_.extend(Dashboard.prototype, {
	updateLayout: function (layout) {
		var _this = this;
		
		_this._layout = layout || {};
		
		_this._copyDataToLayout();
		
		_this._renderLayout();
	},
	
	updateCharts: function (updates) {
		var _this = this;
		
		for (var seriesId in updates) { if (updates.hasOwnProperty(seriesId)) {
			var update = updates[seriesId];
			if (update && update.data) {
				var updateData = update.data;
				
				var series = _this._series[seriesId] = _this._series[seriesId] || {};
				var seriesData = series.data = series.data || [];
				
				if (update.replace) {
					seriesData.splice.apply(seriesData, [ 0, seriesData.length ].concat(updateData));
				}
				else {
					seriesData.push.apply(seriesData, updateData);
				}
				
				_this._copyDataToLayout(seriesId);
			}
		} }
	},
	
	_traverseLayout: function (layout, ctx, beforeFn, itemFn, afterFn) {
		var _this = this,
			items = layout.row || layout.col || [];
		
		if (beforeFn) { beforeFn.call(_this, ctx, layout); }
		
		_.each(items, function (item) {
			if (itemFn) { itemFn.call(_this, ctx, layout, item, item.cell); }
			
			if (item.row || item.col) {
				_this._traverseLayout(item, ctx, beforeFn, itemFn, afterFn);
			}
		});
		
		if (afterFn) { afterFn.call(_this, ctx, layout); }
	},
	
	_renderLayout: function () {
		var _this = this,
			layout = _this._layout,
			$wrapper = _this.$el;
		
		$wrapper.empty();
		
		layout.$root = $wrapper;
		
		_this._traverseLayout(layout, {},
			function (ctx, layout) {
				var $layout = layout.$layout = $('<div class="wsdash-layout"></div>');
				
				if (layout.row) {
					$layout.addClass('wsdash-layout__m-row');
				}
				else {
					$layout.addClass('wsdash-layout__m-col');
				}
		
				var $cards = layout.$cards = $('<div class="wsdash-layout__items"></div>');
				
				$layout.appendTo(layout.$root);
				$cards.appendTo($layout);
			},
			function (ctx, layout, item, cell) {
				var $item = item.$root = $('<div class="wsdash-layout__item"></div>');
				
				$item.appendTo(layout.$cards);
				
				if (cell) {
					var $card = cell.$card = $('<div class="wsdash-card"></div>');
					
					$card.appendTo($item);
				
					if (cell.header) {
						var $header = cell.header.$el = $('<div class="wsdash-card__header"></div>');
						
						$header.text(cell.header.text);
						
						$header.appendTo($card);
					}
				
					if (cell.chart) {
						var $chartWrapper = cell.chart.$wrapper = $('<div class="wsdash-card__chart-wrapper"></div>');
						
						$chartWrapper.appendTo($card);
						
						var $chart = cell.chart.$el = $('<div class="wsdash-card__chart"></div>');

						$chart.appendTo($chartWrapper);
						
						var series = _this._series[cell.chart.seriesId] || {};
						
						_this._copyDataToLayout(cell.chart.seriesId, cell);
						
						var graph = cell.chart.graph = new Rickshaw.Graph({
							element: $chart[0],
							width: $chart.width(),
							height: $chart.height(),
							renderer: cell.chart.renderer || 'lineplot',
							preserve: true,
							series: [
								{
									name: cell.chart.seriesId,
									color: (cell.chart.color || 'rgba(0,0,0,1)'),
									data: cell.chart.data
								}
							],
							min: cell.chart.min,
							max: cell.chart.max,
							interpolation: cell.chart.interpolation || 'none'
						});
						
						graph.render();
						
						var ticksTreatment = 'glow';
						
						cell.chart.xAxisTimeUnit = {
							seconds: _this._getChartTickInterval(cell),
							formatter: function (d) {
								return moment(d).format('HH:mm:ss');
							}
						};
						
						var xAxis = cell.chart.xAxis = new Rickshaw.Graph.Axis.Time({
							graph: graph,
							ticksTreatment: ticksTreatment,
							timeUnit: cell.chart.xAxisTimeUnit
						});
						xAxis.render();
						
						var yAxis = cell.chart.yAxis = new Rickshaw.Graph.Axis.Y({
							graph: graph,
							tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
							ticksTreatment: ticksTreatment
						});
						yAxis.render();
						
						_this._updateChartTimeInterval(cell);
					}
				}
			},
			null
		);
		
		_this._resizeLayout();
	},
	
	_copyDataToLayout: function (targetSeriesId, targetCell) {
		var _this = this,
			layout = _this._layout;
		
		_this._traverseLayout(layout, {},
			null,
			function (ctx, layout, item, cell) {
				if (targetCell && cell !== targetCell) { return; }
				if (cell && cell.chart && (!targetSeriesId || cell.chart.seriesId === targetSeriesId)) {
					var chartData = cell.chart.data = cell.chart.data || [];
					
					var series = _this._series[cell.chart.seriesId];
					
					if (series) {
						var seriesData = series.data;
						
						var selectedData = [],
							ic = seriesData.length,
							i = ic-1;
						
						// Add new data:
						while (i >= 0) {
							// Push backwards to concat later:
							selectedData.unshift({ x: seriesData[i].x, y: seriesData[i].y });
							
							// Add until we get enough points to fill the required time interval:
							if ((selectedData[selectedData.length-1].x - selectedData[0].x) > cell.chart.timeInterval) {
								break;
							}
							
							--i;
						}
						
						// Note: Update chart data in-place because our graph has a reference to it:
						chartData.splice.apply(chartData, [ 0, chartData.length ].concat(selectedData));
					}
					
					_this._stubChartData(chartData, cell.chart.timeInterval);
					
					// Convert to seconds (Rickshaw requires this time format):
					chartData.forEach(function (point) {
						point.x /= 1000;
					});
					
					if (cell.chart.graph) {
						cell.chart.graph.render();
					}
					
					_this._updateChartTimeInterval(cell);
				}
			},
			null
		);
	},
	
	_getChartTickInterval: function (cell) {
		var chartData = cell.chart.data;
		var chartTimeInterval = (chartData && chartData.length >= 2 ? chartData[chartData.length-1].x - chartData[0].x : CHART_DEFAULTS.TIME_INTERVAL);
		
		var chartTickInterval = Math.ceil(chartTimeInterval / (cell.chart.tickCount || CHART_DEFAULTS.TICK_COUNT));
		
		return chartTickInterval;
	},
	
	_updateChartTimeInterval: function (cell) {
		var _this = this,
			chartTickInterval;
		
		if (cell.chart.xAxisTimeUnit) {
			chartTickInterval = _this._getChartTickInterval(cell);
			if (chartTickInterval !== cell.chart.xAxisTimeUnit.seconds) {
				cell.chart.xAxisTimeUnit.seconds = chartTickInterval;
				
				if (cell.chart.xAxis) {
					cell.chart.xAxis.render();
				}
			}
		}
	},
	
	_resizeLayout: function () {
		var _this = this,
			layout = _this._layout;
		
		_this._traverseLayout(layout, {},
			null,
			function (ctx, layout, item, cell) {
				if (cell && cell.chart && cell.chart.graph) {
					var $chartWrapper = cell.chart.$wrapper;
					var $chart = cell.chart.$el;
					
					$chart.hide();
					
					cell.chart.graph.configure({
						width: $chartWrapper.width(),
						height: $chartWrapper.height()
					});
					
					$chart.show();
					
					cell.chart.graph.render();
				}
			},
			null
		);
	},
	
	_stubChartData: function (chartData, timeInterval) {
		// WARNING: Assuming a time-based data that comes each second, so we stub each second back until we fill the whole time interval.
		// TODO: Either update the stubbing to support various domains or remove if we don't need it.
		
		var nowX = (new Date()).getTime();
		
		if (chartData.length <= 0) {
			chartData.push({
				x: nowX,
				y: 0,
				stub: true
			});
		}
		
		while ((chartData[chartData.length-1].x - chartData[0].x) <= timeInterval) {
			chartData.unshift({
				x: chartData[0].x - 1000,
				y: 0,
				stub: true
			});
		}
	}
});

module.exports = Dashboard;
