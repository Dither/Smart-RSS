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
		this.store_name = options.storeName || 'key-value';
		this.db = new Promise(function(resolve, reject) {
			var openreq = indexedDB.open(options.dbName || 'keyvalue-store', options.dbVersion || 1);

			openreq.onerror = function() {
				reject(openreq.error);
			};

			openreq.onupgradeneeded = function() {
				// First time setup: create an empty object store
				var upgrader = null;
				if (typeof options.upgradeFn === 'function') upgrader = options.upgradeFn();
				if (typeof upgrader === 'function') return upgrader(openreq.result);
				else if (upgrader) return upgrader;
				//openreq.result.createObjectStore(store_name, (options.keyPath ? { keyPath: options.keyPath } : undefined));
			};

			openreq.onsuccess = function() {
				resolve(openreq.result);
			};
		});
		return this;
	}

	promIDB.prototype = {
		getDB: function() { return this.db },
		withStore: function(type, callback) {
			var that = this;
			return this.db.then(function(db) {
				return new Promise(function(resolve, reject) {
					var transaction = db.transaction(that.store_name, type || 'readwrite');
					transaction.oncomplete = function() {
						resolve();
					};
					transaction.onerror = function() {
						reject(transaction.error);
					};
					callback(transaction.objectStore(that.store_name));
				});
			});
		},
		get: function(key) {
			var req;
			return this.withStore('readonly', function(store) {
				req = store.get(key);
			}).then(function() {
				return req.result;
			});
		},
		add: function(key, value) {
			return this.withStore('readwrite', function(store) {
				store.add(value, key);
			});
		},
		update: function(key, value) {
			return this.withStore('readwrite', function(store) {
				store.put(value, key);
			});
		},
		delete: function(key) {
			return this.withStore('readwrite', function(store) {
				store.delete(key);
			});
		},
		count: function(key) {
			var req;
			return this.withStore('readonly', function(store) {
				req = store.count(key);
			}).then(function() {
				return req.result;
			});
		},
		clear: function() {
			return this.withStore('readwrite', function(store) {
				store.clear();
			});
		},
		values: function() {
			var values = [];
			return this.withStore('readonly', function(store) {
				store.openCursor.call(store).onsuccess = function() {
					if (!this.result) return;
					values.push(this.result.value);
					this.result.continue();
				};
			}).then(function() {
				return values;
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
