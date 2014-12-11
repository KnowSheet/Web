var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');

var DashboardLayout = require('./dashboard-layout');

require('./dashboard.less');

var console = global.console;


function Dashboard(locator, options) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._locator = locator;
	
	_this._options = _.extend({
	}, options);
	
	var $el = _this.$el = $('<div class="knsh-dashboard" />');
}
inherits(Dashboard, EventEmitter);
require('./util-mount-unmount')(Dashboard.prototype, 'Dashboard');
_.extend(Dashboard.prototype, {
	componentDidMount: function () {
		var _this = this;
		
		_this._layout = new DashboardLayout(_this._locator, {
		});
		
		_this._layout.mount( _this.$el );
	},
	
	componentWillUnmount: function () {
		var _this = this;
		
		_this._layout.unmount();
	}
});

module.exports = Dashboard;
