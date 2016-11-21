self.indexedDB = self.indexedDB || self.mozIndexedDB || self.webkitIndexedDB || self.msIndexedDB;
self.IDBTransaction = self.IDBTransaction || self.webkitIDBTransaction || self.msIDBTransaction;
self.IDBKeyRange = self.IDBKeyRange || self.webkitIDBKeyRange || self.msIDBKeyRange;


var db, content;

var request = indexedDB.open('backbone-indexeddb', 4);
request.addEventListener('error', function(e) { throw 'Error code: ' + this.errorCode; });
request.addEventListener('success', function(e) {
	db = this.result;
	if (content) startImport();
});

onmessage = function(e) {
	if (e.data.action == 'file-content') {
		content = e.data.value;
		if (db) startImport();
	}
}

var writes = 0;
function handleReq(req) {
	writes++;
	req.onsuccess = req.onerror = function() {
		writes--;
		if (writes <= 0) {
			postMessage({ action: 'finished' });
		}
	}
}

function startImport() {
	var tx = this.db.transaction(['items-backbone', 'favicons-backbone'], 'readwrite'),
		items = tx.objectStore('items-backbone'),
		favicons = tx.objectStore('favicons-backbone');

	var t = content.items,
		f = content.favicons;

	if (t) {
		for (var i=0, j=t.length; i<j; i++) {
			handleReq( items.add(t[i]) );
			if (!(i % 10)) postMessage({ action: 'message', value: 'Articles: ' + i + '/' + j });
		}
	}

	if (f) {
		for (var i=0, j=f.length; i<j; i++) {
			handleReq( favicons.add(f[i]) );
			if (!(i % 10)) postMessage({ action: 'message', value: 'Favicons: ' + i + '/' + j });
		}
	}

	if (writes === 0) postMessage({ action: 'finished' });
	else postMessage({ action: 'message', value: 1 });
}
