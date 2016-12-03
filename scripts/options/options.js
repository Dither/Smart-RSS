if (typeof browser === 'undefined' && typeof chrome !== 'undefined') browser = chrome;

var FILE_SIZE_LARGE = 1000000;

 var _T = function () {
	//console.log(arguments);
	try {
		return browser.i18n.getMessage.apply(null, arguments) || arguments[0] || '';
	} catch (e) {
		return arguments[0] || '';
	}
}

function utf8_to_b64( str ) {
	return btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8( str ) {
	return atob(str);
}

var entityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;'
};

function escapeHtml(string) {
	var str = String(string).replace(/[&<>"']/gm, function (s) {
	  return entityMap[s];
	});
	str = str.replace(/\s/, function(f) {
		if (f == ' ') return ' ';
		return '';
	});
	return str;
}

function decodeHTML(str) {
	str = str || '';
	var map = {"gt":">", 'lt': '<', 'amp': '&', 'quot': '"' };
	return str.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);?/gmi, function($0, $1) {
		if ($1[0] === "#") {
			return String.fromCharCode($1[1].toLowerCase() === "x" ? parseInt($1.substr(2), 16)  : parseInt($1.substr(1), 10));
		} else {
			return map.hasOwnProperty($1) ? map[$1] : $0;
		}
	});
}

JSON.safeParse = function(str) {
	try { return JSON.parse(str); } catch(e) { return null; }
}

function localizeNodes() {
	//var log = '';
	$('option[value]').each(function(i, item) {
		//log += 'OPTION_' + $(item).val().toUpperCase() + '\n';
		$(item).text(_T('OPTION_' + $(item).val().toUpperCase().replace(':','_')));
	});
	$('[title]').each(function(i, item) {
		//log += $(item).attr('title') + '\n';
		$(item).attr('title', _T($(item).attr('title')));
	});
	$('optgroup[label]').each(function(i, item) {
		//log += $(item).attr('label') + '\n';
		$(item).attr('label', _T($(item).attr('label')));
	});
	//console.log(log);
}

$(function(){ localizeNodes(); });

browser.runtime.getBackgroundPage(function(bg) {
	$(function call() {
		if (!bg.settings) return setTimeout(call, 300);

		$('#version').html(bg.version || 'dev build');

		$('select[id], input[type=number], input[type=range], input[type=range]').each(function(i, item) {
			$(item).val(bg.settings.get(item.id));
			if (item.type == 'number') {
				$(item).on('input', handleChangeNumber);
			} else {
				$(item).change(handleChange);
			}
		});

		$('input[type=checkbox]').each(function(i, item) {
			$(item).get(0).checked = !!bg.settings.get(item.id);
			$(item).change(handleCheck);
		});

		$('button[id^="open-dialog-"').each(function(i, item) {
			var realDialog = function (id) {
				return function() {
					real_dlg = document.getElementById(id);
					real_dlg.value = '';
					real_dlg.click();
				};
			};

			$(item).click(realDialog(item.id.replace('open-dialog-','')));
		});

		$('#useSound').change(function() {
			bg.loader.playNotificationSound();
		});

		$('#default-sound').change(handleDefaultSound);
		$('#export-smart').click(handleExportSmart);
		$('#export-opml').click(handleExportOPML);
		$('#clear-data').click(handleClearData);
		$('#import-smart').change(handleImportSmart);
		$('#import-opml').change(handleImportOPML);
	});

	function handleChangeNumber(e) {
		var t = e.target;
		bg.settings.save(t.id, parseInt(t.value, 10) || 0);
	}

	function handleChange(e) {
		var t = e.target;
		bg.settings.save(t.id, t.value);
	}

	function handleCheck(e) {
		var t = e.target;
		bg.settings.save(t.id, t.checked);
	}

	function handleDefaultSound(e) {
		var file = e.currentTarget.files[0];
		if (!file || file.size == 0) return;

		if (!file.type.match(/audio.*/)) {
			$.confirm({
				text: _T('SELECT_AUDIO'),
				confirmButton: _T("OK")
			});
			return;
		}

		if (file.size > FILE_SIZE_LARGE) {
			$.confirm({
				text: _T('NO_LARGE_FILES'),
				confirmButton: _T("OK")
			});
		}

		var reader = new FileReader();
		reader.onload = function(e) {
			bg.settings.save('defaultSound', this.result);
		}

		reader.readAsDataURL(file);
	}

	function handleExportSmart() {
		var data = {
			folders: bg.folders.toJSON(),
			sources: bg.sources.toJSON(),
			items: bg.items.toJSON(),
			favicons: bg.favicons.toJSON(),
		};

		$('#smart-exported').attr('href', '#');
		$('#smart-exported').removeAttr('download');
		$('#smart-exported').html(_T('WAIT_EXPORTING'));

		setTimeout(function() {
			var expr = new Blob([JSON.stringify(data)]);
			$('#smart-exported').attr('href', URL.createObjectURL(expr));
			$('#smart-exported').attr('download', 'exported-rss.smart');
			$('#smart-exported').html(_T('CLICK_TO_DOWNLOAD'));
		}, 200);
	}

	function handleExportOPML() {
		var addFolder = function(doc, title, id) {
			var tmp = doc.createElement('outline');
			tmp.setAttribute('text', escapeHtml(title));
			tmp.setAttribute('title', escapeHtml(title));
			tmp.setAttribute('id', id);
			return tmp;
		};

		var addSource = function (doc, title, url) {
			var tmp = doc.createElement('outline');
			tmp.setAttribute('text', escapeHtml(title));
			tmp.setAttribute('title', escapeHtml(title));
			tmp.setAttribute('type', 'rss');
			tmp.setAttribute('xmlUrl', url);
			return tmp;
		};

		var addLine = function(doc, to, ctn) {
			var line = doc.createTextNode(ctn || '\n\t');
			to.appendChild(line);
		}

		$('#opml-exported').attr('href', '#');
		$('#opml-exported').removeAttr('download');
		$('#opml-exported').html(_T('WAIT_EXPORTING'));

		var start = '<?xml version="1.0" encoding="utf-8"?>\n<opml version="1.0">\n<head>\n\t<title>Feeds exported from Smart RSS</title>\n</head>\n<body>';
		var end = '\n</body>\n</opml>';

		var parser = new DOMParser();
		var doc = parser.parseFromString(start + end, 'application/xml');

		setTimeout(function() {
			var body = doc.querySelector('body');

			bg.folders.forEach(function(folder) {
				addLine(doc, body);
				body.appendChild( addFolder(doc, folder.get('title'), folder.get('id')) );
			});

			bg.sources.forEach(function(source) {
				//middle += '\n\t<outline text="' + escapeHtml(source.get('title')) + '" title="' + escapeHtml(source.get('title')) + '" type="rss" xmlUrl="' + escapeHtml(source.get('url')) + '" />';

				if (source.get('folderID')) {
					var folder = body.querySelector('[id="' + source.get('folderID') + '"]');
					if (folder) {
						addLine(doc, folder, '\n\t\t');
						folder.appendChild( addSource(doc, source.get('title'), source.get('url')) );
					} else {
						addLine(doc, body);
						body.appendChild( addSource(doc, source.get('title'), source.get('url')) );
					}

				} else {
					addLine(doc, body);
					body.appendChild( addSource(doc, source.get('title'), source.get('url')) );
				}
			});

			var folders = body.querySelectorAll('[id]');
			[].forEach.call(folders, function(folder) {
				folder.removeAttribute('id');
			});

			var expr = new Blob([ (new XMLSerializer()).serializeToString(doc) ]);
			$('#opml-exported').attr('href', URL.createObjectURL(expr));
			$('#opml-exported').attr('download', 'exported-rss.opml');
			$('#opml-exported').html(_T('CLICK_TO_DOWNLOAD'));
		}, 200);
	}

	function handleImportSmart(e) {
		var file = e.currentTarget.files[0];
		if (!file || file.size == 0) return $('#smart-imported').html(_T('WRONG_FILE'));

		$('#smart-imported').html(_T('LOADING_PARSING'));

		var reader = new FileReader();
		reader.onload = function(e) {
			var data = JSON.safeParse(this.result);
			if (!data || !data.items || !data.sources) return $('#smart-imported').html(_T('WRONG_FILE'));

			$('#smart-imported').html(_T('WAIT_IMPORTING'));

			var worker = new Worker('scripts/options/worker.js');
			worker.onmessage = function(e) {
				if (e.data.action == 'finished'){
					$('#smart-imported').html(_T('LOADING_TO_MEMORY'));

					bg.fetchAll().always(function() {
						bg.info.autoSetData();
						$('#smart-imported').html(_T('IMPORT_COMPLETE'));
						bg.loader.downloadFeeds(bg.sources.toArray(), true);
					});
				} else if (e.data.action == 'message'){
					if (e.data.value == 1) $('#smart-imported').html(_T('IMPORT_WRITING'));
				}
			};

			worker.postMessage({ action: 'file-content', value: data });

			worker.onerror = function(e) {
				$.confirm({
					text: _T('IMPORT_ERROR') + e.message,
					confirmButton: _T("OK")
				});
			};

			var f = data.folders;
			var s = data.sources;
			browser.storage.local.get('folders-backbone', function(data) {
				if (!data['sources-backbone']) data['folders-backbone'] = {};
				for (var i=0, j=f.length; i<j; i++) data['folders-backbone'][f[i].id] = f[i];
				browser.storage.local.set(data);
			});

			browser.storage.local.get('sources-backbone', function(data) {
				if (!data['sources-backbone']) data['sources-backbone'] = {};
				for (var i=0, j=s.length; i<j; i++) data['sources-backbone'][s[i].id] = s[i];
				browser.storage.local.set(data);
			});
		}

		bg.closeRSS(function() {
			// wait for clear events to happen
			setTimeout(function() {
				reader.readAsText(file);
			}, 1000);
		});
	}

	function handleImportOPML(e) {
		var file = e.currentTarget.files[0];
		if (!file || file.size == 0) return $('#opml-imported').html(_T('WRONG_FILE'));

		$('#opml-imported').html(_T('WAIT_IMPORTING'));

		var reader = new FileReader();
		reader.onload = function(e) {
			var parser = new DOMParser();
			var doc = parser.parseFromString(this.result, 'application/xml');
			if (!doc) return $('#opml-imported').html(_T('WRONG_FILE'));

			var feeds = doc.querySelectorAll('body > outline[text], body > outline[title]');
			for (var i=0; i<feeds.length; i++) {
				if ( !feeds[i].hasAttribute('xmlUrl') ) {
					var subfeeds = feeds[i].querySelectorAll('outline[xmlUrl]');
					var folderTitle = decodeHTML(feeds[i].getAttribute('title') || feeds[i].getAttribute('text'));
					var duplicite = bg.folders.findWhere({ title: folderTitle });
					var folder = duplicite || bg.folders.create({ title: folderTitle }, { wait: true });

					for (var n=0; n<subfeeds.length; n++) {
						if ( bg.sources.findWhere({ url: decodeHTML(subfeeds[n].getAttribute('xmlUrl')) }) ) continue;
						bg.sources.create({
							title: decodeHTML(subfeeds[n].getAttribute('title') || subfeeds[n].getAttribute('text')),
							url: decodeHTML(subfeeds[n].getAttribute('xmlUrl')),
							updateEvery: 180,
							folderID: folder.get('id')
						}, { wait: true });
					}
				} else {
					if ( bg.sources.findWhere({ url: decodeHTML(feeds[i].getAttribute('xmlUrl')) }) ) continue;
					bg.sources.create({
						title: decodeHTML(feeds[i].getAttribute('title') || feeds[i].getAttribute('text')),
						url: decodeHTML(feeds[i].getAttribute('xmlUrl')),
						updateEvery: 180
					}, { wait: true });
				}
			}

			$('#opml-imported').html(_T('IMPORT_COMPLETE'));

			setTimeout(function() {
				bg.loader.downloadFeeds(bg.sources.toArray());
			}, 200);
		}

		reader.readAsText(file);
	}

	function handleClearData() {
		$.confirm({
			text: _T('REMOVE_ALL_DATA'),
			confirm: function() {
				browser.alarms.clearAll();
				bg.indexedDB.deleteDatabase('backbone-indexeddb');
				browser.storage.local.clear();
				browser.storage.sync.clear();
				localStorage.clear();
				browser.runtime.reload();
				location.reload();
			},
			cancel: function() {},
			confirmButton: _T('OK'),
			cancelButton: _T('CANCEL'),
			confirmButtonClass: 'btn-default',
			cancelButtonClass: 'btn-primary',
		});
	}
});
