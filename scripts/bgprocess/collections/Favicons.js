/**
 * @module BgProcess
 * @submodule collections/Favicons
 */
define(['backbone', 'preps/storage'], function (BB) {

	/**
	 * Collection of favicons
	 * @class Favicons
	 * @constructor
	 * @extends Backbone.Collection
	 */
	var Favicons = BB.Collection.extend({
		model: BB.Model.extend({ defaults: {
			data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAADYUlEQVR42mNkoDFgpLsFd2p1fJRF2HOBTA0gZibSnH9A/PDt1z/zSzY8mb/g1Nv/WC341mNYxcHC2AKWAIL/QIDMRhbDpQbIXMRUcC4Bw4LViUraIQaCF4FqmCi0gOH+u1+Byk1XNqJY8LxZr06Cj7URxP7y8+/MxaffzVUSZpMxkeM2EOZmcQUKmwMxE5FBtowx/2w0igXv2/WnCXCxZIJc8fLznxbJ2kt1yDoWRiuoRhgLlrAyMSYCuSz4fABk7gda4IxuwXSgBRkgRV9//Zvcve9l88vPv9/OPPrmP7JFu7NU9Z3VeBcDmTp4LDgAtMAJqwVoXv0IxEeff/y9YvrR1yubdz7/BRKsdpPgavaSWgE0yBdHEO3HacF/iDNOA4nrTIwMukApfaBBzEDR+08+/s6Rq7+8DaQ+y0aUdUqILCgiPUjyAXoczAiTk4szE84HJt8coEbWX3/+NbEXn28AyXX4SvOXOYufBTKVSLLg/fe/LcKVF1EieX+umoGDCu96oLT877//64CWgPPL2RJNJ0MZzj2kxsF7IL4BdO2edRc/zIhcdP8ZSHBlgqJsmKHQMSBT6u6bny4qzVf2g8T/TTDaBjTUk+g4QAvTL0AfpQN9tBwkfqpYw9ZElusAkHk9f91jvcmHXv87lKfmbqvMu4PUVPQAiG8BsT0Qs776/DtUvObSOpDE3wlGK5gYGcOvPv/uo9NxbWuKpQjz7Aj5l0ApYWJ9cKFn30ursk1Pf5wr1XQwlOHaBxR+03/glXLxhiefd2Sq2Lup84GCZyGw3AFlPIb/E41B8eNPVCT//c/QxVp4rgImB9T8ASjM9/zT71Tpustz06xEWICp6wPQoCdAg0ClLsPLFr0WUR6WKnwWTAJakAvlXllw8o1l4rKHX27VaHuqinJsg4rPB2pMglp6EUipAvlcIP7lCq1cHUnOSVB1O4HiHigWXCrXStSV4pyHFFGvgMx7QKYpkM0CLU1fA6kLUC1mQD4/kL8HZB+QLQNka4IkgMm4E5iMK1EsKHYU5+wJkLkCVKSIJWeSUlx/WnHuvW7UovuPUSwAgc2pymo+OgLrgUwtBvLAs+svvkdotV87DHcEuopEc2HmYH1BZ3FeFpKqzI8//j7cfePTzs69L78jS9C/0qc2AACJzAU3iRId6QAAAABJRU5ErkJggg=='
		}}),
		localStorage: new BB.LocalStorage('favicons-backbone', 'id', 'indexed')
	});

	return Favicons;

});
