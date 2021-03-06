if (typeof browser === 'undefined' && typeof chrome !== 'undefined') browser = chrome;

_T = function () {
	//console.log(arguments);
	try {
		return browser.i18n.getMessage.apply(null, arguments) || arguments[0] || '';
	} catch (e) {
		return arguments[0] || '';
	}
}

require.config({
	baseUrl: 'scripts/bgprocess',
	waitSeconds: 2000,
	paths: {
		jquery: '../libs/jquery.min',
		underscore: '../libs/underscore.min',
		backbone: '../libs/backbone.min',
		digest: '../libs/digest',
		guid: '../libs/guid',
		promIDB: '../libs/promIDB',
		backboneDB: '../libs/backbone.db',
		readability: '../libs/readability',
		text: '../text',
		domReady: '../domReady',
		siteinfo: '../siteinfo'
	},
	shim: {
		jquery: { exports: '$' },
		underscore: { exports: '_' },
		backbone: { deps: ['underscore', 'jquery'], exports: 'Backbone' },
		backboneDB: { deps: ['guid', 'backbone', 'promIDB'] },
		readability: { exports: 'Readability' }
	}
});

/**
 * Events handlers that has to be set right on start
 */

browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.action === 'get-tab-id')
		sendResponse({ action: 'response-tab-id', value: sender.tab.id });
});

browser.runtime.onConnect.addListener(function(port) {
	port.onDisconnect.addListener(function(_port) {
		if (sources && _port)
			sources.trigger('clear-events', _port.sender.tab.id);
	});
});

function dumpStore(type) {
	chrome.storage[type || 'local'].get(function(data) {
		console.log(data, 'Length:', JSON.stringify(data).length);
	});
}

function closeRSS(callback) {
	var url = browser.runtime.getURL('reader.html');
	browser.tabs.query({ /*url: url*/ }, function(tabs) {
		for (var i = tabs.length; i-- ;) {
			if (tabs[i].url === url) {
				browser.tabs.remove(tabs[i].id);
			}
		}
		callback();
	});
}

requirejs(['bg'], function(bg) {
	// bg started
});
