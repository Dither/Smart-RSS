/**
 * Escapes XML special characters: &, <, >, ", ' but keeps XML entities
 * @module App
 * @submodule helpers/keepXmlText
 * @param {String} text String with HTML to be escaped
 */
define(['underscore'], function(_) {

	var re_unknown = /\uFFFD/g,
		re_amp = /&([#a-z0-9]+\b;?)/gi,
		re_back = /\uFFFD([^\uFFFD]+)\uFFFD/g;

	var keepXmlText = function(text) {
		// it can be done in the RSSParser but at the expense of disk space
		return _.escape(text.replace(re_unknown, '').replace(re_amp, '\uFFFD$1\uFFFD'))
					.replace(re_back, '&$1');
	};

	return keepXmlText;
});
