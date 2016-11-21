/**
 * Backbone indexDB and storage.[local|sync] adapter.
 * Based on localStorage adapter from jeromegn: https://github.com/jeromegn/Backbone.localStorage
 *
 * Version 1.2.0
 */
(function(root, factory) {
	if (typeof exports === 'object' && root.require) {
		module.exports = factory(require('underscore'), require('backbone'));
	} else if (typeof define === 'function' && define.amd) {
		// AMD. Register as an anonymous module.
		define(['underscore', 'backbone'], function(_, Backbone) {
			// Use global variables if the locals are undefined.
			return factory(_ || root._, Backbone || root.Backbone);
		});
	} else {
		// RequireJS isn't being used. Assume underscore and backbone are loaded in <script> tags
		factory(_, Backbone);
	}
}(this, function(_, Backbone) {
// A simple module to replace `Backbone.sync` with *localStorage*-based
// persistence. Models are given GUIDS, and saved into a JSON object. Simple
// as that.

// Get rid off browser prefixes
window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;


// Hold reference to Underscore.js and Backbone.js in the closure in order
// to make things work even if they are removed from the global namespace

var lut = [];
for (var i=0; i<256; i++) {
	lut[i] = (i<16?'0':'')+(i).toString(16);
}

// Generate a pseudo-GUID by concatenating random hexadecimal.
function guid() {
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
	return	lut[d0&0xff]+lut[d0>>8&0xff]+lut[d0>>16&0xff]+lut[d0>>24&0xff]+'-'+
			lut[d1&0xff]+lut[d1>>8&0xff]+'-'+lut[d1>>16&0x0f|0x40]+lut[d1>>24&0xff]+'-'+
			lut[d2&0x3f|0x80]+lut[d2>>8&0xff]+'-'+lut[d2>>16&0xff]+lut[d2>>24&0xff]+
			lut[d3&0xff]+lut[d3>>8&0xff]+lut[d3>>16&0xff]+lut[d3>>24&0xff];
}

// Our Store is represented by a single JS object in *localStorage*. Create it
// with a meaningful name, like the name you'd give a table.
// window.Store is deprectated, use Backbone.LocalStorage instead
Backbone.LocalStorage = function(name) {
	if (!window.indexedDB) {
		throw 'Backbone.indexedDB: Environment does not support IndexedDB.';
	}
	_.bindAll.apply(_, [this].concat(_.functions(this)));

	this.name = name;
	this.db = null;
	var request = window.indexedDB.open('backbone-indexeddb', Backbone.LocalStorage.version);
	this.dbRequest = request;
	var that = this;

	request.addEventListener('error', function(e) {
		throw 'Error code: ' + this.errorCode; // user probably disallowed idb
	});

	request.addEventListener('success', function(e) {
		that.db = this.result;
	});

	request.addEventListener('upgradeneeded', function(e) {
		var db = this.result;
		Backbone.LocalStorage.prepare(db);
	});
};

_.extend(Backbone.LocalStorage.prototype, {
    version: 4,

	// Add a model, giving it a (hopefully)-unique GUID, if it doesn't already
	// have an id of it's own.
	create: function(model, cb) {
		if (!model.id) {
			model.id = guid();
			model.set(model.idAttribute, model.id);
		}
		this.localStorage().add(model.toJSON());
	},

	update: function(model, cb) {
		var req = this.localStorage().put(model.toJSON());
	},

	find: function(model, cb) {
		var request = this.localStorage().get(model.id);
		request.onsuccess = function() {
			cb(this.result);
		}
		request.onerror = function() {
			throw 'IndexDB Error: Can\'t read from or write to database';
		}
	},

	// Return the array of all models currently in storage.
	findAll: function(cb) {
		var items = [];
		this.localStorage('readonly').openCursor().onsuccess = function(event) {
			var cursor = this.result;
			if (cursor) {
				items.push(cursor.value);
				cursor.continue();
			} else {
				cb(items);
			}
		};
	},

	// Delete a model from `this.data`, returning it.
	destroy: function(model, cb) {
		if (model.isNew())
			return false
		this.localStorage().delete(model.id);
		//cb(model);
		return model;
	},

	localStorage: (function() {
		var tx;

		window.addEventListener('message', function(e) {
			if (e.data.action == 'clear-tx') tx = null;
		});

		return function(type) {
			if (tx && !type) {
				try {
					var tmpStore = tx.objectStore(this.name);
					// neccesary to trigger error with <1ms async calls
					tmpStore.get(-1);
					return tmpStore;
				} catch(e) {}
			}

			var names = [].map.call(this.db.objectStoreNames, function(item) { return item });
			var tmpTx = this.db.transaction(names, type || 'readwrite');

			var tmpStore = tmpTx.objectStore(this.name);
			if (!type) {
				tx = tmpTx;
				window.postMessage({ action: 'clear-tx' }, '*'); // setImmidiate polyfill , doesn't work very wll tho.
			}

			return tmpStore;
		}
	})(),

	// Clear localStorage for specific collection.
	_clear: function(cb) {
		var req = this.localStorage().clear();
		req.onsuccess = cb;
		req.onerror = cb;
	},

	// Size of localStorage.
	_storageSize: function(cb) {
		this.localStorage().count().onsuccess = cb;
	}

});

// #BrowserStorage.Wrapper

// A wrapper around the `browser.storage.*` API that uses
// `$.Deferred` objects for greater flexibility.
function Wrapper(type) {
	if (typeof type !== 'string' || !browser.storage[type]) {
		console.warn('[BrowserStorage] Unknown type %s, defaulting to local', type);
		type = 'local';
	}

	this.type = type;
	this.storage = browser.storage[this.type];
}

// ## csResponse
//
// Private helper function that's used to return a callback to
// wrapped `browser.storage.*` methods.
//
// It will **resolve** the provided `$.Deferred` object
// with the response, or **reject** it if there was an
// error.
function csResponse(dfd) {
	return function() {
		var err = browser.runtime.lastError;
		if (!err) dfd.resolve.apply(dfd, arguments);
		else {
			console.warn("[BrowserStorage] error: '%s'", err.message);
			dfd.reject(dfd, err.message, err);
		}
	};
}

// ## browser.storage.* API
// Private factory functions for wrapping API methods

// ### wrapMethod
//
// For wrapping **clear** and **getBytesInUse**
function wrapMethod(method) {
	return function(cb) {
		var dfd = $.Deferred();
		if (typeof cb === 'function') dfd.done(cb);
		this.storage[method](csResponse(dfd));
		return dfd.promise();
	};
}

// ### wrapAccessor
//
// For wrapping **get**, **set**, and **remove**.
function wrapAccessor(method) {
	return function(items, cb) {
		var dfd = $.Deferred();
		if (typeof cb === 'function') dfd.done(cb);
		this.storage[method](items, csResponse(dfd));
		return dfd.promise();
	};
}

// The `Wrapper` prototype has the same methods as the `browser.storage.*` API,
// accepting the same parameters, except that they return `$.Deferred` promise
// and the callback is always optional. If one is provided, it will be added as a
// **done** callback.
_.extend(Wrapper.prototype, {
	getBytesInUse: wrapMethod('getBytesInUse'),
	clear: wrapMethod('clear'),
	get: wrapAccessor('get'),
	set: wrapAccessor('set'),
	remove: wrapAccessor('remove'),
	// Pick out the relevant properties from the storage API.
	getQuotaObject: function() {
		return _(this.storage).pick(
			'QUOTA_BYTES',
			'QUOTA_BYTES_PER_ITEM',
			'MAX_ITEMS',
			'MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE',
			'MAX_WRITE_OPERATIONS_PER_HOUR');
	}
});

Backbone.BrowserStorage = function(name, type) {
	_.bindAll.apply(_, [this].concat(_.functions(this)));

	var that = this;
	this.name = name;
	this.type = type || Backbone.BrowserStorage.defaultType || 'sync';
	this.store = new Wrapper(that.type);

	//browser.storage.onChanged.addListener(that.updateRecords.bind(that));
	this.store.get(that.name).then(function(data){
		if (Object.keys(data).length > 0 || data.constructor !== Object) return;
		var obj = {};
		obj[that.name] = {};
		return that.store.set(obj);
	});
}

Backbone.BrowserStorage.Wrapper = Wrapper;

_.extend(Backbone.BrowserStorage.prototype, {

	// Add a model, giving it a (hopefully)-unique GUID, if it doesn't already
	// have an id of it's own.
	create: function(model, cb) {
		var that = this;
		if (!model.id) {
			model.id = guid();
			model.set(model.idAttribute, model.id);
		}
		return this.update(model, cb);
	},

	// Update a model by replacing its copy in `this.data`.
	update: function(model, cb) {
		var that = this;
		return this.store.get(that.name).then(function(data){
			data[that.name][model.id] = model.toJSON();
			return that.store.set(data, cb);
		});
	},

	// Retrieve a model from `this.data` by id.
	find: function(model, cb) {
		var that = this;
		return this.store.get(that.name).then(function(data){
			if (!data[that.name] || !data[that.name][model.id]) return cb([]);
			return cb(data[that.name][model.id]);
		});
	},

	// Return the array of all models currently in storage.
	findAll: function(cb) {
		var that = this;
		return this.store.get(that.name).then(function(data){
			if (!data[that.name] || !data[that.name]) return cb([]);
			var items = Object.keys(data[that.name]).map(function(val){ return data[that.name][val]; });
			return cb(items);
		});
	},

	// Delete a model from `this.data`, returning it.
	destroy: function(model, cb) {
		var that = this;
		if (model.isNew()) return false;
		that.store.get(that.name).then(function(data){
			delete data[that.name][model.id];
			return that.store.set(data, cb);
		});
		return true;
	},

	destroyAll: function(cb) {
		return this.store.remove(this.name, cb);
	},

	// Clear localStorage for specific collection.
	_clear: function(cb) {
		return this.store.clear(cb);
	},

	// Size of localStorage.
	_storageSize: function(cb) {
		return this.store.getBytesInUse(null, cb);
	}
});


function nothing() {}

function callbackHandler(options, resp, errorMessage) {
	var syncDfd = options.syncDfd;
	if (resp) {
		if (options && options.success) {
			if (Backbone.VERSION === '0.9.10') options.success(model, resp, options);
			else options.success(resp);
		}
		if (syncDfd) syncDfd.resolve(resp);

	} else {
		errorMessage = errorMessage ? errorMessage : 'Record Not Found';

		if (options && options.error) {
			if (Backbone.VERSION === '0.9.10') options.error(model, errorMessage, options);
			else options.error(errorMessage);
		}

		if (syncDfd) syncDfd.reject(errorMessage);
	}

	if (options && options.complete) options.complete(resp);
}

function switchAction(method, model, options, store) {
	var errorMessage, cbh = callbackHandler.bind(this, options);
	//try {
		switch (method) {
			case 'read':
				model.id != undefined ? store.find(model, cbh) : store.findAll(cbh);
				//cbh(model.toJSON());
				break;
			case 'create':
				store.create(model, nothing);
				cbh(model.toJSON());
				break;
			case 'update':
				store.update(model, nothing);
				cbh(model.toJSON());
				break;
			case 'delete':
				store.destroy(model, nothing);
				cbh(model.toJSON());
				break;
		}
	/*} catch (error) {
		if (error.code === 22) errorMessage = 'Private Browsing is unsupported!';
		else errorMessage = error.message;

		console.log('ERR: ' + errorMessage);
		cbh(null, errorMessage);
	}*/
}

// localSync delegate to the model or collection's
// *localStorage* property, which should be an instance of `Store`.
// window.Store.sync and Backbone.localSync is deprecated, use Backbone.LocalStorage.sync instead
Backbone.LocalStorage.sync = Backbone.localSync = function(method, model, options) {
	var that = this;
	var store = model.localStorage || model.collection.localStorage;
	options = options || {};
	var syncDfd = options.syncDfd || (Backbone.$.Deferred && Backbone.$.Deferred()); //If $ is having Deferred - use it.
	options.syncDfd = syncDfd;

	if (!store.db) {
		store.dbRequest.addEventListener('success', function(e) {
			store.db = this.result;
			Backbone.LocalStorage.sync.call(that, method, model, options);
		});
	} else {
		switchAction(method, model, options, store);
	}
	return syncDfd && syncDfd.promise();
};

// localSync delegate to the model or collection's
// *localStorage* property, which should be an instance of `Store`.
// window.Store.sync and Backbone.localSync is deprecated, use Backbone.LocalStorage.sync instead
Backbone.BrowserStorage.sync = Backbone.browserSync = function(method, model, options) {
	var that = this;
	var store = model.browserStorage || model.collection.browserStorage;
	options = options || {};
	var errorMessage, syncDfd = options.syncDfd || (Backbone.$.Deferred && Backbone.$.Deferred()); //If $ is having Deferred - use it.
	options.syncDfd = syncDfd;
	switchAction(method, model, options, store);
	return syncDfd && syncDfd.promise();
};

Backbone.ajaxSync = Backbone.sync;

Backbone.getSyncMethod = function(model) {
	if (model.browserStorage || (model.collection && model.collection.browserStorage))
		return Backbone.browserSync;
	else if (model.localStorage || (model.collection && model.collection.localStorage))
		return Backbone.localSync;
	return Backbone.ajaxSync;
};

// Override 'Backbone.sync' to default to localSync,
// the original 'Backbone.sync' is still available in 'Backbone.ajaxSync'
Backbone.sync = function(method, model, options) {
	return Backbone.getSyncMethod(model).apply(this, [method, model, options]);
};

}));
