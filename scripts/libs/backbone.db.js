/**
 * Backbone IndexedDB and storage.local/storage.sync adapter.
 *
 * Version 1.0.0
 */

// ===================================================================================

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

// ===================================================================================

/**
 * Class for IndexedDB access.
 *
 * @class      IndexedStorage
 * @param      {string}  name    Database key name
 * @param      {string}  keypath   Property of index
 * @param      {string}  type    Database type 'indexed'
 */
function IndexedStorage(name, keypath, type, version, upgradefn) {
	if (!name || !keypath) throw '[IndexedStorage] No parameters for indexed storage.';
	var that = this;
	this.name = name;
	this.type = type;
	this.idb = new promIDB({
			dbName: 'backbone-indexeddb',
			storeName: name,
			keyPath: keypath,
			dbVersion: version,
			upgradeFn: upgradefn
		});
	this.prom = this.idb.getDB();
	this.ready = false;
	this.prom.then(function() { that.ready = true; });
	this.prom.catch(function(e) { throw '[IndexedStorage] IndexedDB failed us: ' + e; });
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
	 * @return {Promise}         Promise of the operation
	 */
	create: function(model) {
		if (!model.id) {
			model.id = guid();
			model.set(model.idAttribute, model.id);
		}
		return this.idb.add(model.toJSON());
	},

	/**
	 * Updates a record.
	 *
	 * @param  {Backbone.Model}    model   The model
	 * @return {Promise}         Promise of the operation
	 */
	update: function(model) {
		return this.idb.update(model.toJSON());
	},

	/**
	 * Coalesces all record updates or deletes
	 *   before 500ms pause to avoid Chromium limits.
	 *
	 * @param  {Backbone.Model}    model   The model
	 * @return {Promise}   Promise of the operation
	 */
	throttle: function(model) {
		return this.idb.throttle(model.id, model.toJSON());
	},

	/**
	 * Searches for the first record.
	 *
	 * @param  {Backbone.Model}  model   The model
	 * @return {Promise}         Promise of the operation
	 */
	find: function(model) {
		return this.idb.get(model.id);
	},

	/**
	 * Searches for all records.
	 *
	 * @param  {Backbone.Model}  model   The model
	 * @return {Promise}         Promise of the operation
	 */
	findAll: function() {
		return this.idb.values();
	},

	/**
	 * Delete the record.
	 *
	 * @param  {Backbone.Model}  model   The model
	 * @return {Promise}         Promise of the operation
	 */
	destroy: function(model) {
		if (model.isNew()) return Promise.resolve();
		return this.idb.destroy(model.id);
	},

	/**
	 * Clear storage.
	 * @return {Promise}         Promise of the operation
	 */
	_clear: function() {
		return this.idb.clear();
	},

	/**
	 * Get storage size.
	 * @return {Promise}         Promise of the operation
	 */
	_storageSize: function() {
		return this.idb.count();
	}
});


// ===================================================================================


/**
 * Promise wrapper for storage.[local|sync] access.
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
// Creates responder for a Promise.
//
// @param      {Function} resolve  Promise resolver
// @param      {Function} reject   Promise rejector
// @return     {Function}          Responder function
//
function makeResponder(resolve, reject) {
	return function() {
		var err = browser.runtime.lastError;
		if (!err) return resolve.apply(null, arguments);
		else {
			console.warn("[BrowserStorage] error: '%s'", err.message);
			return reject(err.message || err);
		}
	};
}

//
// Wrapper for methods of storage.[local|sync].
//
// @param      {Function}  method  Methods of storage.[local|sync]
// @return     {Function}          Storage method wrapper function
//
function wrapMethod(method) {
	return function() {
		var that = this;
		return new Promise(function(resolve, reject) {
			return that.storage[method](makeResponder(resolve, reject));
		});
	};
}

//
// Wrapper for accessors of storage.[local|sync].
//
// @param      {Function}  method  Accessors of storage.[local|sync]
// @return     {Function}          Storage accessor wrapper function
//
function wrapAccessor(method) {
	return function(items) {
		var that = this;
		return new Promise(function(resolve, reject) {
			return that.storage[method](items, makeResponder(resolve, reject));
		});
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


// ===================================================================================


/**
 * Class for browser.storage access.
 *
 * @class      BrowserStorage
 * @param      {string}  name    Database key name
 * @param      {string}  keypath   Property of index
 * @param      {string}  type    Database type 'sync' or 'local'
 */
 function BrowserStorage(name, keypath, type) {
	if (!name || !keypath) throw '[BrowserStorage] No parameters for browser storage.';
	_.bindAll.apply(_, [this].concat(_.functions(this)));

	this.name = name;
	this.kpath = keypath;
	this.type = BrowserStorage.defaultType;
	if (typeof type !== 'undefined') this.type = (type === 'sync') ? type : 'local';
	this.store = new Wrapper(this.type);

	this._cache = {};
	this._timeout = 0;

	var that = this;
	this.prom = this.store.get(this.name).then(function(data) {
		if (data && (Object.keys(data).length > 0 || data.constructor !== Object)) return;
		var obj = {};
		obj[that.name] = {};
		return that.store.set(obj);
	});
	this.ready = false;
	this.prom.then(function() { that.ready = true; });
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
	 * @param   {Backbone.Model}    model   The model
	 * @return  {Promise}    Promise of the operation
	 */
	create: function(model) {
		if (!model.id) {
			model.id = guid();
			model.set(model.idAttribute, model.id);
		}
		return this.update(model);
	},

	/**
	 * Updates entry
	 *
	 * @param   {Backbone.Model}    model   The model
	 * @return  {Promise}    Promise of the operation
	 */
	update: function(model) {
		var that = this, id = model.id;
		if (this._cache[id]) delete this._cache[id];
		return this.store.get(that.name).then(function(data) {
			data[that.name][id] = model.toJSON();
			delete (data[that.name][id])[that.kpath]; // preserve storage space
			return that.store.set(data);
		});
	},

	/**
	 * Searches for the first match.
	 *
	 * @param   {Backbone.Model}    model   The model
	 * @return  {Promise}   Promise of the operation
	 */
	find: function(model) {
		var that = this;
		if (this._cache[model.id]) return Promise.resolve(this._cache[model.id]);
		return this.store.get(that.name).then(function(data){
			var id = model.id;
			if (!data[that.name] || !id || !data[that.name][id]) return null; //{};
			var stored_model = data[that.name][id];
			stored_model[that.kpath] = id;
			return stored_model;
		});
	},

	/**
	 * Searches for all matches.
	 *
	 * @return  {Promise}   Promise of the operation
	 */
	findAll: function() {
		var that = this;
		return this.store.get(that.name).then(function(data){
			if (Object.keys(data).length === 0 || !data[that.name]) return [];
			var items = Object.keys(data[that.name]).map(function(val){
				var stored_model = data[that.name][val];
				if (that._cache[val]) {
					stored_model = that._cache[val];
					delete that._cache[val];
				} else {
					stored_model[that.kpath] = val;
				}
				return stored_model;
			});
			return items.concat(Object.keys(that._cache).map(function (key) { return that._cache[key]; }));
		});
	},

	/**
	 * Coalesces all record updates or deletes before first 200ms pause.
	 *
	 * @param   {Backbone.Model}    model   The model
	 * @return {Promise}   Promise of the operation
	 */
	throttle: function(model) {
		this._cache[model.id] = model.toJSON();
		var that = this;
		return new Promise(function(resolve, reject) {
			clearTimeout(that._timeout);
			// collect requests
			that._timeout = setTimeout(function() {
				that.many.bind(that)(null, resolve, reject);
			}, 200);
			// NOTE: GC probably will do the job
			/*setTimeout(function() {
				// don't keep the promise hanging giving "that.many()" around
				// (500 + Object.keys(this._cache).length * 50) ms to response
				resolve();
			}, 500 + Object.keys(this._cache).length * 50);*/
		});
	},

	/**
	 * Does multiple record updates or deletes at once.
	 *
	 * @param  {Object}    items   Object of models to add [optional, _cache is used by default]
	 *
	 * @note   Models can be:
	 *             {id1: value1; id2: value2, ...} <- add those
	 *             {id7: null, id8: null, ...} <- delete those
	 *
	 * @param  {Function}  resolve  Resolver function
	 * @param  {Function}  reject   Rejector function
	 * @return {Promise}   Promise of the operation
	 */
	many: function(items, resolve, reject) {
		var that = this;
		return this.store.get(that.name).then(function(data) {
			if (!items) {
				items = that._cache;
				that._cache = {};
				that._timeout = null;
			};

			if (typeof items !== 'object')
				return reject ? reject() : Promise.reject(new Error('wrong parameter type'));

			var keys = Object.keys(items),
				current = keys.length;

			// in case this.many used by itself we will return Promise
			if (!current) return resolve ? resolve() : Promise.resolve();

			while (current-- > 0) {
				var key = keys[current],
					value = items[key];

				if (!value) delete data[that.name][key];
				else data[that.name][key] = value;
			}
			var p = that.store.set(data);
			p.then(
				function() { if(resolve) resolve(); },
				function(e) { if(reject) reject(e); }
			);
			return p;
		});
	},

	/**
	 * Destroys entry by model.
	 *
	 * @param      {Backbone.Model}    model   The model
	 * @return     {Promise}   Promise of the operation
	 */
	destroy: function(model) {
		var that = this;
		if (this._cache[model.id]) delete this._cache[model.id];
		if (model.isNew()) return Promise.resolve();
		return this.store.get(this.name).then(function(data) {
			delete data[that.name][model.id];
			return that.store.set(data);
		});
	},

	/**
	 * Clears storage.
	 *
	 * @return     {Promise}    Promise of the operation
	 */
	_clear: function() {
		this._cache = {};
		return this.store.clear();
	},

	/**
	 * Gets storage size.
	 *
	 * @return     {Backbone.Model}    Promise of the operation
	 */
	_storageSize: function() {
		var that = this;
		if (this.store.getBytesInUse) return this.store.getBytesInUse(null);
		return this.store.get().then(function (results) {
			var size = 0;
			for (var i in results) { size += (i + JSON.stringify(results[i])).length; };
			return parseInt((Object.keys(that._cache).length + size) * 1.5, 10);
		});
	}
});


// ===================================================================================


/**
 * Handles the operation's result.
 *
 * @param      {Object}  options       The options
 * @param      {Object}  resp          The resp
 * @param      {Object}  errorMessage  The error message
 */
function callbackHandler(options, resp, errorMessage) {
	var syncDfd = options.syncDfd;
	//console.log('[backbone.db] Response', resp);
	if (resp) {
		if (options && options.success) options.success(resp);
		if (syncDfd) syncDfd.resolve(resp);

	} else {
		errorMessage = errorMessage ? errorMessage : '[backbone.db] Record not found';
		if (options && options.error) options.error(errorMessage);
		if (syncDfd) syncDfd.reject(errorMessage);
	}

	if (options && options.complete) options.complete(resp);
}

/**
 * Selects asynchronous action and executes it.
 *
 * @param      {string}  action   Type of operation
 * @param      {Backbone.Model}    model    The model
 * @param      {Object}    options  The options
 * @param      {IndexedStorage|IndexedStorage}    store    The storage type class
 */
function switchAction(action, model, options, store) {
	var cbh = callbackHandler.bind(this, options);

	//console.log('[backbone.db] In store', store.name, action, 'model', model.toJSON());
	switch (action) {
		case 'read':
			store.prom = store.prom.then(function() {
				var p = (!!model.id ? store.find(model) : store.findAll());
				p.then(cbh);
				return p;
			});
			break;
		case 'create':
			store.prom = store.prom.then(function() {
				// wait for add operation to finish because we need new ID of a model
				// after its add operation for some tasks
				var p = store.create(model);
				p.then(
					function() { cbh(model.toJSON()); }
				);
				return p;
			});
			break;
		case 'update':
			store.prom = store.prom.then(function() {
				var p = store.update(model);
				cbh(model.toJSON());
				return p;
			});
			break;
		case 'delete':
			store.prom = store.prom.then(function() {
				var p = store.destroy(model);
				cbh(model.toJSON());
				return p;
			});
			break;
	}

	if (store.prom) {
		store.prom.catch(function(error) {
			var errorMessage;
			if (error.code === 22) errorMessage = '[backbone.db] Private browsing is unsupported!';
			else errorMessage = error.message || error;

			console.log('[CustomStorage] Error: ' + errorMessage);
			cbh(null, errorMessage);
		});
	}
}

Backbone.ajaxSync = Backbone.sync;

/**
 * Gets synchronization action.
 *
 * @param      {string}  action   Type of operation
 * @param      {Backbone.Model}    model    The model
 * @param      {Object}    options The options
 * @return     {Function}          Synchronization action
 */
Backbone.sync = function(action, model, options) {
	var that = this,
		store = (model.storage || model.collection.storage).current;
	options = options || {};
	var syncDfd = options.syncDfd || (Backbone.$.Deferred && Backbone.$.Deferred()); // If $ is having Deferred - use it.
	options.syncDfd = syncDfd;

	switch (store.type) {
		case 'local':
		case 'sync':
		case 'indexed':
			if (store.ready) {
				switchAction(action, model, options, store);
			} else {
				syncDfd = syncDfd.always(store.prom.then(function() {
					switchAction(action, model, options, store);
				}));
			}
			break;
		default:
			return;//Backbone.ajaxSync(action, model, options);
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
