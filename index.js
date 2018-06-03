module.exports = function(inputFolder) {
  const argv = require('minimist')(process.argv.slice(2));
  if (!argv.i) {
    argv.i = inputFolder;
  }
  require('./src/video-up.js')(argv._, argv);
};
