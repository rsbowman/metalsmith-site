"use strict";

const build    = require("./ms-pipeline.js"),
  config       = require("./config.js"),
  util         = require("util"),
  gulp         = require("gulp"),
  gutil        = require("gulp-util"),
  w3cjs        = require("gulp-w3cjs"),
  htmlhint     = require("gulp-htmlhint"),
  browser_sync = require("browser-sync").create(),
  shell        = require("gulp-shell"),
  crawler      = require("simplecrawler");

gulp.task("metalsmith", (done) => {
  build((err) => {
    if (err) {
      gutil.log("Metalsmith error: " + err);
      done(err);
    } else {
      gutil.log("Metalsmith ok!");
      done();
    }
  });
});

gulp.task("build", ["metalsmith"]);
gulp.task("metalsmith-rebuild", ["metalsmith"], () => browser_sync.reload());

gulp.task("browser-sync", () => {
  browser_sync.init({
    server: {
      baseDir: "site/",
    },
    open: false,
    reloadDebounce: 500,
    injectChanges: false,
  });
});

gulp.task("serve", ["metalsmith", "browser-sync"], () => {
  gulp.watch("source/**/*", ["metalsmith-rebuild"]);
  gulp.watch("layouts/**/*", ["metalsmith-rebuild"]);
});

gulp.task("validator", ["metalsmith"], (done) => {
  return gulp.src(["site/**/*.html"].concat(config.lint_skip))
    .pipe(w3cjs());
});

gulp.task("htmllint", ["metalsmith"], () => {
  return gulp.src(["site/**/*.html"].concat(config.lint_skip))
    .pipe(htmlhint())
    .pipe(htmlhint.reporter());
});

gulp.task("links", (done) => {
  let n_checked = 0, n_errors = 0;

  function report_link(link) {
    gutil.log("Bad link: " + link.url + " from " + link.referrer +
              " got HTTP " + link.stateData.code);
    n_errors += 1;
  }

  gulp.doneCallback = function (err) {
    browser_sync.exit();
    gutil.log("Checked " + n_checked + " links");
    process.exit((err || n_errors > 0) ? 1 : 0);
  };

  function crawl_links() {
    const c = crawler.crawl("http://localhost:3000");
    c.filterByDomain = false;
    c.interval = 10;
    c.maxConcurrency = 50;

    c.addFetchCondition(function(parsedUrl, queueItem) {
      return (queueItem.host == c.host && !parsedUrl.path.match(/\.pdf$/i) &&
              !parsedUrl.path.match(/\.js$/i));
    });

    c.on("fetchcomplete", () => { n_checked += 1; })
      .on("fetcherror",report_link)
      .on("fetch404", report_link)
      .on("fetch410", report_link)
      .on("complete", () => {
        done();
      });
  }

  browser_sync.init({
    server: {
      baseDir: "site/",
    },
    open: false,
    port: 3000
  }, crawl_links);
});

function s3_sync(opts) {
  const opt_str = opts || "";
  return "s3cmd sync site/ s3://seanbowman.me/ --acl-public --cf-invalidate --no-mime-magic -M " + opt_str;
}

gulp.task("deploy", ["metalsmith"], shell.task(
  s3_sync()
));

gulp.task("fakedeploy", ["metalsmith"], shell.task(
  s3_sync("--dry-run")
));
