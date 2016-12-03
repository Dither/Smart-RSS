/**
 * @module BgProcess
 * @submodule models/Loader
 */
define(['backbone', 'underscore', 'modules/RSSParser','modules/ContentExtractor', 'modules/Animation', 'modules/toDataURI'],
function (BB, _, RSSParser, ContentExtractor, animation, toDataURI) {

	function markAutoRemovals(src) {
		var removedelta = (parseInt(src.get('autoremove'), 10) || 0); // days
		if (!removedelta) return;
		var oldest = Date.now() - removedelta * 24 * 60 * 60 * 1000; // ms
		items.where({
			sourceID: src.get('id'),
			deleted: false,
			pinned: false
		}).forEach(function(item) {
			// we assign dateCreated as Date.now() in RSSParser so if it's <=0 things went seriously wrong
			var created = item.get('dateCreated');
			// so if we encounter those we'll delete them anyway to prevent uncontrolled database growth
			if (created <= 0 || created < oldest)
				item.markAsDeleted();
		});
	}

	// Support more than one level of directories
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

		console.log('[models/Loader] Requested', sourcesArr.length, 'downloads,', force ? 'forced' : 'non-forced');

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
				var every = src.get('updateEvery'), last = src.get('lastUpdate');
				//console.log('[models/Loader] Filtering', url, 'every', every, 'last', last, 'Ignore', last > Date.now() - every * 60 * 1000);
				if (!every || every === -1) return false; // consider feeds with updateEvery = 0 as disabled
				if (!force) {
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

		console.log('[models/Loader] Started', numAdded, 'downloads');
		getFeed();
	}

	function getFileSize(url) {
		return new Promise(function(resolve, reject) {
			try {
				var xhr = new XMLHttpRequest();
				xhr.open('HEAD', url, true);
				xhr.onreadystatechange = function() {
					if (this.readyState !== this.DONE) {
						resolve(parseInt(this.getResponseHeader('Content-Length'), 10) || -1);
					}
				};
				xhr.onerror = function() { resolve(-1); };
				xhr.send();
			} catch(e) {
				resolve(-1);
			}
		});
	}

	function getContent(item, src) {
		return new Promise(function(resolve, reject) {
			if (!src || !item || loader.get('aborted')) return reject();

			var existingItem = items.get(item.id),
				blink = ContentExtractor.binary(item.url);

			if (src.get('fulltextEnable') && !blink) {
				if (!item.url) return resolve();

				$.ajax({
					url: item.url,
					timeout: (settings.get('htmlTimeout') || 6000),
					dataType: 'html'
				}).done(function(htm) {
					if (!src || loader.get('aborted')) return reject();

					if (!existingItem) {
						ContentExtractor.parse(htm, src.get('id'), item.url).then(function(content) {
							if (content && content.length) {
								item.content = content;
								loader.hasNew = true;
								loader.numberNew++;
								items.create(item, { sort: false });
							}
							resolve();
						}).catch(function(e) {
							console.log('[models/Loader] Error extracting content', item.url, ',', e);
							resolve(); // ignoring failed extractions
						});
					} else {
						resolve(); // don't update existing items on content change
					}
				}).fail(function(e) {
					console.log('[models/Loader] Error loading from', item.url, ',', e);
					resolve(); // ignoring failed downloads
				});
			} else {
				if (blink) item.content = blink;
				if (!existingItem) {
					loader.hasNew = true;
					loader.numberNew++;
					items.create(item, { sort: false });
				} else if (existingItem.get('deleted') === false &&
					existingItem.get('trashed') === false &&
					existingItem.get('content') !== item.content) {
					existingItem.save({ content: item.content }); // update existing items on content change
				}
				resolve();
			}
		});
	}

	function processItems(array, parser, src) {
		var N = loader.get('numParallel') || 7,
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

		// if any fetched items are marked as trashed or deleted, filter them out
		var deleted = items.where({ sourceID: sourceToLoad.get('id'), deleted: true }),
			trashed = items.where({ sourceID: sourceToLoad.get('id'), trashed: true });
		parsedData = parsedData.filter(function(item) {
			var i, notfound = true;
			for (i = deleted.length; i--;) {
				if (item.id !== deleted[i].id) continue;
				notfound = false;
				deleted.splice(i, 1);
				break;
			}
			return notfound;
		});

		// clean up all (stale) deleted items not found in the current feed
		var now = Date.now(), oldest = now - 3 * 24 * 60 * 60 * 1000;
		deleted.forEach(function(item) {
			var created = item.get('dateCreated');
			// keeping items for 3 days in case site shuffles the feed randomly, popping deleted items
			// destroying deleted items with inadequate dates
			if (created <= 0 || created > now || created < oldest) {
				console.log('[models/Loader] Cleaning up', item.get('url'));
				item.destroy();
			}
		});

		if (!parsedData.length) return onDataProcessed(false, sourceToLoad);

		loader.requestPromise.then(function() { return processItems(parsedData, getContent, sourceToLoad); }).then(
				function() {
					onDataProcessed(true, sourceToLoad);
				}, function(e) {
					console.log('[models/Loader] Error or aborted processing feed items', sourceToLoad.get('url'), e);
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
			'hasNew': (count > 0 ? (loader.hasNew || sourceToLoad.get('hasNew')) : false)
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

		loader.requestPromise = loader.requestPromise.then(
				function () { return loader.requestHandle = $.ajax(options); }//,
				//function () { return loader.requestHandle = $.ajax(options); }
		);
		loader.requestPromise.then(function(data, status) {
				return RSSParser.parse(data, sourceToLoad.get('id')).then(function(items, sID) {
					onDataLoaded(items, sourceToLoad);
				}, function() {
					console.log('[models/Loader] Feed parsing failed', options.url);
					onFeedCompleted(sourceToLoad, false);
				});
			}).catch(function() {
				console.log('[models/Loader] Feed retrieving failed', options.url);
				onFeedCompleted(sourceToLoad, false);
			});
	}

	function onFeedCompleted(src, upd) {
		console.log('[models/Loader] Finished', loader.get('numLoaded') + 1, 'downloads');
		items.sort({ silent: true });
		if (loader.hasNew) items.trigger('render-screen');
		loader.set('numLoaded', loader.get('numLoaded') + 1);
		// reset alarm to make sure next call isn't too soon
		//  + to make sure alarm actually exists (it doesn't after import)
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
			loader.requestPromise = Promise.resolve();
			loader.set('aborted', false);
			animation.stop();
		};
		loader.requestPromise.then(stop, stop);
	}

	function abortDownloading() {
		loader.sourcesToLoad = [];
		loader.set('aborted', true);
		if (loader.requestHandle) loader.requestHandle.abort();
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
			numParallel: 10, // number of parallel HTTP sources to retrieve
			numSources: 0, // number of queued feeds
			numLoaded: 0, // number of loaded feed items
			loading: false, // flag with loading status
			aborted: false // flag to abort HTTP request retrievals
		},
		requestPromise: Promise.resolve(), // general request sequence handle
		requestHandle: null, // $.ajax handle to abort RSS request
		currentSource: null, // current feed's model
		hasNew: false, // flag if feed has new items
		numberNew: 0, // number of new feed items
		sourcesToLoad: [], // array of feed models for processing
		abortDownloading: abortDownloading,
		downloadFeeds: downloadFeeds,
		playNotificationSound: playNotificationSound
	});

	return Loader;

});
