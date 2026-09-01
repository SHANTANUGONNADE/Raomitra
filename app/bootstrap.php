<?php
declare(strict_types=1);

$root = dirname(__DIR__);

ini_set('display_errors', '0');
ini_set('html_errors', '0');
if (ob_get_level() === 0) {
    ob_start();
}

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if (!$err || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    if (ob_get_level() > 0) {
        ob_clean();
    }
    echo json_encode([
        'ok' => false,
        'error' => 'Server error: ' . $err['message'],
    ]);
});

$config = require $root . '/app/config/config.php';

$helpers = [
    'Database', 'Schema', 'SessionStore', 'Response', 'Auth',
    'WalletService', 'NotificationService', 'ItineraryEngine',
    'PlacesCatalog', 'TranslatorService',
];
$controllers = [
    'AuthController', 'ProfileController', 'TripController',
    'NotificationController', 'WalletController', 'TranslateController',
    'CommunityController', 'BookingController', 'HostController', 'AdminController',
];
foreach ($helpers as $class) {
    require_once $root . '/app/helpers/' . $class . '.php';
}
foreach ($controllers as $class) {
    require_once $root . '/app/controllers/' . $class . '.php';
}

$script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
$forwardedProto = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
$secure = $forwardedProto === 'https'
    || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || getenv('VERCEL') === '1';

if (preg_match('#^(.*?/public)(?:/|$)#', $script, $m) === 1) {
    $cookiePath = rtrim($m[1], '/') . '/';
} else {
    $dir = str_replace('\\', '/', dirname($script));
    $cookiePath = ($dir === '/' ? '' : rtrim($dir, '/')) . '/';
}
if ($cookiePath === '/' || getenv('VERCEL') === '1' || str_ends_with(rtrim($cookiePath, '/'), '/api')) {
    $cookiePath = '/';
}

try {
    Schema::migrate();
    session_set_save_handler(new SessionStore(), true);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    if (ob_get_level() > 0) {
        ob_clean();
    }
    echo json_encode(['ok' => false, 'error' => 'Database unavailable: ' . $e->getMessage()]);
    exit;
}

session_name('raomitra_session');
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start([
        'cookie_lifetime' => 0,
        'cookie_path' => $cookiePath,
        'cookie_secure' => $secure,
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
    ]);
}
