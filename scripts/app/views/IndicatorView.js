/**
 * @module App
 * @submodule views/IndicatorView
 */
define(['backbone', 'text!templates/indicator.txt'], function(BB, tplIndicator) {

	/**
	 * Feeds update indicator view
	 * @class IndicatorView
	 * @constructor
	 * @extends Backbone.View
	 */
	var IndicatorView = BB.View.extend({
		/**
		 * Indicator element id
		 * @property id
		 * @default indicator
		 */
		id: 'indicator',

		/**
		 * Article item view template
		 * @property template
		 * @default ./templates/item.html
		 * @type Function
		 */
		template: _.template(tplIndicator),

		events: {
			'click #indicator-stop': 'handleButtonStop'
		},

		/**
		 * @method initialize
		 */
		initialize: function() {
			this.$el.html(this.template());
			bg.loader.on('change:loading', this.handleLoadingChange, this);
			bg.loader.on('change:numLoaded', this.render, this);
			bg.loader.on('change:numSources', this.render, this);
			bg.sources.on('clear-events', this.handleClearEvents, this);

			this.handleLoadingChange();
		},

		/**
		 * Clears bg events it listens to
		 * @method handleClearEvents
		 * @param id {Integer} ID of the closed tab
		 */
		handleClearEvents: function(id) {
			if (window === null || id === tabID) {
				bg.loader.off('change:loading', this.handleLoadingChange, this);
				bg.loader.off('change:numLoaded', this.render, this);
				bg.loader.off('change:numSources', this.render, this);
				bg.sources.off('clear-events', this.handleClearEvents, this);
			}
		},

		/**
		 * Stops updating feeds
		 * @method handleButtonStop
		 * @triggered when user clicks on stop button
		 */
		handleButtonStop: function() {
			app.actions.execute('feeds:stopUpdate');
		},

		/**
		 * Hides/shows indicator according to loading flag
		 * @method handleLoadingChange
		 */
		handleLoadingChange: function() {
			var that = this;
			if (bg.loader.get('loading') == true) {
				this.render();
				this.$el.addClass('indicator-visible');
			} else {
				setTimeout(function() {
					that.$el.removeClass('indicator-visible');
				}, 500);
			}
		},

		/**
		 * Renders the indicator (gradient/text)
		 * @method render
		 * @chainable
		 */
		render: function() {
			var l = bg.loader, nld = l.get('numLoaded'), nsrc = l.get('numSources');
			if (nsrc === 0) return this;
			var perc = Math.round(nld * 100 / nsrc);
			this.$el.find('#indicator-progress').css('background', 'linear-gradient(to right,  #c5c5c5 ' + perc + '%, #eee ' + perc + '%)');
			this.$el.find('#indicator-progress').html(_T('UPDATING_FEEDS') + ' (' + nld + '/' + nsrc + ')');
			return this;
		}
	});

	return IndicatorView;
});
