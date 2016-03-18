// debug plugin for metalsmith

const util = require("util");

module.exports = function debug(msg, options) {
  return function(files, metalsmith, done) {
    console.log(msg);
    if (options.long) {
      Object.keys(files).forEach(
        file => {
          console.log("file:", file);
          console.log("data:", util.inspect(files[file]));
          if (options.show_md && file.endsWith("md")) {
            console.log(files[file].contents.toString());
          }
        });
    } else if (options.keys) {
      Object.keys(files).forEach(
        file => {
          console.log("file:", file);
          options.keys.forEach(k => console.log("  " + k + ": " + files[file][k]));
      });
    } else {
      console.log(Object.keys(files));
    }
    done();
  };
}

