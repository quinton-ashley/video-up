#!/usr/bin/env node

// true if the program is run independently as a CLI
if (require.main == module) {
	require('./src/main.js')();
} else {
	module.exports = require('./src/main.js');
}
