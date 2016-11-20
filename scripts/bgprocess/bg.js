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

	window.appStarted = false;
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

	window.defaultDownloadTimeout = 20000;

	logs.startLogging();

	/**
	 * RSS Downloader
	 */
	$.support.cors = true;

	/**
	 * Fetch all
	 */
	function fetchOne(arr, allDef) {
		if (!arr.length) return allDef.resolve();
		var one = arr.shift();
		one.always(function() {
			fetchOne(arr, allDef);
		});
	}

	function fetchAll() {
		var allDef = new (jQuery.Deferred)(),
			deferreds = [],
			settingsDef;

		deferreds.push(  folders.fetch({ silent: true }) );
		deferreds.push(  sources.fetch({ silent: true }) );
		deferreds.push(    items.fetch({ silent: true }) );
		deferreds.push( toolbars.fetch({ silent: true }) );
		deferreds.push( settingsDef = settings.fetch({ silent: true }) );

		fetchOne(deferreds, allDef);
		settingsDef.always(settingsLoaded.resolve);

		return allDef.promise();
	}

	window.fetchAll = fetchAll;
	window.fetchOne = fetchOne;

	var isFirefox = (typeof InstallTrigger !== 'undefined');

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
			var ttl = source.get('updateEvery');
			if (!isNaN(ttl) && ttl > 0 && ttl < 100000) {
				browser.alarms.create('source-' + source.get('id'), {
					delayInMinutes: ttl,
					periodInMinutes: ttl
				});
			}
			loader.downloadFeeds([source]);
		});

		sources.on('change:updateEvery reset-alarm', function(source) {
			var ttl = source.get('updateEvery');
			if (!isNaN(ttl) && ttl > 0 && ttl < 100000) {
				browser.alarms.create('source-' + source.get('id'), {
					delayInMinutes: ttl,
					periodInMinutes: ttl
				});
			} else {
				browser.alarms.clear('source-' + source.get('id'));
			}
		});

		browser.alarms.onAlarm.addListener(function(alarm) {
			var sourceID = alarm.name.replace('source-', '');
			if (sourceID) {
				var source = sources.findWhere({ id: sourceID });
				if (source) {
					setTimeout(function(source) { loader.downloadFeeds([source]); }, window.defaultDownloadTimeout);
				} else {
					console.log('No source with ID: ' + sourceID);
					browser.alarms.clear(alarm.name);
				}
			}
		});

		sources.on('change:url', function(source) { loader.downloadFeeds([source]); });
		sources.on('change:title', function(source) {
			// if url was changed as well change:url listener will download the source
			if (!source.get('title')) loader.downloadFeeds([source]);
			sources.sort();
		});

		/**
		 * Set icon
		 */
		animation.stop();
		sources.on('change:hasNew', animation.handleIconChange);
		settings.on('change:icon', animation.handleIconChange);

		info.setEvents(sources);

		/**
		 * Init
		 */
		setTimeout(function() { loader.downloadFeeds(sources.toArray()) }, window.defaultDownloadTimeout);
		appStarted = true;
		browser.runtime.sendMessage({started: true});
		/**
		 * onclick:button -> open RSS
		 */
		var pending = false;
		browser.browserAction.onClicked.addListener(function() {
			if (pending) return;
			pending = true;
			setTimeout(function() { pending = false; }, 1000);
			openRSS(true);
		});
	}); //fetchAll().always
	}); //$

	/**
	 * Messages
	 */
	if (browser.runtime.onMessageExternal)
		browser.runtime.onMessageExternal.addListener(function(message) {
		if (!message.hasOwnProperty('action')) return;
		if (message.action === 'new-rss' && message.value) onExternalLink(message.value);
	});

	function onExternalLink(url) {
		url = url.replace(/^feed:/i, 'http:');

		var duplicate = sources.findWhere({ url: url });
		if (!duplicate) {
			var s = sources.create({ title: url, url: url, updateEvery: 180 }, { wait: true });
			openRSS(false, s.get('id'));
		} else {
			openRSS(false, duplicate.get('id'));
		}
	}

	// Capture raw feeds in Firefox and prevent embedded feed viewer.
	// We need additional "webRequest", "webRequestBlocking", "<all_urls>" permissions only for that.
	if (isFirefox) {
		browser.webRequest.onHeadersReceived.addListener(
			handleHeaders,
			{
				urls: ['https://*/*', 'http://*/*'],
				types: ['main_frame']
			},
			['responseHeaders', 'blocking']
		);
	}

	function getContentType(arr) {
		for (var i=0; i < arr.length; i++) {
			if (arr[i].name.toLowerCase() == 'content-type') {
				arr = arr[i].value.split(';');
				return arr[0];
			}
		}
		return 'application/octet-stream';
	}

	var rssMimes = ['application/rss', 'application/rss+xml', 'application/atom+xml', 'application/atom', 'text/atom', 'text/atom+xml'],
		xmlMimes = ['text/xml', 'application/xml'],
		urlParts = /(new|feed|rss|atom)/i;

	function handleHeaders(details) {
		var contentType = getContentType(details.responseHeaders);
		if (~rssMimes.indexOf(contentType) || (~xmlMimes.indexOf(contentType) && urlParts.test(details.url))) {
			browser.tabs.remove(details.tabId);
			return onExternalLink(details.url.replace(/(?:data|javascript):.+/ig, ''));
		}
		return false;
	}

	function openRSS(closeIfActive, focusSource) {
		var url = browser.runtime.getURL('reader.html');
		browser.tabs.query({
			/*url: url*/
		}, function(tabs) {
			var matchedTab = null; //tabs[0]

			// Firefox hack because `moz-extension://` url query won't work
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
