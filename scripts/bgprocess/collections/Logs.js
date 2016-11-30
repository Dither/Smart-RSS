/**
 * @module BgProcess
 * @submodule collections/Logs
 */
define(['backbone', 'models/Log'], function (BB, Log) {

	/**
	 * Collection of error log modules
	 * @class Logs
	 * @constructor
	 * @extends Backbone.Collection
	 */
	var Logs = BB.Collection.extend({
		model: Log,
		initialze: function() {
		},
		startLogging: function() {
			window.onerror = function(a, b, c) {
				var file = b.replace(/\w+\-extension:\/\/[^\/]+\//, '');
				var msg = a.toString() + ' (Line: ' + c.toString() + ', File: ' + file + ')';
				logs.add({
					message: msg
				});
			};
		}
	});

	return Logs;

});
