module.exports = function(args, opt) {
  const checkDiskSpace = require('check-disk-space');
  const delay = require('delay');
  const fs = require('fs-extra');
  const klaw = require('klaw-promise'); // get all files in a directory
  const path = require('path');
  const process = require('process'); // built-in node.js process library
  const spawnAwait = require('await-spawn'); // use await with a child process
  const {
    spawn
  } = require('child_process');
  const {
    join
  } = require('async-child-process');

  const __homeDir = require('os').homedir();
  const __parentDir = path.dirname(process.mainModule.filename);
  const er = console.error;
  const log = console.log;

  let input = (opt.i || opt.input);
  if (!input || !fs.existsSync(input)) {
    throw `file input doesn't exit`;
  }
  let outputDir = (opt.o || opt.output || 'D:/Videos/Avatar_The_Last_Airbender/Book_3');
  let vidNum = (-opt.skip || 0);
  let upscalerProcess, multiPart, partNum;

  async function _upscale(vid, startNumber) {
    let vidName = path.parse(vid).name;
    let tempDir = (opt.t || opt.temp || 'E:/atla') + '/' + vidName;
    log('tempDir: ' + tempDir);
    fs.ensureDirSync(outputDir);
    log('startNumber: ' + startNumber);

    if (!startNumber) {
      fs.ensureDirSync(tempDir + '/y');
      fs.ensureDirSync(tempDir + '/z');

      // get frames, scale to 960:540
      await spawnAwait('ffmpeg', [
        '-i', vid,
        '-q:v', 2,
        '-vf', 'scale=960:540',
        tempDir + '/y/y%06d.jpg', '-hide_banner'
      ], {
        stdio: 'inherit'
      });

      // get frames, crop to 720:540
      await spawnAwait('ffmpeg', [
        '-i', tempDir + '/y/y%06d.jpg',
        '-q:v', 2,
        '-vf', 'crop=720:540:120:0',
        tempDir + '/z/z%06d.jpg', '-hide_banner'
      ], {
        stdio: 'inherit'
      });

      // delete all uncropped frames
      fs.removeSync(tempDir + '/y');
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
    upscalerProcess = spawn(waifu2x, [
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
    await spawnAwait('ffmpeg', [
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
          cur = path.parse(files[i].path).name;
          fs.removeSync(`${tempDir}/z/${cur}.jpg`);
          fs.removeSync(`${upDir}/${cur}.png`);
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
      fs.outputFileSync(partsFilePath, partsFile);
      preVidPath = `${outputDir}/${vidName}_combo.mp4`;

      log('combining multiple parts of ' + vidName);
      await spawnAwait('ffmpeg', [
        '-f', 'concat',
        '-safe', 0,
        '-i', partsFilePath,
        '-c', 'copy',
        preVidPath
      ], {
        stdio: 'inherit'
      });

      for (let i = 0; i <= partNum; i++) {
        fs.removeSync(`${outputDir}/${vidName}_${i}.mp4`);
      }
      fs.removeSync(partsFilePath);
    }

    // add orginal audio to upscaled video
    await spawnAwait('ffmpeg', [
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

    fs.removeSync(preVidPath);

    // remove temp directory
    fs.removeSync(tempDir);
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
    if (fs.statSync(input).isDirectory()) {
      let files = fs.readdirSync(input);
      for (let i = 0; i < files.length; i++) {
        if (fs.statSync(input + '/' + files[i]).size / 1000000.0 >= 4000) {
          if (vidNum >= 0) {
            multiPart = false;
            partNum = 0;
            await upscale(input + '/' + files[i], 0);
          }
          vidNum++;
        }
      }
    } else {
      multiPart = false;
      partNum = (opt.m || opt.multipart || ((opt.start) ? 1 : 0));
      await upscale(input, (opt.start || 0));
    }
  }

  findVids();
};
