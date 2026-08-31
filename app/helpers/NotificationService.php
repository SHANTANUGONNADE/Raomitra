<?php
declare(strict_types=1);

final class NotificationService
{
    public static function create(int $userId, string $type, string $title, string $body = '', ?string $link = null): void
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $type, $title, $body, $link]);
    }

    public static function listForUser(int $userId, int $limit = 40): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, type, title, body, link, is_read, created_at
             FROM notifications
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ' . (int) $limit
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    public static function unreadCount(int $userId): int
    {
        $stmt = Database::pdo()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    public static function markRead(int $userId, int $id): bool
    {
        $stmt = Database::pdo()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        return $stmt->rowCount() > 0;
    }

    public static function markAllRead(int $userId): void
    {
        $stmt = Database::pdo()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0');
        $stmt->execute([$userId]);
    }

    public static function notifyStaff(string $type, string $title, string $body = '', ?string $link = null): void
    {
        $stmt = Database::pdo()->query("SELECT id FROM users WHERE role IN ('admin','co_admin')");
        foreach ($stmt->fetchAll() as $row) {
            self::create((int) $row['id'], $type, $title, $body, $link);
        }
    }
}
