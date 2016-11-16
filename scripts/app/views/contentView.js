/**
 * @module App
 * @submodule views/contentView
 */
define([
	'backbone', 'jquery', 'underscore', 'helpers/formatDate', 'helpers/escapeHtml', 'helpers/stripTags', 'text!templates/download.txt',
	'text!templates/header.txt', 'modules/Locale'
],
function(BB, $, _, formatDate, escapeHtml, stripTags, tplDownload, tplHeader, Locale) {

	/**
	 * Full view of one article (right column)
	 * @class ContentView
	 * @constructor
	 * @extends Backbone.View
	 */
	var ContentView = BB.View.extend({

		/**
		 * Tag name of content view element
		 * @property tagName
		 * @default 'header'
		 * @type String
		 */
		tagName: 'header',

		/**
		 * Content view template
		 * @property template
		 * @default ./templates/header.html
		 * @type Function
		 */
		template: _.template(Locale.translateHTML(tplHeader)),

		/**
		 * Template for downlaoding an article
		 * @property downloadTemplate
		 * @default ./templates/download.html
		 * @type Function
		 */
		downloadTemplate: _.template(tplDownload),


		events: {
			'mousedown': 'handleMouseDown',
			'click .pin-button': 'handlePinClick',
			'keydown': 'handleKeyDown'
		},

		/**
		 * Changes pin state
		 * @method handlePinClick
		 * @triggered on click on pin button
		 * @param event {MouseEvent}
		 */
		handlePinClick: function(e) {
			$(e.currentTarget).toggleClass('pinned');
			this.model.save({
				pinned: $(e.currentTarget).hasClass('pinned')
			});
		},

		/**
		 * Called when new instance is created
		 * @method initialize
		 */
		initialize: function() {
			this.on('attach', this.handleAttached);
			bg.items.on('change:pinned', this.handleItemsPin, this);
			bg.sources.on('clear-events', this.handleClearEvents, this);
		},

		/**
		 * Sets comm event listeners
		 * @method handleAttached
		 * @triggered when content view is attached to DOM
		 */
		handleAttached: function() {
			app.on('select:article-list', function(data) {
				this.handleNewSelected(bg.items.findWhere({ id: data.value }));
			}, this);

			app.on('space-pressed', this.handleSpace, this);

			app.on('no-items:article-list', function() {
				if (this.renderID) clearTimeout(this.renderID);
				this.model = null;
				this.hide();
			}, this);
		},

		/**
		 * Next page in article or next unread article
		 * @method handleSpace
		 * @triggered when space is pressed in middle column
		 */
		handleSpace: function() {
			var cw = $('iframe').get(0).contentWindow;
			var d = $('iframe').get(0).contentWindow.document;
			if (d.documentElement.clientHeight + $(d.body).scrollTop() >= d.body.offsetHeight ) {
				app.trigger('give-me-next');
			} else {
				cw.scrollBy(0, d.documentElement.clientHeight * 0.85);
			}
		},

		/**
		 * Unbinds all listeners to bg process
		 * @method handleClearEvents
		 * @triggered when tab is closed/refershed
		 * @param id {Integer} id of the closed tab
		 */
		handleClearEvents: function(id) {
			if (window == null || id == tabID) {
				bg.items.off('change:pinned', this.handleItemsPin, this);
				bg.sources.off('clear-events', this.handleClearEvents, this);
			}
		},

		/**
		 * Sets the pin button state
		 * @method handleItemsPin
		 * @triggered when the pin state of the article is changed
		 * @param model {Item} article that had its pin state changed
		 */
		handleItemsPin: function(model) {
			if (model == this.model) {
				this.$el.find('.pin-button').toggleClass('pinned', this.model.get('pinned'));
			}
		},

		/**
		 * Gets formated date (according to settings) from given unix time
		 * @method getFormatedDate
		 * @param unixtime {Number}
		 */
		getFormatedDate: function(unixtime) {
			var dateFormats = { normal: 'DD.MM.YYYY', iso: 'YYYY-MM-DD', us: 'MM/DD/YYYY' };
			var pickedFormat = dateFormats[bg.settings.get('dateType') || 'normal'] || dateFormats['normal'];
			var timeFormat = bg.settings.get('hoursFormat') == '12h' ? 'H:mm a' : 'hh:mm:ss';
			return formatDate(new Date(unixtime), pickedFormat + ' ' + timeFormat);
		},

		/**
		 * Identificator of asynchronous render function.
		 * @property renderID
		 * @default null
		 * @type Integer
		 */
		renderID: null,

		/**
		 * Delay of asynchronous render in ms.
		 * @property renderDelay
		 * @default 100
		 * @type Integer
		 */
		renderDelay: 100,

		/**
		 * Renders articles content asynchronously
		 * Rendering of article is delayed for %renderDelay% ms to speed up successive selection in article list.
		 * @method render
		 * @chainable
		 */
		render: function() {
			clearTimeout(this.renderID);

			this.renderID = setTimeout(function(that) {
				if (!that || !that.model) return;

				that.show();

				var data = Object.create(that.model.attributes);
				data.date = that.getFormatedDate(that.model.get('date'));
				data.title = stripTags(data.title).trim() || '&lt;'+_T('NO_TITLE')+'&gt;';
				data.author = stripTags(data.author).trim();
				data.url = escapeHtml(data.url);
				data.titleIsLink = bg.settings.get('titleIsLink');

				var source = that.model.getSource(),
					content = that.model.get('content'),
					sandbox = app.content.sandbox,
					frame = sandbox.el;

				that.$el.html(that.template(data));

				var _render = function() {
					if (!frame || !that) return;

					frame.contentWindow.scrollTo(0, 0);

					var _url = that.model.get('url'),
						_base = frame.contentDocument.querySelector('base');

					if (source && source.get('fulltextEnable'))
						_base.href = (_url.match(/^https?:\/\/\S+$/i) || [])[0] || '#';
					else
						_base.href = source ? source.get('base') || source.get('url') : '#';

					frame.contentDocument.querySelector('#smart-rss-content').innerHTML = content;
					frame.contentDocument.querySelector('#smart-rss-url').href = _url;
					frame.contentDocument.documentElement.style.fontSize = bg.settings.get('articleFontSize') + '%';
					frame.contentDocument.querySelector('body').removeAttribute('style');
				};

				if (sandbox.loaded) _render();
				else sandbox.on('load', _render);
			}, this.renderDelay, this);

			return this;
		},

		/**
		 * Replaces old article model with newly selected one
		 * @method handleNewSelected
		 * @param model {Item} The new article model
		 */
		handleNewSelected: function(model) {
			if (!model) return this.hide();
			if (model === this.model) return;
			this.model = model;
			this.render();
		},

		/**
		 * Hides contents (header, iframe)
		 * @method hide
		 */
		hide: function() {
			$('header,iframe').css('display', 'none');
		},

		/**
		 * Show contents (header, iframe)
		 * @method hide
		 */
		show: function() {
			$('header,iframe').css('display', 'block');
		},
	});

	return new ContentView();
});
