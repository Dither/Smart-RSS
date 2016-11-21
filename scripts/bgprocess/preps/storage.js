/**
 * Prepare IndexedDB stores
 * @module BgProcess
 * @submodule preps/indexeddb
 */
define(['backbone', 'backboneDB'], function(BB) {

	/**
	 * IndexedDB preps.
	 */

	BB.LocalStorage.prepare = function(db) {
		if (!db) return;

		/*if (!db.objectStoreNames.contains('settings-backbone'))
			db.createObjectStore('settings-backbone', { keyPath: 'id' });*/

		if (!db.objectStoreNames.contains('items-backbone'))
			db.createObjectStore('items-backbone',    { keyPath: 'id' });

		if (!db.objectStoreNames.contains('favicons-backbone'))
			db.createObjectStore('favicons-backbone', { keyPath: 'id' });

		/*if (!db.objectStoreNames.contains('sources-backbone'))
			db.createObjectStore('sources-backbone',  { keyPath: 'id' });

		if (!db.objectStoreNames.contains('folders-backbone'))
			db.createObjectStore('folders-backbone', { keyPath: 'id' });

		if (!db.objectStoreNames.contains('toolbars-backbone'))
			db.createObjectStore('toolbars-backbone', { keyPath: 'region' });*/
	};

	/**
	 * 1 -> 3: Main objects stores and testing
	 * 3 -> 4: Added toolbars-backbone store
	 */
	BB.LocalStorage.version = 4;

	return true;
});
