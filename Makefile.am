
VAD_FILES = \
  sql/*.sql \
  www/*.ico \
  www/*.js \
  www/*.vsp \
  www/*.html \
  www/*.png \
  www/*.gif \
  www/ample/*.js \
  www/ample/cultures/*.js \
  www/ample/languages/aui/*.js \
  www/ample/languages/aui/themes/default/*.css \
  www/ample/languages/chart/*.js \
  www/ample/languages/chart/themes/default/*.css \
  www/ample/languages/svg/*.js \
  www/ample/languages/xhtml/*.js \
  www/ample/languages/xhtml/themes/default/*.css \
  www/ample/languages/xhtml/themes/default/media/*.png \
  www/ample/languages/xhtml/themes/default/media/colorpicker/*.png \
  www/ample/languages/xhtml/themes/default/media/colorpicker/*.gif \
  www/ample/languages/xhtml/themes/default/media/colorpicker/*.jpg \
  www/ample/languages/xmlschema/*.js \
  www/ample/languages/xul/*.js \
  www/ample/languages/xul/locales/*.js \
  www/ample/languages/xul/themes/default/*.css \
  www/ample/languages/xul/themes/default/media/*.gif \
  www/ample/languages/xul/themes/default/media/*.png \
  www/ample/languages/xul/themes/default/media/*.jpg \
  www/ample/plugins/cookie/*.js \
  www/ample/plugins/forms/*.js \
  www/ample/plugins/touch/*.js \
  www/ample/plugins/xslt/*.js 


VERSION=`./gen_version.sh`
ROOT_DIR=$(abs_srcdir)

vad_DATA = spasqlqb_dav.vad spasqlqb.zip

# Rule to create our vad
spasqlqb_dav.vad: $(VAD_FILES) vad-sticker.xml Makefile vad_version
	@VADPACKER@ -o spasqlqb_dav.vad --var="VERSION=$(VERSION)" vad-sticker.xml

spasqlqb.zip: $(VAD_FILES) Makefile
# remove any left-over files from previous build
	@rm -f spasqlqb.zip
	@rm -rf build
	@mkdir -pv build/spasqlqb
	@cd build/spasqlqb
	@ln -s $(ROOT_DIR)/www/ample ./build/spasqlqb/ample
	@ln -s $(ROOT_DIR)/www/XMLAexplorer.html ./build/spasqlqb/XMLAexplorer.html
	@ln -s $(ROOT_DIR)/www/spasqlqb.html ./build/spasqlqb/spasqlqb.html
	@ln -s $(ROOT_DIR)/www/spasqlqb.vsp ./build/spasqlqb/spasqlqb.vsp
	@ln -s $(ROOT_DIR)/www/spasqlqblogo-80.png ./build/spasqlqb/spasqlqblogo-80.png
	@ln -s $(ROOT_DIR)/www/throbber.gif ./build/spasqlqb/throbber.gif
	@ln -s $(ROOT_DIR)/www/throbber.js ./build/spasqlqb/throbber.js
	@ln -s $(ROOT_DIR)/www/webdb_xmla_min.js ./build/spasqlqb/webdb_xmla_min.js
	@ln -s $(ROOT_DIR)/www/xmla_min.js ./build/spasqlqb/xmla_min.js
	@ln -s $(ROOT_DIR)/www/favicon.ico ./build/spasqlqb/favicon.ico
	@cd build; zip -r ../spasqlqb.zip ./spasqlqb
	@rm -rf build


CLEANFILES = *.vad *.zip

EXTRA_DIST = $(YOUID_FILES) vad-sticker.xml
