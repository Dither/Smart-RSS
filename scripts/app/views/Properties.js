define([
	'backbone', 'jquery', 'underscore', 'text!templates/properties.html', 'modules/Locale'
],
function(BB, $, _, tplProperties, Locale) {

	var Properties = BB.View.extend({
		id: 'properties',
		current: null,
		template: _.template(Locale.translateHTML(tplProperties)),
		events: {
			'click button' : 'handleClick',
			'keydown button' : 'handleKeyDown',
			'click #advanced-switch' : 'handleSwitchClick',
		},
		handleClick: function(e) {
			var t = e.currentTarget;
			if (t.id == 'prop-cancel') {
				this.hide();
			} else if (t.id == 'prop-ok') {
				this.saveData();
			}
		},
		saveData: function() {
			if (!this.current) {
				this.hide();
				return;
			}

			var updateEvery, autoremove, fulltextEnable;
			function saveValue(prop, arr) {
				var val = parseFloat($('#prop-'+param.toHyphenFormat()).val());
				if (val && val >= 0) {
					arr.forEach(function(source) {
						var obj = {};
						obj[prop] = val;
						source.save(obj);
					});
				}
				return val;
			}

			if (this.current instanceof bg.Source) {
				/* encrypt the password */
				this.current.setPass();

				var ft_pos = app.validatePosition($('#prop-fulltext-position').val().trim()),
					ft_pos_mode = parseInt($('#prop-fulltext-enable').val(), 10),
					url = $('#prop-url').val().trim();

				if (url) this.current.save({
					title: $('#prop-title').val(),
					url: app.fixURL(url),
					username: $('#prop-username').val(),
					updateEvery: parseInt($('#prop-update-every').val(), 10),
					autoremove: parseInt($('#prop-autoremove').val(), 10),
					fulltextEnable: ft_pos_mode, /*(((ft_pos_mode === 1) && ft_pos) || (ft_pos_mode === 2)) ? ft_pos_mode : 0,*/
					fulltextPosition: ft_pos
				});
			} else if (this.current instanceof bg.Folder) {
				this.current.save({
					title: $('#prop-title').val()
				});

				var sourcesInFolder = bg.sources.where({ folderID: this.current.id });
				updateEvery = saveValue('updateEvery', sourcesInFolder);
				autoremove = saveValue('autoremove', sourcesInFolder);
				fulltextEnable = saveValue('fulltextEnable', sourcesInFolder);
			} else if (Array.isArray(this.current)) {
				updateEvery = saveValue('updateEvery', this.current);
				autoremove = saveValue('autoremove', this.current);
				fulltextEnable = saveValue('fulltextEnable', this.current);
			}

			this.hide();

		},
		handleKeyDown: function(e) {
			if (e.keyCode == 13) {
				this.handleClick(e);
			}
		},
		render: function() {
			if (!this.current) return;

			if (this.current instanceof bg.Source) {
				/* decrypt password */
				var thisrender = this,
					attrs = this.current.toJSON();
				attrs.password = this.current.getPass();

				this.$el.html(this.template(attrs));

				function setValue(param) {
					var v = this.current.get(param),
						el = $('#prop-' + param.toHyphenFormat())
					if (el) el.val(v);
				}

				setValue.apply(this, ['updateEvery']);
				setValue.apply(this, ['autoremove']);
				setValue.apply(this, ['fulltextEnable']);
				setValue.apply(this, ['fulltextPosition']);
			} else {
				var isFolder = this.current instanceof bg.Folder;
				var listOfSources = isFolder ? bg.sources.where({ folderID: this.current.id }) : this.current;
				var params = {};

				/**
				 * Test if all selected feeds has the same properteies or if they are mixed
				 */

				function setDiffers(param) {
					params['first_' + param] = listOfSources[0].get(param) || null;
					params['differs_' + param] = listOfSources.some(function(c) {
						if (params['first_' + param] != c.get(param)) return true;
					});
				}

				if (listOfSources.length) {
					setDiffers('updateEvery');
					setDiffers('autoremove');
					setDiffers('fulltextEnable');
					setDiffers('fulltextPosition');
				}

				/**
				 * Create HTML
				 */

				this.$el.html(this.template( isFolder ? _.extend(params, this.current.attributes) : params ));

				/**
				 * Set <select>s's values
				 */

				function setDiffValue(param) {
					var v = params['differs_'+param],
						el = $('#prop-'+param.toHyphenFormat());

					if (!v && el) {
						el.val(params['first_'+param]);
					}
				}

				setDiffValue('updateEvery');
				setDiffValue('autoremove');
				setDiffValue('fulltextEnable');
				setDiffValue('fulltextAuto');
			}

			return this;
		},
		show: function(source) {
			this.current = source;
			this.render();

			this.$el.css('display', 'block');
		},
		hide: function() {
			this.$el.css('display', 'none');
		},
		handleSwitchClick: function() {
			$('#properties-advanced').toggleClass('visible');
			$('#advanced-switch').toggleClass('switched');
		}
	});

	return Properties;
});
