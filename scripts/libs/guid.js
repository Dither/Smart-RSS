(function(global){

/**
 * Hashed hex tuplets.
 *
 * @type      {Array}
 */
var tpl = [];
for (var i = 0; i < 256; i++) tpl[i] = (i<16 ? '0' : '') + (i).toString(16);

/**
 * Returns GUID.
 * @return      {string}  GUID
 */
function generateGUID() {
	var dvals = new Uint32Array(4);
	if (window.crypto) {
		window.crypto.getRandomValues(dvals);
	} else {
		dvals[0] = Math.random()*0x100000000>>>0;
		dvals[1] = Math.random()*0x100000000>>>0;
		dvals[2] = Math.random()*0x100000000>>>0;
		dvals[3] = Math.random()*0x100000000>>>0;
	}
	var d0 = dvals[0];
	var d1 = dvals[1];
	var d2 = dvals[2];
	var d3 = dvals[3];
	return	tpl[d0&0xff]+tpl[d0>>8&0xff]+tpl[d0>>16&0xff]+tpl[d0>>24&0xff]+'-'+
			tpl[d1&0xff]+tpl[d1>>8&0xff]+'-'+tpl[d1>>16&0x0f|0x40]+tpl[d1>>24&0xff]+'-'+
			tpl[d2&0x3f|0x80]+tpl[d2>>8&0xff]+'-'+tpl[d2>>16&0xff]+tpl[d2>>24&0xff]+
			tpl[d3&0xff]+tpl[d3>>8&0xff]+tpl[d3>>16&0xff]+tpl[d3>>24&0xff];
}

if (typeof module !== 'undefined' && 'exports' in module) module.exports = generateGUID;
else {
	if (typeof define === 'function' && define.amd) define('guid', function(){ return generateGUID; });
	global.guid = generateGUID;
}

})(typeof window === 'object' ? window : this);
