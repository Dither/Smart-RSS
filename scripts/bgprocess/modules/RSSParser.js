/**
 * @module BgProcess
 * @submodule modules/RSSParser
 */
define(['md5'], function (CryptoJS) {

	/**
	 * RSS Parser
	 * @class RSSParser
	 * @constructor
	 * @extends Object
	 */
	function parseRSS(xml, sourceID) {
		var items = [];

		if (!xml || !(xml instanceof XMLDocument)) return items;

		var nodes = xml.querySelectorAll('item');
		if (!nodes.length) nodes = xml.querySelectorAll('entry');
		if (!nodes.length) return items;

		var title = getFeedTitle(xml);
		var source = sources.findWhere({ id: sourceID });
		if (title && (source.get('title') === source.get('url') || !source.get('title'))) {
			source.save('title', title);
		}

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
			items.push({
				id: rssGetGuid(node),
				title: rssGetTitle(node),
				url: rssGetLink(node),
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
			if (!last.id) {
				last.id = CryptoJS.MD5(last.sourceID + last.title + last.date).toString();
			} else {
				last.id = CryptoJS.MD5(last.sourceID + last.id).toString();
			}
			
			if (last.date == 0) last.date = Date.now();
		});

		return items;
	}


	function rssGetGuid(node) {
		if (!node) return false;
		var guid = node.querySelector('guid');
		return guid ? guid.textContent : '';
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
		if (!title || !(title.textContent).trim()) {
			title = xml.querySelector('channel > description, feed > description, rss > description');
		}

		if (!title || !(title.textContent).trim()) {
			title = xml.querySelector('channel > description, feed > description, rss > description');
		}

		if (!title || !(title.textContent).trim()) {
			title = xml.querySelector('channel > link, feed > link, rss > link');
		}

		return title && title.textContent ? title.textContent.trim() || 'rss' : 'rss';
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
		var pubDate = node.querySelector('pubDate, published');
		if (pubDate) {
			return (new Date( replaceUTCAbbr(pubDate.textContent) )).getTime() || 0;
		}

		pubDate = node.querySelector('date');
		if (pubDate) {
			return (new Date( replaceUTCAbbr(pubDate.textContent) )).getTime() || 0;
		}

		pubDate = node.querySelector('lastBuildDate, updated, update');

		if (pubDate) {
			return (new Date( replaceUTCAbbr(pubDate.textContent) )).getTime() || 0;
		}
		return 0;
	}

	function rssGetAuthor(node, title) {
		var creator = node.querySelector('creator, author > name');
		if (creator) {
			creator = creator.textContent.trim();
		}

		if (!creator) {
			creator = node.querySelector('author');
			if (creator) {
				creator = creator.textContent.trim();
			}
		}

		if (!creator && title && title.length > 0) {
			creator = title;
		}

		if (creator) {
			if (/^\S+@\S+\.\S+\s+\(.+\)$/.test(creator)) {
				creator = creator.replace(/^\S+@\S+\.\S+\s+\((.+)\)$/, '$1');
			}
			creator = creator.replace(/\s*\(\)\s*$/, '');
			return creator;
		}

		return 'no author';
	}

	function rssGetTitle(node) {
		return node.querySelector('title') ? node.querySelector('title').textContent : '&lt;'+'no title'+'&gt;';
	}

    function nodesToText(doc, filter) {
        var whitelist = ['src', 'alt', 'href', 'height', 'width', 'name', 'value', 'type', 'data', 'frameborder', 'colspan'],
        	nodes = doc.querySelectorAll('*');

        if (filter) for (var i = 0, l = nodes.length; i < l; i++) {
            var attributes = nodes[i].attributes,
                j = attributes.length;
            while (j--) {
                var attr = attributes[j];
                if (whitelist.indexOf(attr.name) === -1)
                    nodes[i].removeAttributeNode(attr);
            }
            
        };
        return doc.innerHTML.replace(/\s{2,}/g,'').replace(/(<\/?)xhtml:/g,'$1').trim();
    }

    /**
     * Filters undesired elements from a DOM tree using either XPath or CSS selectors.
     * @param {documentElement} doc Base DOM element to remove nodes from.
     * @param {String} names Selectors of nodes to remove.
     * */
    function removeNodes(doc, names, replaces) {
        if (typeof doc === 'undefined') return;

        var r = doc.querySelectorAll(names),
        	l = r.length;
        for (var i = 0; i < l; i++) {
            if (r[i].parentNode) {
                r[i].parentNode.removeChild(r[i]);
            }
        }
        var r = doc.querySelectorAll(replaces),
        	l = r.length;
        for (var i = 0; i < l; i++) {
            r[i].outerHTML='<a href="'+(r[i].src || r[i].data)+'">' + '[embedded video]' + '</a>';
        }
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
     * Creates HTML document object from a string.
     * @param {String} source String with HTML-formatted text.
     * @param {String} url String with URL of original page.
     * @return {HTMLDocument} DOM-document.
     * */
    function createXML(source) {
        return (new window.DOMParser()).parseFromString(source, "application/xml");
    }

	function rssGetContent(node, filter) {
		var content = '', 
			desc = node.querySelector('encoded'),
			to_remove = 'script,style,noscript,link,param',
			to_replace = 'object';

		if (desc) content = desc.textContent;
		if (!content && (desc = node.querySelector('description'))) content = desc.textContent;
        if (!content && (desc = node.querySelector('content')) && ~desc.innerHTML.indexOf('<')) content = desc.innerHTML; 
		if (!content && (desc = node.querySelector('content'))) content = desc.textContent; // prefer content over summary
		if (!content && (desc = node.querySelector('summary'))) content = desc.textContent;

		if (!filter && content) return content;
		else if (content) {
			// filter unused nodes
			var xmldoc = createXML(content);
			if (xmldoc.querySelector('parsererror')) {
				xmldoc = createHTML(content);
			}
			
			var rnode = xmldoc.querySelector('body');
            if (!rnode) rnode = xmldoc.childNodes[0];
			if (rnode) removeNodes(rnode, to_remove, to_replace);
	        if (rnode && (content = nodesToText(rnode, filter).trim())) return content;
	        else return '&nbsp;';
	    }
		return '&nbsp;';
	}



	return {
		parse: function() {
			return parseRSS.apply(null, arguments);
		}
	};
});