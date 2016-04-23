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
    'src="/assets/images/figures/' + name + '">'].join(" ");
}

handlebars.registerHelper("centered_figure", centered_figure);
handlebars.registerHelper("inspect", util.inspect);
handlebars.registerHelper("inspect_keys", (obj) => { return util.inspect(_.keys(obj)); });

// plugin to set basename to filename w/o extension
function basename() {
  return function(files) {
    Object.keys(files).forEach(file => {
      const parts = path.parse(file);
      files[file].basename = parts.name;
    });
  };
}

// plugin to add ms metadata for handlebars use
function add_metadata() {
  return (files, metalsmith) => {
    Object.keys(files).forEach(file => {
      files[file].meta = metalsmith._metadata;
    });
  };
}

function fake_plugin() {
  return (files) => {};
}

module.exports = function(dev_mode, done) {
  function is_dev(plugin) {
    if (dev_mode) {
      return plugin;
    } else {
      return fake_plugin();
    }
  }

  metalsmith(__dirname)
    .source("source")
    .destination("site")
    // .metadata({}) // put something here maybe?
    .use(timer("init"))
    .use(metadata({
      publications: "metadata/publications.json",
      talks: "metadata/talks.yaml"
    }))
    .use(ignore(["metadata/*", "assets/raw/**/*"]))
    .use(is_dev(drafts()))
    .use(timer("metadata, ignore, drafts"))
    .use(basename())
    .use(timer("basename"))
    .use(collections({
      blog: {
        pattern: "blog/**/*.md",
        sortBy: "date",
        reverse: true
      },
      cpp_concurrency: {
        pattern: "series/cpp_concurrency/*.md",
        sortBy: "date",
      }
    }))
    .use(timer("collections"))
    .use(add_metadata())
    .use(timer("add_meta"))
    .use(inplace({
      pattern: ["blog/**/*.md", "series/**/*.md"],
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
    .use(pagination({
      "collections.blog": {
        perPage: 6,
        layout: "index_paginate.jade",
        first: "blog/index.html",
        path: "blog/page/:num/index.html"
      },
      "collections.cpp_concurrency": {
        perPage: 1000,
        layout: "index_collection.jade",
        first: "blog/cpp_concurrency/index.html",
        path: "fake"
      }
    }))
    .use(timer("pagination"))
    .use(permalinks({
      pattern: ":basename/",
      relative: false,
      linksets: [{
        match: { collection: "blog" },
        pattern: "blog/:basename/"
      },
      {
        match: { collection: "cpp_concurrency" },
        pattern: "cpp_concurrency/:basename/"
      }]
    }))
    .use(timer("permalinks"))
    .use(layouts({
      pattern: ["**", "!blog/**/*", "!cpp_concurrency/**/*"],
      engine: "jade",
      directory: "layouts",
      moment: moment,
      inspect: util.inspect,
      "_": _,
      pagination_classes: pagination_classes
    }))
    .use(timer("layouts1"))
    .use(layouts({
      pattern: ["blog/**/*.html", "cpp_concurrency/**/*.html"],
      default: "article.jade",
      engine: "jade",
      directory: "layouts",
      moment: moment,
      inspect: util.inspect,
      "_": _,
      pagination_classes: pagination_classes
    }))
    .use(timer("layouts"))
    .use(feed({
      collection: "blog",
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

function pagination_classes(this_index, page_index) {
  // assume 5 entries
  const classes = [];
  if (this_index === page_index) {
    classes.push("active");
  }

  if (((0 < this_index && this_index < 4) && Math.abs(page_index - this_index) > 1) ||
      ((this_index === 0 || this_index === 4) && Math.abs(page_index - this_index) > 2)) {
    classes.push("hidden-sm-down");
  }

  return classes.join(" ");
}
