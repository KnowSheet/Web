'use strict';

var webpackConfig = require('../../webpack.config.js');

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
