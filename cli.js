#!/usr/bin/env node

(async function() {
	console.log('video-up by Quinton Ashley (qashto)');
	let opt = require('minimist')(process.argv.slice(2));
	await require('./core/setup.js')(opt);

	log('-i input -o ouput -h help');
	if (opt.h || opt.help) {
		log('example use: ');
		log('video-up -i input/dir -o output/dir');
	}

	opt.cli = true;
	await require('./core/video-up.js')(opt);
})();
