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
		horizontal: [
			{
				chart: {
					data: function (data) { return data.usage.cpu; }
				}
			},
			{
				chart: {
					data: function (data) { return data.usage.memory; }
				}
			}
		]
	};
	
	_.extend(_this, options);
	
	_this.$el = $(_this.selector).addClass('wsdash-root');
	
	_this.$wrapper = $('<div class="wsdash-wrapper"></div>').appendTo(_this.$el);
	
	_this._renderLayout(_this.layout, _this.$wrapper);
}
inherits(Dashboard, EventEmitter);
_.extend(Dashboard.prototype, {
	accept: function (data) {
		var _this = this;
		
		_this._update(data);
	},
	
	_renderLayout: function (layout, $wrapper) {
		var _this = this,
			$layout = $('<div class="wsdash-layout"></div>').appendTo($wrapper),
			items = layout.horizontal || layout.vertical || [];
		
		if (layout.horizontal) {
			$layout.addClass('wsdash-layout__m-horizontal');
		}
		else {
			$layout.addClass('wsdash-layout__m-vertical');
		}
		
		$layout = $('<div class="wsdash-layout__inner"></div>').appendTo($layout);
		
		_.each(items, function (item) {
			var $item = $('<div class="wsdash-layout-item"></div>').appendTo($layout);
			
			if (item.chart) {
				var $chart = $('<div class="wsdash-chart"></div>').appendTo($item);
				
				// TODO: Fix chart size.
				
				var chart = new Epoch.Time.Line({
					el: $chart[0]
				});
				
				chart.draw();
			}
			else {
				_this._renderLayout(item, $item);
			}
		});
	},
	
	_update: function (data) {
		// TODO: Push new data to the charts.
		
		console.log('CPU usage: ' + data.usage.cpu + ', memory usage: ' + data.usage.memory);
	}
});

module.exports = Dashboard;
