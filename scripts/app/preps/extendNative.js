/**
 * Extends prototypes of native objects with various methods.
 * Removes prefixes for some nonstandard fucntions.
 * @module App
 * @submodule preps/extendNative
 */
define([], function() {

	/**
	 * Converts a string to camel case
	 * @method toCamelCase
	 * @extends String
	 * @param str {String} String to convert
	 * @return {String} Converted string
	 */
	String.prototype.toCamelCase = function(str) {
		return (str || this)
			.replace(/[\s_-](.)/g, function($1) { return $1.toUpperCase(); })
			.replace(/[\s_-]/g, '')
			.replace(/^(.)/, function($1) { return $1.toLowerCase(); });
	};

	/**
	 * Converts a string to to hyphen format
	 * @method toHyphenFormat
	 * @extends String
	 * @param str {String} String to convert
	 * @return {String} Converted string
	 */
	String.prototype.toHyphenFormat = function(str) {
		function upperToHyphenLower(match) {
			return '-' + match.toLowerCase();
		}
		return (str || this).replace(/[A-Z]/g, upperToHyphenLower);
	};

	/**
	 * Searches for the first index of a regular expression match
	 * @method regexIndexOf
	 * @extends String
	 * @param regex {RegExp} Regexp to search
	 * @param regex {Number} Starting position
	 * @return {Number} Position in string or -1
	 */
	String.prototype.regexIndexOf = function(regex, startpos) {
		var first = this.substring(startpos || 0).search(regex);
		return (first >= 0) ? (first + (startpos || 0)) : first;
	};

	/**
	 * Searches for the last index of a regular expression match
	 * @method regexLastIndexOf
	 * @extends String
	 * @param regex {RegExp} Regexp to search
	 * @param regex {Number} Starting position
	 * @return {Number} Position in string or -1
	 */
	String.prototype.regexLastIndexOf = function(regex, startpos) {
		regex = (regex.global) ? regex : new RegExp(regex.source, 'g' + (regex.ignoreCase ? 'i' : '') + (regex.multiLine ? 'm' : ''));
		if (typeof startpos === 'undefined') {
			startpos = this.length;
		} else if (startpos < 0) {
			startpos = 0;
		}
		var str = this.substring(0, startpos + 1), last = -1, next = 0;
		while ((result = regex.exec(str)) !== null) {
			last = result.index;
			regex.lastIndex = ++next;
		}
		return last;
	};

	/**
	 * Sets or get last array item
	 * @method last
	 * @extends Array
	 * @param value {Any} Value to set - optional
	 * @return {Any} Last item of array, null if array is empty
	 */
	Array.prototype.last = function(val) {
		if (!this.length) return null;
		if (val) this[this.length - 1] = val;
		return this[this.length - 1];
	};

	/**
	 * Sets or get first array item
	 * @method last
	 * @extends Array
	 * @param value {Any} Value to set - optional
	 * @return {Any} First item of array, null if array is empty
	 */
	Array.prototype.first = function(val) {
		if (!this.length) return null;
		if (val) this[0] = val;
		return this[0];
	};

	/**
	 * Gets index of element in a HTMLCollection (used by eg. Element#children)
	 * @method indexOf
	 * @extends HTMLCollection
	 * @param element {HTMLElement} Element fo find index of
	 * @return {Number} Index of the element or -1
	 */
	HTMLCollection.prototype.indexOf = Array.prototype.indexOf;

	window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame;

	if (!Element.prototype.hasOwnProperty('matchesSelector')) {
		Element.prototype.matchesSelector = Element.prototype.webkitMatchesSelector;
	}

	/**
	 * Gets first following sibling that matches given selector
	 * @method findNext
	 * @extends Element
	 * @param query {String} CSS selector
	 * @return {HTMLELement|null} Found element
	 */
	Element.prototype.findNext = function(query) {
		var cur = this;
		while (cur = cur.nextElementSibling) {
			if (cur.matchesSelector(query)) {
				return cur;
			}
		}
		return null;
	};

	/**
	 * Gets first previous sibling that matches given selector
	 * @method findPrev
	 * @extends Element
	 * @param query {String} CSS selector
	 * @return {HTMLELement|null} Found element
	 */
	Element.prototype.findPrev = function(query) {
		var cur = this;
		while (cur = cur.previousElementSibling) {
			if (cur.matchesSelector(query)) {
				return cur;
			}
		}
		return null;
	};

	/**
	 * Escapes regular expression characters in a string
	 * @method escape
	 * @extends RegExp
	 * @static
	 * @param text {String} String to be escaped
	 * @return {String} Escaped string
	 */
	RegExp.escape = function(str) {
		return String(str).replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
	};
});
