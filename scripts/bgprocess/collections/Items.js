/**
 * @module BgProcess
 * @submodule collections/Items
 */
define(['backbone', 'models/Item', 'preps/indexeddb'], function (BB, Item) {

	function getS(val) {
		return String(val).toLowerCase();
	}

	/**
	 * Collection of feed modules
	 * @class Items
	 * @constructor
	 * @extends Backbone.Collection
	 */
	var Items = BB.Collection.extend({
		model: Item,
		batch: false,
		localStorage: new Backbone.LocalStorage('items-backbone'),
		comparator: function(a, b, sorting) {
			var val;
			sortBy = sorting || settings.get('sortBy');
			switch (sortBy) {
				case 'title':
				case 'unread':
				case 'author':
					if (!sorting &&  getS(a.get(sortBy)) === getS(b.get(sortBy)) ) return this.comparator(a, b, settings.get('sortBy2') || true);
					val = getS(a.get(sortBy)) <= getS(b.get(sortBy)) ? 1 : -1;
					break;
				default:
					if (!sorting &&  a.get('date') === b.get('date') ) return this.comparator(a, b, settings.get('sortBy2') || true);
					val = a.get('date') <= b.get('date') ? 1 : -1;
			}

			if (!sorting && settings.get('sortOrder') === 'asc') val = -val;
			if (sorting && settings.get('sortOrder2') === 'asc') val = -val;
			return val;
		},
		initialize: function() {
			//settings.on('change:sortOrder', this.sort, this);
			this.listenTo(settings, 'change:sortOrder', this.sort);
			this.listenTo(settings, 'change:sortOrder2', this.sort);
			this.listenTo(settings, 'change:sortBy', this.sort);
			this.listenTo(settings, 'change:sortBy2', this.sort);
		}
	});

	return Items;

});