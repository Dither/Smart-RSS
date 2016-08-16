/**
 * @module BgProcess
 * @submodule models/Item
 */
define(['backbone'], function (BB) {

	/**
	 * Module for each article
	 * @class Item
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Item = BB.Model.extend({
		defaults: {
			title: '<'+_T('NO_TITLE')+'>',
			author: '<'+_T('NO_AUTHOR')+'>',
			url: 'about:blank',
			date: 0,
			content: '&nbsp', // No content loaded
			sourceID: -1,
			unread: true,
			visited: false,
			deleted: false,
			trashed: false,
			pinned: false,
			dateCreated: 0
		},
		markAsDeleted: function() {
			this.save({
				trashed: true,
				deleted: true,
				visited: true,
				unread: false,
				'pinned': false,
				'content': '',
				'author': '',
				'title': ''
			});
		},
		_source: null,
		getSource: function() {
			if (!this._source) {
				this._source = sources.findWhere({ id: this.get('sourceID')	}) || sourceJoker;
			}
			return this._source;
		},
		query: function(o) {
			if (!o) return true;
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					if (this.get(i) != o[i]) return false;
				}
			}
			return true;
		}
	});

	return Item;

});
