/**
 * @module BgProcess
 * @submodule collections/Folders
 */
define(['backbone', 'models/Folder', 'backboneDB'], function (BB, Folder) {

	/**
	 * Collection of feed folders
	 * @class Folders
	 * @constructor
	 * @extends Backbone.Collection
	 */
	var Folders = BB.Collection.extend({
		model: Folder,
		comparator: function(a, b) {
			var t1 = (a.get('title') || '').trim().toLowerCase();
			var t2 = (b.get('title') || '').trim().toLowerCase();
			//if (t1 === t2) return 0;
			return t1 < t2  ? -1 : 1;
		},
		browserStorage: new BB.BrowserStorage('folders-backbone', 'id', 'local')
	});

	return Folders;

});
