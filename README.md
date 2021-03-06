# video-up

I made this script to upscale my Avatar: The Last Airbender Blu-rays!  A lot of
setup work is required to use this script but once all the requirements
are met you can simply sit back and relax as whole disks get upscaled
automatically!

### Features

-   utilizes waifu2x 16bit image color upscaling
-   output videos will use 4:4:4 16bit color
-   output videos will be h.265 encoded
-   untouched DTS-HD stereo audio is copied from the Blu-ray disks
-   only upscales videos on the Blu-ray disk 4GB+ in size
-   keeps track of the free disk space on the drive that upscaled frames
    are written to
-   if that drive becomes full, a section of the final video is made using those
    upscaled frames, which are deleted so the rest of the frames can be made

These files can be played with MPC-HC on the latest version of Windows 10 using
an HDR projector or display.

### Requirements

-   latest version of Windows 10 for HDR and WCG support
-   nodejs and npm
-   NVIDIA graphics card with 10 bit color support
-   NVIDIA CUDA
-   NVIDIA cudnn
-   ffmpeg with cuvid h265 support
-   waifu2x-caffe
-   MakeMKV
-   128GB+ of scratch disk space for the tempDir on a fast SSD or m.2 drive
-   100GB+ free on a hard drive for an ATLA Blu-ray disc and the outputDir
-   HDR display or projector

### Recommended Specs

-   NVIDIA 10 series graphics card
-   256GB+ of scratch disk space for the tempDir on a fast SSD or m.2 drive
-   300GB+ free on a hard drive for all the ATLA Blu-ray discs and the outputDir

### CLI Installation

```javascript
npm i video-up -g
```

### CLI Usage

Whole blu-ray disk:

```javascript
video-up -i /d/Videos/ATLA/Disc3-1/BDMV/STREAM -t /e/atla/temp -o /d/Videos/ATLA/Book_3
```

Single episode:

```javascript
video-up -i /d/Videos/ATLA/Disc3-1/BDMV/STREAM/01062.m2ts -t /e/atla/temp -o /d/Videos/ATLA/Book_3
```

### node.js Usage

```javascript
require('video-up')({
  i: '/d/Videos/ATLA/Disc3-1/BDMV/STREAM/01062.m2ts',
  t: '/e/atla/temp',
  o: '/d/Videos/ATLA/Book_3'
});
```

### Please consider donating!

If you want to support this project and you appreciate my work so far please donate!  Any amount is accepted.  Thank you :)

Ethereum: 0xb4355179da353f1BA4AA0BB5a7E3Ba4FdC7128ea  
Bitcoin: 1LJkyU5jdZb525sBwcx1dA2qV8kgowdcro  
Patreon: <https://www.patreon.com/qashto>  
Paypal: <https://www.paypal.me/qashto/5>
