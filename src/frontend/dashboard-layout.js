var $ = require('jquery');
var _ = require('underscore');

require('./dashboard-layout.less');

var console = global.console;


function DashboardLayout(locator, options) {
	var _this = this;
	
	_this._locator = locator;
	
	_this._layoutStore = _this._locator.getLayoutStore();
	
	_this._options = _.extend({
	}, options);
	
	_this._layout = {};
	
	_this.$el = $('<div class="knsh-dashboard-layout"></div>');
}
require('./util-mount-unmount')(DashboardLayout.prototype, 'DashboardLayout');
_.extend(DashboardLayout.prototype, {
	componentDidMount: function () {
		var _this = this;
		
		_this._renderLayout();
		
		_this._layoutStore.on('layout-changed', function () {
			_this._renderLayout();
		});
	},
	
	componentWillUnmount: function () {
		var _this = this;
		
		_this._destroyLayout();
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
	
	_destroyLayout: function () {
		var _this = this;
		
		if (!_this._layout) { return; }
		
		_this._traverseLayout(_this._layout, {},
			null,
			function (ctx, layout, item, cell) {
				if (cell && cell.visualizer) {
					if (cell.visualizer.unmount) {
						cell.visualizer.unmount();
					}
					cell.visualizer = null;
				}
			},
			null
		);
		
		_this._layout = {};
		
		_this.$el.empty();
	},
	
	_renderLayout: function () {
		var _this = this;
		
		_this._destroyLayout();
		
		_this._layout = $.extend(true, {}, _this._layoutStore.getLayout());
		
		_this._layout.$root = _this.$el;
		
		_this._traverseLayout(_this._layout, {},
			function (ctx, layout) {
				var $layout = layout.$layout = $('<div class="knsh-dashboard-layout-group"></div>');
				
				if (layout.row) {
					$layout.addClass('knsh-dashboard-layout-group__m-row');
				}
				else {
					$layout.addClass('knsh-dashboard-layout-group__m-col');
				}
		
				var $items = layout.$items = $('<div class="knsh-dashboard-layout-group__items"></div>');
				
				$layout.appendTo(layout.$root);
				$items.appendTo($layout);
			},
			function (ctx, layout, item, cell) {
				var $item = item.$root = $('<div class="knsh-dashboard-layout-group__item"></div>');
				
				$item.appendTo(layout.$items);
				
				if (cell) {
					var $card = cell.$card = $('<div class="knsh-dashboard-layout-card"></div>');
					
					$card.appendTo($item);
					
					if ($.isPlainObject(cell.visualizer)) {
						cell.visualizer = new (require('./visualizers/' + cell.visualizer.name))(_this._locator, cell.visualizer.options);
						
						// Note: Mount the visualizer after the layout structure is complete to avoid resizing it.
					}
				}
			},
			null
		);
		
		// Note: Second-pass to mount the visualizers in a complete layout.
		_this._traverseLayout(_this._layout, {},
			null,
			function (ctx, layout, item, cell) {
				if (cell && cell.visualizer && cell.visualizer.componentDidMount) {
					cell.visualizer.mount( cell.$card );
				}
			},
			null
		);
		
		// WARNING: The visualizers must take dimensions from the layout and not stretch it, otherwise the sizes may get out of sync.
	}
});

module.exports = DashboardLayout;
