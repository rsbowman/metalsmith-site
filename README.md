# The Personal Website of Sean Bowman

This is part of my site, http://seanbowman.me.  I don't keep the whole thing
on here because I have lots of draft posts and experiments and stuff laying
around.  It's enough to give an idea of how you can cobble together a decent
blog with metalsmith, though, so I thought I'd share it.

## Metalsmith

The blog mostly uses metalsmith, a cool, small framework for creating static
sites and other stuff.  I use jade for templates, and a little handlebars for
"inline" templating, which is to say being able to use little functions and
helpers in my markdown posts.

I migrated the blog from a middleman site, and to keep the URLs the same,
I wrote a tiny custom plugin to grab the base file name of the blog posts.
Also, I use a customized version of markdown-it that let's me use MathJax in
my posts and adds the potential for other plugin style goodies.

## Gulp

I have a small gulpfile for building, validating/linting, running a dev
server, and deploying to s3.  It might also be useful if you're looking for
simple ways to approach these tasks.
