/**
 * @module App
 * @submodule modules/Locale
 */

define([], function () {

	/**
	 * String localization
	 * @class Locale
	 * @constructor
	 * @extends Object
	 */
	var Locale = {
		translateHTML: function(content) {
			return String(content).replace(/\{\{(\w+)\}\}/gm, function(all, str) {
				return _T(str) || str;
			});
		}
	};

	return Locale;

});
