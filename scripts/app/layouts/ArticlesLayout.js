/**
 * @module App
 * @submodule layouts/ArticlesLayout
 */
define([
	'jquery', 'layouts/Layout', 'views/ToolbarView', 'views/articleList',
	'mixins/resizable', 'controllers/comm', 'domReady!'
],
function ($, Layout, ToolbarView, articleList, resizable, comm) {
	var toolbar = bg.toolbars.findWhere({ region: 'articles' });

	/**
	 * Articles layout view
	 * @class ArticlesLayout
	 * @constructor
	 * @extends Layout
	 */
	var ArticlesLayout = Layout.extend({
		el: '#region-articles',

		events: {
			'keydown': 'handleKeyDown',
			'mousedown': 'handleMouseDown'
		},

		initialize: function() {
			this.el.view = this;
			var focus = true;
			var blurTimeout;

			this.on('attach', function() {
				this.attach('toolbar', new ToolbarView({ model: toolbar }) );
				this.attach('articleList', articleList );
			});

			this.$el.on('focus', function() {
				$(this).addClass('focused');
				clearTimeout(blurTimeout);
			});

			comm.on('stop-blur', function() { focus = false; });

			this.$el.on('blur', function(e) {
				blurTimeout = setTimeout(function() {
					if (focus && !e.relatedTarget) return this.focus();
					this.classList.remove('focused');
					focus = true;
				}.bind(this), 0);
			});

			this.on('resize:after', this.handleResizeAfter);
			this.on('resize', this.handleResize);
			this.on('resize:enabled', this.handleResize);
			bg.settings.on('change:layout', this.handleLayoutChange, this);

			this.handleLayoutChange();
		},

		/**
		 * Handles article view layout change
		 * @method handleToggleChange
		 */
		handleLayoutChange: function() {
			var region = $('.regions .regions'),
				layout = bg.settings.get('layout');
			if (layout === 'vertical') {
				region.addClass('vertical');
				this.enableResizing(layout, bg.settings.get('posC'));
			} else {
				region.removeClass('vertical');
				this.enableResizing(layout, bg.settings.get('posB'));
			}
		},

		/**
		 * Saves the new layout size
		 * @triggered after resize
		 * @method handleResizeAfter
		 */
		handleResizeAfter: function() {
			if (bg.settings.get('layout') == 'horizontal') {
				var wid = this.el.offsetWidth;
				bg.settings.save({ posB: wid });
			} else {
				var hei = this.el.offsetHeight;
				bg.settings.save({ posC:hei });
			}
		},

		/**
		 * Clears events
		 * @method clearEvents
		 */
		clearEvents: function(){
			bg.settings.off('change:layout', this.handleLayoutChange, this);
		},

		/**
		 * Changes layout to one/two line according to width
		 * @triggered while resizing
		 * @method handleResize
		 */
		handleResize: function() {
			if (bg.settings.get('lines') !== 'auto') return;
			var oneRem = parseFloat(getComputedStyle(document.documentElement).fontSize);
			if (this.el.offsetWidth > 37 * oneRem) this.articleList.$el.addClass('lines-one-line');
			else this.articleList.$el.removeClass('lines-one-line');
		}
	});

	ArticlesLayout = ArticlesLayout.extend(resizable);

	return ArticlesLayout;
});
