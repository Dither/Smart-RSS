/**
 * @module BgProcess
 * @submodule modules/ContentExtractor
 */
define(['readability', 'locale'], function (Readability, Locale) {
	/**
	 * HTML Main Content Extractor
	 * @class ContentExtractor
	 * @constructor
	 * @extends Object
	 */
	function ContentExtractor(html, sourceID, url, callback) {
		var nodes = [],
			to_remove = 'script,style,noscript,link,meta,param',
			to_replace = 'object,applet',
			r_default = '&nbsp';

		if (!html || !sourceID || !callback) return;

		var source = sources.findWhere({ id: sourceID });

		html = createHTML(html);

		if (!source || !html) return callback(r_default);

		var ft_pos_mode = source.get('fulltextEnable') || 0,
			ft_pos = source.get('fulltextPosition') || 'body>*:not(footer):not(nav):not(script):not(style):not(header):not(form)';

		if (ft_pos_mode === 0) return callback('&nbsp');

		removeNodes(html, to_remove, to_replace);

		if (ft_pos_mode === 2) {
			/*new Readability({debug:true}).init(url, html).parse(function(result) {
				callback(result.content || r_default); // It's already cleaned by Readability
			});*/
			var readable = new Readability({
				pageURL: url,
				resolvePaths: true
			});
			saxParser(html.childNodes[html.childNodes.length-1], readable);
			return callback(readable.getHTML() || r_default); // It's already cleaned by Readability
		} else {
			try {
				nodes = Array.prototype.slice.call(html.querySelectorAll(ft_pos), 0);
			} catch (e) {
				try {
					var evnodes = html.evaluate(ft_pos, html, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
					while (node = evnodes.iterateNext()) nodes.push(node);
				} catch (e) {
					return callback('&nbsp');
				}
			}
		}
		return callback(nodesToText(nodes, true) || r_default);
	}

	function saxParser(elem, callbacks){
		if(typeof callbacks !== 'object')
			throw 'please provide callbacks!';

		//todo: support further events, options for trim & space normalisation

		function parse(node){
			var name = node.tagName.toLowerCase(),
			    attributeNodes = node.attributes;

			callbacks.onopentagname(name);

			for(var i = 0, j = attributeNodes.length; i < j; i++){
				callbacks.onattribute(attributeNodes[i].name+'', attributeNodes[i].value);
			}

			var childs = node.childNodes,
			    num = childs.length, nodeType;

			for(var i = 0; i < num; i++){
				nodeType = childs[i].nodeType;
				if(nodeType === 3 /*text*/)
					callbacks.ontext(childs[i].textContent);
				else if(nodeType === 1 /*element*/) parse(childs[i]);
				/*else if(nodeType === 8) //comment
					if(callbacks.oncomment) callbacks.oncomment(childs[i].toString());
				[...]
				*/
			}
			callbacks.onclosetag(name);
		}

		parse(elem);
	}

	function nodesToText(nodes, filter) {
		if (!nodes.length) return '';

		if (filter) {
			var whitelist = [
				/*'class', 'id',*/ 'style', 'src', 'href', 'type', 'alt', 'title', 'data', 'height', 'width',
				'name', 'value', 'type', 'border', 'frameborder', 'colspan', 'rowspan', 'span', 'cite'
			];

			for (var inner_nodes, attr, i = 0, l = nodes.length; i < l; i++) {
				inner_nodes = Array.prototype.slice.call(nodes[i].querySelectorAll('*')) || [];
				inner_nodes.push(nodes[i]);
				for (var attributes, k, j = 0, inl = inner_nodes.length; j < inl; j++) {
					attributes = inner_nodes[j].attributes,
					k = attributes.length;
					while (k--) {
						attr = attributes[k];
						if (whitelist.indexOf(attr.name) === -1)
							inner_nodes[j].removeAttributeNode(attr);
					}
				}
			}
		}

		var text = '';
		for (var i = 0, l = nodes.length; i < l; i++) {
			text += nodes[i].outerHTML.trim().replace(/\s{2,}/g, ' ');
		}

		return text;
	}

	/**
	 * Creates HTML document object from a string.
	 * @param {String} source String with HTML-formatted text.
	 * @param {String} url String with URL of original page.
	 * @return {HTMLDocument} DOM-document.
	 * */
	function createHTML(source) {
		// Chrome 4, Opera 10, Firefox 4, Internet Explorer 9, Safari 4 have createHTMLDocument
		var doc = document.implementation.createHTMLDocument('HTMLParser');
		doc.documentElement.innerHTML = source;
		return doc;
	}

	/**
	 * Filters undesired elements from a DOM tree using either XPath or CSS selectors.
	 * @param {documentElement} doc Base DOM element to remove nodes from.
	 * @param {String} names Selectors of nodes to remove.
	 * */
	function removeNodes(doc, names, replaces) {
		if (typeof doc === 'undefined' || typeof names !== 'string' || names.length < 2 || typeof replaces !== 'string' || replaces.length < 2) return;

		for (var i = 0, r = doc.querySelectorAll(names), l = r.length; i < l; i++) {
			if (r[i].parentNode) {
				r[i].parentNode.removeChild(r[i]);
			}
		}

		for (var i = 0, r = doc.querySelectorAll(replaces), l = r.length; i < l; i++) {
			if (r[i].src) r[i].outerHTML = '<a href="'+r[i].src+'">' + _T('[embedded media]') + '</a>';
			else if (r[i].parentNode) {
				r[i].parentNode.removeChild(r[i]);
			}
		}
	}

	return {
		parse: function() {
			return ContentExtractor.apply(null, arguments);
		}
	};
});
