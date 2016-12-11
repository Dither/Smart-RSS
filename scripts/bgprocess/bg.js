/**
 * @module BgProcess
 */
define([
	'jquery', 'underscore',
	'modules/Animation', 'models/Settings', 'models/Info', 'models/Source',
	'collections/Sources', 'collections/Items', 'collections/Folders', 'models/Loader', 'collections/Logs',
	'models/Folder', 'models/Item', 'collections/Toolbars', 'collections/Favicons'
],
function ($, _, animation, Settings, Info, Source, Sources, Items, Folders, Loader, Logs, Folder, Item, Toolbars, Favicons) {

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
	window.favicons = new Favicons();

	/**
	 * This is used to focus the newly added feed when the reader opened for it
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
	window.initDownloadTimeout = 30000;
	window.lastDownloadAll = 0;

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
		deferreds.push( favicons.fetch({ silent: true }) );
		deferreds.push( settingsDef = settings.fetch({ silent: true }) );

		fetchOne(deferreds, allDef);
		settingsDef.always(settingsLoaded.resolve);

		return allDef.promise();
	}

	// Get sources from more than one level of folders
	function flatSources(treeArray) {
		if (!treeArray || !treeArray.length) return [];
		return treeArray.reduce(function (flatArray, model) {
			return flatArray.concat((model instanceof Folder) ?
						flatSources(sources.where({ folderID: model.id })) :
						model
					);
		}, []);
	}

	// Get folders from more than one level of folders
	function flatFolders(treeArray) {
		if (!treeArray || !treeArray.length) return [];
		return treeArray.reduce(function (flatArray, model) {
			if (model instanceof Folder)
				return flatArray.concat(model, flatFolders(sources.where({ folderID: model.id })));
			return flatArray;
		}, []);
	}

	window.fetchAll = fetchAll;
	window.fetchOne = fetchOne;
	window.flatSources = flatSources;
	window.flatFolders = flatFolders;

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
			// forced downloads will automatically trigger reset-alarm
			loader.downloadFeeds([source], true);
		});

		sources.on('change:updateEvery reset-alarm', function() {
			browser.alarms.clearAll();

			// get lowest of updateEvery and do non-forced download of all feeds
			// with this period; loader will figure which feeds to ignore
			var s = sources.toArray();
			if (!s.length) return;

			var ttl = _.min(s, function(source) {
				var t = source.get('updateEvery');
				return !isNaN(t) && t > 0 ? t : 43800;
			}).get('updateEvery');

			if (ttl > 0 && ttl < 43800) {
				browser.alarms.create('update', {
					delayInMinutes: ttl,
					periodInMinutes: ttl
				});
			}
		});

		browser.alarms.onAlarm.addListener(function() {
			downloadAllFeeds();
		});

		sources.on('change:url', function(source) {
			loader.downloadFeeds([source]);
		});

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
		 * Extension init
		 */
		appStarted = true;
		browser.runtime.sendMessage({started: true});

		setTimeout(downloadAllFeeds, window.initDownloadTimeout);
		sources.trigger('reset-alarm');

		/**
		 * onclick:button (debounced) -> open RSS
		 */
		browser.browserAction.onClicked.addListener(_.debounce(function() {
			openRSS(true);
		}, 1000, true));
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

	window.downloadAllFeeds = function(force) {
		var now = Date.now();
		if (!force && (window.lastDownloadAll + 3 * 60 * 1000 > now)) return; // don't auto-fetch too often
		window.lastDownloadAll = now;
		loader.downloadFeeds(sources.toArray(), force);
	}

	var onExternalLink = _.debounce(function(url) {
		url = url.replace(/^feed:/i, 'http:');

		var duplicate = sources.findWhere({ url: url });
		if (!duplicate) {
			sources.create({
				title: url,
				url: url,
				updateEvery: 180
			}, {
				wait: true,
				success: function(c, s) {
					openRSS(false, s.id);
				}
			});
		} else {
			openRSS(false, duplicate.get('id'));
		}
	}, 1000, true);

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
			if (arr[i].name.toLowerCase() === 'content-type') {
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
			onExternalLink(details.url.replace(/(?:data|javascript):.+/ig, ''));
		}
		return false;
	}

	function openRSS(closeIfActive, focusSource) {
		var url = browser.runtime.getURL('reader.html');
		browser.tabs.query({
			/*url: url*/
		}, function(tabs) {
			var matchedTab = null; //tabs[0]

			// Firefox hack because `moz-extension:` url query doesn't work
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
