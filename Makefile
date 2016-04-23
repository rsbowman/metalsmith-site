POST_DEPS = $(shell find source -name "*.md" -o -name "*.html")
LAYOUT_DEPS = $(wildcard source/*.jade)
ASSET_DEPS = $(filter-out raw,$(shell find source/assets -name "*" -type f))

ASSETS_CSS_DIR=source/assets/css
ASSETS_RAW_CSS_DIR=source/assets/raw/css

ASSETS_JS_DIR=source/assets/js
ASSETS_RAW_JS_DIR=source/assets/raw/js
ASSETS_JS_FILES=jquery.min.js flowtype.min.js highlight.pack.js jquery.fittext.js anchor.min.js

include config.mk

SERVER_PID_FILENAME=server.PID

${ASSETS_CSS_DIR}/styles.min.css : $(shell find ${ASSETS_RAW_CSS_DIR} -name "*.css")
	cat $^ > $(patsubst %.min.css,%.css,$@)
	cleancss $(patsubst %.min.css,%.css,$@) -o $@

${ASSETS_JS_DIR}/scripts.min.js : $(addprefix ${ASSETS_RAW_JS_DIR}/, ${ASSETS_JS_FILES})
	cat $^ > $(patsubst %.min.js,%.js,$@)
	uglifyjs $(patsubst %.min.js,%.js,$@) --compress -o $@

scripts: ${ASSETS_JS_DIR}/scripts.min.js

css: ${ASSETS_CSS_DIR}/styles.min.css

build: ${POST_DEPS} ${LAYOUT_DEPS} ${ASSET_DEPS} css scripts
	node build.js

reload: build
	browser-sync reload

.PHONY: check validate clean start stop

start: ${SERVER_PID_FILENAME}

${SERVER_PID_FILENAME}:
	{ http-server site & echo $$! > $@; }

stop: ${SERVER_PID_FILENAME}
	kill `cat $<` && rm $<

serve:
	browser-sync start --no-open --files 'site/**' --server site &
	onchange 'source/**' -- make reload

check: start
	linkchecker -t 1 http://127.0.0.1:8080 1>&2
	make stop

validate: ${SITE_HTML_FILES}
	echo $^ | xargs java -jar ~/src/vnu/dist/vnu.jar  --errors-only

deploy: build
	s3cmd sync site/ s3://seanbowman.me/ --acl-public --cf-invalidate --no-mime-magic -M

dryrun: build
	s3cmd sync site/ s3://seanbowman.me/ --acl-public --cf-invalidate --no-mime-magic -M --dry-run
