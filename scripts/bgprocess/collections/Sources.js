/**
 * @module BgProcess
 * @submodule collections/Sources
 */
define(['backbone', 'models/Source', 'backboneDB'], function (BB, Source) {

	/**
	 * Collection of feed modules
	 * @class Sources
	 * @constructor
	 * @extends Backbone.Collection
	 */
	var Sources = BB.Collection.extend({
		model: Source,
		browserStorage: new Backbone.BrowserStorage('sources-backbone'),
		comparator: function(a, b) {
			var t1 = (a.get('title') || '').trim().toLowerCase();
			var t2 = (b.get('title') || '').trim().toLowerCase();
			return t1 < t2  ? -1 : 1;
		}
	});

	return Sources;

});
