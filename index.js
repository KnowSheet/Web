// Start the backend stub:
require('./src/backend_stub').start(require('./src/backend_stub/config.js'));

// Start the frontend development server that provides live recompilation and reload in the browser during development:
require('./gulpfile.js').run('webpack-dev-server');	
