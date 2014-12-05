var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');
var Epoch = require('epoch-charting');
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
						html: 'CPU Load'
					},
					chart: {
						seriesId: 'cpu'
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
						html: 'Memory Footprint'
					},
					chart: {
						seriesId: 'memory'
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
				if (cell && cell.chart && cell.chart.seriesId && cell.chart.epochInstance) {
					var series = seriesData[cell.chart.seriesId];
					if (series && series.data) {
						var chartData = series.data.map(function (value) {
							return { time: Math.floor(timestamp / 1000), y: value };
						});
						cell.chart.epochInstance.push(chartData);
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
						
						$header.html(cell.header.html);
						
						$header.appendTo($card);
					}
				
					if (cell.chart) {
						var $chart = cell.chart.$el = $('<div class="wsdash-card__chart"></div>');
				
						$chart.appendTo($card);
			
						var epochInstance = cell.chart.epochInstance = new Epoch.Time.Line({
							el: $chart[0],
							type: 'time.line',
							axes: [ 'bottom', 'left' ],
							data: [
								{
									label: cell.chart.seriesId,
									values: [
										{ time: Math.floor((new Date()).getTime() / 1000), y: 0 }
									]
								}
							]
						});
					}
				}
			},
			function (ctx, layout) {
				
			}
		);
	},
	
	_resizeLayout: function (layout) {
		var _this = this;
		
		_this._traverseLayout(_this.layout, {},
			null,
			function (ctx, layout, item, cell) {
				// TODO: Do something to update the size of the charts.
			},
			null
		);
	}
});

module.exports = Dashboard;
