if (typeof browser === 'undefined' && typeof chrome !== 'undefined') browser = chrome;

var _T = function () {
	//console.log(arguments);
	return browser.i18n.getMessage.apply(null, arguments) || arguments[0] || '';
}

require.config({
	baseUrl: 'scripts/bgprocess',
	waitSeconds: 2000,

	paths: {
		jquery: '../libs/jquery.min',
		underscore: '../libs/underscore.min',
		backbone: '../libs/backbone.min',
		backboneDB: '../libs/backbone.indexDB',
		md5: '../libs/md5',
		readability: '../libs/readability',
		text: '../text',
		domReady: '../domReady'
	},

	shim: {
		jquery: { exports: '$' },
		backbone: { deps: ['underscore', 'jquery'], exports: 'Backbone' },
		backboneDB: { deps: ['backbone'] },
		underscore: { exports: '_' },
		md5: { exports: 'CryptoJS' },
		readability: { exports: 'Readability' }
	}
});

/**
 * Events handlers that has to be set right on start
 */


browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
 	if (message.action == 'get-tab-id') {
 		sendResponse({
 			action: 'response-tab-id',
 			value: sender.tab.id
 		});
 	}
});

browser.runtime.onConnect.addListener(function(port) {
 	port.onDisconnect.addListener(function(port) {
 		if (port) sources.trigger('clear-events', port.sender.tab.id);
 	});
});

requirejs(['bg'], function(bg) {
	// bg started
});
