/**
 * Light escapes XML special characters: <, >, ", '
 * @module App
 * @submodule helpers/escapeHtml
 * @param {String} string String with HTML to be escaped
 */
define([], function() {

	var entityMap = {
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'`': '&#x60;'
	};

	var escapeHtml = function(str, dbl) {
		str = (str || '').toString();
		//if (!dbl) { str = str.replace(/&/g, '&amp;'); }
		str = str.replace(/[<>"'`]/gm, function (s) { return entityMap[s]; });
		str = str.replace(/\s/, function(f) { return ((f == ' ') ?  ' ' : ''); });
		return str;
	}

	return escapeHtml;
});
