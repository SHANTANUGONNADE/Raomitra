<?php
declare(strict_types=1);

final class CommunityController
{
    public static function list(): void
    {
        $stmt = Database::pdo()->query(
            'SELECT p.id, p.title, p.body, p.created_at, u.full_name,
                    (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = p.id) AS reply_count
             FROM community_posts p
             JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC
             LIMIT 30'
        );
        Response::ok(['posts' => $stmt->fetchAll()]);
    }

    public static function create(array $input): void
    {
        $userId = Auth::requireUser();
        $title = trim((string) ($input['title'] ?? ''));
        $body = trim((string) ($input['body'] ?? ''));
        if ($title === '' || $body === '') {
            Response::error('Add a title and question.');
        }
        Database::pdo()->prepare('INSERT INTO community_posts (user_id, title, body) VALUES (?, ?, ?)')
            ->execute([$userId, $title, $body]);
        $id = (int) Database::pdo()->lastInsertId();
        NotificationService::create(
            $userId,
            'community',
            'Question posted',
            'You posted: ' . $title,
            'community.html'
        );
        Response::ok(['post_id' => $id], 201);
    }

    public static function requests(): void
    {
        $userId = Auth::requireUser();
        $stmt = Database::pdo()->prepare(
            'SELECT id, kind, person_name, person_location, note, status, created_at
             FROM community_requests
             WHERE user_id = ?
             ORDER BY created_at DESC'
        );
        $stmt->execute([$userId]);
        Response::ok(['requests' => $stmt->fetchAll()]);
    }

    public static function createRequest(array $input): void
    {
        $userId = Auth::requireUser();
        $kind = trim((string) ($input['kind'] ?? ''));
        if (!in_array($kind, ['connect', 'host'], true)) {
            Response::error('Choose a connection or a host request.');
        }
        $name = trim((string) ($input['person_name'] ?? ''));
        $location = trim((string) ($input['person_location'] ?? ''));
        $note = trim((string) ($input['note'] ?? ''));
        if ($name === '' || strlen($name) > 120) {
            Response::error('Add the person you want to reach.');
        }
        if (strlen($location) > 160) {
            $location = substr($location, 0, 160);
        }
        if (strlen($note) > 400) {
            Response::error('Keep the note under 400 characters.');
        }
        if ($kind === 'host' && $note === '') {
            $note = 'I would like to visit and would love your help.';
        }

        $pdo = Database::pdo();
        $existing = $pdo->prepare(
            'SELECT id FROM community_requests WHERE user_id = ? AND kind = ? AND person_name = ? LIMIT 1'
        );
        $existing->execute([$userId, $kind, $name]);
        $found = $existing->fetch();
        if ($found) {
            Response::ok(['request_id' => (int) $found['id'], 'already' => true]);
        }

        $pdo->prepare(
            'INSERT INTO community_requests (user_id, kind, person_name, person_location, note) VALUES (?, ?, ?, ?, ?)'
        )->execute([$userId, $kind, $name, $location !== '' ? $location : null, $note !== '' ? $note : null]);
        $id = (int) $pdo->lastInsertId();
        $title = $kind === 'connect' ? 'Connection request sent' : 'Host request sent';
        NotificationService::create($userId, 'community', $title, $title . ' to ' . $name . '.', 'community.html');
        Response::ok(['request_id' => $id, 'already' => false], 201);
    }

    public static function reply(int $postId, array $input): void
    {
        $userId = Auth::requireUser();
        $body = trim((string) ($input['body'] ?? ''));
        if ($body === '') {
            Response::error('Reply cannot be empty.');
        }
        $post = Database::pdo()->prepare('SELECT id, user_id, title FROM community_posts WHERE id = ?');
        $post->execute([$postId]);
        $row = $post->fetch();
        if (!$row) {
            Response::error('Post not found.', 404);
        }
        Database::pdo()->prepare('INSERT INTO community_replies (post_id, user_id, body) VALUES (?, ?, ?)')
            ->execute([$postId, $userId, $body]);

        if ((int) $row['user_id'] !== $userId) {
            $me = Auth::user();
            NotificationService::create(
                (int) $row['user_id'],
                'community',
                'New reply on your question',
                ($me['full_name'] ?? 'A traveler') . ' replied to “' . $row['title'] . '”.',
                'community.html'
            );
        }
        Response::ok(['ok' => true]);
    }

    public static function localFeeds(): void
    {
        $stmt = Database::pdo()->query(
            'SELECT f.id, f.category, f.title, f.body, f.place, f.created_at, f.user_id, u.full_name
             FROM local_feeds f
             JOIN users u ON u.id = f.user_id
             ORDER BY f.created_at DESC
             LIMIT 40'
        );
        $mine = Auth::userId() ?? 0;
        $feeds = [];
        foreach ($stmt->fetchAll() as $row) {
            $feeds[] = [
                'id' => (int) $row['id'],
                'category' => (string) $row['category'],
                'title' => (string) $row['title'],
                'body' => (string) $row['body'],
                'place' => (string) ($row['place'] ?? ''),
                'created_at' => self::feedStamp((string) $row['created_at']),
                'full_name' => (string) $row['full_name'],
                'mine' => (int) $row['user_id'] === $mine,
            ];
        }
        Response::ok(['feeds' => $feeds]);
    }

    public static function createLocalFeed(array $input): void
    {
        $userId = Auth::requireUser();
        $category = trim((string) ($input['category'] ?? ''));
        if (!in_array($category, ['safety', 'jobs', 'food', 'gems'], true)) {
            Response::error('Choose a category.');
        }
        $title = trim((string) ($input['title'] ?? ''));
        $body = trim((string) ($input['body'] ?? ''));
        $place = trim((string) ($input['place'] ?? ''));
        if ($title === '' || strlen($title) > 180) {
            Response::error('Add a short title, up to 180 characters.');
        }
        if ($body === '' || strlen($body) > 800) {
            Response::error('Write the tip, up to 800 characters.');
        }
        if (strlen($place) > 160) {
            $place = substr($place, 0, 160);
        }

        Database::pdo()->prepare(
            'INSERT INTO local_feeds (user_id, category, title, body, place) VALUES (?, ?, ?, ?, ?)'
        )->execute([$userId, $category, $title, $body, $place !== '' ? $place : null]);
        $id = (int) Database::pdo()->lastInsertId();
        $me = Auth::user();
        NotificationService::create(
            $userId,
            'community',
            'Local tip posted',
            'You shared: ' . $title,
            'explore.html#feed-user-' . $id
        );
        Response::ok([
            'feed' => [
                'id' => $id,
                'category' => $category,
                'title' => $title,
                'body' => $body,
                'place' => $place,
                'created_at' => self::feedStamp(date('Y-m-d H:i:s')),
                'full_name' => (string) ($me['full_name'] ?? 'You'),
                'mine' => true,
            ],
        ], 201);
    }

    public static function deleteLocalFeed(int $id): void
    {
        $userId = Auth::requireUser();
        $stmt = Database::pdo()->prepare('DELETE FROM local_feeds WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        if ($stmt->rowCount() < 1) {
            Response::error('Tip not found.', 404);
        }
        Response::ok(['deleted' => true]);
    }

    private static function feedStamp(string $value): string
    {
        try {
            return (new DateTimeImmutable($value))->format(DateTimeInterface::ATOM);
        } catch (Throwable $e) {
            return $value;
        }
    }
}
