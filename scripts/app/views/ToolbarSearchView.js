define(['backbone', 'jquery', 'domReady!'], function (BB, $) {
	var ToolbarSearchView = BB.View.extend({
		tagName: 'div',

		className: 'button',

		initialize: function() {
			var action = app.actions.get(this.model.get('actionName'));

			var newEl = $('<input type="search" class="input-search" />');
			this.$el.replaceWith(newEl);
			this.$el = newEl;
			this.$el.attr('placeholder', _T('SEARCH'));
			this.$el.attr('tabindex', -1);

			this.el = this.$el.get(0);
			this.el.dataset.action = this.model.get('actionName');
			this.el.title = action.get('title');
			this.el.setAttribute('draggable', 'true');
			this.el.view = this;
		}
	});

	return ToolbarSearchView;
});
