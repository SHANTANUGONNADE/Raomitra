<?php
declare(strict_types=1);

final class ProfileController
{
    public static function show(): void
    {
        $userId = Auth::requireUser();
        $user = Auth::user();
        $wallet = WalletService::ensure($userId);
        $trips = Database::pdo()->prepare(
            'SELECT id, destination, start_date, end_date, status, is_saved, traveling_with, group_size, created_at
             FROM trips WHERE user_id = ? ORDER BY start_date DESC'
        );
        $trips->execute([$userId]);
        $bookings = Database::pdo()->prepare(
            'SELECT id, vehicle_name, location, start_date, end_date, days, total, status, created_at
             FROM vehicle_bookings WHERE user_id = ? ORDER BY created_at DESC'
        );
        $bookings->execute([$userId]);
        $host = Database::pdo()->prepare(
            'SELECT id, listing_type, city, status, review_note, created_at FROM host_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        );
        $host->execute([$userId]);
        Response::ok([
            'user' => $user,
            'wallet' => $wallet,
            'transactions' => WalletService::transactions((int) $wallet['id']),
            'trips' => $trips->fetchAll(),
            'bookings' => $bookings->fetchAll(),
            'host_application' => $host->fetch() ?: null,
        ]);
    }

    public static function update(array $input): void
    {
        $userId = Auth::requireUser();
        $name = trim((string) preg_replace('/\s+/', ' ', (string) ($input['full_name'] ?? '')));
        if ($name === '' || !preg_match("/^[\\p{L}]+(?:[ '\\-][\\p{L}]+)*$/u", $name)) {
            Response::error('Full name can contain letters only (spaces, hyphens, and apostrophes are allowed).');
        }
        $bio = trim((string) ($input['bio'] ?? ''));
        $bioLen = function_exists('mb_strlen') ? mb_strlen($bio) : strlen($bio);
        if ($bioLen > 400) {
            Response::error('Keep your bio under 400 characters.');
        }
        $location = trim((string) ($input['location'] ?? ''));
        $locLen = function_exists('mb_strlen') ? mb_strlen($location) : strlen($location);
        if ($locLen > 120) {
            Response::error('Keep your location under 120 characters.');
        }

        $avatar = self::sanitizeMedia($input['avatar_url'] ?? null, 900000, true, $userId, 'avatar');
        $cover = self::sanitizeMedia($input['cover_url'] ?? null, 1400000, false, $userId, 'cover');

        $pdo = Database::pdo();
        $current = $pdo->prepare('SELECT avatar_url, cover_url FROM users WHERE id = ? LIMIT 1');
        $current->execute([$userId]);
        $row = $current->fetch() ?: [];

        $avatarSql = $avatar === false ? ($row['avatar_url'] ?? null) : ($avatar === '' ? null : $avatar);
        $coverSql = $cover === false ? ($row['cover_url'] ?? null) : ($cover === '' ? null : $cover);

        $pdo->prepare('UPDATE users SET full_name = ?, bio = ?, location = ?, avatar_url = ?, cover_url = ? WHERE id = ?')
            ->execute([
                $name,
                $bio !== '' ? $bio : null,
                $location !== '' ? $location : null,
                $avatarSql,
                $coverSql,
                $userId,
            ]);

        foreach (['avatar' => $avatar, 'cover' => $cover] as $kind => $value) {
            if ($value !== false && !str_starts_with($value, 'api?r=')) {
                $pdo->prepare('DELETE FROM profile_media WHERE user_id = ? AND kind = ?')
                    ->execute([$userId, $kind]);
            }
        }

        Response::ok([
            'user' => Auth::user(),
            'message' => 'Profile saved.',
        ]);
    }

    public static function media(int $userId, string $kind): never
    {
        if ($userId < 1 || !in_array($kind, ['avatar', 'cover'], true)) {
            Response::error('Profile image not found.', 404);
        }
        $stmt = Database::pdo()->prepare(
            'SELECT mime_type, image_data FROM profile_media WHERE user_id = ? AND kind = ? LIMIT 1'
        );
        $stmt->execute([$userId, $kind]);
        $media = $stmt->fetch();
        if (!$media) {
            Response::error('Profile image not found.', 404);
        }
        header('Content-Type: ' . $media['mime_type']);
        header('Cache-Control: public, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        echo $media['image_data'];
        exit;
    }

    /**
     * @return string|false empty string clears, false means leave unchanged
     */
    private static function sanitizeMedia(mixed $value, int $maxLen, bool $photoOnly, int $userId, string $kind): string|false
    {
        if ($value === null) {
            return false;
        }
        $raw = trim((string) $value);
        if ($raw === '' || $raw === 'remove') {
            return '';
        }
        if (str_starts_with($raw, 'preset:')) {
            $id = substr($raw, 7);
            $presets = [
                'forest' => 'linear-gradient(135deg,#0B3D2E 0%,#1A8A58 45%,#76D885 100%)',
                'ocean' => 'linear-gradient(135deg,#051635 0%,#0A4A6E 50%,#47A8A3 100%)',
                'sunset' => 'linear-gradient(135deg,#7C2D12 0%,#EA580C 45%,#FBBF24 100%)',
                'dusk' => 'linear-gradient(135deg,#1E1B4B 0%,#6D28D9 55%,#F472B6 100%)',
                'night' => 'linear-gradient(135deg,#020617 0%,#0F172A 50%,#334155 100%)',
            ];
            if ($photoOnly || !isset($presets[$id])) {
                Response::error('Choose a valid cover style.');
            }
            return $presets[$id];
        }
        if (str_starts_with($raw, 'linear-gradient(')) {
            if ($photoOnly) {
                Response::error('Use a JPEG, PNG, or WebP image.');
            }
            return $raw;
        }
        if (preg_match('#^uploads/profiles/[a-z0-9._-]+$#i', $raw) === 1) {
            return $raw;
        }
        if (preg_match('#^https?://#i', $raw) === 1 && strlen($raw) <= 500) {
            return $raw;
        }
        $head = substr($raw, 0, 80);
        if (preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i', $head) !== 1) {
            Response::error('Use a JPEG, PNG, or WebP image.');
        }
        if (strlen($raw) > $maxLen) {
            Response::error('That photo is too large. Try a smaller image.');
        }
        $comma = strpos($raw, ',');
        $bin = $comma === false ? false : base64_decode(substr($raw, $comma + 1), true);
        $image = $bin === false ? false : @getimagesizefromstring($bin);
        $mime = is_array($image) ? (string) ($image['mime'] ?? '') : '';
        if ($bin === false || strlen($bin) < 24 || !in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            Response::error('Could not read that photo.');
        }
        if (getenv('VERCEL') === '1') {
            $upsert = Database::isSqlite()
                ? 'INSERT INTO profile_media (user_id, kind, mime_type, image_data) VALUES (?, ?, ?, ?)
                   ON CONFLICT(user_id, kind) DO UPDATE SET mime_type = excluded.mime_type, image_data = excluded.image_data'
                : 'INSERT INTO profile_media (user_id, kind, mime_type, image_data) VALUES (?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_data = VALUES(image_data)';
            $statement = Database::pdo()->prepare($upsert);
            $statement->bindValue(1, $userId, PDO::PARAM_INT);
            $statement->bindValue(2, $kind);
            $statement->bindValue(3, $mime);
            $statement->bindValue(4, $bin, PDO::PARAM_LOB);
            $statement->execute();
            $endpoint = 'api?r=';
            return $endpoint . rawurlencode('/profile-media/' . $userId . '/' . $kind)
                . '&v=' . bin2hex(random_bytes(4));
        }
        return self::storeImage($userId, $kind, $bin, $mime);
    }

    private static function storeImage(int $userId, string $kind, string $bin, string $mime): string
    {
        $dir = dirname(__DIR__, 2) . '/public/uploads/profiles';
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            Response::error('Could not save the photo on the server.');
        }
        $extension = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime];
        $name = $kind . '-' . $userId . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
        $path = $dir . DIRECTORY_SEPARATOR . $name;
        if (file_put_contents($path, $bin) === false) {
            Response::error('Could not save the photo on the server.');
        }
        return 'uploads/profiles/' . $name;
    }
}
