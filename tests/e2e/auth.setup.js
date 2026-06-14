const { test: setup } = require('@playwright/test');
const { dockerPhp }   = require('./helpers');
const path             = require('path');
const fs               = require('fs');

// CI uses WP_ADMIN_USER=admin; remote uses support; local uses tearstar153
const ADMIN_USER    = process.env.WP_ADMIN_USER || 'tearstar153';
const BASE_URL      = process.env.WP_BASE_URL   || 'http://localhost:8080/';
const cookieDomain  = new URL(BASE_URL).hostname;

setup('WP 관리자 인증 쿠키 생성 (Docker PHP)', async () => {
    const authDir  = path.join(__dirname, '.auth');
    const authFile = path.join(authDir, 'admin.json');
    fs.mkdirSync(authDir, { recursive: true });

    const isSecure = BASE_URL.startsWith('https');

    // HTTPS WordPress는 SECURE_AUTH_COOKIE (scheme 'secure_auth')를 사용
    const output = dockerPhp(`
$user   = get_user_by('login', '${ADMIN_USER}');
$expiry = time() + 86400;
$isHttps = ${isSecure ? 'true' : 'false'};
echo json_encode([
    'authName'    => $isHttps ? SECURE_AUTH_COOKIE : AUTH_COOKIE,
    'authValue'   => wp_generate_auth_cookie($user->ID, $expiry, $isHttps ? 'secure_auth' : 'auth'),
    'loggedName'  => LOGGED_IN_COOKIE,
    'loggedValue' => wp_generate_auth_cookie($user->ID, $expiry, 'logged_in'),
    'expiry'      => $expiry,
]);
`);

    const { authName, authValue, loggedName, loggedValue, expiry } = JSON.parse(output);

    const storageState = {
        cookies: [
            { name: authName,   value: authValue,   domain: cookieDomain, path: '/', expires: expiry, httpOnly: false, secure: isSecure, sameSite: 'Lax' },
            { name: loggedName, value: loggedValue, domain: cookieDomain, path: '/', expires: expiry, httpOnly: false, secure: isSecure, sameSite: 'Lax' },
        ],
        origins: [],
    };

    fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));
    console.log('[auth-setup] cookies generated via Docker PHP');
});
