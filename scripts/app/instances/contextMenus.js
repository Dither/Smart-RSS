define(['jquery', 'backbone', 'views/ContextMenu', 'views/feedList' ],
function($, BB, ContextMenu) {
	var sourceContextMenu = new ContextMenu([
		{
			title: _T('UPDATE'),
			icon: 'reload.png',
			action: function() {
				app.actions.execute('feeds:update');
			}
		},
		{
			title: _T('MARK_ALL_AS_READ'),
			icon: 'read.png',
			action: function() {
				app.actions.execute('feeds:mark');
			}
		},
		{
			title: _T('DELETE'),
			icon: 'delete.png',
			action: function() {
				app.actions.execute('feeds:delete');
			}
		},
		{
			title: _T('REFETCH'),
			icon: 'save.png',
			action: function() {
				app.actions.execute('feeds:refetch');
			}
		},
		{
			title: _T('PROPERTIES'),
			icon: 'properties.png',
			action: function() {
				app.actions.execute('feeds:showProperties');
			}
		}
	]);

	var trashContextMenu = new ContextMenu([
		{
			title: _T('MARK_ALL_AS_READ'),
			icon: 'read.png',
			action: function() {
				bg.items.where({ trashed: true, deleted: false }).forEach(function(item) {
					if (item.get('unread') === true) {
						item.save({
							unread: false,
							visited: true
						});
					}
				});
			}
		},
		{
			title: _T('EMPTY_TRASH'),
			icon: 'delete.png',
			action: function() {
				$.confirm({
					text: _T('REALLY_EMPTY_TRASH'),
					confirm: function() {
						bg.items.where({ trashed: true, deleted: false }).forEach(function(item) {
							item.markAsDeleted();
						});
						app.trigger('no-items:article-list');
					}
				});
			}
		}
	]);

	var allFeedsContextMenu = new ContextMenu([
		{
			title: _T('UPDATE_ALL'),
			icon: 'reload.png',
			action: function() {
				app.actions.execute('feeds:updateAll');
			}
		},
		{
			title: _T('MARK_ALL_AS_READ'),
			icon: 'read.png',
			action: function() {
				$.confirm({
					text: _T('MARK_ALL_QUESTION'),
					confirm: function() {
						bg.items.forEach(function(item) {
							item.save({ unread: false, visited: true });
						});
					}
				});
			}
		},
		{
			title: _T('DELETE_ALL_ARTICLES'),
			icon: 'delete.png',
			action: function() {
				$.confirm({
					text: _T('DELETE_ALL_Q'),
					confirm: function() {
						bg.items.forEach(function(item) {
							if (item.get('deleted') === true) return;
							item.markAsDeleted();
						});
						app.trigger('no-items:article-list');
					}
				});
			}
		}
	]);

	var folderContextMenu = new ContextMenu([
		{
			title: _T('UPDATE'),
			icon: 'reload.png',
			action: function() {
				app.actions.execute('feeds:update');
			}
		},
		{
			title: _T('MARK_ALL_AS_READ'),
			icon: 'read.png',
			action: function() {
				app.actions.execute('feeds:mark');
			}
		},
		{
			title: _T('DELETE'),
			icon: 'delete.png',
			action: function() {
				app.actions.execute('feeds:delete');
			}
		},
		{
			title: _T('PROPERTIES'),
			icon: 'properties.png',
			action: function() {
				app.actions.execute('feeds:showProperties');
			}
		}
		/*{
			title: _T('RENAME'),
			action: function() {
				var feedList = require('views/feedList');
				$.prompt({
					title: feedList.selectedItems[0].model.get('title'),
					text: _T('FOLDER_NAME') + ': ',
					confirm: function() {
						feedList.selectedItems[0].model.save({ title: newTitle });
					}
				});
			}
		}*/
	]);

	var itemsContextMenu = new ContextMenu([
		{
			title: _T('NEXT_UNREAD') + ' (H)',
			icon: 'forward.png',
			action: function() {
				app.actions.execute('articles:nextUnread');
			}
		},
		{
			title: _T('PREV_UNREAD') + ' (Y)',
			icon: 'back.png',
			action: function() {
				app.actions.execute('articles:prevUnread');
			}
		},
		{
			title: _T('MARK_AS_READ') + ' (K)',
			icon: 'read.png',
			action: function() {
				app.actions.execute('articles:mark');
			}
		},
		{
			title: _T('MARK_AND_NEXT_UNREAD') + ' (G)',
			icon: 'find_next.png',
			action: function() {
				app.actions.execute('articles:markAndNextUnread');
			}
		},
		{
			title: _T('MARK_AND_PREV_UNREAD') + ' (T)',
			icon: 'find_previous.png',
			action: function() {
				app.actions.execute('articles:markAndPrevUnread');
			}
		},
		{
			title: _T('FULL_ARTICLE'),
			icon: 'full_article.png',
			action: function(e) {
				app.actions.execute('articles:fullArticle', e);
			}
		},
		{
			title: _T('PIN') + ' (P)',
			icon: 'pinsource_context.png',
			action: function() {
				app.actions.execute('articles:pin');
			}
		},
		{
			title: _T('DELETE') + ' (D)',
			icon: 'delete.png',
			action: function(e) {
				app.actions.execute('articles:delete', e);
			}
		},
		{
			title: _T('UNDELETE') + ' (N)',
			id: 'context-undelete',
			icon: 'undelete.png',
			action: function() {
				app.actions.execute('articles:undelete');
			}
		}
	]);

	var contextMenus = new (BB.View.extend({
		list: {},
		initialize: function() {
			this.list = {
				source:   sourceContextMenu,
				trash:    trashContextMenu,
				folder:   folderContextMenu,
				allFeeds: allFeedsContextMenu,
				items:    itemsContextMenu
			};
		},
		get: function(name) {
			if (name in this.list)  {
				return this.list[name];
			}
			return null;
		},
		hideAll: function() {
			Object.keys(this.list).forEach(function(item) {
				this.list[item].hide();
			}, this);
		},
		areActive: function() {
			return Object.keys(this.list).some(function(item) {
				return !!this.list[item].el.parentNode;
			}, this);
		}
	}));

	return contextMenus;
});
