if (typeof browser === 'undefined' && typeof chrome !== 'undefined') browser = chrome;

function utf8_to_b64( str ) {
	return btoa(unescape(encodeURIComponent( str )));
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

var _T = function () {
	return browser.i18n.getMessage.apply(null, arguments) || arguments[0] || '';
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
	//console.log(log);
}


JSON.safeParse = function(str) {
	try {
		return JSON.parse(str);
	} catch(e) {
		return null;
	}
}

$(function() { localizeNodes(); });

browser.runtime.getBackgroundPage(function(bg) {
	$(function call() {
		if (!bg.settings) return setTimeout(call, 300);

		$('#version').html(bg.version || 'dev build');

		$('select[id], input[type=number], input[type=range], input[type=range]').each(function(i, item) {
			$(item).val(bg.settings.get(item.id));
			if (item.type == 'number') {
				$(item).on('input', handleChange);
			} else {
				$(item).change(handleChange);
			}
		});

		$('input[type=checkbox]').each(function(i, item) {
			$(item).get(0).checked = !!bg.settings.get(item.id);
			$(item).change(handleCheck);
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
		if (!file || file.size == 0) {
			return;
		}

		if (!file.type.match(/audio.*/)) {
			alert('Please select audio file!')
			return;
		}

		if (file.size > 1000000) {
			alert('Please use file smaller than 1Mb!');
			return;
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
		};

		$('#smart-exported').attr('href', '#');
		$('#smart-exported').removeAttr('download');
		$('#smart-exported').html('Exporting, please wait');


		setTimeout(function() {
			var expr = new Blob([JSON.stringify(data)]);
			$('#smart-exported').attr('href', URL.createObjectURL(expr));
			$('#smart-exported').attr('download', 'exported-rss.smart');
			$('#smart-exported').html('Click to download exported data');
		}, 100);
	}

	function handleExportOPML() {

		function addFolder(doc, title, id) {
			var tmp = doc.createElement('outline');
			tmp.setAttribute('text', escapeHtml(title));
			tmp.setAttribute('title', escapeHtml(title));
			tmp.setAttribute('id', id);
			return tmp;
		}

		function addSource(doc, title, url) {
			var tmp = doc.createElement('outline');
			tmp.setAttribute('text', escapeHtml(title));
			tmp.setAttribute('title', escapeHtml(title));
			tmp.setAttribute('type', 'rss');
			tmp.setAttribute('xmlUrl', url);
			return tmp;
		}

		function addLine(doc, to, ctn) {
			var line = doc.createTextNode(ctn || '\n\t');
			to.appendChild(line);
		}

		$('#opml-exported').attr('href', '#');
		$('#opml-exported').removeAttr('download');
		$('#opml-exported').html('Exporting, please wait');

		var start = '<?xml version="1.0" encoding="utf-8"?>\n<opml version="1.0">\n<head>\n\t<title>Newsfeeds exported from Smart RSS</title>\n</head>\n<body>';
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
			$('#opml-exported').html('Click to download exported data');
		}, 20);
	}

	function handleImportSmart(e) {
		var file = e.currentTarget.files[0];
		if (!file || file.size == 0) {
			$('#smart-imported').html('Wrong file');
			return;
		}

		$('#smart-imported').html('Loading & parsing file');

		var reader = new FileReader();
		reader.onload = function(e) {
			var data = JSON.safeParse(this.result);

			if (!data || !data.items || !data.sources) {
				$('#smart-imported').html('Wrong file');
				return;
			}

			$('#smart-imported').html('Importing, please wait!');

			var worker = new Worker('scripts/options/worker.js');
			worker.onmessage = function(e) {
				if (e.data.action == 'finished'){
					$('#smart-imported').html('Loading data to memory!');

					bg.fetchAll().always(function() {
						bg.info.autoSetData();
						$('#smart-imported').html('Import fully completed!');
						bg.loader.downloadAllFeeds(true);
					});
				} else if (e.data.action == 'message'){
					$('#smart-imported').html(e.data.value);
				}
			}
			worker.postMessage({ action: 'file-content', value: data });

			worker.onerror = function(e) {
				alert('Importing error: ' + e.message);
			}
		}

		var url = browser.runtime.getURL('rss.html');
		browser.tabs.query({ /*url: url*/ }, function(tabs) {
			for (var i = tabs.length; i-- ;) {
				browser.tabs.remove(tabs[i].id);
			}

			// wait for clear events to happen
			setTimeout(function() {
				reader.readAsText(file);
			}, 1000);
		});
	}

	function handleImportOPML(e) {
		var file = e.currentTarget.files[0];
		if (!file || file.size == 0) {
			$('#opml-imported').html('Wrong file');
			return;
		}

		$('#opml-imported').html('Importing, please wait!');

		var reader = new FileReader();
		reader.onload = function(e) {
			var parser = new DOMParser();
        	var doc = parser.parseFromString(this.result, 'application/xml');

			if (!doc) {
				$('#opml-imported').html('Wrong file');
				return;
			}

			var feeds = doc.querySelectorAll('body > outline[text], body > outline[title]');

			for (var i=0; i<feeds.length; i++) {
				if ( !feeds[i].hasAttribute('xmlUrl') ) {
					var subfeeds = feeds[i].querySelectorAll('outline[xmlUrl]');
					var folderTitle = decodeHTML(feeds[i].getAttribute('title') || feeds[i].getAttribute('text'));

					var duplicite = bg.folders.findWhere({ title: folderTitle });

					var folder = duplicite || bg.folders.create({
						title: folderTitle
					}, { wait: true });

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

			$('#opml-imported').html('Import completed!');

			setTimeout(function() {
				bg.loader.downloadAllFeeds();
			}, 10);
		}


		reader.readAsText(file);
	}

	function handleClearData() {
		var c = confirm('Do you really want to remove all extension data?');
		if (!c) return;

		bg.indexedDB.deleteDatabase('backbone-indexeddb');
		localStorage.clear();
		browser.alarms.clearAll()
		browser.runtime.reload();
	}
});
