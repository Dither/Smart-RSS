/*
* =====================================      ReadabilitySAX      =====================================
*
* The code is structured into three main parts:
*	1. An light-weight 'Element' class that is used instead of the DOM (provides DOM-like functionality)
*	2. A list of properties that help readability to determine how a 'good' element looks like
*	3. The Readability class that provides the interface & logic (usable as a htmlparser2 handler)
*
* ====================================================================================================
*/

/* Copyright (c) Felix Böhm All rights reserved. https://github.com/fb55/readabilitySAX
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted
 * provided that the following conditions are met: Redistributions of source code must retain the above
 * copyright notice, this list of conditions and the following disclaimer. Redistributions in binary
 * form must reproduce the above copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the distribution.
 *
 * THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 * PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
 * THE USE OF THIS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/* jshint proto: true, boss:true */
(function(global){
//
// 1. the tree element
//
// @class      Element
// @param      {string}  tagName  The tag name
// @param      {Element} parent   The parent
//
var Element = function(tagName, parent){
	this.name = tagName;
	this.parent = parent;
	this.attributes = {};
	this.children = [];
	this.tagScore = 0;
	this.attributeScore = 0;
	this.totalScore = 0;
	this.elementData = '';
	this.info = {
		textLength: 0,
		linkLength: 0,
		commas:		0,
		density:	0,
		tagCount:	{}
	};
	this.isCandidate = false;
};

Element.prototype = {
	addInfo: function(){
		var info = this.info,
			childs = this.children,
			childNum = childs.length,
			elem;
		for(var i=0; i < childNum; i++){
			elem = childs[i];
			if(typeof elem === 'string'){
				info.textLength += elem.trim().length;
				if(re_commas.test(elem)) info.commas += elem.split(re_commas).length - 1;
			}
			else {
				if(elem.name === 'a'){
					info.linkLength += elem.info.textLength + elem.info.linkLength;
				}
				else{
					info.textLength += elem.info.textLength;
					info.linkLength += elem.info.linkLength;
				}
				info.commas += elem.info.commas;

				for(var j in elem.info.tagCount){
					if(j in info.tagCount) info.tagCount[j] += elem.info.tagCount[j];
					else info.tagCount[j] = elem.info.tagCount[j];
				}

				if(elem.name in info.tagCount) info.tagCount[elem.name] += 1;
				else info.tagCount[elem.name] = 1;
			}
		}

		if(info.linkLength !== 0){
			info.density = info.linkLength / (info.textLength + info.linkLength);
		}
	},
	getOuterHTML: function(){
		var ret = '<' + this.name;

		for(var i in this.attributes){
			ret += ' ' + i + '=\'' + this.attributes[i] + '\'';
		}

		if(this.children.length === 0){
			if(this.name in formatTags) return ret + '/>';
			else return ret + '></' + this.name + '>';
		}

		return ret + '>' + this.getInnerHTML() + '</' + this.name + '>';
	},
	getInnerHTML: function(){
		var nodes = this.children, ret = '';

		for(var i = 0, j = nodes.length; i < j; i++){
			if(typeof nodes[i] === 'string') ret += nodes[i];
			else ret += nodes[i].getOuterHTML();
		}
		return ret;
	},
	getFormattedText: function(){
		var nodes = this.children, ret = '';
		for(var i = 0, j = nodes.length; i < j; i++){
			if(typeof nodes[i] === 'string') ret += nodes[i].replace(re_whitespace, ' ');
			else {
				if(nodes[i].name === 'p' || nodes[i].name in headerTags) ret += '\n';
				ret += nodes[i].getFormattedText();
				if(nodes[i].name in newLinesAfter) ret += '\n';
			}
		}
		return ret;
	},
	toString: function(){
		return this.children.join('');
	},
	getTopCandidate: function(){
		var childs = this.children,
			topScore = -Infinity,
			score = 0,
			topCandidate, elem;

		for(var i = 0, j = childs.length; i < j; i++){
			if(typeof childs[i] === 'string') continue;
			if(childs[i].isCandidate){
				elem = childs[i];
				//add points for the tags name
				if(elem.name in tagCounts) elem.tagScore += tagCounts[elem.name];

				score = Math.floor(
					(elem.tagScore + elem.attributeScore) * (1 - elem.info.density)
				);
				if(topScore < score){
					elem.totalScore = topScore = score;
					topCandidate = elem;
				}
			}
			if((elem = childs[i].getTopCandidate()) && topScore < elem.totalScore){
				topScore = elem.totalScore;
				topCandidate = elem;
			}
		}
		return topCandidate;
	}
};

//2. list of values
var tagsToRemove = { __proto__: null, aside: true, time: true, applet: true, footer: true, head: true, label: true, nav: true, noscript: true, script: true, select: true, style: true, textarea: true, button: true },
	tagCounts = {
		__proto__: null,
		address: -3,
		article: 30,
		blockquote: 3,
		body: -5,
		code: 4,
		canvas: 3,
		dd: -3,
		div: 5,
		dl: -3,
		dt: -3,
		figure: 5,
		footer: -3,
		form: -4,
		h2: -5,
		h3: -5,
		h4: -4,
		h5: -3,
		h6: -3,
		header: -4,
		hgroup: -5,
		li: -3,
		ol: -3,
		pre: 3,
		section: 15,
		td: 3,
		th: -5,
		ul: -3
	},
	removeIfEmpty = { __proto__: null, blockquote: true, a:true, li: true, p: true, pre: true, tbody: true, td: true, th: true, thead: true, tr: true },
	embeds = { __proto__: null, embed: true, object: true, iframe: true, audio: true, video: true, source: true, param: true },
	goodAttributes = { __proto__: null, /*style: true,*/ lang: true, src: true, href: true, alt: true, title: true, data: true, height: true, width: true, name: true, value: true, type: true, border: true, frameborder: true, colspan: true, rowspan: true, span: true, cite: true },
	cleanConditionally = { __proto__: null, div: true, form: true, ol: true, table: true, ul: true },
	unpackDivs = { __proto__: embeds, div: true, img: true, svg: true, figure: true, p: true }, // div>[single child] => [single child]
	noContent = { __proto__: formatTags, font: false, input: false, link: false, meta: false, span: false, path: false, source: false },
	formatTags = { __proto__: null, br: new Element('br'), hr: new Element('hr') },
	headerTags = { __proto__: null, h1: true, h2: true, h3: true, h4: true, h5: true, h6: true },
	newLinesAfter = { __proto__: headerTags, br: true, li: true, p: true },

	divToPElements = ['a','blockquote','dl','img','svg','ol','p','pre','code','table','ul'],
	okayIfEmpty = ['source','path','embed','iframe','img','object','canvas'],

	re_videos = /\/\/(?:[^.?\/]+\.)?(?:youtu(?:be)?|soundcloud|vimeo|imgur|gfycat|dailymotion|cliphunter|twitch|vid|pornhub|xvideos|twitvid|rutube|viddler)\.(?:com|me|be|org|net|tv|ru)/,
	re_nextLink = /[>»]|continue|next|more|weiter(?:[^\|]|$)/i,
	re_prevLink = /[<«]|earl|new|old|prev/i,
	re_extraneous = /\bprint|archive|comment|discuss|e?[\-]?mail|share|reply|sign|single|utility/i,
	re_pages = /pag(?:e|ing|inat)/i,
	re_pagenum = /p[ag]{0,2}(?:e|er|inator|ing|ination)?[=\/]\d{1,2}/i,

	re_safe = /hentry|(?:instapaper|article).body|markdown|\bfulltext/,
	re_final = /first|last/i,

	re_positive = /read|full|article|source|content|body|\bcontent|contain|\bentry|main|page|attach|post|text|blog|story/i,
	re_negative = /pag(?:er|ination)|\bdate|\btime|nav|tag|extra|keyword|foot(?:note)?|^hid$|hid$|\bhid\b|^hid|all|bottom|stat|info|modal|outbrain|masthead|com-|contact|_nav|link|media|\bout|skyscraper|promo|\bad-|related|scroll|shoutbox|sponsor|shopping|teaser/i,
	re_unlikelyCandidates =  /auth?or|similar|ignore|\binfo|annoy|clock|\bdate|\btime|footer|com(?:bx|ment|munity)|banner|intro|log.{2}n|edcolinks|hidd?e|about|bookmark|\bcat|search|social|robot|published|mast(?:head)|subscri|category|disqus|extra|head(?:er|note)|floor|agegate|menu|function|remark|rss|tool|header|teaserlist|widget|meta|adsense|inner-?ad|ad-|\badv\b|\bads\b|agr?egate?|pager|sidebar|popup|tweet|twit|like/i,
	re_okMaybeItsACandidate = /and|out(?:er|side)|wrap|post|article\b|body|entry|\bmain|page|contain|\bcontent|column|general|detail|shadow|lightbox|blog/i,

	re_sentence = /\. |\.$/,
	re_whitespace = /\s+/g,
	re_commas = /,[\s\,]*/g,
	re_digits = /\d/,

	re_pageInURL = /[_\-]?p[a-zA-Z]*[_\-]?\d{1,2}$/,
	re_badFirst = /^(?:[^a-z]{0,3}|index|\d+)$/i,
	re_noLetters = /[^a-zA-Z]/,
	re_params = /\?.*/,
	re_extension = /00,|\.[a-zA-Z]+$/g,
	re_justDigits = /^\d{1,2}$/,
	re_slashes = /\/+/,
	re_domain = /\/([^\/]+)/,
	re_protocol = /\w+\:\/\//g,
	re_cleanPaths = /\/\.(?!\.)|\/[^\/]*\/\.\./,

	re_onAttribute = /^on/i,
	re_jsAttribute = /javascript\s*:/i,
	re_dataAttribute = /^data-/,

	re_closing = /\/?(?:#.*)?$/,
	re_imgUrl = /\.(?:gif|jpe?g|a?png|webp|svg)/i,

	// constants
    SCORE_CHARS_IN_PARAGRAPH = 100,
    GRANDPARENT_SCORE_DIVISOR = 2,
    MIN_PARAGRAPH_LENGTH = 20,
    MIN_COMMAS_IN_PARAGRAPH = 6,
    MIN_NODE_LENGTH = 80,
    MAX_LINK_DENSITY = 0.25,
    SIBLING_SCORE_MULTIPLIER = 0.2,

    // TODO: raw HTML filters
    pre_filters = [
        { r: /^\s+|\s+$/g, s: '' }, // trim()
        { r: /[\r\n]+(?=\n)/g, s: '' }
    ],

    // output HTML filters
    post_filters = [
        { r: /(?:<br\/>(?:\s|&nbsp;?)*)+(?=<\/?p)/g, s:'' }, //remove <br>s in front of opening & closing <p>s
        { r: /(?:\s|&nbsp;?)+(?=<br\/>)/g, s: '' }, // remove spaces in front of <br>s
        { r: /(?:<br\/>){2,}/g, s: '</p><p>' },
        { r: /\s{2,}/g, s: ' ' }
    ];

//
// 3. the readability class
//
// @class      Readability (name)
// @param      {object}  settings  The settings
//
var Readability = function(settings){
	this._currentElement = new Element('document'); // the root node
	this._topCandidate = null;
	this._origTitle = this._headerTitle = '';
	this._scannedLinks = {};
	if(settings) this._processSettings(settings);
};

Readability.prototype._settings = {
	stripUnlikelyCandidates: true, // strip suspicious elements from document before processing
	weightAttributes: true, // weight id and class
	cleanConditionally: true, // clean node based on its metrics
	cleanAttributes: true, // remove unneeded attributes
	replaceImgs: false, // a[href='large.jpg']>img[src='small.jpg'] => img[src='large.jpg']
	searchFurtherPages: true, // download paginaed pages
	resolvePaths: false, //
	linksToSkip: {},	//pages that are already parsed
	//pageURL: null,	//URL of the page which is parsed
	//type: 'html'		//default type of output
};


/**
 * Posts a process content.
 *
 * @param      {string}  articleContent  The article content
 * @return     {string}  Filtered content
 */
Readability.prototype._processContent = function(content, filters) {
    if (typeof content !== 'string' || !content) return '';
    for (var i = 0, l = filters.length; i < l; i++) {
        content = String.prototype.replace.apply(content, [filters[i].r, filters[i].s]);
    }
    return content;
};

/**
 * Fixes relative URLs.
 *
 * @param      {string}  path    The path
 * @return     {string}  Fixed url.
 */
Readability.prototype._fixRelativeUris = function(path){
	if(!this._url) return path;
	if(!path) return this._url.full;

	var path_split = path.split('/');

	//special cases
	if(path_split[1] === ''){
		//paths starting with '//'
		if(path_split[0] === ''){
			return this._url.protocol + path;
		}
		// full domain (if not caught before)
		if(path_split[0].substr(-1) === ':'){
			return path;
		}
	}

	// if path is starting with '/'
	if(path_split[0] === '') path_split.shift();
	else Array.prototype.unshift.apply(path_split, this._url.path);

	path = path_split.join('/');

	if(this._settings.resolvePaths){
		while(path !== (path = path.replace(re_cleanPaths, '')));
	}

	return this._url.protocol + '//' + this._url.domain + '/' + path;
};

/**
 * Finds base URL.
 *
 * @return     {string}  Base URL.
 */
Readability.prototype._findBaseUrl = function(){
	if(this._url.path.length === 0){
		// return what we got
		return this._url.full.replace(re_params,'');
	}

	var cleaned = '',
		elementNum = this._url.path.length - 1;

	for(var i = 0; i < elementNum; i++){
		// Split off and save anything that looks like a file type and '00,'-trash.
		cleaned += '/' + this._url.path[i].replace(re_extension, '');
	}

	var first = this._url.full.replace(re_params, '').replace(/.*\//, ''),
		second = this._url.path[elementNum];

	if(!(second.length < 3 && re_noLetters.test(first)) && !re_justDigits.test(second)){
		if(re_pageInURL.test(second)){
			second = second.replace(re_pageInURL, '');
		}
		cleaned += '/' + second;
	}

	if(!re_badFirst.test(first)){
		if(re_pageInURL.test(first)){
			first = first.replace(re_pageInURL, '');
		}
		cleaned += '/' + first;
	}

	// This is our final, cleaned, base article URL.
	return this._url.protocol + '//' + this._url.domain + cleaned;
};

/**
 * Prepares and assigns Readability settings.
 *
 * @param      {object}  settings  The settings
 */
Readability.prototype._processSettings = function(settings){
	var Settings = this._settings;
	this._settings = {};

	for(var i in Settings){
		if(typeof settings[i] !== 'undefined'){
			this._settings[i] = settings[i];
		}
		else this._settings[i] = Settings[i];
	}

	var path;
	if(settings.pageURL){
		path = settings.pageURL.split(re_slashes);
		this._url = {
			protocol: (path[0] && ~path[0].indexOf('s') ? 'https:' : 'http:'),
			domain: path[1],
			path: path.slice(2, -1),
			full: settings.pageURL.replace(re_closing, '')
		};
		this._baseURL = this._findBaseUrl();
	}
	if(settings.type) this._settings.type = settings.type;
};

/**
 * Scans and weigths a link as link to the next page.
 *
 * @param      {Element}  elem    Link element
 */
Readability.prototype._scanLink = function(elem){
	var href = elem.attributes.href;

	if(!href) return;
	href = href.replace(re_closing, '');

	if(href in this._settings.linksToSkip) return;
	if(href === this._baseURL || (this._url && href === this._url.full)) return;

	var match = href.match(re_domain);

	if(!match) return;
	if(this._url && match[1] !== this._url.domain) return;

	var text = elem.toString();
	if(text.length > 25 || re_extraneous.test(text)) return;
	if(!re_digits.test(href.replace(this._baseURL, ''))) return;

	var score = 0,
		linkData = text + elem.elementData;

	if(re_nextLink.test(linkData)) score += 50;
	if(re_pages.test(linkData)) score += 25;

	if(re_final.test(linkData)){
		if(!re_nextLink.test(text))
			if(!(this._scannedLinks[href] && re_nextLink.test(this._scannedLinks[href].text)))
				score -= 65;
	}

	if(re_negative.test(linkData) || re_extraneous.test(linkData)) score -= 50;
	if(re_prevLink.test(linkData)) score -= 200;

	if(re_pagenum.test(href) || re_pages.test(href)) score += 25;
	if(re_extraneous.test(href)) score -= 15;

	var current = elem,
		posMatch = true,
		negMatch = true;

	while(current = current.parent){
		if(current.elementData === '') continue;
		if(posMatch && re_pages.test(current.elementData)){
			score += 25;
			if(!negMatch) break;
			else posMatch = false;
		}
		if(negMatch && re_negative.test(current.elementData) && !re_positive.test(current.elementData)){
			score -= 25;
			if(!posMatch) break;
			else negMatch = false;
		}
	}

	var parsedNum = parseInt(text, 10);
	if(parsedNum < 10){
		if(parsedNum === 1) score -= 10;
		else score += 10 - parsedNum;
	}

	if(href in this._scannedLinks){
		this._scannedLinks[href].score += score;
		this._scannedLinks[href].text += ' ' + text;
	}
	else this._scannedLinks[href] = {
		score: score,
		text: text
	};
};

// parser methods

/**
 * onopentagname
 *
 * @param      {string}                    name    Tag name
 *
 */
Readability.prototype.onopentagname = function(name){
	if(name in noContent){
		if(name in formatTags) this._currentElement.children.push(formatTags[name]);
	}
	else this._currentElement = new Element(name, this._currentElement);
};

/**
 * onattribute
 *
 * @param      {string}           name    Attribute name
 * @param      {(number|string)}  value   Attribute value
 */
Readability.prototype.onattribute = function(name, value){
	if(!value || re_jsAttribute.test(value) || re_onAttribute.test(name)) return;

	name = name.toLowerCase();

	var elem = this._currentElement;

	if (re_dataAttribute.test(name)) {
		// Replace lazyload images
		if ((value.match(re_protocol) || []).length === 1 && re_imgUrl.test(value))
			elem.attributes['src'] = value;
	}
	else if(name === 'href' || name === 'src'){
		// fix links
		if (elem.attributes[name]);
		else if(re_protocol.test(value)) elem.attributes[name] = value;
		else elem.attributes[name] = this._fixRelativeUris(value);
	}
	else if(name === 'id' || name === 'class'){
		// weight attributes
		value = value.trim().toLowerCase();
		if(!this._settings.weightAttributes);
		else if(re_safe.test(value)){
			elem.attributeScore += 100;
			elem.isCandidate = true;
		}
		else if(re_negative.test(value)) elem.attributeScore -= 25;
		else if(re_positive.test(value)) elem.attributeScore += 25;
		else if(re_unlikelyCandidates.test(value)) elem.attributeScore -= 5;
		else if(re_okMaybeItsACandidate.test(value)) elem.attributeScore += 5;

		elem.elementData += ' ' + value;
	}
	else if(elem.name === 'img' || elem.name === 'svg'){
		// powerup proper images
		if(name === 'width' || name === 'height') {
			value = parseInt(value, 10);
			if(value !== value); // NaN (skip)
			else if(value <= 32) elem.name = 'noscript'; // skip the image (use a tagname that's part of tagsToRemove)
			else if(name === 'width' ? value >= 400 : value >= 300) elem.parent.attributeScore += 20; // increase score of parent
			else if(name === 'width' ? value >= 200 : value >= 150) elem.parent.attributeScore += 5;
		}
		else if(name === 'alt') elem.parent.attributeScore += 10;
	}
	else if(this._settings.cleanAttributes){
		// filter attributes
		if(name in goodAttributes) elem.attributes[name] = value;
	}
	else elem.attributes[name] = value;
};

/**
 * ontext
 *
 * @param      {string}  text    Node text
 */
Readability.prototype.ontext = function(text){
	this._currentElement.children.push(text);
};

/**
 * onclosetag
 *
 * @param      {string}  tagName  Tag name
 */
Readability.prototype.onclosetag = function(tagName){
	if(tagName in noContent) return;

	var elem = this._currentElement, title, i, j;

	this._currentElement = elem.parent;

	// prepare title
	if(this._settings.searchFurtherPages && tagName === 'a'){
		this._scanLink(elem);
	}
	else if(tagName === 'title' && !this._origTitle){
		this._origTitle = elem.toString().trim().replace(re_whitespace, ' ');
		return;
	}
	else if(tagName in headerTags){
		title = elem.toString().trim().replace(re_whitespace, ' ');
		if(this._origTitle){
			if(this._origTitle.indexOf(title) !== -1){
				if(title.split(' ', 4).length === 4){
					//It's probably the title, so let's use it!
					this._headerTitle = title;
				}
				return;
			}
			if(tagName === 'h1' || tagName === 'h2') return;
		}
		//if there was no title tag, use any h1/h2 as the title
		else if(!this._headerTitle && tagName === 'h1'){
			this._headerTitle = title;
			return;
		}
		else if(!this._headerTitle && tagName === 'h2'){
			this._headerTitle = title;
			return;
		}
	}

	if(tagName in tagsToRemove) return;
	if(this._settings.stripUnlikelyCandidates &&
	   re_unlikelyCandidates.test(elem.elementData) &&
	   !re_okMaybeItsACandidate.test(elem.elementData))
			return;

	if(tagName === 'div' &&
		elem.children.length === 1 &&
		typeof elem.children[0] === 'object' &&
		elem.children[0].name in unpackDivs
	){
		//unpack divs
		elem.parent.children.push(elem.children[0]);
		return;
	}

	elem.addInfo();

	//clean conditionally
	if(tagName in embeds){
		// check if tag is wanted (youtube etc)
		if(!('src' in elem.attributes && re_videos.test(elem.attributes.src))) {
			if (!elem.children[0]) return;
			else if(typeof elem.children[0] === 'object' &&
					!('src' in elem.children[0].attributes &&
					re_videos.test(elem.children[0].attributes.src)))
						return; // audio>source[src] case
		}
	}
	else if(tagName === 'h2' || tagName === 'h3'){
		//clean headers
		if (elem.attributeScore < 0 || elem.info.density > 0.33) return;
	}
	else if(this._settings.cleanConditionally && tagName in cleanConditionally){
		var p = elem.info.tagCount.p || 0,
			contentLength = elem.info.textLength + elem.info.linkLength;

		if(contentLength === 0){
			if(elem.children.length === 0) return;
			if(elem.children.length === 1 && typeof elem.children[0] === 'string') return;
		}
		if((elem.info.tagCount.li - 100) > p && tagName !== 'ul' && tagName !== 'ol') return;
		if(contentLength < 25 && (!('img' in elem.info.tagCount) || elem.info.tagCount.img > 2)) return;
		if(elem.info.density > 0.5) return;
		if(elem.attributeScore < 25 && elem.info.density > 0.2) return;
		if((elem.info.tagCount.embed === 1 && contentLength < 75) || elem.info.tagCount.embed > 1) return;
	}

	/* jshint ignore:start */
	filterEmpty: if(
		(tagName in removeIfEmpty || !this._settings.cleanConditionally && tagName in cleanConditionally) &&
		(elem.info.linkLength + elem.info.textLength === 0) &&
		elem.children.length !== 0
	) {
		for(i = 0, j = okayIfEmpty.length; i < j; i++){
			if(okayIfEmpty[i] in elem.info.tagCount) break filterEmpty;
		}
		return;
	}
	/* jshint ignore:end */

	if(this._settings.replaceImgs &&
		tagName === 'a' &&
		elem.children.length === 1 &&
		elem.children[0].name === 'img' &&
		re_imgUrl.test(elem.attributes.href)
	){
		elem.children[0].attributes.src = elem.attributes.href;
		elem = elem.children[0];
	}

	elem.parent.children.push(elem);

	//should node be scored?
	if(tagName === 'p' || tagName === 'pre' || tagName === 'td' || tagName === 'code');
	else if(tagName === 'div'){
		//check if div should be converted to a p
		for(i = 0, j = divToPElements.length; i < j; i++){
			if(divToPElements[i] in elem.info.tagCount) return;
		}
		elem.name = 'p';
	}
	else return;

	if((elem.info.textLength + elem.info.linkLength) > MIN_PARAGRAPH_LENGTH && elem.parent && elem.parent.parent){
		elem.parent.isCandidate = elem.parent.parent.isCandidate = true;
		var addScore = 1 + elem.info.commas +
					   Math.min( Math.floor( (elem.info.textLength + elem.info.linkLength) / SCORE_CHARS_IN_PARAGRAPH ), 3);
		elem.parent.tagScore += addScore;
		if (elem.parent.parent) {
			elem.parent.parent.tagScore += addScore / GRANDPARENT_SCORE_DIVISOR;
			if (elem.parent.parent.parent) elem.parent.parent.parent.tagScore += addScore / (2 * GRANDPARENT_SCORE_DIVISOR);
		}
	}
};

Readability.prototype.onreset = Readability;

/**
 * Gets the candidate siblings.
 *
 * @param      {Element} candidate  The candidate node
 * @return     {Array}   The candidate siblings.
 */
var getCandidateSiblings = function(candidate){
	var toAtrArray = function (node) {
	    return (node.elementData).replace(/[_-]/g, ' ').split(' ')
	        	.filter(function(v) { return v === ''; });
	};

	/**
	 * Intersection of arrays
	 *
	 * @param      {Array}  arrays  Input arrays
	 * @return     {Array}  Intersection array
	 */
	var intersect = function (arrays) {
	    return arrays.shift().filter(function(v) {
	        return arrays.every(function(a) {
	            return a.indexOf(v) !== -1;
	        });
	    });
	};

	// check all siblings
	var ret = [],
		childs = candidate.parent.children,
		childNum = childs.length,
		siblingScoreThreshold = Math.max(10, candidate.totalScore * SIBLING_SCORE_MULTIPLIER);

	for(var i = 0; i < childNum; i++){
		if(typeof childs[i] === 'string') continue;

		if(childs[i] === candidate);
		else if(intersect([toAtrArray(childs[i]), toAtrArray(candidate)]).length){
			if((childs[i].totalScore + candidate.totalScore * SIBLING_SCORE_MULTIPLIER) >= siblingScoreThreshold){
				if(childs[i].name !== 'p') childs[i].name = 'div';
			}
			else continue;
		} else if(childs[i].name === 'p'){
			if(childs[i].info.textLength >= MIN_NODE_LENGTH && childs[i].info.density < MAX_LINK_DENSITY);
			else if(childs[i].info.textLength < MIN_NODE_LENGTH && childs[i].info.density === 0 && re_sentence.test(childs[i].toString()));
			else continue;
		} else continue;

		ret.push(childs[i]);
	}
	return ret;
};

/**
 * Gets the candidate node.
 *
 * @return     {Element}  The candidate node.
 */
Readability.prototype._getCandidateNode = function(){
	var elem = this._topCandidate, elems;
	if(!elem) elem = this._topCandidate = this._currentElement.getTopCandidate();

	if(!elem){
		//select root node
		elem = this._currentElement;
	}
	else if(elem.parent.children.length > 1){
		elems = getCandidateSiblings(elem);

		// create a new object so that the prototype methods are callable
		elem = new Element('article');
		elem.children = elems;
		elem.addInfo();
	}

	while(elem.children.length === 1){
		if(typeof elem.children[0] === 'object'){
			elem = elem.children[0];
		} else break;
	}

	return elem;
};

/**
 * skipLevel is a shortcut to allow more elements of the page
 *
 * @param      {number}  skipLevel  The skip level
 */
Readability.prototype.setSkipLevel = function(skipLevel){
	if(skipLevel === 0) return;

	// if the prototype is still used for settings, change that
	if(this._settings === Readability.prototype._settings){
		this._processSettings({});
	}

	if(skipLevel > 0) this._settings.stripUnlikelyCandidates = false;
	if(skipLevel > 1) this._settings.weightAttributes = false;
	if(skipLevel > 2) this._settings.cleanConditionally = false;
};

/**
 * Gets the title.
 *
 * @return     {string}  The title.
 */
Readability.prototype.getTitle = function(){
	if(this._headerTitle) return this._headerTitle;
	if(!this._origTitle) return '';

	var curTitle = this._origTitle;

	if(/ [\|\-|\xbb] /.test(curTitle)){
		curTitle = curTitle.replace(/(.*) [\|\-|\xbb] .*/g, '$1');

		if(curTitle.split(' ', 3).length !== 3)
			curTitle = this._origTitle.replace(/[^\|\-|\xbb]*[\|\-|\xbb](.*)/gi, '$1');
	}
	else if(curTitle.indexOf(': ') !== -1){
		curTitle = curTitle.substr(curTitle.lastIndexOf(': ') + 2);

		if(curTitle.split(' ', 3).length !== 3)
			curTitle = this._origTitle.substr(this._origTitle.indexOf(': '));
	}

	curTitle = curTitle.trim();

	if(curTitle.split(' ', 5).length !== 5) return this._origTitle;
	return curTitle;
};

/**
 * Gets link to the next page.
 *
 * @return     {string}  The next page.
 */
Readability.prototype.getNextPage = function(){
	var topScore = 49, topLink = '';
	for(var link in this._scannedLinks){
		if(this._scannedLinks[link].score > topScore){
			topLink = link;
			topScore = this._scannedLinks[link].score;
		}
	}

	return topLink;
};

/**
 * Gets cleaned HTML.
 *
 * @param      {Element}  node    The article node
 * @return     {string}   Cleaned HTML.
 */
Readability.prototype.getHTML = function(node){
	if(!node) node = this._getCandidateNode();
	return this._processContent(node.getInnerHTML(), post_filters);
};

/**
 * Gets cleaned text.
 *
 * @param      {Element}  node    The article node
 * @return     {string}   The text.
 */
Readability.prototype.getText = function(node){
	if(!node) node = this._getCandidateNode();
	return node.getFormattedText().trim().replace(/\n+(?=\n{2})/g, '');
};

/**
 * Generates Readability events.
 *
 * @param      {object}  cbs     CBS
 */
Readability.prototype.parse = function(cbs){
	(function process(node){
		cbs.onopentag(node.name, node.attributes);
		for(var i = 0, j = node.children.length; i < j; i++){
			if(typeof node.children[i] === 'string'){
				cbs.ontext(node.children[i]);
			}
			else process(node.children[i]);
		}
		cbs.onclosetag(node.name);
	})(this._getCandidateNode());
};

/**
 * Generates Readability events on DOM object.
 *
 * @param      {Element}  root     Root document node
 */
Readability.prototype.parseDOM = function(root){
	var self = this;
	//root.innerHTML = self._processContent(root.innerHTML, pre_filters);

	var parse = function(node){
		var i, j,
			name = node.tagName.toLowerCase(),
		    attributeNodes = node.attributes;

		self.onopentagname(name);

		for(i = 0, j = attributeNodes.length; i < j; i++)
			self.onattribute(attributeNodes[i].name + '', attributeNodes[i].value);

		var nodeType,
			childs = node.childNodes,
		    num = childs.length;

		for(i = 0; i < num; i++){
			nodeType = childs[i].nodeType;
			if(nodeType === 3 /*text*/)
				self.ontext(childs[i].textContent);
			else if(nodeType === 1 /*element*/) parse(childs[i]);
		}

		self.onclosetag(name);
	};

	parse(root);
};

/**
 * Gets the cleaned article.
 *
 * @param      {string}  type    Content type 'text'|'html'
 * @return     {object}          Article object {title, nextPage, textLength, score}.
 */
Readability.prototype.getArticle = function(type){
	var elem = this._getCandidateNode();

	var ret = {
		title: this._headerTitle || this.getTitle(),
		nextPage: this.getNextPage(),
		textLength: elem.info.textLength,
		score: this._topCandidate ? this._topCandidate.totalScore : 0
	};

	if(!type && this._settings.type) type = this._settings.type;

	if(type === 'text') ret.text = this.getText(elem);
	else ret.html = this.getHTML(elem);

	return ret;
};

if(typeof module !== 'undefined' && 'exports' in module){
	module.exports = Readability;
} else {
	if(typeof define === 'function' && define.amd){
		define('Readability', function(){
			return Readability;
		});
	}
	global.Readability = Readability;
}

})(typeof window === 'object' ? window : this);
