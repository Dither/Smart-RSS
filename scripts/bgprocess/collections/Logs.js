/**
 * @module BgProcess
 * @submodule collections/Logs
 */
define(['backbone'], function (BB) {

	/**
	 * Collection of error log modules
	 * @class Logs
	 * @constructor
	 * @extends Backbone.Collection
	 */
	var Logs = BB.Collection.extend({
		model: BB.Model.extend({
			defaults: {
				message: '<no message>'
			}
		}),
		initialze: function() {
		},
		startLogging: function() {
			window.onerror = function(a, b, c) {
				var path = /\w+-extension:\/\/[^\/]+\//,
					file = b.replace(path, ''),
					msg = '[' + file + ']' + a.toString() + (c && (' @' + c.toString()));

				logs.add({
					message: msg
				});
			};
		}
	});

	return Logs;

});
