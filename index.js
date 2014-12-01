var server = require('./src/server');

// Start the server-side which includes the WebSocket server and a simple HTTP server to serve static files to the browser.
server.start();

// HACK: Avoid making additional gulp task that runs both the server-side and the webpack development server.
if (process.env.NODE_ENV === 'development') {
	require('./gulpfile.js').run('webpack-dev-server');	
}
