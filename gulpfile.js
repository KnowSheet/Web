var gulp = require("gulp");
var gutil = require("gulp-util");
var openurl = require("openurl");
var webpack = require("webpack");
var WebpackDevServer = require("webpack-dev-server");
var webpackConfig = require("./webpack.config.js");

// The development server (the recommended option for development)
gulp.task("default", [ "webpack-dev-server" ]);

// Build and watch cycle (another option for development)
// Advantage: No server required, can run app from filesystem
// Disadvantage: Requests are not blocked until bundle is available,
//               can serve an old app on refresh
gulp.task("build-dev", [ "webpack:build-dev" ], function () {
	gulp.watch(["src/**/*"], [ "webpack:build-dev" ]);
});

// Production build
gulp.task("build", [ "webpack:build" ]);

gulp.task("webpack:build", function (callback) {
	// modify some webpack config options
	var webpackBuildConfig = Object.create(webpackConfig);
	webpackBuildConfig.plugins = (webpackBuildConfig.plugins || []).concat(
		new webpack.DefinePlugin({
			"process.env": {
				// This has effect on the react lib size
				"NODE_ENV": JSON.stringify("production")
			}
		}),
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin()
	);

	// run webpack
	webpack(webpackBuildConfig, function(err, stats) {
		if (err) { return callback(new gutil.PluginError("webpack:build", err)); }
		gutil.log("[webpack:build]", stats.toString({
			colors: true
		}));
		callback();
	});
});

// modify some webpack config options
var webpackDevCompilerConfig = Object.create(webpackConfig);
webpackDevCompilerConfig.devtool = "sourcemap";
webpackDevCompilerConfig.debug = true;

// create a single instance of the compiler to allow caching
var devCompiler = webpack(webpackDevCompilerConfig);

gulp.task("webpack:build-dev", function (callback) {
	// run webpack
	devCompiler.run(function (err, stats) {
		if (err) { return callback(new gutil.PluginError("webpack:build-dev", err)); }
		gutil.log("[webpack:build-dev]", stats.toString({
			colors: true
		}));
		callback();
	});
});

gulp.task("webpack-dev-server", function (callback) {
	// modify some webpack config options
	var webpackDevServerConfig = Object.create(webpackConfig);
	webpackDevServerConfig.devtool = "eval";
	webpackDevServerConfig.debug = true;

	webpackDevServerConfig.plugins = (webpackDevServerConfig.plugins || []).concat(
		new webpack.DefinePlugin({
			"process.env": {
				"NODE_ENV": JSON.stringify("development")
			}
		})
	);

	var developmentServerConfig = webpackDevServerConfig.developmentServer || {};
	var host = (developmentServerConfig.host || "localhost");
	var port = (developmentServerConfig.port || 8080);
	
	var devUrl = "http://" + host + ":" + port + "/webpack-dev-server/index.html";
	var contentBase = "http://" + host + ":" + port + "/";

	// Start a webpack-dev-server
	new WebpackDevServer(webpack(webpackDevServerConfig), {
		contentBase: contentBase,
		publicPath: webpackDevServerConfig.output.publicPath,
		stats: {
			colors: true
		}
	}).listen(port, host, function (err) {
		if (err) { return callback(new gutil.PluginError("webpack-dev-server", err)); }
		gutil.log("[webpack-dev-server]", devUrl);
		if (gutil.env.open) {
			openurl.open(devUrl);
		}
	});
});

module.exports = gulp;
