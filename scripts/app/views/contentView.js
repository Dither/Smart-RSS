/**
 * @module App
 * @submodule views/contentView
 */
define([
	'backbone', 'jquery', 'underscore', 'helpers/formatDate', 'helpers/keepXmlText',
	'text!templates/download.txt', 'text!templates/header.txt', 'modules/Locale'
],
function(BB, $, _, formatDate, keepXmlText, tplDownload, tplHeader, Locale) {

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
				//this.handleScroll(this.frame); // BUG: Firefox ignores the handler here, Chromium - isn't
			}, this);
		},

		/**
		 * Next page in article or next unread article
		 * @method handleSpace
		 * @triggered when space is pressed in middle column
		 */
		handleSpace: function() {
			if (!this.enableSpaceProcessing) return;
			var cw = this.frame.contentWindow,
				ch = cw.document.documentElement.clientHeight,
				d = cw.document.scrollingElement;
			if (ch + d.scrollTop >= d.offsetHeight ) {
				app.actions.execute('articles:markAndNextUnread');
			} else {
				cw.scrollBy(0, ch * 0.8);
			}
		},

		/**
		 * Next page in article or next unread article
		 * @method handleEndScroll
		 * @triggered when scrolled after scrollbar reached the end or beginning
		 */
		handleScroll: function(doc) {
			var that = this,
				dz = parseInt(bg.settings.get('moveByScrolled'), 10); // height of the deadzone

			if (dz === 0) return;
			dz = dz || 800;

			var onwheeled = function(event) {
				if (!that.enableScrollPocessing) return;

				var dc = doc.contentDocument,
					d = dc.scrollingElement || doc.contentDocument,
					scrolly = event.deltaY, // delta of current scroll
					dy = dc.defaultView.scrollY, // height of scroll
					dbottom = d.offsetHeight - dc.documentElement.clientHeight - d.scrollTop; // distance to the page's bottom

				switch (event.deltaMode) {
				  case 1:
					scrolly *= 30; // delta in line units
					break;
				  case 2:
					scrolly *= 300; // delta in page units
					break;
				}

				if ((dbottom <= 0) || (dy === 0)) that.delta += scrolly;
				if ((dbottom <= 0 && that.delta < 0 && scrolly > 0) || (dy === 0 && that.delta > 0 && scrolly < 0)) that.delta = 0;

				//console.log('dbottom',dbottom, 'delta',that.delta, 'dy',dy, 'scrolly',scrolly);

				if (dbottom <= 0 && that.delta > dz) {  // lower deadzone callback
					that.delta = 0;
					app.actions.execute('articles:markAndNextUnread');
				} else if (dy === 0 && that.delta < -dz) { // upper deadzone callback
					that.delta = 0;
					app.actions.execute('articles:selectPrevious');
				}
			}

			//doc.addEventListener("wheel", onwheeled, false);
			doc.contentDocument.onwheel = onwheeled;
		},

		/**
		 * Unbinds all listeners to bg process
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
		 * Gets formated date (according to settings) from given Unix time
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
		 * @default 200
		 * @type Integer
		 */
		renderDelay: 200,

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

			this.renderID = setTimeout(this.prepareRender.bind(this), this.renderDelay);

			return this;
		},

		realRender: function() {
			if (!this || !this.frame/* || this.isModelDeleted(this.model)*/) return;

			var url = this.model.get('url'),
				source = this.model.getSource(),
				base = this.frame.contentDocument.querySelector('base');

			if (source && source.get('fulltextEnable'))
				base.href = (url.match(/^https?:\/\/\S+$/i) || [])[0] || '#';
			else
				base.href = source ? source.get('base') || source.get('url') : '#';

			this.frame.contentDocument.querySelector('#smart-rss-content').innerHTML = this.model.get('content');
			this.frame.contentDocument.querySelector('#smart-rss-url').href = url;
			this.frame.contentDocument.documentElement.style.fontSize = bg.settings.get('articleFontSize') + '%';
			this.frame.contentWindow.scrollTo(0, 0);

			// allows content to render before processing height-requesting events
			var that = this;
			this.scrollID = setTimeout(function() {
				that.enableScrollPocessing = true;
				that.enableSpaceProcessing = true;
			}, 700);

			this.show();
			this.handleScroll(this.frame);
		},

		prepareRender: function() {
			if (!this || this.isModelDeleted(this.model)) return this.hide();

			var data = Object.create(this.model.attributes);
			data.date = this.getFormatedDate(this.model.get('date'));
			// filter with XML-aware version of _.escape
			data.title = keepXmlText(data.title) || '&lt;'+_T('NO_TITLE')+'&gt;';
			data.titletooltip = null;
			data.author = keepXmlText(data.author);
			//data.url = data.url.replace(/["'<>`]/g, ''); // don't do it twice
			data.titleIsLink = bg.settings.get('titleIsLink');

			// Cut string at the end of a sentence, quote or word from minlen to maxlen
			var maxlen = 160, minlen = 64;
			if (data.title.length > maxlen) {
				data.titletooltip = data.title;
				var lastsent, lastchar = '';
				while ((lastsent = data.title.regexLastIndexOf(/(?:[,."'] |[!?。」』])/)) >= 0) {
					if (lastsent < minlen) break;
					lastchar = data.title.charAt(lastsent);
					if (lastchar === ' ') lastchar = data.title.charAt(lastsent - 1);
					data.title = data.title.substring(0, lastsent);
					if (data.title.length <= maxlen) break;
				}
				if (lastsent < minlen) {
					data.title = data.titletooltip;
					while ((lastsent = data.title.lastIndexOf(' ')) > maxlen) {
						if (lastsent < minlen) break;
						data.title = data.title.substring(0, lastsent);
						if (data.title.length <= maxlen) break;
					}
					lastchar = '';
				}
				if (lastsent < minlen) {
					data.title = data.titletooltip.substring(0, maxlen);
					lastchar = '';
				}
				data.title += lastchar + ' \u2026';
			}

			this.$el.html(this.template(data));

			if (this.sandbox.loaded) this.realRender();
			else this.sandbox.on('load', this.realRender, this);
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
