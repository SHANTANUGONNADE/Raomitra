<?php
declare(strict_types=1);

final class Auth
{
    public static function userId(): ?int
    {
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
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
        return $user ?: null;
    }

    public static function login(int $userId, bool $remember = false): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;

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
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] ?: '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) $params['secure'],
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
        }
        session_destroy();
    }
}
