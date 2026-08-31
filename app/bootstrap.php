<?php
declare(strict_types=1);

$root = dirname(__DIR__);

$config = require $root . '/app/config/config.php';

$script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
if (preg_match('#^(.*?/public)(?:/|$)#', $script, $m) === 1) {
    $cookiePath = rtrim($m[1], '/') . '/';
} else {
    $dir = str_replace('\\', '/', dirname($script));
    $cookiePath = ($dir === '/' ? '' : rtrim($dir, '/')) . '/';
}
if ($cookiePath === '/') {
    $cookiePath = '/';
}

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
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

spl_autoload_register(static function (string $class) use ($root): void {
    $paths = [
        $root . '/app/helpers/' . $class . '.php',
        $root . '/app/controllers/' . $class . '.php',
    ];
    foreach ($paths as $path) {
        if (is_file($path)) {
            require_once $path;
            return;
        }
    }
});

try {
    Schema::migrate();
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => 'Database unavailable: ' . $e->getMessage()]);
    exit;
}
