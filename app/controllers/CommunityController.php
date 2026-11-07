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

    public static function stats(): void
    {
        $pdo = Database::pdo();
        $questions = (int) $pdo->query('SELECT COUNT(*) FROM community_posts')->fetchColumn();
        $hosts = (int) $pdo->query(
            "SELECT COUNT(DISTINCT u.id) FROM users u
             LEFT JOIN host_applications a ON a.user_id = u.id AND a.status = 'approved'
             WHERE u.role = 'host' OR a.id IS NOT NULL"
        )->fetchColumn();
        $rentals = (int) $pdo->query(
            "SELECT COUNT(*) FROM host_applications WHERE status = 'approved' AND listing_type = 'vehicle'"
        )->fetchColumn();
        $members = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        Response::ok(['stats' => compact('questions', 'hosts', 'rentals', 'members')]);
    }

    public static function people(string $location = ''): void
    {
        $location = trim($location);
        $currentUserId = Auth::userId() ?? 0;
        $sql = 'SELECT u.id, u.full_name, u.avatar_url, u.bio,
                       COALESCE(NULLIF(TRIM(u.location), ""), t.destination) AS location,
                       t.destination AS traveling_to
                FROM users u
                LEFT JOIN trips t ON t.user_id = u.id
                    AND t.start_date <= CURRENT_DATE AND t.end_date >= CURRENT_DATE
                WHERE u.id <> ? AND (NULLIF(TRIM(u.location), "") IS NOT NULL OR t.id IS NOT NULL)';
        $params = [$currentUserId];
        if ($location !== '') {
            $sql .= ' AND (u.location LIKE ? OR t.destination LIKE ?)';
            $params[] = '%' . $location . '%';
            $params[] = '%' . $location . '%';
        }
        $sql .= ' ORDER BY u.updated_at DESC, u.created_at DESC LIMIT 30';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        Response::ok(['people' => $stmt->fetchAll()]);
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
        $personId = max(0, (int) ($input['person_id'] ?? 0));
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
        if ($kind === 'connect' && $personId > 0 && $personId !== $userId) {
            $target = $pdo->prepare('SELECT id, full_name FROM users WHERE id = ? LIMIT 1');
            $target->execute([$personId]);
            $targetUser = $target->fetch();
            if (!$targetUser) {
                Response::error('Traveler not found.', 404);
            }
            $existingConnection = $pdo->prepare(
                'SELECT id FROM connections WHERE requester_id = ? AND recipient_id = ? LIMIT 1'
            );
            $existingConnection->execute([$userId, $personId]);
            if (!$existingConnection->fetch()) {
                $pdo->prepare(
                    'INSERT INTO connections (requester_id, recipient_id, status) VALUES (?, ?, ?)'
                )->execute([$userId, $personId, 'pending']);
            }
            NotificationService::create(
                $personId,
                'connection',
                'New connection request',
                (Auth::user()['full_name'] ?? 'A traveler') . ' wants to connect with you.',
                'profile.html'
            );
            Response::ok(['request_id' => 0, 'already' => false, 'recipient_id' => $personId], 201);
        }
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

    public static function connections(): void
    {
        $userId = Auth::requireUser();
        $stmt = Database::pdo()->prepare(
            'SELECT c.id, c.requester_id, c.recipient_id, c.status, c.created_at,
                    u.id AS person_id, u.full_name, u.avatar_url, u.location
             FROM connections c
             JOIN users u ON u.id = CASE WHEN c.requester_id = ? THEN c.recipient_id ELSE c.requester_id END
             WHERE c.requester_id = ? OR c.recipient_id = ?
             ORDER BY c.updated_at DESC'
        );
        $stmt->execute([$userId, $userId, $userId]);
        $rows = $stmt->fetchAll();
        $followers = 0;
        $following = 0;
        foreach ($rows as $row) {
            if ($row['status'] !== 'accepted') {
                continue;
            }
            if ((int) $row['recipient_id'] === $userId) {
                $followers++;
            } else {
                $following++;
            }
        }
        Response::ok(['connections' => $rows, 'followers' => $followers, 'following' => $following]);
    }

    public static function respondConnection(array $input): void
    {
        $userId = Auth::requireUser();
        $id = (int) ($input['connection_id'] ?? 0);
        $status = (string) ($input['status'] ?? '');
        if (!in_array($status, ['accepted', 'rejected'], true)) {
            Response::error('Choose an accepted or rejected status.');
        }
        $stmt = Database::pdo()->prepare(
            'UPDATE connections SET status = ? WHERE id = ? AND recipient_id = ? AND status = "pending"'
        );
        $stmt->execute([$status, $id, $userId]);
        if ($stmt->rowCount() < 1) {
            Response::error('Connection request not found.', 404);
        }
        Response::ok(['status' => $status]);
    }

    public static function messages(int $otherUserId): void
    {
        $userId = Auth::requireUser();
        if ($otherUserId < 1) {
            Response::error('Choose a traveler.');
        }
        $allowed = Database::pdo()->prepare(
            'SELECT id FROM connections
             WHERE status = "accepted"
             AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
             LIMIT 1'
        );
        $allowed->execute([$userId, $otherUserId, $otherUserId, $userId]);
        if (!$allowed->fetch()) {
            Response::error('Accept the connection before chatting.', 403);
        }
        $stmt = Database::pdo()->prepare(
            'SELECT id, sender_id, recipient_id, body, created_at
             FROM direct_messages
             WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
             ORDER BY created_at ASC LIMIT 100'
        );
        $stmt->execute([$userId, $otherUserId, $otherUserId, $userId]);
        Response::ok(['messages' => $stmt->fetchAll()]);
    }

    public static function sendMessage(array $input): void
    {
        $userId = Auth::requireUser();
        $otherUserId = (int) ($input['user_id'] ?? 0);
        $body = trim((string) ($input['body'] ?? ''));
        if ($otherUserId < 1 || $body === '' || strlen($body) > 2000) {
            Response::error('Enter a message for a connected traveler.');
        }
        $allowed = Database::pdo()->prepare(
            'SELECT id FROM connections
             WHERE status = "accepted"
             AND ((requester_id = ? AND recipient_id = ?) OR (requester_id = ? AND recipient_id = ?))
             LIMIT 1'
        );
        $allowed->execute([$userId, $otherUserId, $otherUserId, $userId]);
        if (!$allowed->fetch()) {
            Response::error('Accept the connection before chatting.', 403);
        }
        Database::pdo()->prepare(
            'INSERT INTO direct_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)'
        )->execute([$userId, $otherUserId, $body]);
        $sender = Auth::user();
        NotificationService::create(
            $otherUserId,
            'message',
            'New message',
            ($sender['full_name'] ?? 'A traveler') . ' sent you a message.',
            'profile.html'
        );
        Response::ok(['sent' => true]);
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
