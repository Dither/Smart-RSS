/**
 * @module BgProcess
 * @submodule models/Source
 */
define(['backbone', 'underscore'], function (BB, _) {

	/**
	 * Feed source module
	 * @class Source
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Source = BB.Model.extend({
		defaults: {
			title: '',
			url: '0.0.0.0',
			base: '',
			updateEvery: 180, // in minutes
			lastUpdate: 0,
			count: 0, // # unread
			countAll: 0,
			username: '',
			password: '',
			hasNew: false,
			isLoading: false,
			fulltextEnable: 0,
			fulltextPosition: '',
			autoremove: 0 // in days
		},

		dynamic: ['isLoading'],

		initialize: function() {
		},

		// omit some attributes from saving
		save: function(key, val, options) {
			var attrs;
			if (key == null || typeof key === 'object') { attrs = key; options = val; }
			else { (attrs = {})[key] = val; }

			attrs || (attrs = _.clone(this.attributes));
			if (attrs && (!options || !options.wait) && !this.set(_.pick(attrs, this.dynamic), options))
				return false;
			attrs = _.omit(attrs, this.dynamic);

			return BB.Model.prototype.save.call(this, attrs, options);
		},

		getPass: function() {
			var str = this.get('password');
			if (str.indexOf('enc:') != 0) return str;

			var dec = '';
			for (var i=4; i<str.length; i++) dec += String.fromCharCode(str.charCodeAt(i) - 13);
			return dec;
		},

		setPass: function(str) {
			if (!str) return this.save('password', '');
			var enc = 'enc:';
			for (var i=0; i<str.length; i++) enc += String.fromCharCode(str.charCodeAt(i) + 13);
			this.set('password', enc);
		}
	});

	return Source;
});
