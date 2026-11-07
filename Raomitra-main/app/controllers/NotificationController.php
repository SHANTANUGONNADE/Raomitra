<?php
declare(strict_types=1);

final class NotificationController
{
    public static function list(): void
    {
        $userId = Auth::requireUser();
        $pdo = Database::pdo();
        $upcoming = $pdo->prepare(
            'SELECT id, destination, start_date, end_date, status, is_saved
             FROM trips
             WHERE user_id = ? AND end_date >= CURDATE()
             ORDER BY start_date ASC
             LIMIT 8'
        );
        $upcoming->execute([$userId]);

        $saved = $pdo->prepare(
            'SELECT id, destination, start_date, end_date, status
             FROM trips
             WHERE user_id = ? AND is_saved = 1
             ORDER BY updated_at DESC
             LIMIT 8'
        );
        $saved->execute([$userId]);

        $recent = $pdo->prepare(
            'SELECT t.id, t.destination, t.start_date, t.end_date, i.created_at, i.version
             FROM trips t
             INNER JOIN itineraries i ON i.trip_id = t.id AND i.is_current = 1
             WHERE t.user_id = ? AND t.status IN (\'generated\', \'saved\')
             ORDER BY i.created_at DESC
             LIMIT 8'
        );
        $recent->execute([$userId]);

        Response::ok([
            'notifications' => NotificationService::listForUser($userId),
            'unread' => NotificationService::unreadCount($userId),
            'upcoming_trips' => $upcoming->fetchAll(),
            'saved_trips' => $saved->fetchAll(),
            'recent_itineraries' => $recent->fetchAll(),
        ]);
    }

    public static function read(int $id): void
    {
        $userId = Auth::requireUser();
        NotificationService::markRead($userId, $id);
        Response::ok(['unread' => NotificationService::unreadCount($userId)]);
    }

    public static function readAll(): void
    {
        $userId = Auth::requireUser();
        NotificationService::markAllRead($userId);
        Response::ok(['unread' => 0]);
    }
}
