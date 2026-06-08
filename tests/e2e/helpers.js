const { execSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

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
    if (WP_PATH) {
        // CI: execSync stdin piping unreliable — write to temp file instead
        const tmp = path.join(os.tmpdir(), `wcor_${Date.now()}.php`);
        fs.writeFileSync(tmp, full);
        try {
            return execSync(`php ${tmp}`, { encoding: 'utf8', timeout: 30_000 }).trim();
        } finally {
            fs.unlinkSync(tmp);
        }
    }
    // Local: pipe via Docker stdin
    return execSync(
        `docker exec -i ${CONTAINER} php /dev/stdin`,
        { input: full, encoding: 'utf8', timeout: 30_000 }
    ).trim();
}

module.exports = { dockerPhp };
