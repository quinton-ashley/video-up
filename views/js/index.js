module.exports = async function(opt) {
	// opt.v = false; // quieter log
	opt.electron = true;
	await require(opt.__rootDir + '/core/setup.js')(opt);

	function selectDir(asg) {
		let dir = dialog.selectDir();
		$('#' + asg).val(dir);
		opt[asg] = dir;
		return dir;
	}

	cui.setUIOnChange((state, subState, gamepadConnected) => {});

	cui.setCustomActions(async function(act, isBtn) {
		log(act);
		let ui = cui.ui;
		if (act == 'in') {
			$('#inOpt').show('blind');
		} else if (act == 'inFile') {
			let file = dialog.selectFile();
			$('#input').val(file);
			opt.i = file;
			$('#inOpt').hide('blind');
			$('#out').show('blind');
		} else if (act == 'inFiles') {
			let files = dialog.selectFiles();
			if (!files) {
				return;
			}
			$('#input').val(files[0]);
			opt.i = files;
			$('#inOpt').hide('blind');
			$('#out').show('blind');
		} else if (act == 'inDir') {
			selectDir('input');
			$('#inOpt').hide('blind');
			$('#out').show('blind');
		} else if (act == 'tmp') {
			selectDir('temp');
		} else if (act == 'out') {
			let dir = selectDir('output');
			if (!opt.temp) {
				$('#temp').val(dir);
				opt.temp = dir;
			}
			$('#tmp').show('blind');
			$('#start').show('blind');
		} else if (act == 'start') {
			log(opt);
			await require(__rootDir + '/core/video-up.js')(opt);
		}
		if (act == 'quit') {
			app.exit();
		}
	});

	cui.change('main');
	cui.start({
		v: true
	});
}
