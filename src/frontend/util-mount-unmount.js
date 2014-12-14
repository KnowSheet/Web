'use strict';

var _ = require('underscore');

module.exports = function (proto, classname) {
	_.extend(proto, {
		mount: function (container) {
			var _this = this;
			
			if (_this._mounted) { throw new Error(classname + '#mount: Already mounted.') }
			
			_this._mounted = true;
			
			if (_this.$el) {
				_this.$el.appendTo(container);
			}
			
			if (_this.componentDidMount) {
				_this.componentDidMount();
			}
		},
		
		unmount: function () {
			var _this = this;
			
			if (!_this._mounted) { throw new Error(classname + '#unmount: Not mounted.') }
			
			if (_this.componentWillUnmount) {
				_this.componentWillUnmount();
			}
			
			if (_this.$el) {
				_this.$el.detach();
			}
			
			_this._mounted = false;
		}
	});
};
