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
		 * @default ./templates/header.txt
		 * @type Function
		 */
		template: _.template(Locale.translateHTML(tplHeader)),

		/**
		 * Template for downloading an article
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
			this.model.save({ pinned: $(e.currentTarget).hasClass('pinned') });
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
			app.on('content-layout-ready', function() {
				app.on('select:article-list', function(data) {
					this.handleNewSelected(bg.items.findWhere({ id: data.value }));
				}, this);

				app.on('space-pressed', this.handleSpace, this);

				app.on('no-items:article-list', function() {
					clearTimeout(this.renderID);
					this.model = null;
					this.hide();
				}, this);

				this.sandbox = app.content.sandbox;
				this.frame = this.sandbox.el;
				this.handleScroll(this.frame);
			}, this);
		},

		/**
		 * Next page in article or next unread article
		 * @method handleSpace
		 * @triggered when space is pressed in middle column
		 */
		handleSpace: function() {
			if (!this.enableSpaceProcessing) return;
			var cw = this.frame.contentWindow;
			var d = cw.document.scrollingElement;
			if (cw.document.documentElement.clientHeight + d.scrollTop >= d.offsetHeight ) {
				app.actions.execute('articles:markAndNextUnread');
			} else {
				cw.scrollBy(0, cw.document.documentElement.clientHeight * 0.85);
			}
		},

		/**
		 * Next unread article or previous article
		 * @method handleScroll
		 * @triggered when scrolled down after scrollbar reached the end or up on beginning of content
		 */
		handleScroll: function(doc) {
			var that = this,
				ddead = 700; // TODO: move to settings // height of the deadzone after scroll-end

			doc.addEventListener("wheel", function onwheel(event) {
				if (!that.enableScrollPocessing) return;

				var dc = doc.contentDocument,
					d = dc.scrollingElement,
					scrolly = event.deltaY, // delta of current scroll
					dy = dc.defaultView.scrollY, // entirety of current scroll
					dbottom = Math.max(0, d.offsetHeight - (dc.documentElement.clientHeight + d.scrollTop)); // distance to the page's bottom

				switch (event.deltaMode) {
				  case 1:
					scrolly *= 40; // scrolled in line units
					break;
				  case 2:
					scrolly *= 800; // scrolled in page units
					break;
				}

				//console.log('dbottom',dbottom,'delta',that.delta, 'dy',dy, 'scrolly',scrolly);

				if ((dbottom === 0) || (dy === 0)) that.delta += scrolly;
				if (((dy === 0 && that.delta > 0) || (dbottom === 0 && that.delta < 0)) && (dy !== dbottom)) {
					that.delta = 0;
				} else if (dy <= 0 && that.delta < -ddead) {
					app.actions.execute('articles:selectPrevious');;
				} else if (dbottom <= 0 && that.delta > ddead) {
					app.actions.execute('articles:markAndNextUnread');
				}
			}, false);
		},

		/**
		 * Unbinds all listeners to background process
		 * @method handleClearEvents
		 * @triggered when tab is closed/refreshed
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
		 * Gets formated date (according to settings) from given Unix-time
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
		 * Identificator of asynchronous processing delay function.
		 * @property scrollID
		 * @default null
		 * @type Integer
		 */
		scrollID: null,

		/**
		 * Current scroll delta.
		 * @property delta
		 * @default 0
		 * @type Integer
		 */
		delta: 0,

		/**
		 * Flag to enable scroll processing.
		 * @property enableScrollPocessing
		 * @default false
		 * @type Boolean
		 */
		enableScrollPocessing: false,

		/**
		 * Flag to enable space processing.
		 * @property enableScrollPocessing
		 * @default false
		 * @type Boolean
		 */
		enableSpaceProcessing: false,

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
			this.enableScrollPocessing = false;
			this.enableSpaceProcessing = false;
			clearTimeout(this.scrollID);
			clearTimeout(this.renderID);

			this.renderID = setTimeout(function(that) {
				if (!that || that.isModelDeleted(that.model)) return that.hide();

				var data = Object.create(that.model.attributes);
				data.date = that.getFormatedDate(that.model.get('date'));
				data.title = stripTags(data.title).trim() || '&lt;'+_T('NO_TITLE')+'&gt;';
				data.author = stripTags(data.author).trim();
				data.url = escapeHtml(data.url);
				data.titleIsLink = bg.settings.get('titleIsLink');

				that.$el.html(that.template(data));

				var _render = function() {
					if (!that || !that.frame/* || that.isModelDeleted(that.model)*/) return;

					that.frame.contentWindow.scrollTo(0, 0);

					var _url = that.model.get('url'),
						_source = that.model.getSource(),
						_base = that.frame.contentDocument.querySelector('base');

					if (_source && _source.get('fulltextEnable'))
						_base.href = (_url.match(/^https?:\/\/\S+$/i) || [])[0] || '#';
					else
						_base.href = _source ? _source.get('base') || _source.get('url') : '#';

					that.frame.contentDocument.querySelector('#smart-rss-content').innerHTML = that.model.get('content');
					that.frame.contentDocument.querySelector('#smart-rss-url').href = _url;
					that.frame.contentDocument.documentElement.style.fontSize = bg.settings.get('articleFontSize') + '%';

					that.delta = 0;
					// allows content to render before processing height-requesting events
					that.scrollID = setTimeout(function() {
						that.enableScrollPocessing = true;
						that.enableSpaceProcessing = true;
					}, 500);

					that.show();
				};

				if (that.sandbox.loaded) _render();
				else that.sandbox.on('load', _render);
			}, this.renderDelay, this);

			return this;
		},

		/**
		 * Returns true if model is deleted
		 * @method isModelDeleted
		 * @param model {Item} The article model
		 */
		isModelDeleted: function(model) {
			return !model || model.get('deleted');
		},

		/**
		 * Replaces old article model with newly selected one
		 * @method handleNewSelected
		 * @param model {Item} The new article model
		 */
		handleNewSelected: function(model) {
			if (this.isModelDeleted(model)) {
				this.hide();
				return;
			}

			if (model == this.model) return;
			else this.model = model;

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
