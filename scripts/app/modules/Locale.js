/**
 * @module App
 * @submodule modules/Locale
 */
var nl, loc;
if (typeof bg !== 'undefined'){
	nl = bg.settings.get('lang') || 'en';
	loc = '../../nls/' + nl
	loc_en = '../../nls/en';
}
else{
	nl = 'en';
	loc = '../nls/' + nl
	loc_en = '../nls/en';
}
define([loc, loc_en], function (lang, en) {

	/**
	 * String localization
	 * @class Locale
	 * @constructor
	 * @extends Object
	 */
	var Locale = {
		get c() {
			return lang || en;
		},
		translate: function(str) {
			str = String(str);
			if (lang && lang[str]) return lang[str];
			if (en && en[str]) return en[str];
			return str;
		},
		translateHTML: function(content) {
			return String(content).replace(/\{\{(\w+)\}\}/gm, function(all, str) {
				return lang[str] || en[str] || str;
			});
		}
	};

	return Locale;

});
