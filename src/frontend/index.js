/*global window*/
'use strict';

var $ = require('jquery');
var _ = require('underscore');
var EventEmitter = require('node-event-emitter');
var URL = require('url');

var queryStringUtil = require('./query-string-util');

var PersistentConnection = require('./persistent-connection');
var JsonPerLineParser = require('./json-per-line-parser');

var Dashboard = require('./dashboard');
var DashboardDataStore = require('./dashboard-data-store');
var DashboardLayoutStore = require('./dashboard-layout-store');

require('./index.less');


var logger = require('./logger');

var logPrefix = '[frontend] ';


logger.log(logPrefix + 'Loaded at ' + (new Date()));


/**
 * Copies all HTMl attributes from one DOM node to another.
 */
function copyHtmlAttributes(srcEl, dstEl) {
	for (var atts = srcEl.attributes, ic = atts.length, i = 0; i < ic; ++i) {
		dstEl.setAttribute(atts[i].nodeName, atts[i].nodeValue);
	}
}


function init() {
	var dispatcher = new EventEmitter();
	
	var config = null;
	var dataHostnamesRoundRobin = 0;
	
	var backendApi = {
		/**
		 * Loads the config from the backend, then loads the layout.
		 * The config includes:
		 * - {string} layout_url The URL of the dashboard layout, the base for other URLs.
		 * - {Array.<string>} [data_hostnames] An array of hostnames that resolve to
		 *     the backend to fool the browser's domain connection limit.
		 * - {string} [dashboard_template] The HTML template of the dashboard (full HTML document).
		 *     Replaces the current HTMl document contents. Should contain an HTML element
		 *     with `knsh-dashboard-root` class. May also contain CSS styles and JS scripts.
		 */
		loadConfig: function () {
			// Obtain the base URL of the dashboard.
			var baseUrl = window.location.pathname;
			
			// The backend must guarantee the base URL to have a trailing slash,
			// otherwise there could be issues with relative URL resolution done by
			// the browser (e.g. from the stylesheets).
			if (baseUrl.lastIndexOf('/') !== baseUrl.length-1) {
				logger.error(logPrefix + 'The base path must have a trailing slash: ' + baseUrl);
				window.alert('The base path must have a trailing slash: ' + baseUrl);
				return;
			}
			
			// Build the config URL.
			var configUrl = baseUrl + 'config';
			
			// Load the config from the backend.
			$.ajax({
				url: configUrl,
				dataType: 'json'
			}).then(function (response) {
				config = _.extend({
					layout_url: null,
					data_hostnames: [],
					dashboard_template: ''
				}, response && response.config);
				
				if (!config.layout_url) {
					logger.error(logPrefix + 'Empty "layout_url" in config from ' + configUrl + ':', config);
					window.alert('Got invalid config from ' + configUrl + '.');
					return;
				}
				
				if (config.dashboard_template) {
					// Parse the HTML template string into a DOM document.
					var templateDocument = window.document.implementation.createHTMLDocument('');
					templateDocument.documentElement.innerHTML = config.dashboard_template;
					
					// Prepare to move elements from the template to the current document.
					var $src = $(templateDocument);
					var $srcHead = $src.find('head');
					var $srcBody = $src.find('body');
					
					var $dst = $(window.document);
					var $dstHead = $dst.find('head');
					var $dstBody = $dst.find('body');
					
					// Move the template elements to the current document.
					$dstHead.append( $srcHead.contents() );
					$dstBody.empty().append( $srcBody.contents() );
					
					// Copy the attribute values on the root elements.
					copyHtmlAttributes($srcHead[0], $dstHead[0]);
					copyHtmlAttributes($srcBody[0], $dstBody[0]);
				}
				else {
					// The empty template is not a critical error, we'll use the default.
					logger.error(logPrefix + 'Empty "dashboard_template" in config from ' + configUrl + ':', config);
				}
				
				// The `knsh-dashboard-root` element comes from the `dashboard_template`.
				// If the template is empty, the element from the default HTML is used.
				dashboard.mount( $('.knsh-dashboard-root') );
				
				// Load the layout after the dashboard is mounted to the template.
				backendApi.loadLayout();
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load config from ' + configUrl + ':', jqXHR);
				window.alert('An error occurred while loading config from ' + configUrl + '.');
			});
		},
		
		/**
		 * Patches the passed URL with the next hostname from the config, if available.
		 *
		 * @param {string} url The URL to patch.
		 * @return {string} The URL with the hostname replaced, or the initial URL if the hostnames are not available.
		 */
		cycleHostname: function (url) {
			if (!config) {
				logger.error(logPrefix + 'The config is not loaded.');
				window.alert('The config is not loaded.');
				return;
			}
			
			var dataHostnames = config.data_hostnames;
			
			// If the hostnames array is not available, the URL is not modified.
			if (dataHostnames && dataHostnames.length > 0) {
				// Check and, if required, reset the selected hostname index.
				if (dataHostnamesRoundRobin >= dataHostnames.length) {
					dataHostnamesRoundRobin = 0;
				}
				
				// Parse the passed URL into components.
				var dataUrlParsed = URL.parse(url);
				
				// Set the hostname to the selected one.
				dataUrlParsed.hostname = dataHostnames[dataHostnamesRoundRobin];
				
				// Set the protocol and port, they are required if the hostname is set.
				dataUrlParsed.protocol = dataUrlParsed.protocol || window.location.protocol;
				dataUrlParsed.port = dataUrlParsed.port || window.location.port;
				
				// Invalidate composite properties to use
				// the updated `hostname`, `protocol` and `port`.
				dataUrlParsed.host = null;
				dataUrlParsed.href = null;
				
				// Combine into a string.
				url = URL.format(dataUrlParsed);
				
				// Advance to the next hostname.
				dataHostnamesRoundRobin++;
			}
			
			return url;
		},
		
		/**
		 * Loads the layout via the URL from the config.
		 * The config must be loaded before.
		 */
		loadLayout: function () {
			if (!config) {
				logger.error(logPrefix + 'The config is not loaded.');
				window.alert('The config is not loaded.');
				return;
			}
			
			var layoutUrl = config.layout_url;
			
			layoutUrl = backendApi.cycleHostname(layoutUrl);
			
			$.ajax({
				url: layoutUrl,
				dataType: 'json'
			}).then(function (response) {
				var layout = response.layout;
				
				if (layout) {
					logger.log(logPrefix + 'Loaded layout from ' + layoutUrl + ':', layout);
					
					dispatcher.emit('receive-layout', {
						layoutUrl: layoutUrl,
						layout: layout
					});
				}
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load layout from ' + layoutUrl + ':', jqXHR);
				window.alert('An error occurred while loading layout from ' + layoutUrl + '.');
			});
		},
		
		/**
		 * Loads the metadata for a single layout cell.
		 * The config must be loaded before.
		 */
		loadMeta: function (metaUrl) {
			if (!config) {
				logger.error(logPrefix + 'The config is not loaded.');
				window.alert('The config is not loaded.');
				return;
			}
			
			var metaUrlFull = config.layout_url + metaUrl;
			
			metaUrlFull = backendApi.cycleHostname(metaUrlFull);
			
			$.ajax({
				url: metaUrlFull,
				dataType: 'json'
			}).then(function (response) {
				var meta = response.meta;
				
				if (meta) {
					logger.log(logPrefix + 'Loaded meta from ' + metaUrlFull + ':', meta);
					
					dispatcher.emit('receive-meta', {
						metaUrl: metaUrl,
						meta: meta
					});
				}
			}, function (jqXHR) {
				logger.error(logPrefix + 'Failed to load meta from ' + metaUrlFull + ':', jqXHR);
				window.alert('An error occurred while loading meta from ' + metaUrlFull + '.');
			});
		},
		
		/**
		 * Connects to the data stream with a persistent connection
		 * and triggers updates when new data arrives.
		 * Uses "dataHostnames" to find the hostname to connect to.
		 * The config must be loaded before.
		 */
		streamData: function (meta) {
			if (!config) {
				logger.error(logPrefix + 'The config is not loaded.');
				window.alert('The config is not loaded.');
				return;
			}
			
			var dataUrl = meta.data_url;
			var dataUrlFull = config.layout_url + dataUrl;
			dataUrlFull = backendApi.cycleHostname(dataUrlFull);
			
			
			var time_interval = (meta.visualizer_options && meta.visualizer_options.time_interval);
			if (typeof time_interval !== 'number' || time_interval < 0) {
				time_interval = 0;
			}
			
			var n_min = (meta.visualizer_options && meta.visualizer_options.n_min);
			if (typeof n_min !== 'number' || n_min < 0) {
				n_min = 0;
			}
			
			
			var queryParams = {};
			
			if (n_min > 0) {
				queryParams.n_min = n_min;
			}
			if (time_interval > 0) {
				queryParams.recent = time_interval;
			}
			
			
			var stopping = false;
			
			var persistentConnection = new PersistentConnection({
				logPrefix: 	logPrefix + ' [' + dataUrl + '] [PersistentConnection] '
			});
			
			var jsonPerLineParser = new JsonPerLineParser({
				logPrefix: 	logPrefix + ' [' + dataUrl + '] [JsonPerLineParser] '
			});
			
			function reconnectOnError() {
				if (!stopping && !persistentConnection.isConnecting()) {
					persistentConnection.reconnect();
				}
			}
			
			persistentConnection.on('connected', function (data) {
				jsonPerLineParser.reset();
			});
			persistentConnection.on('data', function (data) {
				jsonPerLineParser.write(data);
			});
			persistentConnection.on('end', reconnectOnError);
			persistentConnection.on('error', reconnectOnError);
			
			jsonPerLineParser.on('data', function (data) {
				// Support both raw '{"x":1,"y":2}' and Bricks' '{"point":{"x":1,"y":2}}'.
				var point = (data ? (data.point || data) : data);
				if (point && typeof point.x === 'number') {
					// The data point looks like a URL (is a string, starts with a slash).
					if (typeof point.y === 'string'
						&& point.y.indexOf('/') === 0
						&& point.y.indexOf('//') !== 0  //< Not a protocol-relative URL.
					) {
						// Treat it like relative to the data URL.
						// WARNING: Be careful not to put query strings into data URLs.
						point.y = backendApi.cycleHostname(dataUrlFull + point.y);
					}
					
					// Notify that the data has been received:
					dispatcher.emit('receive-data', {
						dataUrl: dataUrl,
						data: [ point ]
					});
				}
				else {
					logger.error(logPrefix + ' [' + dataUrl + '] Invalid data format:', data);
				}
			});
			jsonPerLineParser.on('error', reconnectOnError);
			
			persistentConnection.connect(
				queryStringUtil.extend(
					dataUrlFull,
					queryParams
				)
			);
			
			return {
				stop: function () {
					stopping = true;
					persistentConnection.disconnect();
				}
			};
		}
	};
	
	var dashboardDataStore = new DashboardDataStore(dispatcher, backendApi);
	
	var dashboardLayoutStore = new DashboardLayoutStore(dispatcher, backendApi);
	
	var dashboard = new Dashboard({
		getDataStore: function () { return dashboardDataStore; },
		getLayoutStore: function () { return dashboardLayoutStore; }
	}, {
	});
	
	$(global).on('resize orientationchange', _.throttle(function () {
		dispatcher.emit('resize-window');
	}, 50));
	
	logger.log(logPrefix + 'Initialized at ' + (new Date()));
	
	backendApi.loadConfig();
}

$(global).on('load', init);
