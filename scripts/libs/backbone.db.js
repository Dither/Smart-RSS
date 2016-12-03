/**
 * Backbone IndexedDB and storage.local/storage.sync adapter.
 *
 * Version 1.0.0
 */

(function(root, factory) {
	if (typeof exports === 'object' && root.require) {
		module.exports = factory(require('underscore'), require('backbone'));
	} else if (typeof define === 'function' && define.amd) {
		define(['underscore', 'backbone'], function(_, Backbone) {
			return factory((_ || root._), (Backbone || root.Backbone));
		});
	} else {
		factory(_, Backbone);
	}
}(this, function(_, Backbone) {

/**
 * Do nothing
 */
function nothing() {}

/**
 * Database general failure handler.
 *
 * @param      {Error}  e Error object
 */
function failure(e) {
	throw "[Backbone.db] IndexedDB Error: Can't read from or write to database. " + JSON.stringify(e);
}

/**
 * Class for IndexedDB access.
 *
 * @class      IndexedStorage
 * @param      {string}  name    Database key name
 * @param      {string}  keypath   Property of index
 * @param      {string}  type    Database type 'indexed'
 */
function IndexedStorage(name, keypath, type, version, upgradefn) {
	if (!name || !keypath) throw '[IndexedStorage] No parameters for storage.'
	var that = this;
	this.type = type;
	this.ready = false;
    this.idb = new promIDB({
            dbName: 'backbone-indexeddb',
            storeName: name,
            keyPath: keypath,
            dbVersion: version,
            upgradeFn: upgradefn
        });
    this.prom = this.idb.getDB();
    this.prom.then(function() { that.ready = true; });
    this.prom.catch(function(e) { throw '[IndexedStorage] IndexedDB failed us: ' + e.name; });
};

_.extend(IndexedStorage.prototype, {
	/**
	 * Integer database versions ups on any breaking change.
	 *
	 * @type      {Number}
	 */
	version: 4,

	/**
	 * Creates a record.
	 *
	 * @param  {Backbone.Model}  model   The model
	 * @param        {Function}  cb      Callback
	 */
	create: function(model, cb) {
		if (!model.id) {
			model.id = guid();
			model.set(model.idAttribute, model.id);
		}
		return this.idb.add(undefined, model.toJSON()).then(cb, failure);
	},

	/**
	 * Updates a record.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 */
	update: function(model, cb) {
		return this.idb.update(undefined, model.toJSON()).then(cb, failure);
	},

	/**
	 * Searches for the first record.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 */
	find: function(model, cb) {
		return this.idb.get(model.id).then(cb, failure);
	},

	/**
	 * Searches for all records.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 */
	findAll: function(cb) {
		return this.idb.values().then(cb, failure);
	},

	/**
	 * Delete the record.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 * @return     {Backbone.Model}    The model
	 */
	destroy: function(model, cb) {
		if (model.isNew()) return;
		return this.idb.delete(model.id).then(cb, failure);
	},

	/**
	 * Clear storage.
	 *
	 * @param      {Function}  cb      Callback
	 */
	_clear: function(cb) {
		return this.idb.clear().then(cb, cb);
	},

	/**
	 * Get storage size.
	 *
	 * @param      {Function}  cb      Callback
	 */
	_storageSize: function(cb) {
		return this.idb.count().then(cb);
	}
});


/**
 * Asynchronious wrapper for storage.[local|sync] access.
 *
 * @class      Wrapper
 * @param      {string}  type    Specifies 'local' or 'sync' storage.
 */
function Wrapper(type) {
	if (typeof type !== 'string' || !browser.storage[type]) {
		console.warn('[BrowserStorage] Unknown type %s, defaulting to local', type);
		type = 'local';
	}

	this.type = type;
	this.storage = browser.storage[this.type];
}

//
// Create structs a response.
//
// @param      {Deferred}  dfd     The deferred function
// @return     {Function}          Function to call
//
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

//
// Wrapper for methods of storage.[local|sync].
//
// @param      {Function}  method  Methods of storage.[local|sync]
// @return     {Function}          Function to call
//
function wrapMethod(method) {
	return function(cb) {
		var dfd = $.Deferred();
		if (typeof cb === 'function') dfd.done(cb);
		this.storage[method](csResponse(dfd));
		return dfd.promise();
	};
}

//
// Wrapper for accessors of storage.[local|sync].
//
// @param      {Function}  method  Methods of storage.[local|sync]
// @return     {Function}          Function to call
//
function wrapAccessor(method) {
	return function(items, cb) {
		var dfd = $.Deferred();
		if (typeof cb === 'function') dfd.done(cb);
		this.storage[method](items, csResponse(dfd));
		return dfd.promise();
	};
}

_.extend(Wrapper.prototype, {
	getBytesInUse: wrapMethod('getBytesInUse'),
	clear: wrapMethod('clear'),
	get: wrapAccessor('get'),
	set: wrapAccessor('set'),
	remove: wrapAccessor('remove'),
	getQuotaObject: function() {
		return _(this.storage).pick(
			'QUOTA_BYTES',
			'QUOTA_BYTES_PER_ITEM',
			'MAX_ITEMS',
			'MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE',
			'MAX_WRITE_OPERATIONS_PER_HOUR');
	}
});


/**
 * Class for browser.storage access.
 *
 * @class      BrowserStorage
 * @param      {string}  name    Database key name
 * @param      {string}  keypath   Property of index
 * @param      {string}  type    Database type 'sync' or 'local'
 */
 function BrowserStorage(name, keypath, type) {
	_.bindAll.apply(_, [this].concat(_.functions(this)));

	if (!name || !keypath) throw '[BrowserStorage] No parameters for storage.'
	this.name = name;
	this.kpath = keypath;
	this.type = BrowserStorage.defaultType;
	if (typeof type !== 'undefined')
		this.type = (type === 'sync') ? type : 'local';
	this.store = new Wrapper(this.type);

	var that = this;
	this.store.get(this.name).then(function(data){
		if (Object.keys(data).length > 0 || data.constructor !== Object) return;
		var obj = {};
		obj[that.name] = {};
		return that.store.set(obj);
	});
}

BrowserStorage.Wrapper = Wrapper;

_.extend(BrowserStorage.prototype, {

	/**
	 * Default storage type.
	 *
	 * @type      {string} [sync|local]
	 */
	defaultType: 'local',

	/**
	 * Creates entry
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}    Promise of the operation
	 */
	create: function(model, cb) {
		if (!model.id) {
			model.id = guid();
			model.set(model.idAttribute, model.id);
		}
		return this.update(model, cb);
	},

	/**
	 * Updates entry
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}    Promise of the operation
	 */
	update: function(model, cb) {
		var that = this;
		return this.store.get(that.name).then(function(data){
			var id = model.id;
			data[that.name][id] = model.toJSON();
			delete (data[that.name][id])[that.kpath]; // perserve storage space
			return that.store.set(data, cb);
		});
	},

	/**
	 * Searches for the first match.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}    Promise of the operation
	 */
	find: function(model, cb) {
		var that = this;
		return this.store.get(that.name).then(function(data){
			var id = model.id;
			if (!data[that.name] || !id || !data[that.name][id]) return cb([]);
			var stored_model = data[that.name][id];
			stored_model[that.kpath] = id;
			return cb(stored_model); // Array or value here?
		});
	},

	/**
	 * Searches for all matches.
	 *
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}    Promise of the operation
	 */
	findAll: function(cb) {
		var that = this;
		return this.store.get(that.name).then(function(data){
			if (Object.keys(data).length === 0 || !data[that.name]) return cb([]);
			var items = Object.keys(data[that.name]).map(function(val){
				var stored_model = data[that.name][val];
				stored_model[that.kpath] = val;
				return stored_model;
			});
			return cb(items);
		});
	},

	/**
	 * Destroys entry by model.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}   Promise of the operation
	 */
	destroy: function(model, cb) {
		var that = this;
		if (model.isNew()) return;
		return this.store.get(this.name).then(function(data){
			delete data[that.name][model.id];
			return that.store.set(data, cb);
		});
	},

	/**
	 * Destroys all entries.
	 *
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}    Promise of the operation
	 */
	destroyAll: function(cb) {
		return this.store.remove(cb);
	},

	/**
	 * Clears storage.
	 *
	 * @param      {Function}  cb      Callback
	 * @return     {Promise}    Promise of the operation
	 */
	_clear: function(cb) {
		return this.store.clear(cb);
	},

	/**
	 * Gets storage size.
	 *
	 * @param      {Function}  cb      Callback
	 * @return     {Backbone.Model}    Promise of the operation
	 */
	_storageSize: function(cb) {
		if (this.store.getBytesInUse) return this.store.getBytesInUse(null, cb);
		return this.store.get().then(function (results) {
			var size = 0;
			for (var i in results) { size += (i + JSON.stringify(results[i])).length; };
			return cb(parseInt(size * 1.5, 10));
		});
	}
});

/**
 * Handles the operation's result.
 *
 * @param      {Object}  options       The options
 * @param      {Object}  resp          The resp
 * @param      {Object}  errorMessage  The error message
 */
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

/**
 * Selects asynchronious action and executes it.
 *
 * @param      {string}  method   Type of operation
 * @param      {Backbone.Model}    model    The model
 * @param      {Object}    options  The options
 * @param      {IndexedStorage|IndexedStorage}    store    The storage type class
 */
function switchAction(method, model, options, store) {
	var errorMessage,
		cbh = callbackHandler.bind(this, options);
	try {
		switch (method) {
			case 'read':
				!!model.id ? store.find(model, cbh) : store.findAll(cbh);
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
	} catch (error) {
		if (error.code === 22) errorMessage = 'Private Browsing is unsupported!';
		else errorMessage = error.message;

		console.log('Storage error: ' + errorMessage);
		cbh(null, errorMessage);
	}
}

Backbone.ajaxSync = Backbone.sync;

/**
 * Gets synchronization method.
 *
 * @param      {string}  method   Type of operation
 * @param      {Backbone.Model}    model    The model
 * @param      {Object}    options The options
 * @return     {Function}          Synchronization method
 */
Backbone.sync = function(method, model, options) {
	var that = this,
		store = (model.storage || model.collection.storage).current;
	options = options || {};
	var syncDfd = options.syncDfd || (Backbone.$.Deferred && Backbone.$.Deferred()); // If $ is having Deferred - use it.
	options.syncDfd = syncDfd;

	switch (store.type) {
		case 'local':
		case 'sync':
			switchAction(method, model, options, store);
			break;
		case 'indexed':
			if (store.ready)
				switchAction(method, model, options, store);
			else
				syncDfd = syncDfd.always(store.prom.then(function() {
					switchAction(method, model, options, store);
				}));
			break;
		default:
			return;//Backbone.ajaxSync(method, model, options);
	}

	return syncDfd && syncDfd.promise();
};


Backbone.CustomStorage = function(name, keypath, type) {
	this.current = null;
	switch (type) {
		case 'local':
		case 'sync':
			this.current = new BrowserStorage(name, keypath, type);
			break;
		case 'indexed':
			this.current = new IndexedStorage(name, keypath, type, Backbone.CustomStorage.version, Backbone.CustomStorage.prepare);
			break;
		default:
	}
};

return Backbone.CustomStorage;
}));
