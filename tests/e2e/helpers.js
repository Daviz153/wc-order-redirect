const { execSync } = require('child_process');

// CI sets WP_PATH=/tmp/wordpress and runs PHP directly (no Docker)
// Local uses Docker container
const WP_PATH   = process.env.WP_PATH;
const WP_LOAD   = WP_PATH ? `${WP_PATH}/wp-load.php` : '/var/www/html/wp-load.php';
const CONTAINER = 'wordpress-dev-wordpress-1';

function dockerPhp(code) {
    const full = `<?php
error_reporting(E_ERROR);
ini_set('display_errors', '1');
$_SERVER['HTTP_HOST']   = 'localhost';
$_SERVER['REQUEST_URI'] = '/';
require '${WP_LOAD}';
${code}
`;
    const cmd = WP_PATH
        ? 'php /dev/stdin'
        : `docker exec -i ${CONTAINER} php /dev/stdin`;

    return execSync(cmd, { input: full, encoding: 'utf8', timeout: 30_000 }).trim();
}

module.exports = { dockerPhp };
