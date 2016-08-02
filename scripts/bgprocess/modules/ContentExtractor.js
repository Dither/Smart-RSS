/**
 * @module BgProcess
 * @submodule modules/ContentExtractor
 */
define([], function () {
	/**
	 * HTML Main Content Extractor
	 * @class ContentExtractor
	 * @constructor
	 * @extends Object
	 */
	function ContentExtractor(html, sourceID) {
		var nodes = [],
            removed = 'script,style,noscript,link';

		if (!html || !sourceID) return '';
		var source = sources.findWhere({ id: sourceID });
        html = createHTML(html);

        if (!source || !html) return '';

		var ft_pos_mode = source.get('fulltextEnable') || 0,
			ft_pos = source.get('fulltextPosition') || 'body';

		if (ft_pos_mode > 0 && !ft_pos) ft_pos_mode = 2;

		removeNodes(html, removed);

		if (0 && ft_pos_mode === 2) {
			nodes = extractAuto(html);
		} else {
            try { 
            	nodes = Array.prototype.slice.call(html.querySelectorAll(ft_pos), 0); 
            } catch (e) {
                try {
                    var evnodes = html.evaluate(ft_pos, html, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                    while (node = evnodes.iterateNext()) nodes.push(node);
                } catch (e) {}
            }
        }

		return nodesToText(nodes);
	}

    function nodesToText(nodes) {
        var text = '',
        whitelist = ['src', 'alt', 'href', 'height', 'width', 'name', 'value', 'type', 'data', 'frameborder'];;
        for (var i = nodes.length - 1; i >= 0; i--) {
            var attributes = nodes[i].attributes,
                j = attributes.length;
            while (j--) {
                var attr = attributes[j];
                if (whitelist.indexOf(attr.name) === -1)
                    nodes[i].removeAttributeNode(attr);
            }
            text += nodes[i].innerHTML;
        };
        return text.trim();
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

	function extractAuto(root) {
		return root;
	}

    /**
     * Filters undesired elements from a DOM tree using either XPath or CSS selectors.
     * @param {documentElement} doc Base DOM element to remove nodes from.
     * @param {String} names Selectors of nodes to remove.
     * */
    function removeNodes(doc, names) {
        if (typeof doc === 'undefined') return;

        var r = doc.querySelectorAll(names),
        	l = r.length;
        for (var i = 0; i < l; i++) {
            if (r[i].parentNode) {
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