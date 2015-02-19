/*global Image*/
'use strict';

var $ = require('jquery');
var _ = require('underscore');

require('./image-visualizer.less');


function cleanupImageLoader(imageLoader) {
	imageLoader.onload = imageLoader.onerror = imageLoader.onabort = null;
}

/**
 * @see https://stereochro.me/ideas/detecting-broken-images-js
 */
function isImageOk(img) {
	// During the onload event, IE correctly identifies any images that
	// weren’t downloaded as not complete. Others should too. Gecko-based
	// browsers act like NS4 in that they report this incorrectly.
	if (!img.complete) {
	    return false;
	}

	// However, they do have two very useful properties: naturalWidth and
	// naturalHeight. These give the true size of the image. If it failed
	// to load, either of these should be zero.

	if (typeof img.naturalWidth !== "undefined" && img.naturalWidth === 0) {
	    return false;
	}

	// No other way of checking: assume it’s ok.
	return true;
}


function ImageVisualizer(locator, options, dataUrl) {
	var _this = this;
	
	_this._dataStore = locator.getDataStore();
	
	_this._dataUrl = dataUrl;
	
	_this._options = _.extend({
		header_text: '',
		empty_text: ''
	}, options);
	
	var blockCssClass = 'knsh-image-visualizer';
	
	var $el = _this.$el = $('<div class="' + blockCssClass + '">' +
		'<div class="' + blockCssClass + '__header"></div>' +
		'<div class="' + blockCssClass + '__wrapper">' +
			'<div class="' + blockCssClass + '__content">' +
				'<div class="' + blockCssClass + '__empty">' +
					_this._options.empty_text +
				'</div>' +
				'<img class="' + blockCssClass + '__image" />' +
			'</div>' +
		'</div>' +
	'</div>');
	
	_this.$header = $el.find('.' + blockCssClass + '__header');
	_this.$empty = $el.find('.' + blockCssClass + '__empty');
	_this.$image = $el.find('.' + blockCssClass + '__image');
	
	_this.$image.hide().css({
		visibility: 'hidden'
	});
	
	_this._imageLoader = null;
}
require('../util-mount-unmount')(ImageVisualizer.prototype, 'ImageVisualizer');
_.extend(ImageVisualizer.prototype, {
	componentDidMount: function () {
		var _this = this;
		
		_this.$header.text( _this._options.header_text );
		
		_this._renderData();
		
		_this._dataStore.on('data-updated', _this._dataUpdatedListener = function (args) {
			if (!args || !args.dataUrl || args.dataUrl === _this._dataUrl) {
				_this._renderData();
			}
		});
	},
	
	componentWillUnmount: function () {
		var _this = this;
		
		_this._dataStore.removeListener('data-updated', _this._dataUpdatedListener);
		_this._dataUpdatedListener = null;
		
		_this.$image.hide().css({
			visibility: 'hidden'
		});
		_this.$image.prop('src', '');
		_this.$empty.show();
		_this.$header.empty();
	},
	
	_renderData: function () {
		var _this = this;
		
		var seriesData = _this._dataStore.getData(_this._dataUrl);
		
		if (seriesData && seriesData.length) {
			var data = seriesData[seriesData.length-1];
			
			_this._loadImage(data.y);
		}
	},
	
	_loadImage: function (imageUrl) {
		var _this = this;
		
		if (_this._imageLoader) {
			cleanupImageLoader(_this._imageLoader);
			_this._imageLoader = null;
		}
		
		if (!imageUrl) {
			_this.$image.css({
				visibility: 'hidden'
			});
			_this.$empty.show();
			return;
		}
		
		var imageLoader = _this._imageLoader = new Image();
		
		imageLoader.onload = function () {
			cleanupImageLoader(imageLoader);
			
			if (_this._imageLoader === imageLoader && isImageOk(imageLoader)) {
				_this.$empty.hide();
				_this.$image.prop('src', imageLoader.src);
				_this.$image.show().css({
					visibility: ''
				});
			}
		};
		
		imageLoader.onerror = imageLoader.onabort = function () {
			cleanupImageLoader(imageLoader);
			
			if (_this._imageLoader === imageLoader) {
				_this.$image.css({
					visibility: 'hidden'
				});
				_this.$empty.show();
			}
		};
		
		imageLoader.src = imageUrl;
	}
});

module.exports = ImageVisualizer;
