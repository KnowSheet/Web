var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');


function DashboardLayoutStore(dispatcher) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._layout = {};
	
	dispatcher.on('receive-layout', function (payload) {
		_this._handleLayoutChange(payload);
	});
	
	dispatcher.on('resize-window', function (payload) {
		_this.emit('layout-resized');
	});
}
inherits(DashboardLayoutStore, EventEmitter);
_.extend(DashboardLayoutStore.prototype, {
	getLayout: function () {
		return this._layout;
	},
	
	_handleLayoutChange: function (layout) {
		var _this = this;
		
		if (!layout) { throw new Error('DashboardLayoutStore#_handleLayoutChange: No layout.'); }
		
		_this._layout = layout;
		
		_this.emit('layout-changed');
	}
});

module.exports = DashboardLayoutStore;
