var fs = require('fs');
var path = require('path');
var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var _ = require("underscore");

var jshintConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '.jshintrc')));

module.exports = {
	context: __dirname,
	output: {
		path: path.join(__dirname, "public"),
		publicPath: "/",
		filename: "app/[name].js?[chunkhash]"
	},
	entry: {
		app: "./src/client/index.js",
		vendor: [
			"jquery",
			"underscore",
			"node-event-emitter",
			"d3",
			"rickshaw",
			"rickshaw-css"
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
			"jquery": path.join(__dirname, "node_modules/jquery/dist/jquery.js"),
			"d3": path.join(__dirname, "node_modules/d3/d3.js"),
			"rickshaw": path.join(__dirname, "node_modules/rickshaw/rickshaw.js"),
			"rickshaw-css": path.join(__dirname, "node_modules/rickshaw/rickshaw.css")
		},
		extensions: ["", ".js"]
	},
	plugins: [
		new webpack.optimize.CommonsChunkPlugin("vendor", "libs/[name].js?[chunkhash]"),
		new HtmlWebpackPlugin({
			template: './src/client/index.blueimp.html'
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
