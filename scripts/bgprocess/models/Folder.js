/**
 * @module BgProcess
 * @submodule models/Folder
 */
define(['backbone'], function (BB) {

	/**
	 * Model for feed folders
	 * @class Folder
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Folder = BB.Model.extend({
		defaults: {
			title: _T('NO_TITLE'),
			opened: false,
			count: 0, // unread
			countAll: 0
		}
	});

	return Folder;

});
