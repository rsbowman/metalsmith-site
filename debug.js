// debug plugin for metalsmith

const util = require("util"),
  _ = require("lodash");

module.exports = function debug(msg, options) {
  return function(files, metalsmith, done) {
    console.log(msg);
    if (options.long) {
      Object.keys(files).forEach(
        file => {
          const file_data = _.omit(files[file], ["stats", "previous", "next"])
          console.log("file:", file);
          console.log("data:", util.inspect(file_data));
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

