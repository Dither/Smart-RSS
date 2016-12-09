/**
 * @module BgProcess
 * @submodule models/Loader
 */
define(['backbone', 'underscore', 'modules/RSSParser','modules/ContentExtractor', 'modules/Animation', 'modules/toDataURI', 'siteinfo'],
function (BB, _, RSSParser, ContentExtractor, animation, toDataURI, siteinfo) {

	function markAutoRemovals(src) {
		var removedelta = parseInt(src.get('autoremove'), 10) || 0; // days
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

	function getDate() {
		return new Date(Date.now()).toISOString().replace(/[^T]+T/g, '').replace(/(?:[Z]|\..+)/g, '') + ':';
	}

	function downloadFeeds(sourcesArr, force) {
		if (!sourcesArr || sourcesArr.length === 0 || !Array.isArray(sourcesArr)) return;
		var oldLen = loader.sourcesToLoad.length;

		console.log(getDate(),'[models/Loader] Requested', sourcesArr.length, 'downloads,', force ? 'forced' : 'non-forced');
		// reset alarm to make sure next call isn't too soon
		// and to make sure alarm actually exists (on feed creation)
		if (force) sources.trigger('reset-alarm');

		sourcesArr = flatSources(sourcesArr).filter(function(src) {
			if (src instanceof Source) {
				var url = src.get('url'),
					sID = src.get('id');

				if (/^(?:http:\/\/)?0\.0\.0\.0/i.test(url)) return false; // ignore default models
				if (loader.currentSource == src || loader.sourcesToLoad.indexOf(src) >= 0) return false;
				if (!favicons.where({ sourceID: sID }).length) {
					//console.log('requesting favicon for', url);
					toDataURI.favicon(url).then(function(_url) {
						favicons.create({data: _url, sourceID: sID});
					}, function(err){ console.log(err); });
				}

				var every = src.get('updateEvery'), last = src.get('lastUpdate');
				//console.log('[models/Loader] Filtering', url, 'every', every, 'last', last, 'Ignore', last > Date.now() - every * 60 * 1000);
				// feeds with updateEvery = -1 are disabled and can't be forced to update (in Update All etc.)
				if (every < 0) return false;
				if (!force) {
					if (!every) return false;
					if (!last) return true;
					// decrease last to include operation and alarm delays
					if (last - 10000 > Date.now() - every * 60 * 1000) return false;
				}
				return true;
			}
			return false;
		});

		if (sourcesArr.length) loader.sourcesToLoad = _.union(loader.sourcesToLoad, sourcesArr);
		else return;

		loader.requestPromise.then(function() {
			onDownloadStarted(loader.sourcesToLoad.length - oldLen);
		}, function() {
			onDownloadStarted(loader.sourcesToLoad.length - oldLen);
		});
	}

	function onDownloadStarted(numAdded) {
		if (numAdded === 0) return;

		loader.set('aborted', false);
		loader.set('numSources', loader.get('numSources') + numAdded);

		if (loader.get('loading') === true) return;

		loader.hasNew = false;
		loader.numberNew = 0;
		loader.set('loading', true);
		animation.start();

		console.log(getDate(), '[models/Loader] Started', numAdded, 'downloads');
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

	function addItem(toadd) {
		loader.hasNew = true;
		loader.numberNew++;
		items.create(toadd, { sort: false });
	}

	function getContent(item, src) {
		return new Promise(function(resolve, reject) {
			if (!src || !item || loader.get('aborted')) return reject();

			var existingItem = items.get(item.id),
				blink = ContentExtractor.binary(item.url),
				siteinfos = siteinfo(item.url);

			if (src.get('fulltextEnable') && !blink) {
				if (!item.url || existingItem) return resolve();  // don't update existing items on content change
				$.ajax({
					url: item.url,
					timeout: (settings.get('htmlTimeout') || 10000),
					dataType: 'html'
				}).done(function(htm) {
					if (!src || loader.get('aborted')) return reject();
					ContentExtractor.parse(htm, src.get('id'), item.url, siteinfos).then(function(content) {
						if (content && content.length) item.content = content;
						addItem(item);
						resolve();
					}).catch(function(e) {
						// filling failed extractions with the original content
						addItem(item);
						//console.log(getDate(), '[models/Loader] Error extracting content', item.url, e);
						onerror('Error extracting content ' + item.url + ' ' + e, 'models/Loader', new Error().lineNumber);
						resolve();
					});
				}).fail(function(e) {
					// filling failed downloads with the original content
					addItem(item);
					console.log(getDate(), '[models/Loader] Error loading from', item.url, e.statusText);
					resolve();
				});
			} else {
				if (blink) item.content = blink;
				for (var j = siteinfos.length; j--;) {
					if (siteinfos[j].filters) {
						for (var cur, i = siteinfos[j].filters.length; i--;) {
							cur = siteinfos[j].filters[i];
							item.content = item.content.replace(new RegExp(cur.s, cur.o), cur.r);
						}
					}
				}
				if (!existingItem) {
					addItem(item);
				} else if (existingItem.get('deleted') === false && // don't update deleted or trashed items
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
				};
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

		parsedData = parsedData.filter(function(item) {
			return !_.findWhere(trashed, {id: item.id});
		});

		// clean up all (stale) deleted items not found in the current feed
		var now = Date.now(), oldest = now - 3 * 24 * 60 * 60 * 1000;
		deleted.forEach(function(item) {
			var created = item.get('dateCreated');
			// keeping items for N-days in case site shuffles the feed randomly, popping deleted items
			// destroying items with inadequate dates and older items
			if (created <= 0 || created > now || created < oldest) {
				//console.log('[models/Loader] Cleaning up', created);
				item.destroy();
			}
		});

		if (!parsedData.length) return onDataProcessed(true, sourceToLoad);

		loader.requestPromise.then(function() { return processItems(parsedData, getContent, sourceToLoad); }).then(
				function() {
					onDataProcessed(true, sourceToLoad);
				}, function(e) {
					console.log(getDate(), '[models/Loader] Error or aborted processing feed items', sourceToLoad.get('url'), e);
					onDataProcessed(false, sourceToLoad);
				}
			);
	}

	function onDataProcessed(success, sourceToLoad) {
		if (!sourceToLoad) return onFeedCompleted(false, null);

		var sID = sourceToLoad.get('id'),
			countAll = items.where({ sourceID: sID, trashed: false }).length,
			count = items.where({ sourceID: sID, unread: true, trashed: false }).length;

		sourceToLoad.set({
			'count': count,
			'countAll': countAll,
			'hasNew': (count > 0 ? (loader.hasNew || sourceToLoad.get('hasNew')) : false)
		});

		info.set({
			allCountUnvisited: info.get('allCountUnvisited') + loader.numberNew
		});

		onFeedCompleted(true, sourceToLoad);
	}

	function getFeed() {
		if (!loader.sourcesToLoad.length) {
			var sourceIDs = sources.pluck('id'),
				foundSome = !items.toArray().every(function(item) {
					// if downloading finished while the source was deleted
					if (sourceIDs.indexOf(item.get('sourceID')) === -1) {
						console.log(getDate(), '[models/Loader] Deleting item because of missing source', item.get('sourceID'));
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

		if (settings.get('showSpinner')) sourceToLoad.set({isLoading: true});

		loader.requestPromise = loader.requestPromise.then(
				function () { return loader.requestHandle = $.ajax(options); }
		).then(function(data, status) {
			return RSSParser.parse(data, sourceToLoad.get('id')).then(function(items) {
				sourceToLoad.set({lastUpdate: Date.now() });
				onDataLoaded(items, sourceToLoad);
			}, function(e) {
				console.log(getDate(), '[models/Loader] Feed parsing failed', options.url, e);
				onFeedCompleted(false, sourceToLoad);
			});
		}, function(e) {
			console.log(getDate(), '[models/Loader] Feed retrieving failed', options.url, e.statusText);
			onFeedCompleted(false, sourceToLoad);
		});
	}

	function onFeedCompleted(success, sourceToLoad) {
		items.sort({ silent: true });
		if (loader.hasNew) items.trigger('render-screen');
		loader.set('numLoaded', loader.get('numLoaded') + 1);

		if (sourceToLoad) {
			sourceToLoad.save({isLoading: false});
			sourceToLoad.trigger('update', { ok: success });
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
		var stop = function(e){
			console.log(getDate(), '[models/Loader] Finished', loader.get('numLoaded'), 'downloads', e ? e : '');
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
			numParallel: 10, // number of HTML pages to retrieve at the same time
			numSources: 0, // number of queued feeds
			numLoaded: 0, // number of loaded feed items
			loading: false, // flag with loading status
			aborted: false // flag to abort HTTP content retrievals
		},
		requestPromise: Promise.resolve(), // general request sequence handle
		requestHandle: null, // $.ajax handle to abort feed request
		currentSource: null, // current feed's model
		hasNew: false, // flag if feed has new items
		numberNew: 0, // number of new feed items
		sourcesToLoad: [], // array of feed models for downloading
		abortDownloading: abortDownloading,
		downloadFeeds: downloadFeeds,
		playNotificationSound: playNotificationSound
	});

	return Loader;
});
