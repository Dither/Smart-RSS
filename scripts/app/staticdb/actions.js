define(['jquery', 'underscore', 'helpers/stripTags', 'modules/Locale', 'controllers/comm'], function($, _, stripTags, Locale, comm) {

var _T = function(text) { return Locale.translate(text); }

return {
	global: {
		default: {
			title: _T('Unknown'),
			fn: function() {
				alert('no action');
			}
		},
		hideOverlays: {
			title: _T('Hide Overlays'),
			fn: function() {
				comm.trigger('hide-overlays');
			}
		},
		runTests: {
			title: _T('Run tests (dev dependencies needed)'),
			fn: function() {
				require(['../runtests']);
			}
		},
		openOptions: {
			title: _T('Options'),
			icon: 'options.png',
			fn: function() {
				window.open('options.html');
			}
		},
		report: {
			title: _T('Report a problem'),
			icon: 'report.png',
			fn: function() {
				app.report();
			}
		}
	},
	feeds: {
		updateAll: {
			icon: 'reload.png',
			title: _T('UPDATE_ALL'),
			fn: function() {
				bg.loader.downloadAllFeeds(true);
			}
		},
		update: {
			icon: 'reload.png',
			title: _T('UPDATE'),
			fn: function() {
				var s = require('views/feedList').selectedItems;
				if (s.length) {
					bg.loader.download(_.pluck(s, 'model'));
				}
			}
		},
		stopUpdate: {
			icon: 'stop.png',
			title: _T('Stop updating feeds'),
			fn: function() {
				bg.loader.abortDownloading();
			}
		},
		mark: {
			icon: 'read.png',
			title: _T('MARK_ALL_AS_READ'),
			fn: function() {
				var s = require('views/feedList').getSelectedFeeds();
				if (!s.length) return;

				bg.items.forEach(function(item) {
					if (item.get('unread') == true && s.indexOf(item.getSource()) >= 0) {
						item.save({
							unread: false,
							visited: true
						});
					}
				});

				s.forEach(function(source) {
					if (source.get('hasNew')) {
						source.save({ hasNew: false });
					}
				});
			}
		},
		refetch: {
			title: _T('Refetch'), /****localization needed****/
			fn: function() {
				if (!window.confirm(_T('This will delete all elements from selected feed(s). Continue?'))) return;

				var s = require('views/feedList').getSelectedFeeds();

				if (!s.length) return;

				s.forEach(function(source) {
					bg.items.where({ sourceID: source.get('id') }).forEach(function(item) {
						item.destroy();
					});
				});

				app.actions.execute('feeds:update');

			}
		},
		delete: {
			icon: 'delete.png',
			title: _T('DELETE'),
			fn: function() {
				if (!confirm(_T('REALLY_DELETE'))) return;

				var feeds = require('views/feedList').getSelectedFeeds();
				var folders = require('views/feedList').getSelectedFolders();

				feeds.forEach(function(feed) {
					feed.destroy();
				});

				folders.forEach(function(folder) {
					folder.destroy();
				});
			}
		},
		showProperties: {
			icon: 'properties.png',
			title: _T('PROPERTIES'),
			fn: function() {
				var properties = app.feeds.properties;

				var feedList = require('views/feedList');

				var feeds = feedList.getSelectedFeeds();
				var folders = feedList.getSelectedFolders();

				if (feedList.selectedItems.length == 1 && folders.length == 1) {
					properties.show(folders[0]);
				} else if (!folders.length && feeds.length == 1) {
					properties.show(feeds[0]);
				} else if (feeds.length > 0) {
					properties.show(feeds);
				}

			}
		},
		addSource: {
			icon: 'add.png',
			title: _T('ADD_RSS_SOURCE'),
			fn: function() {
				var url = (prompt(_T('RSS_FEED_URL')) || '').trim();
				if (!url)  return;

				var folderID = 0;
				var list = require('views/feedList');
				if (list.selectedItems.length && list.selectedItems[0].$el.hasClass('folder')) {
					var fid = list.selectedItems[0].model.get('id');
					// make sure source is not added to folder which is not in db
					if (bg.folders.get(fid)) {
						folderID = fid;
					}
				}

				url = app.fixURL(url);
				var duplicate = bg.sources.findWhere({ url: url });

				if (!duplicate) {
					var newFeed = bg.sources.create({
						title: url,
						url: url,
						updateEvery: 180,
						fulltextEnable: 0,
						folderID: folderID
					}, { wait: true });
					app.trigger('focus-feed', newFeed.get('id'));
				} else {
					app.trigger('focus-feed', duplicate.get('id'));
				}
			}
		},
		addFolder: {
			icon: 'add_folder.png',
			title: _T('NEW_FOLDER'),
			fn: function() {
				var title = (prompt(_T('FOLDER_NAME') + ': ') || '').trim();
				if (!title) return;

				bg.folders.create({
					title: title
				}, { wait: true });
			}
		},
		focus: {
			title: _T('Focus feeds'),
			fn: function() {
				app.setFocus('feeds');
			}
		},
		selectNext: {
			title: _T('Select next'),
			fn: function(e) {
				require('views/feedList').selectNext(e);
			}
		},
		selectPrevious: {
			title: _T('Select previous'),
			fn: function(e) {
				require('views/feedList').selectPrev(e);
			}
		},
		closeFolders: {
			title: _T('Close folders'),
			fn: function(e) {
				var folders = $('.folder.opened');
				if (!folders.length) return;
				folders.each(function(i, folder) {
					if (folder.view) {
						folder.view.handleClickArrow(e);
					}
				});
			}
		},
		openFolders: {
			title: _T('Open folders'),
			fn: function(e) {
				var folders = $('.folder:not(.opened)');
				if (!folders.length) return;
				folders.each(function(i, folder) {
					if (folder.view) {
						folder.view.handleClickArrow(e);
					}
				});
			}
		},
		toggleFolder: {
			title: _T('Toggle folder'),
			fn: function(e) {
				e = e || {};
				var cs = require('views/feedList').selectedItems;
				if (cs.length && cs[0].$el.hasClass('folder')) {
					cs[0].handleClickArrow(e);
				}
			}
		},
		showArticles: {
			title: _T('Show articles'),
			fn: function(e) {
				e = e || {};
				var t = e.target || {};
				var feedList = require('views/feedList');
				var feeds = feedList.getSelectedFeeds();
				var ids = _.pluck(feeds, 'id');
				var special = $('.special.selected').get(0);
				if (special) special = special.view.model;

				app.trigger('select:' + feedList.el.id, {
					action: 'new-select',
					feeds: ids,
					// _.extend is important, because otherwise it would be sent by reference
					filter: special ? _.extend({}, special.get('filter')) : null,
					name: special ? special.get('name') : null,
					unreadOnly: !!e.altKey || t.className == 'source-counter'
				});


				if (special && special.get('name') == 'all-feeds') {
					bg.sources.forEach(function(source) {
						if (source.get('hasNew')) {
							source.save({ hasNew: false });
						}
					});

				} else if (ids.length) {
					bg.sources.forEach(function(source) {
						if (source.get('hasNew') && ids.indexOf(source.id) >= 0) {
							source.save({ hasNew: false });
						}
					});
				}
			}
		},
		showAndFocusArticles: {
			title: _T('Show and focus articles'),
			fn: function(e) {
				e = e || {};
				var cs = require('views/feedList').selectedItems;
				if (cs.length) {
					app.actions.execute('feeds:showArticles', e);
					app.actions.execute('articles:focus');
				}
			}
		}
	},
	articles: {
		mark: {
			icon: 'read.png',
			title: _T('MARK_AS_READ'),
			fn: function() {
				require('views/articleList').changeUnreadState();
			}
		},
		update: {
			icon: 'reload.png',
			title: _T('UPDATE'),
			fn: function() {
				var list = require('views/articleList');
				if (list.currentData.feeds.length) {
					list.currentData.feeds.forEach(function(id) {
						bg.loader.downloadSingleFeed(bg.sources.get(id));
					});
				} else {
					bg.loader.downloadAllFeeds(true); // true = force
				}
			}
		},
		delete: {
			icon: 'delete.png',
			title: _T('DELETE'),
			fn: function(e) {
				var list = require('views/articleList');
				if (list.currentData.name == 'trash' || e.shiftKey) {
					list.destroyBatch(list.selectedItems, list.removeItemCompletely);
				} else {
					list.destroyBatch(list.selectedItems, list.removeItem);
				}
			}
		},
		undelete: {
			icon: 'undelete.png',
			title: _T('UNDELETE'),
			fn: function() {
				var articleList = require('views/articleList');
				if (!articleList.selectedItems || !articleList.selectedItems.length || articleList.currentData.name != 'trash') return;
				articleList.destroyBatch(articleList.selectedItems, articleList.undeleteItem);
			}
		},
		selectNext: {
			fn: function(e) {
				require('views/articleList').selectNext(e);
			}
		},
		selectPrevious: {
			fn: function(e) {
				require('views/articleList').selectPrev(e);
			}
		},
		search: {
			title: _T('SEARCH_TIP'),
			fn: function(e) {
				e = e || { currentTarget: $('input[type=search]').get(0) };
				var str = e.currentTarget.value || '';
				var list = require('views/articleList');
				if (str == '') {
					$('.date-group').css('display', 'block');
				} else {
					$('.date-group').css('display', 'none');
				}

				var searchInContent = false;
				if (str[0] && str[0] == ':') {
					str = str.replace(/^:/, '', str);
					searchInContent = true;
				}
				var rg = new RegExp(RegExp.escape(str), 'i');
				list.views.some(function(view) {
					if (!view.model) return true;
					if (rg.test(view.model.get('title')) || rg.test(view.model.get('author')) || (searchInContent && rg.test(view.model.get('content')) )) {
						view.$el.removeClass('invisible');
					} else {
						view.$el.addClass('invisible');
					}
				});

				list.redraw();

				list.restartSelection();
			}
		},
		focusSearch: {
			title: 'Focus Search',
			fn: function() {
				$('input[type=search]').focus();
			}
		},
		focus: {
			title: 'Focus Articles',
			fn: function() {
				app.setFocus('articles');
			}
		},
		fullArticle: {
			title: _T('FULL_ARTICLE'),
			icon: 'full_article.png',
			fn: function(e) {
				var articleList = app.articles.articleList;
				if (!articleList.selectedItems || !articleList.selectedItems.length) return;
				if (articleList.selectedItems.length > 10 && bg.settings.get('askOnOpening')) {
					if (!confirm('Do you really want to open ' + articleList.selectedItems.length + ' articles?')) {
						return;
					}
				}
				articleList.selectedItems.forEach(function(item) {
					browser.tabs.create({ url: stripTags(item.model.get('url')), active: !e.shiftKey });
				});
			}
		},
		oneFullArticle: {
			title: _T('One full article'),
			fn: function(e) {
				e = e || {};
				var articleList = app.articles.articleList;
				var view;
				if ('currentTarget' in e) {
					view = e.currentTarget.view;
				} else {
					if (!articleList.selectedItems || !articleList.selectedItems.length) return;
					view = articleList.selectedItems[0];
				}
				if (view.model) {
					browser.tabs.create({ url: stripTags(view.model.get('url')), active: !e.shiftKey });
				}
			}
		},
		markAndNextUnread: {
			title: _T('MARK_AND_NEXT_UNREAD'),
			icon: 'find_next.png',
			fn: function() {
				require('views/articleList').changeUnreadState({ onlyToRead: true });
				require('views/articleList').selectNext({ selectUnread: true });
			}
		},
		markAndPrevUnread: {
			title: _T('MARK_AND_PREV_UNREAD'),
			icon: 'find_previous.png',
			fn: function() {
				require('views/articleList').changeUnreadState({ onlyToRead: true });
				require('views/articleList').selectPrev({ selectUnread: true });
			}
		},
		nextUnread: {
			title: _T('NEXT_UNREAD'),
			icon: 'forward.png',
			fn: function() {
				require('views/articleList').selectNext({ selectUnread: true });
			}
		},
		prevUnread: {
			title: _T('PREV_UNREAD'),
			icon: 'back.png',
			fn: function() {
				require('views/articleList').selectPrev({ selectUnread: true });
			}
		},
		markAllAsRead: {
			title: _T('MARK_ALL_AS_READ'),
			icon: 'read.png',
			fn: function() {
				var articleList = require('views/articleList');
				var f = articleList.currentData.feeds;
				var filter = articleList.currentData.filter;
				if (f.length) {
					(filter ? bg.items.where(articleList.currentData.filter) : bg.items).forEach(function(item) {
						if (item.get('unread') == true && f.indexOf(item.get('sourceID')) >= 0) {
							item.save({ unread: false, visited: true });
						}
					});
				} else if (articleList.currentData.name == 'all-feeds') {
					if (confirm(_T('MARK_ALL_QUESTION'))) {
						bg.items.forEach(function(item) {
							if (item.get('unread') == true) {
								item.save({ unread: false, visited: true });
							}
						});
					}
				} else if (articleList.currentData.filter) {
					bg.items.where(articleList.specialFilter).forEach(function(item) {
						item.save({ unread: false, visited: true });
					});
				}
			}
		},
		selectAll: {
			title: _T('Select All'),
			fn: function() {
				var articleList = require('views/articleList');
				articleList.$el.find('.selected').removeClass('selected');
				articleList.selectedItems = [];

				articleList.$el.find('.item:not(.invisible)').each(function(i, item) {
					item.view.$el.addClass('selected');
					articleList.selectedItems.push(item.view);
				});

				articleList.$el.find('.last-selected').removeClass('last-selected');
				articleList.$el.find('.item:not(.invisible):last').addClass('last-selected');
			}
		},
		pin: {
			title: _T('PIN'),
			icon: 'pinsource_context.png',
			fn: function() {
				var articleList = require('views/articleList');
				if (!articleList.selectedItems || !articleList.selectedItems.length) return;
				var val = !articleList.selectedItems[0].model.get('pinned');
				articleList.selectedItems.forEach(function(item) {
					item.model.save({ pinned: val });
				});
			}
		},
		spaceThrough: {
			title: _T('Space Through'),
			fn: function() {
				var articleList = require('views/articleList');
				if (!articleList.selectedItems || !articleList.selectedItems.length) return;
				app.trigger('space-pressed');
			}
		},
		pageUp: {
			title: _T('Page up'),
			fn: function() {
				var el = require('views/articleList').el;
				el.scrollByPages(-1);
			}
		},
		pageDown: {
			title: _T('Page down'),
			fn: function() {
				var el = require('views/articleList').el;
				el.scrollByPages(1);
			}
		},
		scrollToBottom: {
			title: _T('Scroll to bottom'),
			fn: function() {
				var el = require('views/articleList').el;
				el.scrollTop = el.scrollHeight;
			}
		},
		scrollToTop: {
			title: _T('Scroll to top'),
			fn: function() {
				var el = require('views/articleList').el;
				el.scrollTop = 0;
			}
		},
		download: {
			title: _T('DOWNLOAD'),
			icon: 'save.png',
			fn: function() {
				var contentView = require('views/contentView');
				var articleList = require('views/articleList');
				if (!articleList.selectedItems.length) {
					app.actions.execute('content:download');
					return;
				}
				var tpl = contentView.downloadTemplate;

				var list = {};
				list.articles = articleList.selectedItems.map(function(itemView) {
					var attrs = Object.create(itemView.model.attributes);
					attrs.date = contentView.getFormatedDate(attrs.date);
					return attrs;
				});

				var blob = new Blob([ tpl(list) ], { type: 'text\/html' });
				var reader = new FileReader();
				reader.readAsDataURL(blob);
				reader.onload = function() {
					window.open(this.result.replace('data:text/html;', 'data:text/html;charset=utf-8;'));
				};
				/*var url = URL.createObjectURL(blob);
				window.open(url);
				setTimeout(function() {
					URL.revokeObjectURL(url);
				}, 30000);*/
			}
		}
	},
	content: {
		download: {
			title: _T('DOWNLOAD'),
			icon: 'save.png',
			fn: function() {
				var contentView = require('views/contentView');
				if (!contentView.model) return;
				var tpl = contentView.downloadTemplate;
				var attrs = Object.create(contentView.model.attributes);
				attrs.date = contentView.getFormatedDate(attrs.date);
				var list = { articles: [attrs] };
				var blob = new Blob([ tpl(list) ], { type: 'text\/html' });
				var reader = new FileReader();
				reader.readAsDataURL(blob);
				reader.onload = function() {
					window.open(this.result.replace('data:text/html;', 'data:text/html;charset=utf-8;'));
				};
				/*var url = URL.createObjectURL(blob);
				window.open(url);
				setTimeout(function() {
					URL.revokeObjectURL(url);
				}, 30000);*/
			}
		},
		print: {
			title: _T('PRINT'),
			icon: 'print.png',
			fn: function() {
				var contentView = require('views/contentView');
				if (!contentView.model) return;
				window.print();
			}
		},
		mark: {
			title: _T('MARK_AS_READ'),
			icon: 'read.png',
			fn: function() {
				var contentView = require('views/contentView');
				if (!contentView.model) return;
				contentView.model.save({
					unread: !contentView.model.get('unread'),
					visited: true
				});
			}
		},
		delete: {
			title: _T('DELETE'),
			icon: 'delete.png',
			fn: function(e) {
				var contentView = require('views/contentView');
				if (!contentView.model) return;

				askRmPinned = bg.settings.get('askRmPinned')
				if (e.shiftKey) {
					if (contentView.model.get('pinned') && askRmPinned && askRmPinned != 'none') {
						if (!confirm(_T('PIN_QUESTION_A') + contentView.model.escape('title') + _T('PIN_QUESTION_B'))) return;
					}

					contentView.model.markAsDeleted();
				} else {
					if (contentView.model.get('pinned') && askRmPinned == 'all') {
						if (!confirm(_T('PIN_QUESTION_A') + contentView.model.escape('title') + _T('PIN_QUESTION_B'))) return;
					}

					contentView.model.save({
						trashed: true,
						visited: true
					});
				}
			}
		},
		showConfig: {
			title: _T('SETTINGS'),
			icon: 'config.png',
			fn: function() {
				app.content.overlay.show();
			}
		},
		focus: {
			title: _T('Focus Article'),
			fn: function() {
				app.setFocus('content');
			}
		},
		focusSandbox: {
			title: _T('Focus Article'),
			fn: function() {
				app.content.sandbox.el.focus();
			}
		},
		scrollDown: {
			title: _T('Scroll down'),
			fn: function() {
				var cw = $('iframe').get(0).contentWindow;
				cw.scrollBy(0, 40);
			}
		},
		scrollUp: {
			title: _T('Scroll up'),
			fn: function() {
				var cw = $('iframe').get(0).contentWindow;
				cw.scrollBy(0, -40);
			}
		},
		spaceThrough: {
			title: _T('Space trough'),
			fn: function() {
				require('views/contentView').handleSpace();
			}
		},
		pageUp: {
			title: _T('Page up'),
			fn: function() {
				var cw = $('iframe').get(0).contentWindow;
				var d = $('iframe').get(0).contentWindow.document;
				cw.scrollBy(0, -d.documentElement.clientHeight * 0.85);
			}
		},
		pageDown: {
			title: _T('Page down'),
			fn: function() {
				var cw = $('iframe').get(0).contentWindow;
				var d = $('iframe').get(0).contentWindow.document;
				cw.scrollBy(0, d.documentElement.clientHeight * 0.85);
			}
		},
		scrollToBottom: {
			title: _T('Scroll to bottom'),
			fn: function() {
				var cw = $('iframe').get(0).contentWindow;
				var d = $('iframe').get(0).contentWindow.document;
				cw.scrollTo(0, d.documentElement.offsetHeight);
			}
		},
		scrollToTop: {
			title: _T('Scroll to top'),
			fn: function() {
				var cw = $('iframe').get(0).contentWindow;
				cw.scrollTo(0, 0);
			}
		}
	}

};  // end actions object
}); // end define function
