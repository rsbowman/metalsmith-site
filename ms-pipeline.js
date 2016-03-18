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
  wordcount = require("metalsmith-word-count"),
  feed = require("metalsmith-feed"),
  handlebars = require("handlebars");

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
  return function(files, ms, done) {
    setImmediate(done);
    Object.keys(files).forEach(file => {
      const parts = path.parse(file);
      files[file].basename = parts.name;
    });
  };
}

module.exports = function(done) {
  metalsmith(__dirname)
    .source("source")
    .destination("site")
    .metadata({}) // put something here maybe?
    .use(metadata({
      publications: "metadata/publications.json",
      talks: "metadata/talks.yaml"
    }))
    .use(ignore("metadata"))
    .use(drafts())
    .use(collections({
      posts: {
        pattern: "blog/**/*.md",
        sortBy: "date",
        reverse: true
      }
    }))
    .use(inplace({
      pattern: "blog/**/*.md",
      engine: "handlebars",
    }))
    .use(markdown())
    .use(wordcount({
      metaKeyCount: "word_count",
      metaKeyReadingTime: "reading_time",
      speed: 200,
      seconds: false,
      raw: false
    }))
    .use(excerpts())
    .use(basename())
    .use(tags({
      handle: "tags",
      path: "blog/tags/:tag.html",
      layout: "tag.jade",
      sortBy: "date",
      reverse: true,
      skipMetadata: true
    }))
    .use(permalinks({
      pattern: ":basename",
      relative: false,
      linksets: [{
        match: { collection: "posts" },
        pattern: "blog/:basename"
      }]
    }))
    .use(pagination({
      "collections.posts": {
        perPage: 10,
        layout: "index_paginate.jade",
        first: "blog/index.html",
        path: "blog/page/:num/index.html"
      }
    }))
    .use(layouts({
      engine: "jade",
      directory: "layouts",
      moment: moment
    }))
    .use(layouts({
      pattern: "blog/**/*.html",
      default: "article.jade",
      engine: "jade",
      directory: "layouts",
      moment: moment
    }))
    .use(feed({
      collection: "posts",
      destination: "blog/feed.xml",
      site_url: "http://seanbowman.me/",
      title: "Software! Math! Data!",
      description: "The website of R. Sean Bowman",
      author: "R. Sean Bowman"
    }))
    .build(function (err) {
      if (err) {
        done(err);
      } else {
        done();
      }
    });
}
