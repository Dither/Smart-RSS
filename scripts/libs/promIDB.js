(function(root) {
	'use strict';

	// Get rid off browser prefixes
    try {
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
	window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
	window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
    } catch(e) {}

	if (!window.indexedDB)
		throw '[promIDB] Environment does not support IndexedDB. Abort! Abort!!!';

	/*
	 	Options:
	 	{
			dbName: database name,
			storeName: object storage name,
			keyPath: index property,
			dbVersion: database version,
			upgradeFn: function upgrade(){ return function upgradeDatabaseVersion(db){ ... }; }
		}
	 */
	function promIDB(options) {
		if (typeof options !== 'object') return Promise.reject('[promIDB] Access not configured!');
		this._store = options.storeName || 'key-value';
		this._timeout = null;
		this._cache = {};
		this._kpath = options.keyPath;
		this._db = new Promise(function(resolve, reject) {
			var openreq = indexedDB.open(options.dbName || 'keyvalue-store', options.dbVersion || 1);

			openreq.onerror = function() {
				reject(openreq.error);
			};

			openreq.onupgradeneeded = function() {
				// Database version upgrade
				var upgrader = null;
				if (typeof options.upgradeFn === 'function') upgrader = options.upgradeFn(openreq.result);
				if (typeof upgrader === 'function') return upgrader(openreq.result);
				//openreq.result.createObjectStore(this._store, (options.keyPath ? { keyPath: options.keyPath } : undefined));
			};

			openreq.onsuccess = function() {
				resolve(openreq.result);
			};
		});
		return this;
	}

	promIDB.prototype = {
		getDB: function() { return this._db },
		withStore: function(type, callback) {
			var that = this;
			return this._db.then(function(db) {
				return new Promise(function(resolve, reject) {
					var transaction = db.transaction(that._store, type || 'readwrite');
					transaction.oncomplete = function() { resolve(); };
					transaction.onerror = function() { reject(transaction.error); };
					callback(transaction.objectStore(that._store));
				});
			});
		},
		add: function(value) {
			//if (this._cache[value[this._kpath]]) delete this._cache[value[this._kpath]];
			return this.withStore('readwrite', function(store) {
				store.add(value);
			});
		},
		update: function(value) {
			if (this._cache[value[this._kpath]]) delete this._cache[value[this._kpath]];
			return this.withStore('readwrite', function(store) {
				store.put(value);
			});
		},
		get: function(key) {
			var req;
			if (this._cache[key]) return Promise.resolve(this._cache[key]);
			return this.withStore('readonly', function(store) {
				req = store.get(key);
			}).then(function() {
				return req.result;
			});
		},
		values: function() {
			var that = this, values = [];
			return this.withStore('readonly', function(store) {
				store.openCursor.call(store).onsuccess = function() {
					if (!this.result) return;
					values.push(this.result.value);
					this.result.continue();
				};
			}).then(function() {
				return values.concat(Object.keys(that._cache).map(function (key) { return that._cache[key]; }));
			});
		},
		destroy: function(key) {
			delete this._cache[key];
			return this.withStore('readwrite', function(store) {
				store.delete(key);
			});
		},
		throttle: function(key, value) {
			this._cache[key || value.id] = value;
			var that = this;
			return new Promise(function(resolve, reject) {
				clearTimeout(that._timeout);
				// collect requsts
				that._timeout = setTimeout(function() {
					that.many.bind(that)(null, resolve, reject);
				}, 100);
			});
		},
		// {key1: value1; key2: value2, ...} <- add those
		// {key2: null, key3: null, ...} <- delete those
		// function returns Promise in any case
		many: function(items, resolve, reject) {
			var that = this;
			return this.withStore('readwrite', function(store) {
				if (!items) {
					items = that._cache;
					that._cache = {};
					that._timeout = null;
				};

				if (typeof items !== 'object')
					return reject ? reject() : Promise.reject(new Error('wrong parameter type'));

				var keys = Object.keys(items),
					current = keys.length;

				if (!current) return resolve ? resolve() : Promise.resolve();

				iterator();
				function iterator() {
					if (current-- <= 0) return resolve ? resolve() : undefined;

					var key = keys[current],
						value = items[key],
						req = null;

					if (!value) req = store.delete(key);
					else req = store.put(value);

					req.onerror = function() { if (reject) reject(req.error); };
					req.onsuccess = iterator;
				}
			});
		},
		count: function(key) {
			var that = this, req;
			return this.withStore('readonly', function(store) {
				req = store.count(key);
			}).then(function() {
				return req.result + Object.keys(that._cache).length;
			});
		},
		clear: function() {
			this._cache = {};
			return this.withStore('readwrite', function(store) {
				store.clear();
			});
		}
	};

	if (typeof module != 'undefined' && module.exports) {
		module.exports = promIDB;
	} else if (typeof define === 'function' && define.amd) {
		define('promIDB', function(){ return promIDB; });
		root.promIDB = promIDB;
	}

	return promIDB;
}(this));
