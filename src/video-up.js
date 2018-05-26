module.exports = function(args, opt) {
  const checkDiskSpace = require('check-disk-space');
  const delay = require('delay');
  const fs = require('fs-extra');
  const klawSync = require('klaw-sync'); // get all files in a directory
  const path = require('path');
  const process = require('process'); // built-in node.js process library
  const spawn = require('await-spawn'); // use await with a child process

  const __homeDir = require('os').homedir();
  const __parentDir = path.dirname(process.mainModule.filename);
  const err = console.error;
  const log = console.log;

  let input = opt.i;
  if (!input || !fs.existsSync(input)) {
    throw `file input doesn't exit`;
  }
  let outputDir = (opt.o || 'D:/Videos/Avatar_The_Last_Airbender/Book_3');
  let vidNum = (-opt.s || 0);
  let upscalerProcess, multiPart, partNum;

  async function _upscale(vid, startNumber) {
    let vidDir = (opt.t || opt.o || 'E:/atla') + '/' + path.parse(vid).name;
    log(vidDir);
    fs.ensureDirSync(outputDir);

    if (!startNumber) {
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
    }

    // check free space on disk
    let diskCheck = setInterval(async () => {
      let freespace = (await checkDiskSpace(vidDir)).free;
      freespace /= 1000000.0;
      log(Math.round(freespace) + 'MB');
      if (freespace <= 1000) {
        upscalerProcess.kill('SIGINT');
        multiPart = true;
        clearInterval(diskCheck);
      }
    }, 60000);

    // upscale frames with waifu2x: 16 bit color, cudnn processor used,
    // noise level 3
    log('waifu2x upscale in progress');
    let waifu2x = 'C:/Program Files (x86)/waifu2x-caffe/waifu2x-caffe-cui.exe';
    upscalerProcess = await spawn(waifu2x, [
      '-i', vidDir + '/z',
      '-d', (opt.d || 16),
      '-p', (opt.p || 'cudnn'),
      '-n', (opt.n || 3),
      '-o', vidDir + '/up'
    ], {
      stdio: 'inherit'
    });

    let preVidPath = `${outputDir}/${path.parse(vid).name}_${partNum}.mp4`;

    // use GPU to convert frames into h.265 encoded video with 16 bit color
    // qp of 12 is practically lossless
    await spawn('ffmpeg', [
      '-hwaccel', 'cuvid',
      '-r', (opt.r || '24000/1001'),
      '-start_number', (startNumber || 0),
      '-i', vidDir + '/up/z%06d.png',
      '-c:v', 'hevc_nvenc',
      '-rc:v', 'constqp',
      '-qp', 12,
      '-rc-lookahead', 32,
      '-pix_fmt', 'yuv444p10le',
      preVidPath
    ], {
      stdio: 'inherit'
    });

    let finalVidPath = `${outputDir}/${path.parse(vid).name}.mp4`;

    if (multiPart) {
      let upDir = vidDir + '/up';
      let files = klawSync(upDir);
      let last = 1;
      let cur;
      for (let i = 0; i < files.length; i++) {
        cur = Math.round(new Number(path.parse(files[i].path).name.slice(1)));
        if (cur > last) {
          last = cur;
        }
      }
      fs.removeSync(upDir);
      partNum++;
      multiPart = false;
      return await upscale(vid, last);
    }

    if (partNum > 0) {
      let partsFile = '';
      for (let i = 0; i <= partNum; i++) {
        partsFile += `file '${outputDir}/${path.parse(vid).name}_${i}.mp4'\n`;
      }
      let partsFilePath = `${outputDir}/${path.parse(vid).name}_parts.txt`
      fs.outputFileSync(partsFilePath, partsFile);
      preVidPath = `${outputDir}/${path.parse(vid).name}_combo.mp4`;

      await spawn('ffmpeg', [
        '-f', 'concat',
        '-i', 'input.txt',
        '-c', 'copy',
        preVidPath
      ], {
        stdio: 'inherit'
      });
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

    fs.removeSync(preVidPath);

    // remove temp directory
    fs.removeSync(vidDir);
    clearInterval(diskCheck);
    log('finished!');
    return true;
  }

  async function upscale(vid, startNumber) {
    try {
      await _upscale(vid, startNumber);
    } catch (er) {
      err(er);
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
            await upscale(input + '/' + files[i]);
          }
          vidNum++;
        }
      }
    } else {
      await upscale(input);
    }
  }

  findVids();
};
