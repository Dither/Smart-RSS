/**
 * @module BgProcess
 * @submodule models/Loader
 */
define(['backbone', 'modules/RSSParser','modules/ContentExtractor', 'modules/Animation', 'modules/toDataURI'],
function (BB, RSSParser, ContentExtractor, animation, toDataURI) {

	function markAutoRemovals(src) {
		var removalInMs = (parseInt(src.get('autoremove'), 10) || 0) * 24 * 60 * 60 * 1000;
		if (!removalInMs) return;
		var now = Date.now();
		items.where({
			sourceID: src.get('id'),
			deleted: false,
			pinned: false
		}).forEach(function(item) {
			var date = item.get('dateCreated') || item.get('date');
			if (date + removalInMs < now) item.markAsDeleted();
		});
	}

	// Support more than one level of directrories
	function flattenTree(treeArray) {
		return treeArray.reduce(function (flatArray, model) {
			return flatArray.concat((model instanceof Folder) ?
						flattenTree(sources.where({ folderID: model.id })) :
						model
					);
		}, []);
	}

	function numDownloading() {
		return loader.sourcesToLoad.length;
	}

	function downloadFeeds(sourcesArr, force) {
		if (!sourcesArr || sourcesArr.length === 0 || !Array.isArray(sourcesArr)) return;

		sourcesArr = flattenTree(sourcesArr).filter(function(src) {
			if (src instanceof Source) {
				var url = src.get('url');
				if (/^about:/i.test(url)) return false;
				if (loader.currentSource === src ||
				    loader.sourcesToLoad.indexOf(src) >= 0)
					return false;
				if (!src.get('favicon')) {
					new toDataURI.favicon(url, function(_url) {
						src.set('favicon', _url);
					});
				}
				if (!force) {
					var every = src.get('updateEvery'), last = src.get('lastUpdate');
					if (!every) return false;
					if (!last) return true;
					if (last > Date.now() - every * 60 * 1000) return false;
				}
				return true;
			}
			return false;
		});

		var oldLen = numDownloading();
		if (sourcesArr.length) loader.sourcesToLoad = loader.sourcesToLoad.concat(sourcesArr);
		downloadStarted(oldLen > 0 && numDownloading() > oldLen, numDownloading() - oldLen);
	}

	function downloadStarted(isAdded, numAdded) {
		if (!isAdded) {
			loader.hasNew = false;
			loader.numberNew = 0;

			animation.start();
			loader.set('loading', true);
		}
		loader.set('numSources', loader.get('numSources') + numAdded);
		downloadFeedByURL();
	}

	function playNotificationSound() {
		var audio, use = settings.get('useSound');

		if (!use || use === ':user') audio = new Audio(settings.get('defaultSound'));
		else if (use === ':none') audio = false;
		else audio = new Audio('/sounds/' + use + '.ogg');

		if (audio) {
			audio.volume = parseFloat(settings.get('soundVolume'));
			audio.play();
		}
	}

	function downloadStopped() {
		if (loader.hasNew && settings.get('soundNotifications'))
			playNotificationSound();

		loader.set('numSources', 0);
		loader.set('numLoaded', 0);
		loader.set('loading', false);
		loader.currentSource = null;
		loader.currentRequest = null;
		loader.hasNew = false;
		loader.numberNew = 0;
		animation.stop();
	}

	function onFeedCompleted(src, upd) {
		loader.set('numLoaded', loader.get('numLoaded') + 1);
		// reset alarm to make sure next call isn't too soon + to make sure alarm acutaly exists (it doesn't after import)
		if (src) {
			src.trigger('reset-alarm', src);
			src.set('isLoading', false);
			src.trigger('update', { ok: upd });
		}
		downloadFeedByURL();
	}

	function onDataLoaded(parsedData, sID){
		var timeout = settings.get('htmlTimeout') || 7000,
			fullText = loader.currentSource.get('fulltextEnable'),
			// remove old deleted content
			deleted = items.where({ sourceID: sID, deleted: true });

		parsedData = parsedData.filter(function(item) {
			var i, notfound = true;
			for (i = deleted.length; i--;) {
				if(item.id !== deleted[i].id) continue;
				// if any fetched items are in deleted, filter them out
				//console.log('@deleted', deleted[i].id);
				notfound = false;
				deleted.splice(i, 1);
				break;
			}
			return notfound;
		});

		// remove all deleted items not found in the current feed
		deleted.forEach(function(item){ item.destroy(); });

		var incompleteItems = parsedData.length;
		parsedData.forEach(function(item) {
			if (!loader.currentSource) return;

			var existingItem = items.get(item.id);

			if (fullText) {
				if (!item.url) {
					if (--incompleteItems <= 0) onDataReady();
					return;
				}

				var xhr = $.ajax({
					url: item.url,
					timeout: timeout,
					dataType: 'html'
				}).done(function(htm) {
					if (!loader.currentSource) return onDataReady();
					// Don't refetch existing items
					if (!existingItem)
						new ContentExtractor.parse(htm, sID, item.url, function(content){
							// TODO: do we need a lock here?
							if (content && content.length)
								item.content = content;

							loader.hasNew = true;
							items.create(item, { sort: false });
							loader.numberNew++;

							if (--incompleteItems <= 0) onDataReady();
						});
					else if (--incompleteItems <= 0) onDataReady();
				}).fail(function() {
					if (!loader.currentSource) return onDataReady();
					if (--incompleteItems <= 0) onDataReady();
				}).always(function() {});
			} else {
				if (!existingItem) {
					loader.hasNew = true;
					items.create(item, { sort: false });
					loader.numberNew++;
				} else if (existingItem.get('deleted') === false &&
						   existingItem.get('content') !== item.content) {
					existingItem.save({ content: item.content });
				}
			}
		});

		if (!fullText || !parsedData.length) onDataReady();
	};

	function onDataReady() {
		var sourceToLoad = loader.currentSource;
		if (!sourceToLoad) return onFeedCompleted(null, false);

		items.sort({ silent: true });
		if (loader.hasNew) items.trigger('render-screen');

		var sID = sourceToLoad.get('id');
		var countAll = items.where({ sourceID: sID, trashed: false }).length;
		var count = items.where({ sourceID: sID, unread: true, trashed: false }).length;

		sourceToLoad.save({
			'count': count,
			'countAll': countAll,
			'lastUpdate': Date.now(),
			'hasNew': loader.hasNew || sourceToLoad.get('hasNew')
		});

		info.set({
			allCountUnvisited: info.get('allCountUnvisited') + loader.numberNew
		});

		onFeedCompleted(sourceToLoad, true);
	};

	function downloadFeedByURL() {
		if (!numDownloading()) {
			var sourceIDs = sources.pluck('id'),
				foundSome = false;

			// if downloading finished while source was deleted
			items.toArray().forEach(function(item) {
				if (sourceIDs.indexOf(item.get('sourceID')) === -1) {
					console.log('Deleting item because of missing source', item.get('sourceID'));
					item.destroy();
					foundSome = true;
				}
			});

			if (foundSome) info.autoSetData();
			downloadStopped();
			return;
		}

		var sourceToLoad = loader.currentSource = loader.sourcesToLoad.pop();

		markAutoRemovals(sourceToLoad);

		var options = {
				url: sourceToLoad.get('url'),
				timeout: settings.get('rssTimeout') || 5000,
				dataType: 'xml',
				beforeSend: function(xhr) {
					xhr.setRequestHeader('Cache-Control', 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0');
					xhr.setRequestHeader('Pragma', 'no-cache');
					xhr.setRequestHeader('X-Time-Stamp', Date.now());
				}
			};

		if (sourceToLoad.get('username') || sourceToLoad.get('password')) {
			options.username = sourceToLoad.get('username') || '';
			options.password = sourceToLoad.getPass() || '';
		}

		if (settings.get('showSpinner')) sourceToLoad.set('isLoading', true);

		//console.log('AJAX called: ' + sourceToLoad.get('url'));
		loader.currentRequest = $.ajax(options)
			.done(function(data, status) {
				if (!loader.currentSource) return onFeedCompleted(sourceToLoad, false);
				new RSSParser.parse(data, sourceToLoad.get('id'), onDataLoaded);
				//console.log('Done called:', sourceToLoad.get('url'), status);

			}).fail(function() {
				onFeedCompleted(sourceToLoad, false);
				//console.log('Fail called:', sourceToLoad.get('url'));
			});
	}

	function abortDownloading() {
		loader.currentSource = null;
		if (loader.currentRequest)
			loader.currentRequest.abort();
		loader.sourcesToLoad = [];
		downloadStopped();
	}

	/**
	 * Updates feeds and keeps info about progress
	 * @class Loader
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Loader = Backbone.Model.extend({
		defaults: {
			numSources: 0,
			numLoaded: 0,
			loading: false
		},
		currentRequest: null,
		currentSource: null,
		hasNew: false,
		numberNew: 0,
		sourcesToLoad: [],
		numDownloading: numDownloading,
		abortDownloading: abortDownloading,
		downloadFeeds: downloadFeeds,
		playNotificationSound: playNotificationSound
	});

	return Loader;

});
