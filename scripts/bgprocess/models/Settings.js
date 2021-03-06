/**
 * @module BgProcess
 * @submodule models/Settings
 */
define(['backbone', 'backboneDB'], function (BB) {

	/**
	 * Test navigator.language and if it matches some avalable language
	 */
	function getLangFromNavigator() {
		var ln = String(navigator.language).split('-')[0],
			available = ['en', 'cs', 'sk', 'de', 'tr', 'pl', 'ru', 'hu', 'nl', 'fr', 'pt', 'hr'],
			index = available.indexOf(ln);
		return index >= 0 ? available[index] : 'en';
	}

	/**
	 * User settings
	 * @class Settings
	 * @constructor
	 * @extends Backbone.Model
	 */
	var Settings = BB.Model.extend({
		defaults: {
			id: 'settings-id',
			lang: getLangFromNavigator(),
			articleFontSize: 100,
			askOnOpening: true,
			askRmPinned: 'trashed',
			badgeMode: 'disabled',
			circularNavigation: true,
			dateType: 'normal', // normal = DD.MM.YYYY, ISO = YYYY-MM-DD, US = MM/DD/YYYY
			defaultSound: '',
			disableDateGroups: false,
			enablePanelToggle: false,
			fullDate: false,
			hoursFormat: '24h',
			icon: 'orange',
			layout: 'horizontal', // or vertical
			lines: 'auto', // one-line, two-lines
			markReadS: 0, // -1..30
			moveByScrolled: 800,
			panelToggled: true,
			posA: 250,
			posB: 270,
			posC: 250,
			showSpinner: true,
			sortBy: 'unread',
			sortBy2: 'date',
			sortOrder: 'desc',
			sortOrder2: 'asc',
			soundNotifications: false,
			soundVolume: 1, // 0..1.0
			thickFrameBorders: false,
			titleIsLink: true,
			uiFontSize: 100,
			useSound: ':user'
		},

		/**
		 * @property storage
		 * @type Backbone.CustomStorage
		 * @default *settings-backbone*
		 */
		storage: new BB.CustomStorage('settings-backbone', 'id', 'local')
	});

	return Settings;
});
