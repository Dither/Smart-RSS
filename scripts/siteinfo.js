(function(global){

if (typeof global.browser === 'undefined' && typeof global.chrome !== 'undefined') global.browser = global.chrome;

var siteinfo = [];

try {
	var url = global.browser.extension.getURL('json/siteinfo.json'),
		xhr = new XMLHttpRequest();

	xhr.open('GET', url);
	xhr.responseType = 'json';
	xhr.onload = function () {
		siteinfo = this.response;
	};
	xhr.send();
} catch (e) {}

/*
	Used SITEINFO-format JSON elements (nextLink can be used for multipage articles):
	{
		'url': '^https?://example\\.com/',
		'pageElement': '//*[contains(concat(" ",@class," "), " autopagerize_page_element ")]',
		'nextLink': '//a[@rel="next"] | //link[@rel="next"]'
	}
*/
function getSiteinfo(url) {
	if (!siteinfo) return [];
	var nodes = [];
	for (var nodes = [], i = 0, len = siteinfo.length; i < len; i++) {
		try {
			if((new RegExp(siteinfo[i].url)).test(url)) nodes.push(siteinfo[i]);
		} catch (e) {}
	}
	return nodes;
}

if (typeof module !== 'undefined' && 'exports' in module) module.exports = getSiteinfo;
else {
	if (typeof define === 'function' && define.amd) define('siteinfo', function(){ return getSiteinfo; });
	global.siteinfo = getSiteinfo;
}

})(typeof window === 'object' ? window : this);
