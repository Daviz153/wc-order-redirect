const { execSync } = require('child_process');

const CONTAINER = 'wordpress-dev-wordpress-1';

function dockerPhp(code) {
    const full = `<?php
error_reporting(E_ERROR);
ini_set('display_errors', '1');
$_SERVER['HTTP_HOST']   = 'localhost';
$_SERVER['REQUEST_URI'] = '/';
require '/var/www/html/wp-load.php';
${code}
`;
    return execSync(
        `docker exec -i ${CONTAINER} php /dev/stdin`,
        { input: full, encoding: 'utf8', timeout: 30_000 }
    ).trim();
}

module.exports = { dockerPhp };
