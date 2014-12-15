'use strict';

var webpackConfig = require('../../webpack.config.js');

module.exports = {
	httpBaseUrl: '',
	httpPort: 3001,
	staticPort: 3002,
	staticPath: webpackConfig.output.path
};
