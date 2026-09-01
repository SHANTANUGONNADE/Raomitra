<?php
declare(strict_types=1);

final class SessionStore implements SessionHandlerInterface
{
    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $stmt = Database::pdo()->prepare(
            'SELECT data FROM app_sessions WHERE id = ? AND expires_at > ? LIMIT 1'
        );
        $stmt->execute([$id, time()]);
        $row = $stmt->fetch();
        return $row ? (string) $row['data'] : '';
    }

    public function write(string $id, string $data): bool
    {
        $lifetime = (int) ini_get('session.gc_maxlifetime');
        if ($lifetime < 60) {
            $lifetime = 1440;
        }
        $expires = time() + $lifetime;
        $stmt = Database::pdo()->prepare(
            'INSERT INTO app_sessions (id, data, expires_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)'
        );
        $stmt->execute([$id, $data, $expires]);
        return true;
    }

    public function destroy(string $id): bool
    {
        Database::pdo()->prepare('DELETE FROM app_sessions WHERE id = ?')->execute([$id]);
        return true;
    }

    public function gc(int $max_lifetime): int|false
    {
        $stmt = Database::pdo()->prepare('DELETE FROM app_sessions WHERE expires_at < ?');
        $stmt->execute([time()]);
        return $stmt->rowCount();
    }
}
