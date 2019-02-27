// opt is an object with all the options
module.exports = async function(opt) {
	const checkDiskSpace = require('check-disk-space');
	const spawnChild = require('child_process').spawn;
	const {
		join
	} = require('async-child-process');

	let input = opt.i || opt.in || opt.input || '.';
	if (!input || !(await fs.exists(input))) {
		log(`file input doesn't exit`);
		return;
	}
	let outputDir = opt.o || opt.out || opt.output || 'D:/Videos/Avatar_The_Last_Airbender/Book_3';
	let vidNum = -opt.skip || 0;
	let upscalerProcess, multiPart, partNum;

	async function _upscale(vid, startNumber) {
		let vidName = path.parse(vid).name;
		let tempDir = (opt.t || opt.temp || 'E:/atla') + '/' + vidName;
		log('tempDir: ' + tempDir);
		await fs.ensureDir(outputDir);
		log('startNumber: ' + startNumber);

		if (!startNumber) {
			await fs.ensureDir(tempDir + '/y');
			await fs.ensureDir(tempDir + '/z');

			// get frames, scale to 960:540
			await spawn('ffmpeg', [
				'-i', vid,
				'-q:v', 2,
				'-vf', 'scale=960:540',
				tempDir + '/y/y%06d.jpg', '-hide_banner'
			], {
				stdio: 'inherit'
			});

			// get frames, crop to 720:540
			await spawn('ffmpeg', [
				'-i', tempDir + '/y/y%06d.jpg',
				'-q:v', 2,
				'-vf', 'crop=720:540:120:0',
				tempDir + '/z/z%06d.jpg', '-hide_banner'
			], {
				stdio: 'inherit'
			});

			// delete all uncropped frames
			await fs.remove(tempDir + '/y');
		}

		// check free space on disk
		let diskCheck = setInterval(async () => {
			let freeSpace = (await checkDiskSpace(tempDir)).free;
			freeSpace /= 1000000.0;
			log(Math.round(freeSpace) + 'MB of free space');
			if (freeSpace <= (opt.f || opt.free || 2000)) {
				log('killing waifu2x child process');
				log('creating video part number ' + partNum);
				upscalerProcess.kill();
				multiPart = true;
				clearInterval(diskCheck);
			}
		}, (opt.interval || 60000));

		// upscale frames with waifu2x, defaults can be changed via command line
		// options
		log('waifu2x upscale in progress');
		let waifu2x = 'C:/Program Files (x86)/waifu2x-caffe/waifu2x-caffe-cui.exe';
		upscalerProcess = spawnChild(waifu2x, [
			'-i', tempDir + '/z',
			'-d', (opt.d || opt.depth || 16), // 16 bit color depth
			'-p', (opt.p || opt.processor || 'cudnn'), // cudnn processor used
			'-n', (opt.n || opt.noise || 3), // noise level 3
			'-o', tempDir + '/up'
		], {
			stdio: 'inherit'
		});

		// will put out an error when closed prematurely, this must be ignored
		// for multipart upscaling
		try {
			await join(upscalerProcess);
		} catch (ror) {}
		clearInterval(diskCheck);

		let preVidPath = `${outputDir}/${vidName}_${partNum}.mp4`;

		// uses nvidia GPU to convert frames into h.265 encoded video with 16 bit
		// color, a qp of 12 is practically lossless
		await spawn('ffmpeg', [
			'-hwaccel', 'cuvid',
			'-r', (opt.r || '24000/1001'),
			'-start_number', (startNumber || 0),
			'-i', tempDir + '/up/z%06d.png',
			'-c:v', 'hevc_nvenc',
			'-rc:v', 'constqp',
			'-qp', 12,
			'-rc-lookahead', 32,
			'-pix_fmt', 'yuv444p16le',
			preVidPath
		], {
			stdio: 'inherit'
		});

		let finalVidPath = `${outputDir}/${vidName}.mp4`;

		if (multiPart) {
			let upDir = tempDir + '/up';
			let files;
			let first = 1000000;
			let last = 1;
			let cur;
			try {
				files = await klaw(upDir);
				for (let i = 0; i < files.length; i++) {
					cur = path.parse(files[i]).name;
					await fs.remove(`${tempDir}/z/${cur}.jpg`);
					await fs.remove(`${upDir}/${cur}.png`);
					cur = new Number(cur.slice(1));
					if (cur > last) {
						last = cur;
					}
					if (cur < first) {
						first = cur;
					}
				}
				log(`deleted frames ${first}-${last}`);
				files = 0;
			} catch (ror) {}
			if (last != 1) {
				partNum++;
				multiPart = false;
				return await upscale(vid, last);
			}
		}

		if (partNum > 0) {
			let partsFile = '';
			for (let i = 0; i <= partNum; i++) {
				partsFile += `file '${vidName}_${i}.mp4'\n`;
			}
			let partsFilePath = `${outputDir}/${vidName}_parts.txt`
			await fs.outputFile(partsFilePath, partsFile);
			preVidPath = `${outputDir}/${vidName}_combo.mp4`;

			log('combining multiple parts of ' + vidName);
			await spawn('ffmpeg', [
				'-f', 'concat',
				'-safe', 0,
				'-i', partsFilePath,
				'-c', 'copy',
				preVidPath
			], {
				stdio: 'inherit'
			});

			for (let i = 0; i <= partNum; i++) {
				await fs.remove(`${outputDir}/${vidName}_${i}.mp4`);
			}
			await fs.remove(partsFilePath);
		}

		// add orginal audio to upscaled video
		await spawn('ffmpeg', [
			'-i', preVidPath,
			'-i', vid,
			'-c', 'copy',
			'-map', '0:v:0',
			'-map', '1:a:0',
			'-shortest',
			finalVidPath
		], {
			stdio: 'inherit'
		});

		await fs.remove(preVidPath);

		// remove temp directory
		await fs.remove(tempDir);
		log('finished!');
		return true;
	}

	async function upscale(vid, startNumber) {
		try {
			await _upscale(vid, startNumber);
		} catch (ror) {
			er(ror);
			process.exit(1);
		}
	}

	async function findVids() {
		log('input: ' + input);
		if ((await fs.stat(input)).isDirectory()) {
			let files = fs.readdirSync(input);
			log('input directory files:');
			log(files);
			let videosProcessed = 0;
			for (let i = 0; i < files.length; i++) {
				if ((await fs.stat(input + '/' + files[i])).size / 1000000.0 >= 4000) {
					if (vidNum >= 0) {
						multiPart = false;
						partNum = 0;
						await upscale(input + '/' + files[i], 0);
						videosProcessed++;
					}
					vidNum++;
				}
			}
			if (!videosProcessed) {
				er('no video files found in input directory: ' + input);
				process.exit(1);
			}
		} else {
			multiPart = false;
			partNum = (opt.m || opt.multipart || ((opt.start) ? 1 : 0));
			await upscale(input, (opt.start || 0));
		}
	}

	findVids();
};
