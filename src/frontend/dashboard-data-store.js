var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var inherits = require('inherits');


function DashboardDataStore(dispatcher) {
	EventEmitter.call(this);
	
	var _this = this;
	
	_this._series = {};
	
	dispatcher.on('receive-data-updates', function (payload) {
		_this._handleDataUpdates(payload);
	});
}
inherits(DashboardDataStore, EventEmitter);
_.extend(DashboardDataStore.prototype, {
	getData: function (seriesId) {
		return this._series[seriesId];
	},
	
	_handleDataUpdates: function (updates) {
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
				
				_this.emit('data-updated', {
					seriesId: seriesId
				});
			}
		} }
	}
});

module.exports = DashboardDataStore;
