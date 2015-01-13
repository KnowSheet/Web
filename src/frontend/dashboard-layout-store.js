'use strict';

var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');


function DashboardLayoutStore(dispatcher, backendApi) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._backendApi = backendApi;
	
	/**
	 * Contains the current layout.
	 */
	_this._layout = {};
	
	/**
	 * Contains metadata for each layout cell.
	 * Indexed by metaUrl.
	 */
	_this._meta = {};
	
	dispatcher.on('receive-layout', function (args) {
		_this._handleLayout(args);
	});
	
	dispatcher.on('receive-meta', function (args) {
		_this._handleMeta(args);
	});
	
	dispatcher.on('resize-window', function () {
		_this.emit('layout-resized');
	});
	
	// Silence the 'possible EventEmitter memory leak detected' warning
	// when there are many visualizers (each subscribes to 'layout-resized').
	_this.setMaxListeners( 200 );
}
inherits(DashboardLayoutStore, EventEmitter);
_.extend(DashboardLayoutStore.prototype, {
	getLayout: function () {
		return this._layout;
	},
	
	getMeta: function (metaUrl) {
		return this._meta[metaUrl];
	},
	
	traverseLayout: function (layout, ctx, beforeFn, itemFn, afterFn) {
		var _this = this,
			items = layout.row || layout.col || [];
		
		if (beforeFn) { beforeFn.call(_this, ctx, layout); }
		
		_.each(items, function (item) {
			if (itemFn) { itemFn.call(_this, ctx, layout, item, item.cell); }
			
			if (item.row || item.col) {
				_this.traverseLayout(item, ctx, beforeFn, itemFn, afterFn);
			}
		});
		
		if (afterFn) { afterFn.call(_this, ctx, layout); }
	},
	
	_handleLayout: function (args) {
		var _this = this;
		
		_this._layout = args.layout || {};
		
		_this.traverseLayout(_this._layout, {},
			null,
			function (ctx, layout, item, cell) {
				if (cell && cell.meta_url) {
					_this._backendApi.loadMeta(cell.meta_url);
				}
			},
			null
		);
		
		_this.emit('layout-changed');
	},
	
	_handleMeta: function (args) {
		var _this = this;
		
		_this._meta[args.metaUrl] = args.meta;
		
		_this.emit('meta-changed', {
			metaUrl: args.metaUrl
		});
	}
});

module.exports = DashboardLayoutStore;
