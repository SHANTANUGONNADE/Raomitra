<?php
declare(strict_types=1);

$path = $_GET['r'] ?? '';
if ($path === '' && !empty($_SERVER['QUERY_STRING'])) {
    parse_str((string) $_SERVER['QUERY_STRING'], $query);
    $path = (string) ($query['r'] ?? '');
}
if ($path === '' && !empty($_SERVER['PATH_INFO'])) {
    $path = $_SERVER['PATH_INFO'];
}
if ($path === '' && !empty($_SERVER['REQUEST_URI'])) {
    $uriPath = (string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH);
    if (preg_match('#/api(?:/index\.php)?/(.+)$#', $uriPath, $m) === 1) {
        $path = $m[1];
    }
}
$path = '/' . ltrim(trim((string) $path), '/');
if ($path === '/') {
    $path = '/health';
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = [];
if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    $raw = file_get_contents('php://input') ?: '';
    $json = json_decode($raw, true);
    $input = is_array($json) ? $json : $_POST;
}

try {
    match (true) {
        $method === 'GET' && ($path === '/health' || $path === '/') => Response::ok([
            'service' => 'roamitra',
            'driver' => Database::driver(),
        ]),

        $method === 'POST' && $path === '/auth/register' => AuthController::register($input),
        $method === 'POST' && $path === '/auth/login' => AuthController::login($input),
        $method === 'POST' && $path === '/auth/admin-login' => AuthController::adminLogin($input),
        $method === 'POST' && $path === '/auth/logout' => AuthController::logout(),
        $method === 'GET' && $path === '/auth/me' => AuthController::me(),

        $method === 'GET' && $path === '/profile' => ProfileController::show(),
        $method === 'POST' && $path === '/profile' => ProfileController::update($input),

        $method === 'GET' && $path === '/trips' => TripController::list(),
        $method === 'POST' && $path === '/trips' => TripController::create($input),
        $method === 'GET' && preg_match('#^/trips/(\d+)$#', $path, $m) === 1 => TripController::show((int) $m[1]),
        $method === 'POST' && preg_match('#^/trips/(\d+)/generate$#', $path, $m) === 1 => TripController::generate((int) $m[1]),
        $method === 'POST' && preg_match('#^/trips/(\d+)/save$#', $path, $m) === 1 => TripController::save((int) $m[1]),
        $method === 'POST' && preg_match('#^/trips/(\d+)/assistant$#', $path, $m) === 1 => TripController::assistant((int) $m[1], $input),

        $method === 'GET' && $path === '/notifications' => NotificationController::list(),
        $method === 'POST' && $path === '/notifications/read-all' => NotificationController::readAll(),
        $method === 'POST' && preg_match('#^/notifications/(\d+)/read$#', $path, $m) === 1 => NotificationController::read((int) $m[1]),

        $method === 'GET' && $path === '/wallet' => WalletController::show(),

        $method === 'POST' && $path === '/roamini/chat' => RoaminiController::chat($input),

        $method === 'POST' && $path === '/translate' => TranslateController::translate($input),
        $method === 'GET' && $path === '/translate/history' => TranslateController::history(),

        $method === 'GET' && $path === '/community/posts' => CommunityController::list(),
        $method === 'POST' && $path === '/community/posts' => CommunityController::create($input),
        $method === 'POST' && preg_match('#^/community/posts/(\d+)/replies$#', $path, $m) === 1 => CommunityController::reply((int) $m[1], $input),

        $method === 'POST' && $path === '/bookings' => BookingController::create($input),
        $method === 'GET' && $path === '/bookings' => BookingController::mine(),

        $method === 'POST' && $path === '/host/apply' => HostController::apply($input),
        $method === 'GET' && $path === '/host/me' => HostController::mine(),

        $method === 'GET' && $path === '/admin/overview' => AdminController::overview(),
        $method === 'GET' && $path === '/admin/users' => AdminController::listUsers(),
        $method === 'POST' && $path === '/admin/hosts/review' => AdminController::reviewHost($input),
        $method === 'POST' && $path === '/admin/users/role' => AdminController::setUserRole($input),

        default => Response::error('Not found.', 404),
    };
} catch (Throwable $e) {
    Response::error('Server error: ' . $e->getMessage(), 500);
}
