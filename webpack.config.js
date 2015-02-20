var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var _ = require("underscore");

var jshintConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '.jshintrc')));

var isProduction = (process.env.NODE_ENV === "production");

var webpackConfig = {
	context: __dirname,
	output: {
		path: path.join(__dirname, (isProduction ? "build" : "build-dev")),
		// Use a relative `publicPath` to be able to serve from a subdirectory.
		publicPath: "static/",
		filename: "[name].js?[chunkhash]"
	},
	entry: {
		app: "./src/frontend/index.js",
		vendor: [
			"jquery",
			"underscore",
			"node-event-emitter",
			"d3",
			"rickshaw",
			"rickshaw-css",
			"moment"
		]
	},
	module: {
		preLoaders: [
			{
				test: /\.js$/,
				exclude: path.join(__dirname, "node_modules"),
				loader: "jshint-loader"
			}
		],
		loaders: [
			{ test: /\.json$/i, loader: "json-loader" },
			{ test: /\.less$/i, loader: "style-loader!css-loader!less-loader" },
			{ test: /\.css$/i, loader: "style-loader!css-loader" },
			{ test: /\.(jpe?g|png|gif)$/i, loader: "file-loader?name=[path][name].[ext]?[hash]" },
			{ test: /\.(mp3|ac3|ogg|m4a)$/i, loader: "file-loader?name=[path][name].[ext]?[hash]" },
			{ test: /\.(ttf|woff|eot)$/i, loader: "file-loader?name=[path][name].[ext]?[hash]" }
		]
	},
	resolve: {
		alias: {
			"jquery": path.join(__dirname, "node_modules/jquery/dist/" + (isProduction ? "jquery.min.js" : "jquery.js")),
			"d3": path.join(__dirname, "node_modules/d3/" + (isProduction ? "d3.min.js" : "d3.js")),
			"rickshaw": path.join(__dirname, "node_modules/rickshaw/" + (isProduction ? "rickshaw.min.js" : "rickshaw.js")),
			"rickshaw-css": path.join(__dirname, "node_modules/rickshaw/" + (isProduction ? "rickshaw.min.css" : "rickshaw.css")),
			
			"prefixer.less": path.join(__dirname, "src/frontend/vendor/prefixer.less"),
			"flexbox.less": path.join(__dirname, "src/frontend/vendor/flexbox.less")
		},
		extensions: ["", ".js"]
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin("vendor", "[name].js?[chunkhash]"),
		new HtmlWebpackPlugin({
			template: './src/frontend/index.blueimp.html'
		})
	],
	jshint: _.extend({
		emitErrors: true,
		failOnHint: false
	}, jshintConfig),
	developmentServer: {
		port: 3000
	}
};

if (isProduction) {
	webpackConfig.plugins.push(
		new webpack.DefinePlugin({
			"process.env": {
				NODE_ENV: JSON.stringify("production")
			}
		}),
		new webpack.optimize.DedupePlugin(),
		new webpack.optimize.UglifyJsPlugin({
			sourceMap: false,
			mangle: {
				except: [
					"$super" //< "rickshaw" module uses "$super" for inheritance.
				]
			}
		})
	);
}

module.exports = webpackConfig;
