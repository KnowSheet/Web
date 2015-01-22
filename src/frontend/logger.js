'use strict';

// Use 'loglevel' module for its simplicity and
// small size compared to the full-featured 'winston'.
var logger = require('loglevel');

if (process.env.NODE_ENV === "production") {
	logger.setLevel(logger.levels.ERROR);
}

// Exports 'trace', 'debug', 'info', 'log', 'warn', 'error' methods.
// Other methods like 'setLevel', 'enableAll', 'disableAll' should
// not be used from the outer code.
module.exports = logger;
