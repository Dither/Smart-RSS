/**
 * @module BgProcess
 * @submodule models/Loader
 */
define(['backbone', 'underscore', 'modules/RSSParser','modules/ContentExtractor', 'modules/Animation', 'modules/toDataURI'],
function (BB, _, RSSParser, ContentExtractor, animation, toDataURI) {

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

	function downloadFeeds(sourcesArr, force) {
		if (!sourcesArr || sourcesArr.length === 0 || !Array.isArray(sourcesArr)) return;
		var oldLen = loader.sourcesToLoad.length;

		sourcesArr = flattenTree(sourcesArr).filter(function(src) {
			if (src instanceof Source) {
				var url = src.get('url'),
					sID = src.get('id');

				if (/^(?:http:\/\/)?0\.0\.0\.0/i.test(url)) return false; // ignore default models
				if (loader.currentSource == src || loader.sourcesToLoad.indexOf(src) >= 0) return false;
				if (!favicons.where({ sourceID: sID }).length) {
					toDataURI.favicon(url).then(function(_url) {
						favicons.create({data: _url, sourceID: sID});
						favicons.trigger('update', { ok: true });
					}, function(err){ console.log(err); });
				}
				if (!force) {
					var every = src.get('updateEvery'),
						last = src.get('lastUpdate');

					if (!every) return false;
					if (!last) return true;
					if (last > Date.now() - every * 60 * 1000) return false;
				}
				return true;
			}
			return false;
		});

		if (sourcesArr.length) loader.sourcesToLoad = _.union(loader.sourcesToLoad, sourcesArr);

		loader.requestPromise.then(function() {
			onDownloadStarted(loader.sourcesToLoad.length - oldLen, oldLen);
		}, function() {
			onDownloadStarted(loader.sourcesToLoad.length - oldLen, oldLen);
		});
	}

	function onDownloadStarted(numAdded, oldLen) {
		if (numAdded === 0) return;

		loader.set('aborted', false);
		loader.set('numSources', loader.get('numSources') + numAdded);

		if (loader.get('loading') === true) return;

		loader.hasNew = false;
		loader.numberNew = 0;
		loader.set('loading', true);
		animation.start();

		getFeed();
	}

	function getContent(item, src) {
		return new Promise(function(resolve, reject) {
			if (!src || !item) return reject(); // rejections shouldn't happen unless it's this kind of bad
			if (loader.get('aborted')) return resolve();

			var existingItem = items.get(item.id);

			if (src.get('fulltextEnable')) {
				if (!item.url) return resolve();

				$.ajax({
					url: item.url,
					timeout: (settings.get('htmlTimeout') || 6000),
					dataType: 'html'
				}).done(function(htm) {
					if (!src) return reject();
					if (loader.get('aborted') || (existingItem && existingItem.get('deleted') === true)) return resolve();

					if (!existingItem) {
						ContentExtractor.parse(htm, src.get('id'), item.url).then(function(content) {
							if (content && content.length) {
								item.content = content;
								loader.hasNew = true;
								items.create(item, { sort: false });
								items.trigger('render-screen'); // render as they go because otherwise it's too slow
								loader.numberNew++;
							}
							resolve();
						}).catch(function() { resolve() }); // ignoring failed extractions
					} else {
						resolve(); // don't update existing items on content change
					}
				}).fail(function() {
					resolve()
				}); // ignoring failed downloads
			} else {
				if (!existingItem) {
					loader.hasNew = true;
					items.create(item, { sort: false });
					loader.numberNew++;
				} else if (existingItem.get('deleted') === false &&
					existingItem.get('content') !== item.content) {
					existingItem.save({ content: item.content }); // update existing items on content change
				}
				resolve();
			}
		});
	}


	function processItems(array, parser, src) {
		var N = loader.get('numParallel') || 5,
			prev = Promise.resolve();

		/* N-items batch downloads */
		for (var next, i = 0, length = array.length; i < length; i = i + N) {
			next = function(here) {
				return function() {
					return Promise.all(array.slice(here, here + N).map(function(item) {
						return parser(item, src);
					}));
				}
			};
			prev = prev.then(next(i));
		}
		return prev;
	}

	function onDataLoaded(parsedData, sourceToLoad){
		if (!sourceToLoad || !parsedData || !parsedData.length) return onDataProcessed(false, sourceToLoad);

		// if any fetched items are marked as deleted, filter them out
		var deleted = items.where({ sourceID: sourceToLoad.get('id'), deleted: true });
		parsedData = parsedData.filter(function(item) {
			var i, notfound = true;
			for (i = deleted.length; i--;) {
				if(item.id !== deleted[i].id) continue;
				//console.log('@deleted', deleted[i].id);
				notfound = false;
				deleted.splice(i, 1);
				break;
			}
			return notfound;
		});

		// remove all deleted items (stale) not found in the current feed
		deleted.forEach(function(item){ item.destroy(); });

		if (!parsedData.length) return onDataProcessed(false, sourceToLoad);

		loader.requestPromise.then(function() { return processItems(parsedData, getContent, sourceToLoad); }).then(
				function() {
					onDataProcessed(true, sourceToLoad);
				}, function() {
					console.log('[models/Loader] Error processing feed items', sourceToLoad.get('url'));
					onDataProcessed(true, sourceToLoad);
				}
			);
	}

	function onDataProcessed(success, sourceToLoad) {
		if (!sourceToLoad) return onFeedCompleted(null, false);

		var sID = sourceToLoad.get('id'),
			countAll = items.where({ sourceID: sID, trashed: false }).length,
			count = items.where({ sourceID: sID, unread: true, trashed: false }).length;

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
	}

	function getFeed() {
		if (!loader.sourcesToLoad.length) {
			var sourceIDs = sources.pluck('id'),
				foundSome = !items.toArray().every(function(item) {
					// if downloading finished while the source was deleted
					if (sourceIDs.indexOf(item.get('sourceID')) === -1) {
						console.log('[models/Loader] Deleting item because of missing source', item.get('sourceID'));
						item.destroy();
						return false;
					}
					return true;
				});

			if (foundSome) info.autoSetData();
			onDownloadStopped();
			return;
		}

		var sourceToLoad = loader.currentSource = loader.sourcesToLoad.pop();

		markAutoRemovals(sourceToLoad);

		var options = {
				url: sourceToLoad.get('url'),
				timeout: settings.get('rssTimeout') || 10000,
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

		loader.requestPromise = loader.requestPromise.then(function () { return loader.requestHandle = $.ajax(options); });
		loader.requestPromise.then(function(data, status) {
				return RSSParser.parse(data, sourceToLoad.get('id')).then(function(items, sID) {
					onDataLoaded(items, sourceToLoad);
				}, function() {
					console.log('[models/Loader] Feed parsing failed', options.url);
					onFeedCompleted(sourceToLoad, false);
				});
			}).catch(function() {
				console.log('[models/Loader] Feed retreiving failed', options.url);
				onFeedCompleted(sourceToLoad, false);
			});
	}

	function onFeedCompleted(src, upd) {
		items.sort({ silent: true });
		if (loader.hasNew) items.trigger('render-screen');
		loader.set('numLoaded', loader.get('numLoaded') + 1);
		// reset alarm to make sure next call isn't too soon
		//  + to make sure alarm acutaly exists (it doesn't after import)
		if (src) {
			src.trigger('reset-alarm', src);
			src.set('isLoading', false);
			src.trigger('update', { ok: upd });
		}
		getFeed();
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

	function onDownloadStopped() {
		var stop = function(){
			if (loader.hasNew && settings.get('soundNotifications'))
				playNotificationSound();
			loader.set('numSources', 0);
			loader.set('numLoaded', 0);
			loader.set('loading', false);
			loader.currentSource = null;
			loader.requestHandle = null;
			loader.hasNew = false;
			loader.numberNew = 0;
			loader.set('aborted', false)
			animation.stop();
			loader.requestPromise = Promise.resolve();
		};
		loader.requestPromise.then(stop, stop);
	}

	function abortDownloading() {
		loader.currentSource = null;
		loader.set('aborted', true);
		if (loader.requestHandle) loader.requestHandle.abort();
		loader.sourcesToLoad = [];
		onDownloadStopped();
	}

	/**
	 * Updates feeds and keeps info about progress
	 * @class Loader
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Loader = Backbone.Model.extend({
		defaults: {
			numParallel: 10, // number of parallel HTTP sources to retreive
			numSources: 0, // number of queued feeds
			numLoaded: 0, // number of loaded feed items
			loading: false, // flag with loading status
			aborted: false // flag to abort HTTP request retreivals
		},
		requestPromise: Promise.resolve(), // general request sequence handle
		requestHandle: null, // $.ajax handle to abort RSS request
		currentSource: null, // current feed's model
		hasNew: false, // flag if feed has new items
		numberNew: 0, // number of new feed items
		sourcesToLoad: [], // array of feed models for procesing
		abortDownloading: abortDownloading,
		downloadFeeds: downloadFeeds,
		playNotificationSound: playNotificationSound
	});

	return Loader;

});
