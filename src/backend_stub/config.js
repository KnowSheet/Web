var webpackConfig = require('../../webpack.config.js');

module.exports = {
	httpPort: 3001,
	wsPort: 3002,
	staticPath: webpackConfig.output.path
};
