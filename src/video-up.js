module.exports = function (args, opt) {
	const fs = require('fs-extra'); // open source library adds functionality to standard node.js fs
	const klawSync = require('klaw-sync'); // get all files in a directory
	const path = require('path');
	const process = require('process'); // built-in node.js process library
	const spawn = require('await-spawn'); // use await with a child process

	const __homeDir = require('os').homedir();
	const __parentDir = path.dirname(process.mainModule.filename);
	const error = console.error;
	const log = console.log;

	let input = opt.i;
	if (!input || !fs.existsSync(input)) {
		throw 'file input doesn\'t exit';
	}

	async function upscale(vid) {
		let vidDir = (opt.t || opt.o || 'E:/atla') + '/' + path.parse(vid).name;
		log(vidDir);
		fs.ensureDirSync(vidDir + '/y');
		fs.ensureDirSync(vidDir + '/z');

		// get frames, scale to 960:540
		await spawn('ffmpeg', [
			'-i', vid,
			'-q:v', 2,
			'-vf', 'scale=960:540',
			vidDir + '/y/y%06d.jpg', '-hide_banner'
		], {
			stdio: 'inherit'
		});

		// get frames, crop to 720:540
		await spawn('ffmpeg', [
			'-i', vidDir + '/y/y%06d.jpg',
			'-q:v', 2,
			'-vf', 'crop=720:540:120:0',
			vidDir + '/z/z%06d.jpg', '-hide_banner'
		], {
			stdio: 'inherit'
		});

		// delete all uncropped frames
		fs.removeSync(vidDir + '/y');

		//		let files = fs.readdirSync(vidDir + '/z0');
		//		files.forEach((file) => {
		//			if (Number(file[2] + file[3]) >= 17) {
		//				fs.moveSync(vidDir + '/z0/' + file, vidDir + '/z1/' + path.parse(file).base);
		//			}
		//		});

		// upscale frames with waifu2x: 16 bit color, cudnn processor used, noise level 3
		log('waifu2x upscale in progress');
		await spawn('C:/Program Files (x86)/waifu2x-caffe/waifu2x-caffe-cui.exe', [
			'-i', vidDir + '/z',
			'-d', (opt.d || 16),
			'-p', (opt.p || 'cudnn'),
			'-n', (opt.n || 3),
			'-o', vidDir + '/up'
		], {
			stdio: 'inherit'
		});

		// use GPU to convert frames into h.265 encoded video with 16 bit color
		// qp of 8 is practically lossless
		await spawn('ffmpeg', [
			'-hwaccel', 'cuvid',
			'-r', (opt.r || '24000/1001'),
			'-i', vidDir + '/up/z%06d.png',
			'-c:v', 'hevc_nvenc',
			'-rc:v', 'constqp',
			'-qp', 8,
			'-rc-lookahead', 32,
			'-pix_fmt', 'yuv444p16le',
			vidDir + '/out.mp4'
		], {
			stdio: 'inherit'
		});

		// add orginal audio to upscaled video
		await spawn('ffmpeg', [
			'-i', vidDir + '/out.mp4',
			'-i', vid,
			'-c', 'copy',
			'-map', '0:v:0',
			'-map', '1:a:0',
			'-shortest',
			(opt.o || 'D:/Videos/Avatar_The_Last_Airbender/Book_1') + '/' + path.parse(vid).name + '.mp4'
		], {
			stdio: 'inherit'
		});

		// remove temp directory
		fs.removeSync(vidDir);

		log('finished!');
	}

	async function findVids() {
		if (fs.statSync(input).isDirectory()) {
			let files = fs.readdirSync(input);
			for (let i = 0; i < files.length; i++) {
				if (fs.statSync(input + '/' + files[i]).size / 1000000.0 >= 4000) {
					await upscale(input + '/' + files[i]);
				}
			}
		} else {
			await upscale(input);
		}
	}

	findVids();
};
