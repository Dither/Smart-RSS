/*!
 * jquery.confirm (custom mod for Smart RSS)
 *
 * @version 2.3.1
 *
 * @author My C-Labs
 * @author Matthieu Napoli <matthieu@mnapoli.fr>
 * @author Russel Vela
 * @author Marcus Schwarz <msspamfang@gmx.de>
 *
 * @license MIT
 * @url https://myclabs.github.io/jquery.confirm/
 */
(function ($) {

    /**
     * Confirm a link or a button
     * @param [options] {{title, text, confirm, cancel, confirmButton, cancelButton, post, submitForm, confirmButtonClass}}
     */
    $.fn.confirm = function (options) {
        if (typeof options === 'undefined') {
            options = $.confirm.options;
        }

        if (this)
            this.click(function (e) {
                e.preventDefault();

                var newOptions = $.extend({
                    button: $(this)
                }, options);

                $.confirm(newOptions, e);
            });

        return this;
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

        // Parse options defined with "data-" attributes
        var dataOptions = {};
        if (options && options.button) {
            var dataOptionsMapping = {
                'title': 'title',
                'text': 'text',
                'confirm-button': 'confirmButton',
                'submit-form': 'submitForm',
                'cancel-button': 'cancelButton',
                'confirm-button-class': 'confirmButtonClass',
                'cancel-button-class': 'cancelButtonClass',
                'dialog-class': 'dialogClass'
            };
            $.each(dataOptionsMapping, function(attributeName, optionName) {
                var value = options.button.data(attributeName);
                if (value) {
                    dataOptions[optionName] = value;
                }
            });
        }

        // Default options
        var settings = $.extend({}, $.confirm.options, {
            confirm: function () {},
            cancel: null,
            button: null
        }, dataOptions, options);

        // Modal
        var modalHeader = '';
        if (settings.title !== '') {
            modalHeader =
                '<div class="modal-header">' +
                    '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>' +
                    '<h4 class="modal-title">' + settings.title+'</h4>' +
                '</div>';
        }
        var modalHTML =
                '<div class="confirmation-modal modal fade" tabindex="-1" role="dialog">' +
                    '<div class="'+ settings.dialogClass +'">' +
                        '<div class="modal-content">' +
                            modalHeader +
                            '<div class="modal-body">' + settings.text + '</div>' +
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
            modal.find(".btn-primary:first").focus();
        });
        modal.on('hidden.bs.modal', function () {
            modal.remove();
        });
        modal.find(".confirm").click(function () {
            settings.confirm(settings.button);
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
        confirmButton: "OK",
        cancelButton: "Cancel",
        post: false,
        submitForm: false,
        confirmButtonClass: "btn-primary",
        cancelButtonClass: "btn-default",
        dialogClass: "modal-dialog"
    }
})(jQuery);
