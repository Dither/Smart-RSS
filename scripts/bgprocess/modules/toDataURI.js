/**
 * @module BgProcess
 * @submodule modules/toDataURI
 */
define([], function() {

    /**
     * Image specific data URI converter
     * @class toDataURI
     * @constructor
     * @extends Object
     */
    function toDataURI(url, callback, isfavicon) {
        var xhr = new window.XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
    	xhr.onreadystatechange = function () {
	        if(xhr.readyState === XMLHttpRequest.DONE) {
	        	if (xhr.status === 200) {
	            	var type = xhr.getResponseHeader('content-type');
	            	if (!~type.indexOf('image')) type = 'image/png';
		        	callback('data:' + type + ';base64,' + AB2B64(xhr.response));
		        } else {
		        	callback('');
		        }
			}
	    };

        xhr.open('GET', url, true);
        xhr.send();
    }

    function getFaviconDataURI(url, callback) {
    	var paths = url.split(/\/+/);
    	toDataURI('https://www.google.com/s2/favicons?domain='+encodeURIComponent(paths[1]), callback, true);
    }

    function AB2B64(arrayBuffer) {
        var base64 = '';
        var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

        var bytes = new Uint8Array(arrayBuffer);
        var byteLength = bytes.byteLength
        var byteRemainder = byteLength % 3;
        var mainLength = byteLength - byteRemainder;

        var a, b, c, d;
        var chunk;

        for (var i = 0; i < mainLength; i = i + 3) {
            chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

            a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
            b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
            c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
            d = chunk & 63; // 63       = 2^6 - 1

            base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
        }

        if (byteRemainder == 1) {
            chunk = bytes[mainLength]

            a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2
            b = (chunk & 3) << 4; // 3   = 2^2 - 1

            base64 += encodings[a] + encodings[b] + '==';
        } else if (byteRemainder == 2) {
            chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

            a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
            b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4
            c = (chunk & 15) << 2; // 15    = 2^4 - 1

            base64 += encodings[a] + encodings[b] + encodings[c] + '=';
        }

        return base64;
    }

    return {
        image: function() {
            return toDataURI.apply(null, arguments);
        },
        favicon: function() {
            return getFaviconDataURI.apply(null, arguments);
        }
    };
});
