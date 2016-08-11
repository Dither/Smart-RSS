/**
 * @module BgProcess
 */
define([
	'jquery',
	'modules/Animation', 'models/Settings', 'models/Info', 'models/Source',
	'collections/Sources', 'collections/Items', 'collections/Folders', 'models/Loader', 'collections/Logs',
	'models/Folder', 'models/Item', 'collections/Toolbars'
],
function ($, animation, Settings, Info, Source, Sources, Items, Folders, Loader, Logs, Folder, Item, Toolbars) {

	/**
	 * Update animations
	 */
	animation.start();


	/*$.ajaxSetup({
		cache: false
	});*/

	window.appStarted = new (jQuery.Deferred)();
	window.settingsLoaded = new (jQuery.Deferred)();

	/**
	 * Items
	 */
	window.Source = Source;
	window.Item = Item;
	window.Folder = Folder;

	/**
	 * DB models
	 */
	window.settings = new Settings();
	window.info = new Info();
	window.sourceJoker = new Source({ id: 'joker' });
	window.sources = new Sources();
	window.items = new Items();
	window.folders = new Folders();

	/**
	 * This is used for when new feed is subsribed and smart rss tab is opened to focus the newly added feed
	 */
	window.sourceToFocus = null;

	window.toolbars = new Toolbars();


	/**
	 * Non-db models & collections
	 */
	window.loader = new Loader();
	window.logs = new Logs();

	logs.startLogging();

	/**
	 * RSS Downloader
	 */
	$.support.cors = true;

	/**
	 * Fetch all
	 */
	function fetchOne(arr, allDef) {
		if (!arr.length) {
			allDef.resolve();
			return;
		}
		var one = arr.shift();
		one.always(function() {
			fetchOne(arr, allDef);
		});
	}

	function fetchAll() {
		var allDef = new (jQuery.Deferred)();
		var deferreds = [];
		var settingsDef;
		deferreds.push(  folders.fetch({ silent: true }) );
		deferreds.push(  sources.fetch({ silent: true }) );
		deferreds.push(    items.fetch({ silent: true }) );
		deferreds.push( toolbars.fetch({ silent: true }) );
		deferreds.push( settingsDef = settings.fetch({ silent: true }) );

		fetchOne(deferreds, allDef);

		settingsDef.always(function() {
			settingsLoaded.resolve();
		});

		return allDef.promise();
	}

	window.fetchAll = fetchAll;
	window.fetchOne = fetchOne;

	/**
	 * Init
	 */
	$(function() {
	fetchAll().always(function() {

		/**
		 * Load counters for specials
		 */
		info.autoSetData();

		/**
		 * Set events
		 */
		sources.on('add', function(source) {
			if (source.get('updateEvery') > 0) {
				browser.alarms.create('source-' + source.get('id'), {
					delayInMinutes: source.get('updateEvery'),
					periodInMinutes: source.get('updateEvery')
				});
			}
			loader.downloadSingleFeed(source);
		});

		sources.on('change:updateEvery reset-alarm', function(source) {
			if (source.get('updateEvery') > 0) {
				browser.alarms.create('source-' + source.get('id'), {
					delayInMinutes: source.get('updateEvery'),
					periodInMinutes: source.get('updateEvery')
				});
			} else {
				browser.alarms.clear('source-' + source.get('id'));
			}
		});

		browser.alarms.onAlarm.addListener(function(alarm) {
			var sourceID = alarm.name.replace('source-', '');
			if (sourceID) {
				var source = sources.findWhere({
					id: sourceID
				});
				if (source) {
					if (!loader.downloadSingleFeed(source)) {
						setTimeout(loader.downloadSingleFeed, 30000, source);
					}
				} else {
					console.log('No source with ID: ' + sourceID);
					browser.alarms.clear(alarm.name);
				}

			}

		});

		sources.on('change:url', function(source) {
			loader.downloadSingleFeed(source);
		});

		sources.on('change:title', function(source) {
			// if url was changed as well change:url listener will download the source
			if (!source.get('title')) {
				loader.downloadSingleFeed(source);
			}

			sources.sort();
		});

		sources.on('change:hasNew', animation.handleIconChange);
		settings.on('change:icon', animation.handleIconChange);

		info.setEvents(sources);

		/**
		 * Init
		 */
		setTimeout(loader.downloadAllFeeds, 30000);
		appStarted.resolve();

		/**
		 * Set icon
		 */
		animation.stop();

		/**
		 * onclick:button -> open RSS
		 */
		browser.browserAction.onClicked.addListener(function() {
			openRSS(true);
		});

	});
	});

	function onExternalLink(url) {
		url = url.replace(/^feed:/i, 'http:');

		var duplicate = sources.findWhere({ url: url });
		if (!duplicate) {
			var s = sources.create({ title: url, url: url, updateEvery: 180 }, { wait: true });
			openRSS(false, s.get('id'));
		} else {
			//duplicate.trigger('change');
			openRSS(false, duplicate.get('id'));
		}
	}

	/**
	 * Messages
	 */
	if (browser.runtime.onMessageExternal)
		browser.runtime.onMessageExternal.addListener(function(message) {
		if (!message.hasOwnProperty('action')) return;
		if (message.action == 'new-rss' && message.value) onExternalLink(message.value);
	});


	var rssMimes = ['application/rss', 'application/rss+xml', 'application/atom+xml', 'application/atom', 'text/atom', 'text/atom+xml'],
		xmlMimes = ['text/xml', 'application/xml'],
		urlParts = /(new|feed|rss)/i;

	// Capturing all raw rss feeds added by default; FF;
	// 	needs "webRequest", "webRequestBlocking",  "<all_urls>" permissions
	if (typeof InstallTrigger !== 'undefined')
		browser.webRequest.onHeadersReceived.addListener(
			handleHeaders,
			{
				urls: ['https://*/*', 'http://*/*'],
				types: ['main_frame']
			},
			['responseHeaders', 'blocking']
		);

	function getContentType(arr) {
		for (var i=0; i < arr.length; i++) {
			if (arr[i].name.toLowerCase() == 'content-type') {
				arr = arr[i].value.split(';');
				return arr[0];
			}
		}
		return '';
	}

	function handleHeaders(details) {
		var contentType = getContentType(details.responseHeaders);
		if (~rssMimes.indexOf(contentType) || (~xmlMimes.indexOf(contentType) && urlParts.test(details.url))) {
			browser.tabs.remove(details.tabId);
			return onExternalLink(details.url.replace(/[^-A-Za-z0-9+&@#/%?=~_|!:,.;\(\)]/, ''));
		}
		return false;
	}

	function openRSS(closeIfActive, focusSource) {
		var url = browser.runtime.getURL('rss.html');
		browser.tabs.query({
			/*url: url*/
		}, function(tabs) {
			var matchedTab = null; //tabs[0]

			// FF hack because moz-extension:// url query won't work
			if (tabs && tabs.length) {
				for (var i = tabs.length; i--; ) {
					if (tabs[i].url === url) {
						matchedTab = tabs[i];
						break;
					}
				}
			}
			if (matchedTab) {
				if (matchedTab.active && closeIfActive) {
					browser.tabs.remove(matchedTab.id);
				} else {
					if (focusSource) window.sourceToFocus = focusSource;
					browser.tabs.update(matchedTab.id, { active: true });
				}
			} else {
				window.sourceToFocus = focusSource;
				browser.tabs.create({ 'url': url }, function() {});
			}
		});
	}

});
