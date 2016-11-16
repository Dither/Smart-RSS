/**
 * @module App
 */

define([
	'controllers/comm',
	'layouts/Layout', 'punycode', 'jquery', 'domReady!', 'collections/Actions', 'layouts/FeedsLayout', 'layouts/ArticlesLayout',
	'layouts/ContentLayout', 'staticdb/shortcuts', 'modules/Locale', 'views/ReportView', 'preps/all',
],
function (comm, Layout, punycode, $, doc, Actions, FeedsLayout, ArticlesLayout, ContentLayout, shortcuts, Locale, ReportView) {

	document.documentElement.style.fontSize = bg.settings.get('uiFontSize') + '%';

	var templates = $('script[type="text/template"]');
	templates.each(function(i, el) {
		el.innerHTML = Locale.translateHTML(el.innerHTML);
	});

	document.addEventListener('contextmenu', function(e) {
		if (!e.target.matchesSelector('#region-content header, #region-content header *')) {
			e.preventDefault();
		}
	});

	var app = window.app = new (Layout.extend({
		el: 'body',
		events: {
			'mousedown': 'handleMouseDown',
			'click #panel-toggle': 'handleClickToggle'
		},
		initialize: function() {
			this.actions = new Actions();

			window.addEventListener('blur', function(e) {
				this.hideContextMenus();
				if (e.target instanceof window.Window) comm.trigger('stop-blur');
			}.bind(this));

			if (bg.settings.get('thickFrameBorders')) this.$el.addClass('thick-borders');

			bg.sources.on('clear-events', this.handleClearEvents, this);
		},
		fixURL: function(url) {
			if (url.search(/[a-z]+:\/\//) === -1) url = 'http://' + url;
			if (url.match(/\/\/(?:[^@]*@)?([\d]+\.){3}\d+/g) || url.match(/\/\/(?:[^@]*@)?\[/g)) return url;
			url = url.replace(/[a-z]+:\/\/(?:[^@]*@)?([^\/?#@:]+)(?::\d*)?/, function replacer(match, domain) {
				if (punycode.isUnicode(domain)) return match.replace(domain, punycode.toASCII(domain));
				else return match;
			});
			return url;
		},
		validatePosition: function(path) {
			var pathVal = '';
			try {
				document.querySelector(path);
				pathVal = path;
			} catch (e) {
				try {
					document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
					pathVal = path;
				} catch (e) {
					pathVal = '';
				}
			}
			return pathVal;
		},
		handleClearEvents: function(id) {
			if (!window || id === tabID) {
				if (this.feeds) this.feeds.clearEvents();
				if (this.articles) this.articles.clearEvents();
				if (this.content) this.content.clearEvents();
				bg.sources.off('clear-events', this.handleClearEvents, this);
			}
		},
		/**
		 * Saves the panel toggle state (panel visible/hidden)
		 * @method handleClickToggle
		 */
		handleClickToggle: function() {
			bg.settings.save('panelToggled', !bg.settings.get('panelToggled'));
		},
		handleMouseDown: function(e) {
			if (!e.target.matchesSelector('.context-menu, .context-menu *, .overlay, .overlay *')) {
				this.hideContextMenus();
			}
		},
		hideContextMenus: function() {
			comm.trigger('hide-overlays', { blur: true });
		},
		focusLayout: function(e) {
			this.setFocus(e.currentTarget.getAttribute('name'));
		},
		start: function() {
			this.trigger('start');

			this.attach('feeds', new FeedsLayout);
			this.attach('articles', new ArticlesLayout);
			this.attach('content', new ContentLayout);

			var retries = 10,
				that = this;

			var id = setInterval(function _isLoaded() {
				_loaded = !!that.feeds && !!that.articles && !!that.content;
				if (_loaded) $('body').removeClass('loading');
				if (retries-- <= 0 || _loaded) clearInterval(id);
			}, 150);

			this.setFocus('articles');
			this.trigger('start:after');
		},
		report: function() {
			document.body.appendChild((new ReportView()).render().el);
		},
		handleKeyDown: function(e) {
			var ac = document.activeElement;
			if (ac && (ac.tagName == 'INPUT' || ac.tagName == 'TEXTAREA')) return;

			var str = '';
			if (e.ctrlKey) str += 'ctrl+';
			if (e.shiftKey) str += 'shift+';

			if (e.keyCode > 46 && e.keyCode < 91) str += String.fromCharCode(e.keyCode).toLowerCase();
			else if (e.keyCode in shortcuts.keys) str += shortcuts.keys[e.keyCode];
			else return;

			var focus = document.activeElement.getAttribute('name');

			if (focus && focus in shortcuts) {
				if (str in shortcuts[focus]) {
					app.actions.execute( shortcuts[focus][str], e);
					e.preventDefault();
					return;
				}
			}

			if (str in shortcuts.global) {
				app.actions.execute( shortcuts.global[str], e);
				e.preventDefault();
			}
		}
	}));

	// Prevent context-menu when alt is pressed
	document.addEventListener('keyup', function(e) {
		if (e.keyCode == 18) {
			e.preventDefault();
		}
	});

	document.addEventListener('keydown', app.handleKeyDown);

	return app;
});
