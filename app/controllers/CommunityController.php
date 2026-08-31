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
}
