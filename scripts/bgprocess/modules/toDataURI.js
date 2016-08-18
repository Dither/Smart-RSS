/**
 * @module BgProcess
 * @submodule modules/toDataURI
 */
define([], function() {

    var defaultImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAADYUlEQVR42mNkoDFgpLsFd2p1fJRF2HOBTA0gZibSnH9A/PDt1z/zSzY8mb/g1Nv/WC341mNYxcHC2AKWAIL/QIDMRhbDpQbIXMRUcC4Bw4LViUraIQaCF4FqmCi0gOH+u1+Byk1XNqJY8LxZr06Cj7URxP7y8+/MxaffzVUSZpMxkeM2EOZmcQUKmwMxE5FBtowx/2w0igXv2/WnCXCxZIJc8fLznxbJ2kt1yDoWRiuoRhgLlrAyMSYCuSz4fABk7gda4IxuwXSgBRkgRV9//Zvcve9l88vPv9/OPPrmP7JFu7NU9Z3VeBcDmTp4LDgAtMAJqwVoXv0IxEeff/y9YvrR1yubdz7/BRKsdpPgavaSWgE0yBdHEO3HacF/iDNOA4nrTIwMukApfaBBzEDR+08+/s6Rq7+8DaQ+y0aUdUqILCgiPUjyAXoczAiTk4szE84HJt8coEbWX3/+NbEXn28AyXX4SvOXOYufBTKVSLLg/fe/LcKVF1EieX+umoGDCu96oLT877//64CWgPPL2RJNJ0MZzj2kxsF7IL4BdO2edRc/zIhcdP8ZSHBlgqJsmKHQMSBT6u6bny4qzVf2g8T/TTDaBjTUk+g4QAvTL0AfpQN9tBwkfqpYw9ZElusAkHk9f91jvcmHXv87lKfmbqvMu4PUVPQAiG8BsT0Qs776/DtUvObSOpDE3wlGK5gYGcOvPv/uo9NxbWuKpQjz7Aj5l0ApYWJ9cKFn30ursk1Pf5wr1XQwlOHaBxR+03/glXLxhiefd2Sq2Lup84GCZyGw3AFlPIb/E41B8eNPVCT//c/QxVp4rgImB9T8ASjM9/zT71Tpustz06xEWICp6wPQoCdAg0ClLsPLFr0WUR6WKnwWTAJakAvlXllw8o1l4rKHX27VaHuqinJsg4rPB2pMglp6EUipAvlcIP7lCq1cHUnOSVB1O4HiHigWXCrXStSV4pyHFFGvgMx7QKYpkM0CLU1fA6kLUC1mQD4/kL8HZB+QLQNka4IkgMm4E5iMK1EsKHYU5+wJkLkCVKSIJWeSUlx/WnHuvW7UovuPUSwAgc2pymo+OgLrgUwtBvLAs+svvkdotV87DHcEuopEc2HmYH1BZ3FeFpKqzI8//j7cfePTzs69L78jS9C/0qc2AACJzAU3iRId6QAAAABJRU5ErkJggg==';

    /**
     * Image specific data URI converter
     * @class toDataURI
     * @constructor
     * @extends Object
     */
    function toDataURI(url, favicon, resize_w, resize_h, callback) {
        var xhr = new window.XMLHttpRequest();
        xhr.responseType = 'arraybuffer';
    	xhr.onreadystatechange = function () {
	        if(xhr.readyState === XMLHttpRequest.DONE) {
	        	if (xhr.status === 200) {
	            	var type = xhr.getResponseHeader('content-type');
	            	if (!~type.indexOf('image') || xhr.response.byteLength < 10) // Not an image file
                        callback(favicon ? defaultImage : '');
		        	else {
                        var imgData = 'data:' + type + ';base64,' + AB2B64(xhr.response);
                        if (favicon){
                            if (xhr.response.byteLength > 2000)
                                resizeTo(imgData, resize_w, resize_h, function(parsedImgData){
                                    callback(parsedImgData);
                                });
                            else
                                callback(imgData);
                        } else {
                            if (!resize_w)
                                callback(imgData);
                            else
                                resizeTo(imgData, resize_w, resize_h, function(parsedImgData){
                                    callback(parsedImgData);
                                });
                        }

                    }
		        } else { // Error retreiving image
		        	callback('');
		        }
			}
	    };

        xhr.open('GET', url, true);
        xhr.send();
    }

    function getFaviconDataURI(url, callback) {
    	var paths = url.split(/\/+/);
    	/*toDataURI('https://www.google.com/s2/favicons?domain='+encodeURIComponent(paths[1]), true, 16, 16, callback);*/
        toDataURI('https://icons.better-idea.org/icon?size=16&url='+encodeURIComponent(paths[1]), true, 16, 16, callback);
    }

    /* Custom Base64 encoder. */
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
            chunk = bytes[mainLength];

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

    function resizeTo(url, w, h, callback) {
        var img, canvas, resized;
        img = new Image();
        img.onload = function(){
            canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
            resized = document.createElement('canvas');
            resized.width = w || 16;
            // in case we want proportional resize h = 0/null/undefined
            if (!h) {
                resized.height = w * (canvas.height / canvas.width);
            } else {
                resized.height = h;
            }

            canvasResize(canvas, resized, function(){
                callback(resized.toDataURL());
            });
        };
        img.src = url;
    }

    /*
     * MIT License
     *  You may use this code as long as you retain this notice. Use at your own risk! :)
     *  https://github.com/danschumann/limby-resize
     *  0.0.8
     */

    function canvasResize(original, canvas, callback) {
        var w1 = original.width,
            h1 = original.height,
            w2 = canvas.width,
            h2 = canvas.height,
            img = original.getContext("2d").getImageData(0, 0, w1, h1),
            img2 = canvas.getContext("2d").getImageData(0, 0, w2, h2);

        if (w2 > w1 || h2 > h1) {
            canvas.getContext('2d').drawImage(original, 0, 0, w2, h2);
            return callback();
        }

        var data = img.data;
        // it's an _ because we don't use it much, as working with doubles isn't great
        var _data2 = img2.data;
        // Instead, we enforce float type for every entity in the array
        // this prevents weird faded lines when things get rounded off
        var i, l = _data2.length,
            data2 = Array(l);
        for (i = 0; i < l; i++){
            data2[i] = 0.0;
        }

        // We track alphas, since we need to use alphas to correct colors later on
        l = _data2.length >> 2;
        var alphas = Array(l);
        for (i = 0; i < l; i++){
            alphas[i] = 1;
        }

        // this will always be between 0 and 1
        var xScale = w2 / w1;
        var yScale = h2 / h1;
        var deferred;

        // We process 1 row at a time ( and then let the process rest for 0ms [async] )
        var nextY = function(y1){
            for (var x1 = 0; x1 < w1; x1++) {
                var
                    // the original pixel is split between two pixels in the output, we do an extra step
                    extraX = false,
                    extraY = false,
                    // the output pixel
                    targetX = Math.floor(x1 * xScale),
                    targetY = Math.floor(y1 * yScale),
                    // The percentage of this pixel going to the output pixel (this gets modified)
                    xFactor = xScale,
                    yFactor = yScale,
                    // The percentage of this pixel going to the right neighbor or bottom neighbor
                    bottomFactor = 0,
                    rightFactor = 0,

                    // positions of pixels in the array
                    offset = (y1 * w1 + x1) * 4,
                    targetOffset = (targetY * w2 + targetX) * 4;

                // Right side goes into another pixel
                if (targetX < Math.floor((x1 + 1) * xScale)) {

                    rightFactor = (((x1 + 1) * xScale) % 1);
                    xFactor -= rightFactor;
                    extraX = true;
                }

                // Bottom side goes into another pixel
                if (targetY < Math.floor((y1 + 1) * yScale)) {
                    bottomFactor = (((y1 + 1) * yScale) % 1);
                    yFactor -= bottomFactor;
                    extraY = true;
                }

                var a = (data[offset + 3] / 255);
                var alphaOffset = targetOffset / 4;

                if (extraX) {
                    // Since we're not adding the color of invisible pixels,  we multiply by a
                    data2[targetOffset + 4] += data[offset] * rightFactor * yFactor * a;
                    data2[targetOffset + 5] += data[offset + 1] * rightFactor * yFactor * a;
                    data2[targetOffset + 6] += data[offset + 2] * rightFactor * yFactor * a;
                    data2[targetOffset + 7] += data[offset + 3] * rightFactor * yFactor;

                    // if we left out the color of invisible pixels(fully or partly)
                    // the entire average we end up with will no longer be out of 255
                    // so we subtract the percentage from the alpha ( originally 1 )
                    // so that we can reverse this effect by dividing by the amount.
                    // ( if one pixel is black and invisible, and the other is white and visible,
                    // the white pixel will weight itself at 50% because it does not know the other pixel is invisible
                    // so the total(color) for the new pixel would be 128(gray), but it should be all white.
                    // the alpha will be the correct 128, combinging alphas, but we need to preserve the color
                    // of the visible pixels )
                    alphas[alphaOffset + 1] -= (1 - a) * rightFactor * yFactor;
                }

                if (extraY) {
                    data2[targetOffset + w2 * 4]     += data[offset] * xFactor * bottomFactor * a;
                    data2[targetOffset + w2 * 4 + 1] += data[offset + 1] * xFactor * bottomFactor * a;
                    data2[targetOffset + w2 * 4 + 2] += data[offset + 2] * xFactor * bottomFactor * a;
                    data2[targetOffset + w2 * 4 + 3] += data[offset + 3] * xFactor * bottomFactor;
                    alphas[alphaOffset + w2] -= (1 - a) * xFactor * bottomFactor;
                }

                if (extraX && extraY) {
                    data2[targetOffset + w2 * 4 + 4]     += data[offset] * rightFactor * bottomFactor * a;
                    data2[targetOffset + w2 * 4 + 5] += data[offset + 1] * rightFactor * bottomFactor * a;
                    data2[targetOffset + w2 * 4 + 6] += data[offset + 2] * rightFactor * bottomFactor * a;
                    data2[targetOffset + w2 * 4 + 7] += data[offset + 3] * rightFactor * bottomFactor;
                    alphas[alphaOffset + w2 + 1] -= (1 - a) * rightFactor * bottomFactor;
                }

                data2[targetOffset]     += data[offset] * xFactor * yFactor * a;
                data2[targetOffset + 1] += data[offset + 1] * xFactor * yFactor * a;
                data2[targetOffset + 2] += data[offset + 2] * xFactor * yFactor * a;
                data2[targetOffset + 3] += data[offset + 3] * xFactor * yFactor;
                alphas[alphaOffset] -= (1 - a) * xFactor * yFactor;
            };

            if (y1++ < h1) {
                // Big images shouldn't block for a long time.
                // This breaks up the process and allows other processes to tick
                setTimeout(function(){
                    nextY(y1)
                }, 0);
            } else
                done();
        }

        var done = function(){
            // fully distribute the color of pixels that are partially full because their neighbor is transparent
            // (i.e. undo the invisible pixels are averaged with visible ones)
            for (var l = (_data2.length >> 2), i = 0; i < l; i++){
                if (alphas[i] && alphas[i] < 1) {
                    data2[(i<<2)] /= alphas[i];     // r
                    data2[(i<<2) + 1] /= alphas[i]; // g
                    data2[(i<<2) + 2] /= alphas[i]; // b
                }
            }

            // re populate the actual imgData
            for (var l = data2.length, i = 0; i < l; i++){
                _data2[i] = Math.round(data2[i]);
            }

            var context = canvas.getContext("2d")
            context.putImageData(img2, 0, 0);
            callback();

        };

        // Start processing the image at row 0
        nextY(0);
    };

    return {
        image: function() {
            return toDataURI.apply(null, arguments);
        },
        favicon: function() {
            return getFaviconDataURI.apply(null, arguments);
        }
    };
});
