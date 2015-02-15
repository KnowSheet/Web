'use strict';

var webpackConfig = require('../../webpack.config.js');

/**
 * backend_stub configuration.
 * 
 * "dataHostnames" is an array of domain names that resolve to the backend server.
 * This array is put into the frontend config that is returned from the backend.
 * The hostnames are then used by the frontend to fool the browser's connection limit.
 * For the frontend to work with this backend_stub configuration, these hostnames
 * should be added to /etc/hosts.
 * The production backend should reply with a list of publicly resolvable hostnames.
 */
module.exports = {
	httpPort: 3001,
	staticBaseUrl: webpackConfig.output.publicPath,
	staticPath: webpackConfig.output.path,
	dataHostnames: [
		'd0.knowsheet.local',
		'd1.knowsheet.local',
		'd2.knowsheet.local',
		'd3.knowsheet.local',
		'd4.knowsheet.local',
		'd5.knowsheet.local',
		'd6.knowsheet.local',
		'd7.knowsheet.local',
		'd8.knowsheet.local',
		'd9.knowsheet.local'
	]
};
