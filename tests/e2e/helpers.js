const { execSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

// CI:     WP_PATH=/tmp/wordpress  → PHP 직접 실행
// Remote: SSH_HOST=root@...       → SSH stdin piping
// Local:  (없음)                  → Docker container
const WP_PATH     = process.env.WP_PATH;
const SSH_HOST    = process.env.SSH_HOST;
const SSH_KEY     = process.env.SSH_KEY || path.join(os.homedir(), '.ssh/id_ed25519');
const SSH_WP_PATH = process.env.SSH_WP_PATH || '/var/www/test.crmbiz.kr';
const HTTP_HOST   = process.env.WP_HTTP_HOST || 'localhost';
const WP_LOAD     = WP_PATH    ? `${WP_PATH}/wp-load.php`
                  : SSH_HOST   ? `${SSH_WP_PATH}/wp-load.php`
                  : '/var/www/html/wp-load.php';
const CONTAINER   = 'wordpress-dev-wordpress-1';

function dockerPhp(code) {
    const full = `<?php
error_reporting(E_ERROR);
ini_set('display_errors', '1');
$_SERVER['HTTP_HOST']   = '${HTTP_HOST}';
$_SERVER['REQUEST_URI'] = '/';
require '${WP_LOAD}';
${code}
`;
    if (SSH_HOST) {
        // Remote: SSH stdin piping — ControlMaster로 핸드쉐이크 스톰 방지
        const CM_PATH = `/tmp/wcor-cm-${SSH_HOST.replace(/[^a-z0-9]/gi, '_')}`;
        return execSync(
            `ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o BatchMode=yes`
            + ` -o ControlMaster=auto -o ControlPath=${CM_PATH} -o ControlPersist=300s`
            + ` ${SSH_HOST} php /dev/stdin`,
            { input: full, encoding: 'utf8', timeout: 30_000 }
        ).trim();
    }
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
