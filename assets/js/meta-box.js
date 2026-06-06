( function () {
    var toggle   = document.getElementById( 'wc_order_redirect_enabled' );
    var track    = document.getElementById( 'wcor-track' );
    var thumb    = document.getElementById( 'wcor-thumb' );
    var urlField = document.getElementById( 'wcor-url-field' );
    var wrap     = document.getElementById( 'wcor-toggle-wrap' );

    if ( ! toggle || ! track || ! thumb || ! urlField || ! wrap ) return;

    function sync() {
        if ( toggle.checked ) {
            track.style.background = '#2271b1';
            thumb.style.left       = '22px';
            urlField.style.display = 'block';
        } else {
            track.style.background = '#ccc';
            thumb.style.left       = '2px';
            urlField.style.display = 'none';
        }
    }

    wrap.addEventListener( 'click', function () {
        toggle.checked = ! toggle.checked;
        sync();
    } );
} )();
