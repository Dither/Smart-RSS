/**
 * @module BgProcess
 * @submodule modules/ContentExtractor
 */
define(['readability', 'siteinfo'], function (Readability, siteinfo) {

/**
 * HTML Main Content Extractor
 * @class ContentExtractor
 * @constructor
 * @extends Object
 */
function ContentExtractor(html, sourceID, url) {
	var to_remove = 'script,style,noscript,link,meta,param',
		to_replace = 'object,applet';

	return new Promise(function(resolve, reject) {
		if (!sourceID) return reject('');
		if (!html) return reject(sourceID);

		var source = sources.findWhere({ id: sourceID });

		// If there is no body assume it's a binary file
		if (!/<body/i.test(html)) return resolve('<a href="' + url + '" download>[' + _T('DOWNLOAD') + ']</a>');

		html = createHTML(html);
		if (!source || !html) return reject(sourceID);

		var ft_pos_mode = source.get('fulltextEnable') || 0,
			ft_pos_default = 'body>*:not(footer):not(nav):not(header):not(form):not(aside):not(menu)',
			ft_pos = source.get('fulltextPosition') || ft_pos_default;

		if (ft_pos_mode === 0) return reject(sourceID);

		removeNodes(html, to_remove, to_replace);

		var nodes = [];
		if (ft_pos_mode === 2) {
			var html_result = '';

			for (var siteinfos = siteinfo(url), i = 0, len = siteinfos.length; i < len; i++) {
				nodes = getNodes(html, siteinfos[i].pageElement);
				html_result = nodesToText(nodes, true);
				if (html_result.length > 14) return resolve(html_result);
			}

			nodes = [];
			html_result = '';
			var readable = new Readability({
					pageURL: url,
					resolvePaths: true
				});

			for (var i = 0, l = readable.getMaxSkipLevel(); i <= l; i++) {
				readable.setSkipLevel(i);
				readable.parseDOM(html.childNodes[html.childNodes.length-1]);
				html_result = readable.getHTML().trim();
				if (readable.getLength() > 140) break;
				//console.log('[ContentExtractor] Retry URL:'+url+';attempt='+i+';length='+readable.getLength())
			}

			if (readable.getLength() < 140) html_result = nodesToText(getNodes(html, ft_pos_default), true);

			return resolve(html_result); // It's already cleaned by Readability
		} else {
			nodes = getNodes(html, ft_pos);
		}
		if (!nodes.length) return reject(sourceID);
		resolve(nodesToText(nodes, true));
	});
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
		var whitelist = [
			/*'class', 'id', 'style',*/ 'src', 'href', 'alt', 'title', 'data', 'height', 'width',
			'name', 'value', 'type', 'border', 'frameborder', 'colspan', 'rowspan', 'span', 'cite'
		];

		for (i = 0; i < l; i++) {
			inner_nodes = Array.prototype.slice.call(nodes[i].querySelectorAll('*')) || [];
			inner_nodes.push(nodes[i]);
			for (var attributes, k, j = 0, inl = inner_nodes.length; j < inl; j++) {
				attributes = inner_nodes[j].attributes,
				k = attributes.length;
				while (k--) {
					attr = attributes[k];
					if (whitelist.indexOf(attr.name) === -1)
						inner_nodes[j].removeAttribute(attr.name);
				}
			}
		}
	}

	var text = '';
	for (i = 0; i < l; i++)
		text += nodes[i].outerHTML.trim().replace(/\s{2,}/g, ' ');

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
 * @param {Node} doc Base DOM element to remove nodes from.
 * @param {String} names Selectors of nodes to remove.
 * */
function removeNodes(doc, names, replaces) {
	if (typeof doc === 'undefined' || typeof names !== 'string' || names.length < 2 || typeof replaces !== 'string' || replaces.length < 2) return;

	var  i,r,l;

	for (i = 0, r = doc.querySelectorAll(names), l = r.length; i < l; i++) {
		if (r[i].parentNode) {
			r[i].parentNode.removeChild(r[i]);
		}
	}

	for (i = 0, r = doc.querySelectorAll(replaces), l = r.length; i < l; i++) {
		if (r[i].src) r[i].outerHTML = '<a href="'+r[i].src+'">[' + _T('EMBEDS') + ']</a>';
		else if (r[i].parentNode) {
			r[i].parentNode.removeChild(r[i]);
		}
	}
}

return { parse: function() {
					return ContentExtractor.apply(null, arguments);
				}
		};
});
