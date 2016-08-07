/**
 * @module BgProcess
 * @submodule modules/RSSParser
 */
define(['md5', 'locale'], function (CryptoJS, Locale) {

	var _T = function(text) { return Locale.translate(text); }

	/**
	 * RSS Parser
	 * @class RSSParser
	 * @constructor
	 * @extends Object
	 */
	function parseRSS(xml, sourceID, callback) {
		var items = [];

		if (!xml || !callback || !(xml instanceof XMLDocument)) return;

		var nodes = xml.querySelectorAll('item');
		if (!nodes.length) nodes = xml.querySelectorAll('entry');
		if (!nodes.length) callback(items);

		var title = getFeedTitle(xml);
		var source = sources.findWhere({ id: sourceID });
		if (title && (source.get('title') === source.get('url') || !source.get('title')))
			source.save('title', title);

		/**
		 * TTL check
		 */
		var ttl = xml.querySelector('channel > ttl, feed > ttl, rss > ttl');
		if (ttl && source.get('lastUpdate') == 0) {
			ttl = parseInt(ttl.textContent, 10);
			var vals = [300, 600, 1440, 10080];
			if (ttl > 10080) {
				source.save({ updateEvery: 10080 });
			} else if (ttl > 180) {
				for (var i=0; i<vals.length; i++) {
					if (ttl <= vals[i]) {
						ttl = vals[i];
						break;
					}
				}
				source.save({ updateEvery: ttl });
			}
		}
		/* END: ttl check */

		var mainEl = xml.querySelector('rss, rdf, feed');
		if (mainEl) {
			var baseStr = mainEl.getAttribute('xml:base') || mainEl.getAttribute('xmlns:base') || mainEl.getAttribute('base');
			if (baseStr) source.save({ base: baseStr });
		}


		[].forEach.call(nodes, function(node) {
			var link = rssGetLink(node);
			items.push({
				id: rssGetGuid(node) || link,
				title: rssGetTitle(node),
				url: link,
				date: rssGetDate(node),
				author: rssGetAuthor(node, title),
				content: rssGetContent(node, true),
				sourceID: sourceID,
				unread: true,
				deleted: false,
				trashed: false,
				visited: false,
				pinned: false,
				dateCreated: Date.now()
			});

			var last = items[items.length - 1];
			last.oldId = last.id;
			last.id = CryptoJS.MD5(last.sourceID + (last.id ? last.id : (last.title + last.date))).toString();

			if (last.date == 0) last.date = Date.now();
		});

		callback(items);
	}


	function rssGetGuid(node) {
		if (!node) return false;
		var guid = node.querySelector('guid');
		return guid ? guid.textContent : null;
	}

	function rssGetLink(node) {
		if (!node) return false;

		var link = node.querySelector('link[rel="alternate"]');

		if (!link) {
			if (!link) link = node.querySelector('link[type="text/html"]');
			if (!link || link.prefix == 'atom') link = node.querySelector('link'); // prefer non atom links over atom links
			if (!link) link = node.querySelector('link[type="text/html"]');
			if (!link) link = node.querySelector('link');
		}

		if (!link) {
			var tmp, guid = node.querySelector('guid');
			if (guid && (tmp = guid.textContent.match(/:\/\//)) && tmp.length) link = guid;
		}

		if (link) return link.textContent || link.getAttribute('href');
		return null;
	}

	function getFeedTitle(xml) {
		var title = xml.querySelector('channel > title, feed > title, rss > title');
		if (!title || !(title.textContent).trim())
			title = xml.querySelector('channel > description, feed > description, rss > description');
		if (!title || !(title.textContent).trim())
			title = xml.querySelector('channel > description, feed > description, rss > description');
		if (!title || !(title.textContent).trim())
			title = xml.querySelector('channel > link, feed > link, rss > link');

		return title && title.textContent ? title.textContent.trim() || _T('rss feed') : _T('rss feed');
	}

	function replaceUTCAbbr(str) {
		str = String(str);
		var rep = {
			'CET': '+0100', 'CEST': '+0200', 'EST': '', 'WET': '+0000', 'WEZ': '+0000', 'WEST': '+0100',
			'EEST': '+0300', 'BST': '+0100', 'EET': '+0200', 'IST': '+0100', 'KUYT': '+0400', 'MSD': '+0400',
			'MSK': '+0400', 'SAMT': '+0400'
		};
		var reg = new RegExp('(' + Object.keys(rep).join('|') + ')', 'gi');
		return str.replace(reg, function(all, abbr) {
			return rep[abbr];
		});
	}

	function rssGetDate(node) {
		var pubDate;
		if (pubDate = node.querySelector('pubDate, published'))
			return (new Date( replaceUTCAbbr(pubDate.textContent) )).getTime() || 0;
		if (pubDate = node.querySelector('date'))
			return (new Date( replaceUTCAbbr(pubDate.textContent) )).getTime() || 0;
		if (pubDate = node.querySelector('lastBuildDate, updated, update'))
			return (new Date( replaceUTCAbbr(pubDate.textContent) )).getTime() || 0;
		return 0;
	}

	function rssGetAuthor(node, title) {
		var creator;
		if (creator = node.querySelector('creator, author > name'))
			creator = creator.textContent.trim();

		if (!creator) {
			creator = node.querySelector('author');
			if (creator) creator = creator.textContent.trim();
		}

		if (!creator && title && title.length > 0) creator = title;

		if (creator) {
			if (/^\S+@\S+\.\S+\s+\(.+\)$/.test(creator))
				creator = creator.replace(/^\S+@\S+\.\S+\s+\((.+)\)$/, '$1');
			creator = creator.replace(/\s*\(\)\s*$/, '');
			return creator;
		}

		return _T('no author');
	}

	function rssGetTitle(node) {
		return node.querySelector('title') ? node.querySelector('title').textContent : '&lt;'+'no title'+'&gt;';
	}

	function nodesToText(doc, filter) {
		var whitelist = [
				/*'class', 'id',*/ 'src', 'href', 'type', 'alt', 'cite', 'title', 'data', 'height', 'width',
				'name', 'value', 'type', 'border', 'frameborder', 'colspan', 'rowspan', 'span'
			],
			nodes = doc.querySelectorAll('*');

		if (filter) for (var attributes, attr, i = 0, l = nodes.length; i < l; i++) {
			attributes = nodes[i].attributes,
				j = attributes.length;
			while (j--) {
				attr = attributes[j];
				if (whitelist.indexOf(attr.name) === -1)
					nodes[i].removeAttributeNode(attr);
			}

		};
		return doc.innerHTML.replace(/(<\/?)xhtml:/g,'$1').trim().replace(/\s{2,}/g, ' ');
	}

	/**
	 * Filters undesired elements from a DOM tree using either XPath or CSS selectors.
	 * @param {documentElement} doc Base DOM element to remove nodes from.
	 * @param {String} names Selectors of nodes to remove.
	 * @param {String} replaces Selectors of nodes to replace with text links.
	 * */
	function removeNodes(doc, names, replaces) {
		for (var i = 0, r = doc.querySelectorAll(names), l = r.length; i < l; i++) {
			if (r[i].parentNode) {
				r[i].parentNode.removeChild(r[i]);
			}
		}

		for (var i = 0, r = doc.querySelectorAll(replaces), l = r.length; i < l; i++) {
			if (r[i].src) {
				r[i].outerHTML = '<a href="'+r[i].src+'">' + _T('[embedded media]') + '</a>';
			} else if (r[i].parentNode) {
				r[i].parentNode.removeChild(r[i]);
			}
		}
	}

	/**
	 * Creates HTML document object from a string.
	 * @param {String} source String with HTML-formatted text.
	 * @param {String} url String with URL of original page.
	 * @return {HTMLDocument} DOM-document.
	 * */
	function createHTML(source) {
		var doc = document.implementation.createHTMLDocument('HTMLParser');
		doc.documentElement.innerHTML = source;
		return doc;
	}

	/**
	 * Creates XML document object from a string.
	 * @param {String} source String with HTML-formatted text.
	 * @param {String} url String with URL of original page.
	 * @return {XMLDocument} XML-document.
	 * */
	function createXML(source) {
		return (new window.DOMParser()).parseFromString(source, "application/xml");
	}

	function rssGetContent(node, filter) {
		var content = '',
			desc = node.querySelector('encoded'),
			to_remove = 'script, style, noscript, link, param',
			to_replace = 'object, iframe';

		if (desc) content = desc.textContent;
		if (!content && (desc = node.querySelector('description'))) content = desc.textContent;
		if (!content && (desc = node.querySelector('content')) && ~desc.innerHTML.indexOf('<')) content = desc.innerHTML;
		if (!content && (desc = node.querySelector('content'))) content = desc.textContent; // prefer content over summary
		if (!content && (desc = node.querySelector('summary'))) content = desc.textContent;

		if (!filter && content) return content;
		else if (content) {
			// filter unused nodes
			content = content.replace(/<!\s*\[\s*CDATA\s*\[\s*(.+)\s*\]\s*\]\s*>/ig, '$1');

			var xmldoc = createXML(content);
			if (xmldoc.querySelector('parsererror')) xmldoc = createHTML(content);

			var rnode = xmldoc.querySelector('body') || xmldoc.childNodes[0];
			if (rnode) removeNodes(rnode, to_remove, to_replace);
			if (rnode && (content = nodesToText(rnode, filter))) return content;
			return '&nbsp;';
		}

		return '&nbsp;';
	}

	return {
		parse: function() {
			return parseRSS.apply(null, arguments);
		}
	};
});
