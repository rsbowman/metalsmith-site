"use strict"

const build = require("./ms-pipeline.js")

build(false, (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    console.log("Ok!");
    process.exit(0);
  }
});
