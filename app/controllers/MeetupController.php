<?php
declare(strict_types=1);

final class MeetupController
{
    private static function ensureTable(): void
    {
        $sql = Database::isSqlite()
            ? 'CREATE TABLE IF NOT EXISTS meetups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title VARCHAR(180) NOT NULL,
                place VARCHAR(180) NOT NULL,
                meetup_date VARCHAR(40) NOT NULL,
                meetup_time VARCHAR(40) NOT NULL,
                capacity INTEGER NOT NULL DEFAULT 20,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'
            : 'CREATE TABLE IF NOT EXISTS meetups (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                title VARCHAR(180) NOT NULL,
                place VARCHAR(180) NOT NULL,
                meetup_date VARCHAR(40) NOT NULL,
                meetup_time VARCHAR(40) NOT NULL,
                capacity INT UNSIGNED NOT NULL DEFAULT 20,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
        Database::pdo()->exec($sql);
    }

    public static function list(): void
    {
        self::ensureTable();
        $rows = Database::pdo()->query(
            'SELECT m.*, u.full_name AS host FROM meetups m JOIN users u ON u.id = m.user_id ORDER BY m.id DESC'
        )->fetchAll();
        Response::ok(['meetups' => array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'], 'title' => $row['title'], 'place' => $row['place'],
                'date' => $row['meetup_date'], 'time' => $row['meetup_time'], 'capacity' => (int) $row['capacity'],
                'going' => 1, 'host' => $row['host'], 'tags' => ['Social'], 'joined' => false,
            ];
        }, $rows)]);
    }

    public static function create(array $input): void
    {
        self::ensureTable();
        $userId = Auth::requireUser();
        $title = trim((string) ($input['title'] ?? ''));
        $place = trim((string) ($input['place'] ?? ''));
        $date = trim((string) ($input['date'] ?? ''));
        $time = trim((string) ($input['time'] ?? ''));
        $capacity = max(2, min(200, (int) ($input['capacity'] ?? 20)));
        if ($title === '' || $place === '' || $date === '' || $time === '') Response::error('Complete all meetup details.');
        $stmt = Database::pdo()->prepare(
            'INSERT INTO meetups (user_id, title, place, meetup_date, meetup_time, capacity) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$userId, $title, $place, $date, $time, $capacity]);
        Response::ok(['ok' => true], 201);
    }
}
