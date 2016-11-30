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
			url: '0.0.0.0',
			date: 0,
			dateCreated: 0,
			content: _T('NO_CONTENT') || '&nbsp', // No content
			//type: '', // html|mathjax|video|audio
			sourceID: -1,
			unread: true,
			visited: false,
			deleted: false,
			trashed: false,
			pinned: false
		},
		markAsDeleted: function() {
			this.save({
				trashed: true,
				deleted: true,
				visited: true,
				unread: false,
				pinned: false,
				date: 0,
				dateCreated: 0,
				url: '',
				content: '',
				author: '',
				title: ''
			});
		},
		_source: null,
		getSource: function() {
			if (this._source) return this._source;
			return this._source = (sources.findWhere({ id: this.get('sourceID') }) || sourceJoker);
		},
		query: function(o) {
			if (!o) return true;
			for (var i in o) if (o.hasOwnProperty(i) && this.get(i) != o[i]) return false;
			return true;
		}
	});

	return Item;

});
