<?php
declare(strict_types=1);

final class HostController
{
    public static function apply(array $input): void
    {
        $user = Auth::user();
        if (!$user) {
            Response::error('Please log in to continue.', 401);
        }
        $userId = (int) $user['id'];
        if (in_array($user['role'], ['host', 'admin', 'co_admin'], true)) {
            Response::error('Your account is already a host or staff account.');
        }

        $type = (string) ($input['listing_type'] ?? 'host');
        if (!in_array($type, ['host', 'vehicle'], true)) {
            $type = 'host';
        }
        $city = trim((string) ($input['city'] ?? ''));
        $country = trim((string) ($input['country'] ?? 'India'));
        $phone = trim((string) ($input['phone'] ?? ''));
        $bio = trim((string) ($input['bio'] ?? ''));
        $experience = trim((string) ($input['experience'] ?? ''));
        $vehicleInfo = trim((string) ($input['vehicle_info'] ?? ''));

        if ($city === '' || strlen($city) > 120) {
            Response::error('Enter the city you host or list from.');
        }
        if ($phone === '' || strlen($phone) > 40) {
            Response::error('Enter a contact phone number.');
        }
        if (strlen($bio) < 20) {
            Response::error('Tell travelers a bit more about yourself (at least 20 characters).');
        }
        if ($type === 'vehicle' && $vehicleInfo === '') {
            Response::error('Describe the vehicle you want to list.');
        }

        $pdo = Database::pdo();
        $pending = $pdo->prepare(
            "SELECT id FROM host_applications WHERE user_id = ? AND status = 'pending' LIMIT 1"
        );
        $pending->execute([$userId]);
        if ($pending->fetch()) {
            Response::error('You already have a host application waiting for review.');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO host_applications
                 (user_id, listing_type, city, country, phone, bio, experience, vehicle_info, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $type,
                $city,
                $country !== '' ? $country : 'India',
                $phone,
                $bio,
                $experience !== '' ? $experience : null,
                $vehicleInfo !== '' ? $vehicleInfo : null,
                'pending',
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        try {
            NotificationService::create(
                $userId,
                'host',
                'Host request sent to admin',
                'Your Become a Host request is now in the admin dashboard for review.',
                'host.html'
            );
            NotificationService::notifyStaff(
                'host',
                'New host request',
                $user['full_name'] . ' asked to become a ' . ($type === 'vehicle' ? 'vehicle owner' : 'host') . ' in ' . $city . '.',
                'admin.html'
            );
        } catch (Throwable $e) {
            // Request is already saved for admin even if a notification fails.
        }

        Response::ok([
            'application' => self::latestFor($userId),
            'message' => 'Your host request was sent to admin. You will be notified after review.',
        ]);
    }

    public static function mine(): void
    {
        $userId = Auth::requireUser();
        Response::ok(['application' => self::latestFor($userId), 'user' => Auth::user()]);
    }

    private static function latestFor(int $userId): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, listing_type, city, country, phone, bio, experience, vehicle_info, status, review_note, created_at, updated_at
             FROM host_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
