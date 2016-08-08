/**
 * @module BgProcess
 * @submodule models/Loader
 */
define(['backbone', 'modules/RSSParser','modules/ContentExtractor', 'modules/Animation'],
function (BB, RSSParser, ContentExtractor, animation) {

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

		sourcesToDownload.forEach(downloadOne);
	}

	function downloadOne(model) {
		if (loader.sourceLoading === model || loader.sourcesToLoad.indexOf(model) >= 0) {
			return false;
		}

		if (model instanceof Folder) {
			download( sources.where({ folderID: model.id }) );
			return true;
		} else if (model instanceof Source) {
			loader.addSources(model);
			if (loader.get('loading') === false) downloadURL();
			return true;
		}

		return false;
	}

	function downloadAll(force) {
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
			downloadURL();
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

	function downloadURL() {
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

		function onFeedCompleted() {
			loader.set('loaded', loader.get('loaded') + 1);
			// reset alarm to make sure next call isn't too soon + to make sure alarm acutaly exists (it doesn't after import)
			sourceToLoad.trigger('reset-alarm', sourceToLoad);
			sourceToLoad.set('isLoading', false);
			downloadURL();
		}

		var fullText = sourceToLoad.get('fulltextEnable');

		var options = {
			url: sourceToLoad.get('url'),
			timeout: settings.get('rssTimeout') || 12000,
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
		loader.currentRequest = $.ajax(options).done(function(r) {
				var donethis = this,
					parsedData = [],
					hasNew = false,
					createdNo = 0,
					sID = sourceToLoad.get('id');

				var onRSSLoaded = function(parsedData){
					var incompleteItems = parsedData.length,
						timeout = settings.get('htmlTimeout') || 24000;

					parsedData.forEach(function(item) {
						var existingItem = items.get(item.id) || items.get(item.oldId);

						if (fullText) {
							if (!item.url) {
								if (--incompleteItems <= 0)
									onDataReady();
								return;
							}
							/* Don't reload complete pages even if they do change */
							if (!existingItem || existingItem.get('content') === '&nbsp;') $.ajax({
								url: item.url,
								timeout: timeout,
								dataType: 'html'
							}).done(function(htm) {
								new ContentExtractor.parse(htm, sID, item.url, function(content){
									/* TODO: do we need a lock here? */
									if (content && content.length) {
										item.content = content;
									}
									if (!existingItem) {
										hasNew = true;
										items.create(item, { sort: false });
										createdNo++;
									} else if (existingItem.get('deleted') === false &&
											   existingItem.get('content') !== item.content)
									{
										existingItem.save({ content: item.content });
									}
									if (--incompleteItems <= 0)
										onDataReady();
								});
								;
							}).fail(function() {
								//console.log('Failed to load URL: ' + item.url);
								if (--incompleteItems <= 0)
									onDataReady();
							});
						} else {
							if (!existingItem) {
								hasNew = true;
								items.create(item, { sort: false });
								createdNo++;
							} else if (existingItem.get('deleted') === false &&
									   existingItem.get('content') !== item.content)
							{
								existingItem.save({ content: item.content });
							}
						}
					});

					if (!fullText)
						onDataReady();
				};

				var onDataReady = function () {
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

					sourceToLoad.trigger('update', { ok: true });
					if (fullText) onFeedCompleted();
				};

				new RSSParser.parse(r, sID, onRSSLoaded);

			}).fail(function() {
				//log('Failed load RSS: ' + sourceToLoad.get('url'));
				sourceToLoad.trigger('update', { ok: false });
			}).always(function() {
				if (!fullText) onFeedCompleted();
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
		abortDownloading: function() {
			if (loader.currentRequest)
				loader.currentRequest.abort();
			this.sourcesToLoad = [];
			downloadStopped();
		},
		download: download,
		downloadURL: downloadURL,
		downloadOne: downloadOne,
		downloadAll: downloadAll,
		playNotificationSound: playNotificationSound
	});

	return Loader;

});
