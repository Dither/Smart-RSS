define(['backbone'], function(BB) {
	var SandboxView = BB.View.extend({
		tagName: 'iframe',

		loaded: false,

		events: {
			'load': 'handleLoad'
		},

		initialize: function() {
			this.$el.attr('src', 'content.html');
			this.$el.attr('name', 'sandbox');
			this.$el.attr('frameborder', 0);
			this.$el.attr('tabindex', -1);
		},

		render: function() {
			return this;
		},

		handleLoad: function() {
			this.loaded = true;

			this.el.contentDocument.querySelector('#smart-rss-url').innerHTML = _T('FULL_ARTICLE');
			this.el.contentDocument.addEventListener('keydown', app.handleKeyDown);

			this.trigger('load');
		}
	});

	return SandboxView;
});
