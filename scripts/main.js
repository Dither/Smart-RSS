if (typeof browser === 'undefined' && typeof chrome !== 'undefined') browser = chrome;

var _T = function () {
	//console.log(arguments);
	try {
		return browser.i18n.getMessage.apply(null, arguments) || arguments[0] || '';
	} catch (e) {
		return arguments[0] || '';
	}
}

require.config({
	baseUrl: 'scripts/app',
	waitSeconds: 0,
	paths: {
		jquery: '../libs/jquery.min',
		underscore: '../libs/underscore.min',
		punycode: '../libs/punycode',
		backbone: '../libs/backbone.min',
		text: '../text',
		domReady: '../domReady'/*,
		mocha: 'https://cdnjs.cloudflare.com/ajax/libs/mocha/1.12.1/mocha.min',
		mochacss: 'https://cdnjs.cloudflare.com/ajax/libs/mocha/1.12.1/mocha.min.css?nojs',
		chai: 'https://raw.github.com/chaijs/chai/master/chai'*/
	},
	shim: {
		jquery: { exports: '$' },
		backbone: { deps: ['underscore', 'jquery'], exports: 'Backbone' },
		underscore: { exports: '_' }/*,
		mocha: { exports: 'mocha' }*/
	}
});

var tabID = -1;

function init(message) {
	if (message.started) {
		browser.runtime.onMessage.removeListener(init);
		requirejs(['app'], function(app) { app.start(); });
	}
}

browser.runtime.onMessage.addListener(init);
browser.runtime.getBackgroundPage(function(bg) {
	/**
	 * Setup work, that has to be done before any dependencies get executed
	 */
	window.bg = bg;
	browser.runtime.sendMessage({ action: 'get-tab-id'}, function(response) {
		if (response.action === 'response-tab-id') tabID = response.value;
	});
	browser.runtime.connect();
	if (bg.appStarted) init({started: true});
});
