/**
 * @module App
 * @submodule layouts/Layout
 */
define(['backbone'], function(BB) {

	/**
	 * Layout abstract class
	 * @class Layout
	 * @constructor
	 * @extends Backbone.View
	 */
	var Layout = BB.View.extend({

		/**
		 * Gives focus to layout region element
		 * @method setFocus
		 * @param name {String} Name of the region
		 */
		setFocus: function(name) {
			if (!name) return;

			var retries = 10,
				that = this;

			if (that[name]) return that[name].el.focus();

			var id = setInterval(function _focus() {
				if (that[name]) that[name].el.focus();
				if (retries-- <= 0 || that[name]) clearInterval(id);
			}, 200);
		},

		/**
		 * Appends new region to layout.
		 * If existing name is used, the old region is replaced with the new region
		 * and 'close' event is triggered on the old region
		 * @method attach
		 * @param name {String} Name of the region
		 * @param view {Backbone.View} Backbone view to be the attached region
		 */
		attach: function(name, view) {
			if (!name || !view) return;

			var old = this[name];
			this[name] = view;

			if (view.el && !view.el.parentNode) {
				if (old && old instanceof BB.View) {
					old.$el.replaceWith(view.el);
					old.trigger('close');
				} else {
					this.$el.append(view.el);
				}
			}

			view.trigger('attach');
			//if (!this.focus) this.setFocus(name);
		}
	});

	return Layout;
});
