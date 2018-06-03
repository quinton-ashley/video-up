#!/usr/bin/env node

let opt = require('minimist')(process.argv.slice(2));
console.log(opt.i);
if (!opt.i && !opt.input) {
  opt.i = opt.input = '.';
}
require('..')(opt);
