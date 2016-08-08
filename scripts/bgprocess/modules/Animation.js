/**
 * @module BgProcess
 * @submodule modules/Animation
 */
define([], function () {
	/**
	 * Handles animation of browser action button icon
	 * @class Animation
	 * @constructor
	 * @extends Object
	 */
	var Animation = {
		i: 2,
		interval: null,
		update: function() {
			browser.browserAction.setIcon({ path: '/images/reload_anim_' + this.i + '.png' });
			this.i++;
		if (this.i > 4) this.i = 1;
		},
		stop: function() {
			clearInterval(this.interval);
			this.interval = null;
			this.i = 1;
			this.handleIconChange();
		},
		start: function() {
			if (this.interval) return;
			var that = this;
			this.interval = setInterval(function() {
				that.update();
			}, 400);
			this.update();
		},
		handleIconChange: function() {
			if (this.interval) return;
			if ( sources.findWhere({ hasNew: true }) ) {
				browser.browserAction.setIcon({
					path: '/images/icon19-' + settings.get('icon') + '.png'
				});
			} else {
				browser.browserAction.setIcon({
					path: '/images/icon19.png'
				});
			}
		}
	};

	return Animation;

});
