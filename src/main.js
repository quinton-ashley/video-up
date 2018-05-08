module.exports = function () {
	const argv = require('minimist')(process.argv.slice(2));
	require('./video-up.js')(argv._, argv);
};
