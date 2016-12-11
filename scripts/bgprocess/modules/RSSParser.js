/**
 * @module BgProcess
 * @submodule modules/RSSParser
 */
define(['digest'], function (hash) {

var date_diff = {
	'CET': '+0100', 'CEST': '+0200', 'EST': '', 'WET': '+0000', 'WEZ': '+0000', 'WEST': '+0100',
	'EEST': '+0300', 'BST': '+0100', 'EET': '+0200', 'IST': '+0100', 'KUYT': '+0400', 'MSD': '+0400',
	'MSK': '+0400', 'SAMT': '+0400'
};

var attr_whitelist = [
		/*'class', 'id',*/ 'src', 'href', 'alt', 'cite', 'title', 'data', 'height', 'width',
		'name', 'value', 'type', 'border', 'frameborder', 'colspan', 'rowspan', 'span'
];

var to_remove = 'script, style, noscript, link, param, meta, [href*="javascript:"]',
	to_replace = 'object, iframe',
	r_default = '&nbsp;';

var re_nonurl = /["'<>`]/g,
	re_nocomments = /<!--[\s\S]*?-->/gi,
	re_notags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
	re_protostart = /^https?:\/\//,
	re_author1 = /^\S+@\S+\.\S+\s+\((.+)\)$/,
	re_author2 = /\s*\(\)\s*$/,
	re_date_diff = new RegExp('(' + Object.keys(date_diff).join('|') + ')', 'gi'),
	re_cdata = /<!\s*\[\s*CDATA\s*\[\s*(.+)\s*\]\s*\]\s*>/ig,
	re_xhtmlspace = /(<\/?)xhtml:/g,
	re_spaces = /\s{2,}/g,
	re_media = /\.(?:ogg|mp4|webm|wav|aac|opus|mp3|flac|wav|ogm|fla)/i,
	re_media_type = /video|audio/i,
	re_video = /video/i;

/**
 * RSS Parser
 * @class RSSParser
 * @constructor
 * @extends Object
 */
function parseRSS(xml, sourceID) {
	return new Promise(function(resolve, reject) {
		if (!xml || !(xml instanceof XMLDocument)) return reject('not an XMLDocument');

		var nodes = xml.querySelectorAll('item');
		if (!nodes.length) nodes = xml.querySelectorAll('entry');
		if (!nodes.length) reject('no entries found');

		var title = getFeedTitle(xml);
		var source = sources.findWhere({ id: sourceID });
		if (title && (source.get('title') === source.get('url') || !source.get('title')))
			source.save('title', title);

		/**
		 * TTL check
		 */
		if (source.get('lastUpdate') === 0)
			source.save({ updateEvery: rssGetTtl(xml) });

		var mainEl = xml.querySelector('rss, rdf, feed');
		if (mainEl) {
			var baseStr = mainEl.getAttribute('xml:base') || mainEl.getAttribute('xmlns:base') || mainEl.getAttribute('base');
			if (baseStr) source.save({ base: baseStr });
		}

		var entries = [];
		Promise.all(Array.prototype.slice.call(nodes).map(function(node) {
			var link = stripTags(rssGetLink(node)).trim().replace(re_nonurl, ''),
				entry = {
					id: rssGetGuid(node) || link,
					title: stripTags(rssGetTitle(node)).trim(),
					url: link,
					date: rssGetDate(node),
					author: stripTags(rssGetAuthor(node, title)).trim(),
					content: rssGetContent(node, true),
					sourceID: sourceID,
					unread: true,
					deleted: false,
					trashed: false,
					visited: false,
					pinned: false,
					dateCreated: Date.now()
				};
			return hash(entry.sourceID + (entry.id ? entry.id : (entry.title + entry.date))).then(function(shash) {
					entry.id = shash;
					if (!entry.date) entry.date = Date.now();
					entries.push(entry);
				});
		})).then(function(){
			resolve(entries, sourceID);
		}).catch(reject);
	});
}

function stripTags(str) {
	if (!str) return '';
	return str.replace(re_nocomments, '').replace(re_notags, '');
	/*var cleaned = createHTML(str).documentElement;
	return cleaned.textContent || '';*/
}

function rssGetTtl(xml) {
	var ttl = xml.querySelector('channel > ttl, feed > ttl, rss > ttl');
	if (ttl) ttl = parseInt(ttl.textContent, 10);
	if (!ttl || isNaN(ttl)) {
		// as per specification: http://purl.org/rss/1.0/modules/syndication/
		ttl = xml.querySelector('*|updatePeriod');
		if (ttl) {
			var freq = xml.querySelector('*|updateFrequency');
			freq = freq ? (parseInt(freq.textContent, 10) || 1) : 1;
			switch (ttl.textContent) {
				case 'hourly':
					ttl = 60;
					break;
				case 'monthly':
					ttl = 43800;
					break;
				case 'yearly':
					ttl = 525600;
					break;
				case 'weekly':
					ttl = 10080;
					break;
				case 'daily':
				default:
					ttl = 1440;
			}
			ttl = ttl / freq;
		}
	}
	ttl =  ttl || 180;
	var vals = [5, 15, 30, 60, 120, 180, 360, 720, 1440, 10080];
	if (ttl > 0) {
		for (var i = vals.length; i--;) {
			if (ttl >= vals[i]) {
				ttl = vals[i];
				break;
			}
		}
	} else {
		ttl = 180;
	}

	return ttl;
}

function rssGetGuid(node) {
	var _guid = node.querySelector('guid');
	return _guid ? _guid.textContent.trim() : null;
}

function rssGetLink(node) {
	var link = node.querySelector('link[rel="alternate"]');

	if (!link) {
		if (!link) link = node.querySelector('link[type="text/html"]');
		if (!link || link.prefix == 'atom') link = node.querySelector('link'); // prefer non-atom over atom links
		if (!link) link = node.querySelector('link[type="text/html"]');
		if (!link) link = node.querySelector('link');
	}

	if (!link) {
		var tmp, _guid = node.querySelector('guid');
		if (_guid && (tmp = _guid.textContent.match(re_protostart)) && tmp.length) link = _guid;
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

	return title && title.textContent ? (title.textContent.trim() || _T('RSS_FEED')) : _T('RSS_FEED');
}

function replaceUTCAbbr(str) {
	str = String(str);
	return str.replace(re_date_diff, function(all, abbr) {
		return date_diff[abbr];
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
		if (re_author1.test(creator))
			creator = creator.replace(re_author1, '$1');
		creator = creator.replace(re_author2, '');
		return creator;
	}

	return _T('NO_AUTHOR');
}

function rssGetTitle(node) {
	var title = node.querySelector('title');
	return title ? title.textContent : ('&lt;' + _T('NO_TITLE') + '&gt;');
}

function rssGetMedia(node) {
	var type = null, thumb = null, media = null;
	media = node.querySelector('enclosure, [rel="enclosure"], [rel="video_src"]'); /*, *|video, *|audio, *|content // media:content
	type = node.querySelector('*|type, [rel="media:type"], [name="video_type"]');
	if (type) media.setAttribute('type', type.getAttribute('url') || type.getAttribute('href') || type.getAttribute('content'));
	thumb = node.querySelector('*|thumbnail, [rel="media:thumbnail"], [rel="image_src"]');
	if (thumb) media.setAttribute('thumbnail', thumb.getAttribute('url') || thumb.getAttribute('href'));*/
	return media;
}

function nodesToText(doc, filter) {
	var nodes = doc.querySelectorAll('*');

	if (filter) for (var attributes, attr, i = 0, l = nodes.length; i < l; i++) {
		attributes = nodes[i].attributes,
			j = attributes.length;
		while (j--) {
			attr = attributes[j];
			if (attr_whitelist.indexOf(attr.name) === -1)
				nodes[i].removeAttribute(attr.name);
		}
	}

	return doc.innerHTML.replace(re_xhtmlspace, '$1').trim().replace(re_spaces, ' ');
}

/**
 * Filters undesired elements from a DOM tree using either XPath or CSS selectors.
 * @param {documentElement} doc Base DOM element to remove nodes from.
 * @param {String} names Selectors of nodes to remove.
 * @param {String} replaces Selectors of nodes to replace with text links.
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
		if (r[i].src) {
			r[i].outerHTML = '<a href="' + r[i].src + '">' + _T('EMBEDDED_MEDIA') + '</a>';
		} else if (r[i].parentNode) {
			r[i].parentNode.removeChild(r[i]);
		}
	}
}

/**
 * Creates HTML document object from a string.
 * @param {String} source String with HTML-formatted text.
 * @return {HTMLDocument} HTML-document.
 * */
function createHTML(source) {
	var doc = document.implementation.createHTMLDocument('HTMLParser');
	doc.documentElement.innerHTML = source;
	return doc;
}

/**
 * Creates XML document object from a string.
 * @param {String} source String with HTML-formatted text.
 * @return {XMLDocument} XML-document.
 * */
function createXML(source) {
	return (new window.DOMParser()).parseFromString(source, "application/xml");
}

function rssGetContent(node, filter) {
	var content = '',
		desc = null;

	if (desc = node.querySelector('encoded')) content = desc.textContent;
	if (!content && (desc = node.querySelector('description'))) content = desc.textContent;
	if (!content && (desc = node.querySelector('content')) && ~desc.innerHTML.indexOf('<')) content = desc.innerHTML;
	if (!content && (desc = node.querySelector('content'))) content = desc.textContent; // prefer content over summary
	if (!content && (desc = node.querySelector('summary'))) content = desc.textContent;

	if (!content) return r_default;
	if (!filter) return content;
	else {
		// filter content data
		var xmldoc = createXML(content);
		if (!xmldoc || xmldoc.querySelector('parsererror')) {
			content = content.replace(re_cdata, '$1');
			xmldoc = createHTML(content);
		}
		if (!xmldoc) return r_default;

		// podcast support
		var enclosed = '', media = rssGetMedia(node);
		if (media) {
			var type = media.getAttribute('type')
				src = media.getAttribute('url') || media.getAttribute('href');
			if (src && (re_media_type.test(type) || re_media.test(src))) {
				enclosed = xmldoc.createElement(re_video.test(type) ? 'video' : 'audio');
				if (type) enclosed.type = type;
				enclosed.id = 'podcast';
				//enclosed.thumbnail = media.getAttribute('thumbnail');
				enclosed.setAttribute('controls', '');
				//enclosed.setAttribute('autoplay', '');
				enclosed.setAttribute('preload', 'none');
				enclosed.setAttribute('src', src);
				enclosed = enclosed.outerHTML;
			}
		}

		var rnode = xmldoc.querySelector('body') || xmldoc.childNodes[0];
		removeNodes(rnode);
		if (rnode && (content = nodesToText(rnode, filter))) return enclosed + content;

		return r_default;
	}

	return r_default;
}

return {
	parse: function() {
		return parseRSS.apply(null, arguments);
	}
};
});
