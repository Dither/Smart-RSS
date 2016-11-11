/**
 * @module BgProcess
 * @submodule models/Loader
 */
define(['backbone', 'modules/RSSParser','modules/ContentExtractor', 'modules/Animation', 'modules/toDataURI'],
function (BB, RSSParser, ContentExtractor, animation, toDataURI) {

	function markAutoRemovals(source) {
		var removalInMs = (parseInt(source.get('autoremove'), 10) || 0) * 24 * 60 * 60 * 1000;
		if (!removalInMs) return;
		var now = Date.now();
		items.where({ sourceID: source.get('id'), deleted: false, pinned: false }).forEach(function(item) {
			var date = item.get('dateCreated') || item.get('date');
			if (date + removalInMs < now) {
				item.markAsDeleted();
			}
		});
	}

	function download(sourcesToDownload) {
		if (!sourcesToDownload) return;
		if (!Array.isArray(sourcesToDownload)) sourcesToDownload = [sourcesToDownload];

		sourcesToDownload.forEach(downloadSingleFeed);
	}

	function downloadSingleFeed(model) {
		if (loader.sourceLoading === model || loader.sourcesToLoad.indexOf(model) >= 0) {
			return false;
		}

		if (model instanceof Folder) {
			download( sources.where({ folderID: model.id }) );
			return true;
		} else if (model instanceof Source) {
			loader.addSources(model);
			if (!model.get('favicon'))
				new toDataURI.favicon(model.get('url'), function(url) {
					model.set('favicon', url);
				});
			if (loader.get('loading') === false) downloadFeedByURL();
			return true;
		}

		return false;
	}

	function downloadAllFeeds(force) {
		if (loader.get('loading') === true) return;
		var sourcesArr = sources.toArray();

		if (!force) {
			sourcesArr = sourcesArr.filter(function(source) {
				if (source.get('updateEvery') === 0) return false;
				if (!source.get('lastUpdate')) return true;
				if (source.get('lastUpdate') > Date.now() - source.get('updateEvery') * 60 * 1000) {
					return false;
				}
				return true;
			});
		}

		if (sourcesArr.length) {
			loader.addSources(sourcesArr);
			downloadFeedByURL();
		}
	}

	function playNotificationSound() {
		var audio;
		if (!settings.get('useSound') || settings.get('useSound') === ':user') {
			audio = new Audio(settings.get('defaultSound'));
		} else if (settings.get('useSound') === ':none') {
			audio = false;
		} else {
			audio = new Audio('/sounds/' + settings.get('useSound') + '.ogg');
		}
		if (audio) {
			audio.volume = parseFloat(settings.get('soundVolume'));
			audio.play();
		}
	}

	function downloadStopped() {
		if (loader.itemsDownloaded && settings.get('soundNotifications')) {
			playNotificationSound();
		}

		loader.set('maxSources', 0);
		loader.set('loaded', 0);
		loader.set('loading', false);
		loader.sourceLoading = null;
		loader.currentRequest = null;
		loader.itemsDownloaded = false;
		animation.stop();
	}

	function onFeedCompleted (source, update) {
		loader.set('loaded', loader.get('loaded') + 1);
		// reset alarm to make sure next call isn't too soon + to make sure alarm acutaly exists (it doesn't after import)
		source.trigger('reset-alarm', source);
		source.set('isLoading', false);
		source.trigger('update', { ok: update });
		downloadFeedByURL();
	}

	function downloadFeedByURL() {
		if (!loader.sourcesToLoad.length) {
			// IF DOWNLOADING FINISHED, DELETED ITEMS WITH DELETED SOURCE (should not really happen)
			var sourceIDs = sources.pluck('id');
			var foundSome = false;
			items.toArray().forEach(function(item) {
				if (sourceIDs.indexOf(item.get('sourceID')) === -1) {
					log('DELETING ITEM BECAUSE OF MISSING SOURCE');
					item.destroy();
					foundSome = true;
				}
			});

			if (foundSome) info.autoSetData();
			downloadStopped();

			return;
		}

		animation.start();
		loader.set('loading', true);
		var sourceToLoad = loader.sourceLoading = loader.sourcesToLoad.pop();

		markAutoRemovals(sourceToLoad);

		var fullText = sourceToLoad.get('fulltextEnable');

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
				if (!loader.sourceLoading) return onFeedCompleted(sourceToLoad, false);

				var donethis = this,
					parsedData = [],
					hasNew = false,
					createdNo = 0,
					sID = sourceToLoad.get('id');

				var onRSSLoaded = function(parsedData){
					var incompleteItems = parsedData.length,
						timeout = settings.get('htmlTimeout') || 7000;

					parsedData.forEach(function(item) {
						if (!loader.sourceLoading) return;

						var existingItem = items.get(item.id) || items.get(item.oldId);

						if (fullText) {
							if (!item.url) {
								if (--incompleteItems <= 0) onDataReady();
								return;
							}

							// Should add array ['url':'xhr'] for each one to abort them on global abort
							var xhr = $.ajax({
								url: item.url,
								timeout: timeout,
								dataType: 'html'
							}).done(function(htm) {
								if (!loader.sourceLoading) return onDataReady();
								// Don't refetch existing items
								if (!existingItem)
									new ContentExtractor.parse(htm, sID, item.url, function(content){
										// TODO: do we need a lock here?
										if (content && content.length)
											item.content = content;

										hasNew = true;
										items.create(item, { sort: false });
										createdNo++;

										if (--incompleteItems <= 0) onDataReady();
									});
								else if (--incompleteItems <= 0) onDataReady();
							}).fail(function() {
								if (!loader.sourceLoading) return onDataReady();
								//console.log('Failed to load URL: ' + item.url);
								if (--incompleteItems <= 0) onDataReady();
							}).always(function() {
								//delete loader.pagesLoading[item.url];
							});
							//loader.pagesLoading[item.url]=xhr;
						} else {
							if (!existingItem) {
								hasNew = true;
								items.create(item, { sort: false });
								createdNo++;
							} else if (existingItem.get('deleted') === false &&
									   existingItem.get('content') !== item.content) {
								existingItem.save({ content: item.content });
							}
						}
					});

					if (!fullText) onDataReady();
				};

				var onDataReady = function () {
					if (!loader.sourceLoading) onFeedCompleted(sourceToLoad, false);

					items.sort({ silent: true });
					if (hasNew) {
						loader.itemsDownloaded = true;
						items.trigger('render-screen');
					}

					// remove old deleted content
					var fetchedIDs = _.pluck(parsedData, 'id');
					var fetchedOldIDs = _.pluck(parsedData, 'oldId');
					items.where({
						sourceID: sourceToLoad.get('id'),
						deleted: true
					}).forEach(function(item) {
						if (fetchedIDs.indexOf(item.id) === -1 && fetchedOldIDs.indexOf(item.id) === -1) {
							item.destroy();
						}
					});

					var countAll = items.where({ sourceID: sourceToLoad.get('id'), trashed: false }).length;
					var count = items.where({ sourceID: sourceToLoad.get('id'),	unread: true, trashed: false }).length;

					sourceToLoad.save({
						'count': count,
						'countAll': countAll,
						'lastUpdate': Date.now(),
						'hasNew': hasNew || sourceToLoad.get('hasNew')
					});

					info.set({
						allCountUnvisited: info.get('allCountUnvisited') + createdNo
					});

					onFeedCompleted(sourceToLoad, true);
				};

				new RSSParser.parse(data, sID, onRSSLoaded);
				//console.log('Done called: ' + sourceToLoad.get('url'));

			}).fail(function() {
				//console.log('Fail called: ' + sourceToLoad.get('url'));
				onFeedCompleted(sourceToLoad, false);
			});
	}

	/**
	 * Updates feeds and keeps info about progress
	 * @class Loader
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Loader = Backbone.Model.extend({
		defaults: {
			maxSources: 0,
			loaded: 0,
			loading: false
		},
		currentRequest: null,
		itemsDownloaded: false,
		sourcesToLoad: [],
		sourceLoading: null,
		addSources: function(s) {
			if (s instanceof Source) {
				this.sourcesToLoad.push(s);
				this.set('maxSources', this.get('maxSources') + 1);
			} else if (Array.isArray(s)) {
				this.sourcesToLoad = this.sourcesToLoad.concat(s);
				this.set('maxSources', this.get('maxSources') + s.length);
			}
		},
		isDownloading: function(model) {
			if (typeof model !== 'undefined')
				return this.sourceLoading === model;
			return !!this.sourceLoading;
		},
		abortDownloading: function() {
			this.sourceLoading = null;
			if (loader.currentRequest)
				loader.currentRequest.abort();
			this.sourcesToLoad = [];
			downloadStopped();
		},
		download: download,
		downloadFeedByURL: downloadFeedByURL,
		downloadSingleFeed: downloadSingleFeed,
		downloadAllFeeds: downloadAllFeeds,
		playNotificationSound: playNotificationSound
	});

	return Loader;

});
