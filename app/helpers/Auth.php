<?php
declare(strict_types=1);

final class Auth
{
    private const COOKIE = 'raomitra_auth';

    public static function userId(): ?int
    {
        if (isset($_SESSION['user_id'])) {
            return (int) $_SESSION['user_id'];
        }
        $token = self::readToken();
        if (!$token) {
            return null;
        }
        self::restoreUser($token);
        $_SESSION['user_id'] = (int) $token['id'];
        return (int) $token['id'];
    }

    public static function requireUser(): int
    {
        $id = self::userId();
        if (!$id) {
            Response::error('Please log in to continue.', 401);
        }
        return $id;
    }

    public static function requireRole(array $roles): array
    {
        $user = self::user();
        if (!$user) {
            Response::error('Please log in to continue.', 401);
        }
        if (!in_array((string) $user['role'], $roles, true)) {
            Response::error('You do not have access to this page.', 403);
        }
        return $user;
    }

    public static function user(): ?array
    {
        $id = self::userId();
        if (!$id) {
            return null;
        }
        $stmt = Database::pdo()->prepare(
            'SELECT id, full_name, email, role, avatar_url, created_at FROM users WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        if ($user) {
            return $user;
        }
        $token = self::readToken();
        if ($token && (int) $token['id'] === $id) {
            self::restoreUser($token);
            $stmt->execute([$id]);
            $user = $stmt->fetch();
            if ($user) {
                return $user;
            }
        }
        return null;
    }

    public static function login(int $userId, bool $remember = false): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_regenerate_id(true);
        }
        $_SESSION['user_id'] = $userId;
        self::writeToken($userId, $remember);

        if ($remember && ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), session_id(), [
                'expires' => time() + (60 * 60 * 24 * 30),
                'path' => $params['path'] ?: '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) $params['secure'],
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            $opts = [
                'expires' => time() - 42000,
                'path' => $params['path'] ?: '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) $params['secure'],
                'httponly' => true,
                'samesite' => 'Lax',
            ];
            setcookie(session_name(), '', $opts);
            $opts['path'] = '/';
            setcookie(self::COOKIE, '', $opts);
        }
        session_destroy();
    }

    private static function secret(): string
    {
        $config = require dirname(__DIR__) . '/config/config.php';
        return (string) $config['session_secret'];
    }

    private static function writeToken(int $userId, bool $remember): void
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, full_name, email, role, avatar_url, password_hash FROM users WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) {
            return;
        }
        $payload = json_encode($row, JSON_UNESCAPED_UNICODE);
        $sig = hash_hmac('sha256', (string) $payload, self::secret());
        $value = rtrim(strtr(base64_encode((string) $payload), '+/', '-_'), '=') . '.' . $sig;
        $vercel = getenv('VERCEL') === '1';
        $params = session_get_cookie_params();
        $secure = $vercel || !empty($params['secure']);
        setcookie(self::COOKIE, $value, [
            'expires' => ($remember || $vercel) ? time() + (60 * 60 * 24 * 30) : 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private static function readToken(): ?array
    {
        $raw = (string) ($_COOKIE[self::COOKIE] ?? '');
        if ($raw === '' || !str_contains($raw, '.')) {
            return null;
        }
        [$b64, $sig] = explode('.', $raw, 2);
        $payload = base64_decode(strtr($b64, '-_', '+/'), true);
        if ($payload === false || !hash_equals(hash_hmac('sha256', $payload, self::secret()), $sig)) {
            return null;
        }
        $data = json_decode($payload, true);
        if (!is_array($data) || empty($data['id']) || empty($data['email'])) {
            return null;
        }
        return $data;
    }

    private static function restoreUser(array $token): void
    {
        $pdo = Database::pdo();
        $id = (int) $token['id'];
        $email = strtolower((string) $token['email']);
        $name = (string) ($token['full_name'] ?? 'Member');
        $hash = (string) ($token['password_hash'] ?? '');
        $role = (string) ($token['role'] ?? 'customer');
        $avatar = $token['avatar_url'] ?? null;
        if ($hash === '') {
            return;
        }
        if (Database::isSqlite()) {
            $pdo->prepare(
                'INSERT INTO users (id, full_name, email, password_hash, role, avatar_url)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(email) DO UPDATE SET
                    full_name = excluded.full_name,
                    password_hash = excluded.password_hash,
                    role = excluded.role,
                    avatar_url = excluded.avatar_url'
            )->execute([$id, $name, $email, $hash, $role, $avatar]);
        } else {
            $pdo->prepare(
                'INSERT INTO users (id, full_name, email, password_hash, role, avatar_url)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    full_name = VALUES(full_name),
                    password_hash = VALUES(password_hash),
                    role = VALUES(role),
                    avatar_url = VALUES(avatar_url)'
            )->execute([$id, $name, $email, $hash, $role, $avatar]);
        }
        WalletService::ensure($id);
    }
}
