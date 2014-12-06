var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');
var Rickshaw = require('rickshaw');
var moment = require('moment');
var console = global.console;

require('./dashboard.less');


function Dashboard(options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this.selector = 'body';
	
	_this.layout = {
		row: [
			{
				cell: {
					header: {
						text: 'CPU Load'
					},
					chart: {
						seriesId: 'cpu',
						color: 'blue',
						min: 0.0,
						max: 1.0,
						seconds: 15
					}
				}
			},
			//{
				//col: [
				//	{ cell: {} },
				//	{ cell: {} },
				//	{ cell: {} }
				//]
			//},
			{
				cell: {
					header: {
						text: 'Memory Footprint'
					},
					chart: {
						seriesId: 'memory',
						min: 0.0,
						max: 1.0,
						seconds: 15
					}
				}
			}
		]
	};
	
	_.extend(_this, options);
	
	_this.$el = $(_this.selector).addClass('wsdash-root');
	
	_this._renderLayout(_this.layout, _this.$el);
	
	_this._resizeLayout(_this.layout);
	
	$(global).on('resize orientationchange', _.throttle(function () {
		_this._resizeLayout(_this.layout);
	}, 10));
}
inherits(Dashboard, EventEmitter);
_.extend(Dashboard.prototype, {
	updateCharts: function (timestamp, seriesData) {
		var _this = this;
		
		_this._traverseLayout(_this.layout, {},
			null,
			function (ctx, layout, item, cell) {
				if (cell && cell.chart && cell.chart.seriesId && cell.chart.graph) {
					var series = seriesData[cell.chart.seriesId];
					if (series && series.data) {
						var updatesData = series.data.map(function (value) {
							return { x: Math.floor(timestamp / 1000), y: value };
						});
						
						var chartData = cell.chart.data;
						chartData.push.apply(chartData, updatesData);
						
						while ((chartData[chartData.length-1].x - chartData[0].x) > cell.chart.seconds) {
							chartData.shift();
						}
						
						cell.chart.graph.render();
					}
				}
			},
			null
		);
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
	
	_renderLayout: function (layout, $wrapper) {
		var _this = this;
		
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
						
						if (!cell.chart.data) {
							var stubData = [],
								now = Math.floor((new Date()).getTime() / 1000);
							
							for (var ic = cell.chart.seconds, i = ic; i >= 1; --i) {
								stubData.push({
									x: now - i,
									y: 0,
									stub: true
								});
							}
							
							cell.chart.data = stubData;
						}
						
						var graph = cell.chart.graph = new Rickshaw.Graph({
							element: $chart[0],
							width: $chart.width(),
							height: $chart.height(),
							renderer: cell.chart.renderer || 'lineplot',
							preserve: true,
							series: [
								{
									color: cell.chart.color || 'rgba(0,0,0,1)',
									data: cell.chart.data,
									name: (cell.header && cell.header.text) || cell.chart.name || cell.chat.seriesId
								}
							],
							min: cell.chart.min,
							max: cell.chart.max,
							interpolation: cell.chart.interpolation || 'monotone'
						});
						
						graph.render();
						
						var ticksTreatment = 'glow';
						
						var xAxis = new Rickshaw.Graph.Axis.Time({
							graph: graph,
							ticksTreatment: ticksTreatment,
							timeUnit: {
								seconds: Math.ceil(cell.chart.seconds / 5),
								formatter: function (d) {
									return moment(d).format('HH:mm:ss');
								}
							}
						});
						xAxis.render();
						
						var yAxis = new Rickshaw.Graph.Axis.Y({
							graph: graph,
							tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
							ticksTreatment: ticksTreatment
						});
						yAxis.render();
					}
				}
			},
			null
		);
	},
	
	_resizeLayout: function (layout) {
		var _this = this;
		
		_this._traverseLayout(_this.layout, {},
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
	}
});

module.exports = Dashboard;
