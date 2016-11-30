/*!
 * jquery.[confirm|prompt] plugin (custom mod for Smart RSS).
 *
 * @license MIT
 */
if (typeof browser === 'undefined' && typeof chrome !== 'undefined') browser = chrome;
(function ($) {
    /**
     * Confirm a link or a button
     * @param [options] {{title, text, confirm, cancel, confirmButton, cancelButton, post, submitForm, confirmButtonClass}}
     */
    $.fn.confirm = function (options) {
        if (typeof options === 'undefined') options = $.confirm.options;
        if (this) this.click(function (e) {
                e.preventDefault();
                var newOptions = $.extend({ button: $(this), prompt: false }, options);
                $.confirm(newOptions, e);
            });
        return this;
    };

    /**
     * Prompt a text
     * @param [options] {{title, text, confirm, cancel, confirmButton, cancelButton, post, submitForm, confirmButtonClass}}
     */
    $.fn.prompt = function (options) {
        if (typeof options === 'undefined') options = $.confirm.options;
        if (this) this.click(function (e) {
                e.preventDefault();
                var newOptions = $.extend({ button: $(this), prompt: true }, options);
                $.confirm(newOptions, e);
            });
        return this;
    };

    /**
     * Show a text prompt dialog
     * @param [options] {{title, text, confirm, cancel, confirmButton, cancelButton, post, submitForm, confirmButtonClass}}
     * @param [e] {Event}
     */
    $.prompt = function (options) {
        $.confirm($.extend({ prompt: true }, options));
    };

    /**
     * Show a confirmation dialog
     * @param [options] {{title, text, confirm, cancel, confirmButton, cancelButton, post, submitForm, confirmButtonClass}}
     * @param [e] {Event}
     */
    $.confirm = function (options, e) {
        // Do nothing when active confirm modal.
        if ($('.confirmation-modal').length > 0)
            return;

        // Default options
        var settings = $.extend({}, $.confirm.options, {
            confirm: function () {},
            cancel: function () {},
            button: null
        }, options);

        // Modal
        var modalHeader = '';
        if (settings.title !== '') {
            modalHeader =
                '<div class="modal-header">' +
                    '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
                    '<h4 class="modal-title">' + settings.title + '</h4>' +
                '</div>';
        }
        var modalHTML =
                '<div class="confirmation-modal modal fade" tabindex="-1" role="dialog">' +
                    '<div class="'+ settings.dialogClass +'">' +
                        '<div class="modal-content">' +
                            modalHeader +
                            '<div class="modal-body">' + settings.text + '</div>' +
                            (settings.prompt ? '<input id="modal-dialog-input" type="text"/>' : '') +
                            '<div class="modal-footer">' +
                                '<button class="confirm btn ' + settings.confirmButtonClass + '" type="button" data-dismiss="modal">' +
                                    settings.confirmButton +
                                '</button>' +
                                (settings.cancel ? (
                                    '<button class="cancel btn ' + settings.cancelButtonClass + '" type="button" data-dismiss="modal">' +
                                        settings.cancelButton +
                                    '</button>') :
                                    ''
                                ) +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

        var modal = $(modalHTML);
        modal.on('shown.bs.modal', function () {
            if (settings.prompt) {
                modal.find("#modal-dialog-input").focus();
            } else {
                modal.find(".btn-primary:first").focus();
            }
        });
        modal.on('hidden.bs.modal', function () {
            modal.remove();
        });
        modal.find(".confirm").click(function () {
            if (settings.prompt) {
                var text = $("#modal-dialog-input").val().trim();
                if (text) {
                    settings.confirm(settings.button, text);
                } else {
                    if (settings.cancel) settings.cancel(settings.button);
                }
            } else {
                settings.confirm(settings.button);
            }
        });
        if (settings.cancel) modal.find(".cancel").click(function () {
            settings.cancel(settings.button);
        });
        // Show the modal
        $("body").append(modal);
        modal.modal('show');
    };

    /**
     * Globally definable rules
     */
    $.confirm.options = {
        text: "Are you sure?",
        title: "",
        confirmButton: browser.i18n.getMessage('OK'),
        cancelButton: browser.i18n.getMessage('CANCEL'),
        post: false,
        submitForm: false,
        confirmButtonClass: "btn-default",
        cancelButtonClass: "btn-primary",
        dialogClass: "modal-dialog"
    }

})(jQuery);
