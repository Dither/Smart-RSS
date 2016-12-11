/**
 * @module BgProcess
 * @submodule modules/ContentExtractor
 */
define(['readability'], function (Readability) {

var attr_whitelist = [
	/*'class', 'id', 'style',*/ 'src', 'href', 'alt', 'title', 'data', 'height', 'width',
	'name', 'value', 'type', 'border', 'frameborder', 'colspan', 'rowspan', 'span', 'cite'
];

var min_length = 140,
	to_remove = 'script, style, noscript, link, meta, param, [href*="javascript:"]',
	to_replace = 'object, applet',
	ft_pos_default = 'body>*:not(footer):not(nav):not(header):not(form):not(aside):not(menu)';

var re_binary = /\.(?:zip|rar|7z|jpe?g|svg|png|gifv?|swf|jar|web[mp]|mp\d|aac|flac|avi|fl[av]]|pdf|epub|djvu|odf|xml|docx?|xlsx?|pptx?|msi|msp|exe|com|cmd|bat|vbs?|ps\d)(?:$|\?)/i,
	re_body = /<body/i,
	re_spaces = /\s{2,}/g;

/**
 * HTML Main Content Extractor
 * @class ContentExtractor
 * @constructor
 * @extends Object
 */
function ContentExtractor(html, sourceID, url, siteinfos) {
	return new Promise(function(resolve, reject) {
		if (!sourceID) return reject('no source feed specified');
		if (!html) return reject('no HTML provided');

		var source = sources.findWhere({ id: sourceID });

		// If there is no body assume it's a binary file
		if (!re_body.test(html)) return resolve(getBinaryLink(url));

		html = createHTML(html);
		if (!source) return reject('no source feed with matching ID');
		if (!html) return reject('failed to create DOM for current HTML');

		var ft_pos_mode = source.get('fulltextEnable') || 0,
			ft_pos = source.get('fulltextPosition') || ft_pos_default,
			html_result = '',
			nodes = [];

		removeNodes(html);

		mode:
		switch (ft_pos_mode) {
			case 1:
				nodes = getNodes(html, ft_pos);
				if (!nodes.length)
					return reject('no nodes match the pattern');
				html_result = nodesToText(nodes, true);
				break;
			case 2:
				for (var i = 0, len = siteinfos.length; i < len; i++) {
					nodes = getNodes(html, siteinfos[i].pageElement);
					html_result = nodesToText(nodes, true);
					if (html_result.length > min_length / 10) break mode;
				}

				nodes = [];
				html_result = '';

				var readable = new Readability({ pageURL: url, resolvePaths: true });
				for (var i = 0, l = readable.getMaxSkipLevel(); i <= l; i++) {
					readable.setSkipLevel(i);
					readable.parseDOM(html.childNodes[html.childNodes.length-1]);
					html_result = readable.getHTML().trim();
					if (readable.getLength() > min_length) break mode;
					//console.log('[ContentExtractor] Retry URL:'+url+';attempt='+i+';length='+readable.getLength())
				}

				if (readable.getLength() < min_length)
					html_result = nodesToText(getNodes(html, ft_pos_default), true);
				break;
			default:
				// this shouldn't happen
				return reject('trying to get fulltext in no-fulltext mode');
		}

		 // just to be sure clean it up again after processing
		html = createHTML(html_result);
		if (!html) return reject('failed to clean resulting HTML');
		removeNodes(html);

		resolve(html.body.innerHTML);
	});
}

/**
 * Gives raw HTML for a file download.
 * @param {String} url URL of a binary resource.
 * @return {String} HTML text.
 * */
function getBinaryLink(url) {
	return '<a href="' + url + '" download>[' + _T('DOWNLOAD') + ']</a>';
}

/**
 * Recognizes some common binary file extensions.
 * @param {String} url URL of a binary resource.
 * @return {Boolean} True if the link is a binary file.
 * */
function isBinary(url) {
	return re_binary.test(url);
}

/**
 * Gives raw HTML for a file download or null.
 * @param {String} url URL of a resource.
 * @return {String} HTML text or null.
 * */
function binaryLink(url) {
	if (isBinary(url)) return getBinaryLink(url);
	return null;
}

/**
 * Converts nodes to raw HTML.
 * @param {Array} nodes Array of matching nodes.
 * @param {Boolean} filter Option to filter out attributes.
 * @return {String} HTML text.
 * */
function nodesToText(nodes, filter) {
	if (!nodes.length) return '';

	var inner_nodes, attr, i, l = nodes.length;

	if (filter) {
		for (i = 0; i < l; i++) {
			inner_nodes = Array.prototype.slice.call(nodes[i].querySelectorAll('*')) || [];
			inner_nodes.push(nodes[i]);
			for (var attributes, k, j = 0, inl = inner_nodes.length; j < inl; j++) {
				attributes = inner_nodes[j].attributes,
				k = attributes.length;
				while (k--) {
					attr = attributes[k];
					if (attr_whitelist.indexOf(attr.name) === -1)
						inner_nodes[j].removeAttribute(attr.name);
				}
			}
		}
	}

	var text = '';
	for (i = 0; i < l; i++)
		text += nodes[i].outerHTML.trim().replace(re_spaces, ' ');

	return text;
}

/**
 * Creates HTML document object from a string.
 * @param {String} source String with HTML-formatted text.
 * @return {HTMLDocument} DOM-document.
 * */
function createHTML(source) {
	var doc = document.implementation.createHTMLDocument('HTMLParser');
	doc.documentElement.innerHTML = source;
	return doc;
}

/**
 * Returns nodes selected by CSS selector or XPath rule.
 * @param {Node} doc Base DOM element to search in.
 * @param {String} rule String with rule.
 * @return {Array} Array of matching nodes.
 * */
function getNodes(doc, rule){
	var tmp = [];
	if (!rule) return tmp;
	try {
		tmp = Array.prototype.slice.call(doc.querySelectorAll(rule), 0);
	} catch (e) {
		tmp = [];
		try {
			var evnodes = doc.evaluate(rule, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
			while (node = evnodes.iterateNext()) tmp.push(node);
		} catch (e) {
			tmp = [];
		}
	}
	return tmp;
}

/**
 * Filters undesired elements from a DOM tree using either XPath or CSS selectors.
 * @param {Element} doc Base DOM element to remove nodes from.
 * @return {Element} Filtered DOM.
 * */
function removeNodes(doc) {
	if (!doc) return;

	var  i,r,l;
	for (i = 0, r = doc.querySelectorAll(to_remove), l = r.length; i < l; i++) {
		if (r[i].parentNode) {
			r[i].parentNode.removeChild(r[i]);
		}
	}

	for (i = 0, r = doc.querySelectorAll(to_replace), l = r.length; i < l; i++) {
		if (r[i].src) r[i].outerHTML = '<a href="'+r[i].src+'">' + _T('EMBEDDED_MEDIA') + '</a>';
		else if (r[i].parentNode) {
			r[i].parentNode.removeChild(r[i]);
		}
	}
}

return {
		parse: function() { return ContentExtractor.apply(null, arguments); },
		binary:  function() { return binaryLink.apply(null, arguments); }
	};
});
