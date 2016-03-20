"use strict";

const _ = require("lodash"),
  util = require("util"),
  path = require("path"),
  moment = require("moment"),
  metalsmith = require("metalsmith"),
  metadata = require("metalsmith-metadata"),
  ignore = require("metalsmith-ignore"),
  drafts = require("metalsmith-drafts"),
  markdown_mathjax = require('markdown-it-mathjax'),
  markdown_it = require("metalsmith-markdownit"),
  md_container = require("markdown-it-container"),
  excerpts = require("metalsmith-excerpts"),
  tags = require("metalsmith-tags"),
  layouts = require("metalsmith-layouts"),
  inplace = require("metalsmith-in-place"),
  pagination = require("metalsmith-pagination"),
  permalinks = require("metalsmith-permalinks"),
  collections = require("metalsmith-collections"),
  headings = require("metalsmith-headings-identifier"),
  wordcount = require("metalsmith-word-count"),
  timer = require("metalsmith-timer"),
  feed = require("metalsmith-feed"),
  handlebars = require("handlebars");

const debug = require("./debug.js");
/*
 * functions for markdown-it, make a bootstrap 4 card "box with title"
 *
 * use:
 *
 * ::: box This is a title
 * Here is some content
 * :::
 *
 * will be rendered as a bootstrap card, the title a h4, the text
 * having class "card-text"
 */
const md_box_functions = {
  validate: function(params) {
    return params.trim().match(/^box\s+(.*)$/);
  },
  render: function(tokens, idx) {
    const raw_title = tokens[idx].info.trim().match(/^box\s+(.*)$/);
    if (tokens[idx].nesting === 1) { // open tag
      for (let i = idx; i < tokens.length; ++i) {
        if (tokens[i].type === "paragraph_open") {
          tokens[i].attrPush(["class", "card-text"]);
        } else if (tokens[i].type === "container_box_close") {
          break;
        }
      }
      const card_title = '<h4 class="card-title">' + raw_title[1] + "</h4>";
      return '<div class="card"><div class="card-block">\n' + card_title;
    } else {
      return '</div></div>\n';
    }
  }
};

// customize the markdown plugin
function markdown() {
  return markdown_it("default", {
    html: true,
    typographer: true,
    quotes: '“”‘’'
  })
  .use(markdown_mathjax)
  .use(md_container, "box", md_box_functions);
}

// handlebars helper to make a centered, responsive img.
function centered_figure(name, alt_text, width) {
  return ['<img class="img-fluid center-block"',
    'style="width: ' + width + '; height: auto;"',
    'alt="' + alt_text + '"',
    'src="/images/figures/' + name + '">'].join(" ");
}

handlebars.registerHelper("centered_figure", centered_figure);

// plugin to set basename to filename w/o extension
function basename() {
  return function(files) {
    Object.keys(files).forEach(file => {
      const parts = path.parse(file);
      files[file].basename = parts.name;
    });
  };
}

function series(_opts) {
  const opts = _opts || {};
  const collection_dir = opts.directory || "series",
    index_collection = opts.index || "posts", // collection to put index file in
    layout = opts.layout || "index_collection.jade";

  return function(files) {
    const collections = {},
      index_files = {};
    Object.keys(files).forEach(file => {
      const parts = path.parse(file),
        dir_cpts = parts.dir.split(path.sep);
      const cd_idx = dir_cpts.lastIndexOf(collection_dir);
      if (cd_idx >= 0) {
        const series = dir_cpts[cd_idx + 1];
        files[file].collection = series;
        collections[series] = collections[series] || [];
        if (parts.name === "index") {
          files[file].collection = index_collection;
          index_files[series] = file;
        } else {
          collections[series].push(files[file]);
        }
      }
    });

    Object.keys(collections).forEach(series => {
      collections[series].sort((a, b) => {
        a = a.date;
        b = b.date;
        if (!a && !b) return 0;
        if (!a) return -1;
        if (!b) return 1;
        if (b > a) return -1;
        if (a > b) return 1;
        return 0;
      });
    });

    Object.keys(collections).forEach(series => {
      files[index_files[series]].series_files = collections[series];
      files[index_files[series]].layout = layout;
      files[index_files[series]].basename = series;
    });
  };
}

module.exports = function(done) {
  metalsmith(__dirname)
  .source("source")
  .destination("site")
  .metadata({}) // put something here maybe?
  .use(timer("init"))
  .use(metadata({
    publications: "metadata/publications.json",
    talks: "metadata/talks.yaml"
  }))
  .use(ignore("metadata"))
  .use(drafts())
  .use(timer("metadata, ignore, drafts"))
  .use(basename())
  .use(timer("basename"))
  .use(series())
  .use(timer("series"))
  .use(collections({
    posts: {
      pattern: "blog/**/*.md",
      sortBy: "date",
      reverse: true
    },
    // cpp_concurrency: {
    //   pattern: "collections/cpp_concurrency/*.md",
    //   sortBy: "date",
    //   metadata: {
    //     name: "Concurrency in C++",
    //     description: "A short series of articles on concurrency in C++"
    //   }
    // }
  }))
  .use(debug("after collection", {keys: ["title", "collection", "path"]}))
  .use(timer("collections"))
  .use(inplace({
    pattern: "blog/**/*.md",
    engine: "handlebars",
  }))
  .use(timer("inplace"))
  .use(markdown())
  .use(timer("markdown"))
  .use(wordcount({
    metaKeyCount: "word_count",
    metaKeyReadingTime: "reading_time",
    speed: 200,
    seconds: false,
    raw: false
  }))
  .use(timer("wordcount"))
  .use(excerpts())
  .use(timer("excerpts"))
  .use(tags({
    handle: "tags",
    path: "blog/tags/:tag.html",
    layout: "tag.jade",
    sortBy: "date",
    reverse: true,
    skipMetadata: true
  }))
  .use(timer("tags"))
  .use(permalinks({
    pattern: ":basename",
    relative: false,
    linksets: [{
      match: { collection: "posts" },
      pattern: "blog/:basename"
    },
    {
      match: { collection: "cpp_concurrency" },
      pattern: "blog/:basename"
    }]
  }))
  .use(timer("permalinks"))
  .use(debug("after collection", {long: true})) //keys: ["title", "collection", "path"]}))
  .use(pagination({
    "collections.posts": {
      perPage: 10,
      layout: "index_paginate.jade",
      first: "blog/index.html",
      path: "blog/page/:num/index.html"
    },
    // "collections.cpp_concurrency": {
    //   perPage: 100,
    //   layout: "index_collection.jade",
    //   first: "blog/cpp-concurrency/index.html",
    //   path: "blog/cpp-concurrency/page/:num/index.html"
    // }
  }))
  .use(timer("pagination"))
  .use(layouts({
    pattern: ["**", "!blog/**/*.html"],
    engine: "jade",
    directory: "layouts",
    moment: moment,
    inspect: util.inspect
  }))
  .use(timer("layouts1"))
  .use(layouts({
    pattern: "blog/**/*.html",
    default: "article.jade",
    engine: "jade",
    directory: "layouts",
    moment: moment,
    inspect: util.inspect
  }))
  .use(timer("layouts"))
  .use(feed({
    collection: "posts",
    destination: "blog/feed.xml",
    site_url: "http://seanbowman.me/",
    title: "Software! Math! Data!",
    description: "The website of R. Sean Bowman",
    author: "R. Sean Bowman"
  }))
  .use(timer("feed"))
  .build(function (err) {
    if (err) {
      done(err);
    } else {
      done();
    }
  });
}
