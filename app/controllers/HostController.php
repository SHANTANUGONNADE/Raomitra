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

        $type = (string) ($input['listing_type'] ?? 'host');
        if (!in_array($type, ['host', 'vehicle'], true)) {
            $type = 'host';
        }
        if (in_array($user['role'], ['admin', 'co_admin'], true)
            || ($user['role'] === 'host' && $type !== 'vehicle')) {
            Response::error('Your account cannot submit this listing request.');
        }
        $city = trim((string) ($input['city'] ?? ''));
        $country = trim((string) ($input['country'] ?? 'India'));
        $phone = trim((string) ($input['phone'] ?? ''));
        $bio = trim((string) ($input['bio'] ?? ''));
        $experience = trim((string) ($input['experience'] ?? ''));
        $vehicleInfo = trim((string) ($input['vehicle_info'] ?? ''));
        $vehicleCategory = strtolower(trim((string) ($input['vehicle_category'] ?? '')));
        $dailyRate = (float) ($input['daily_rate'] ?? 0);

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
        if ($type === 'vehicle' && !in_array($vehicleCategory, ['scooters', 'bikes', 'cars'], true)) {
            Response::error('Choose a vehicle category.');
        }
        if ($type === 'vehicle' && ($dailyRate < 100 || $dailyRate > 100000)) {
            Response::error('Enter a valid daily price (at least ₹100).');
        }

        $pdo = Database::pdo();
        $pending = $pdo->prepare(
            "SELECT id FROM host_applications
             WHERE user_id = ? AND listing_type = ? AND status = 'pending' LIMIT 1"
        );
        $pending->execute([$userId, $type]);
        if ($pending->fetch()) {
            Response::error('You already have a host application waiting for review.');
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO host_applications
                 (user_id, listing_type, city, country, phone, bio, experience, vehicle_info,
                  vehicle_category, daily_rate, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $userId,
                $type,
                $city,
                $country !== '' ? $country : 'India',
                $phone,
                $bio,
                $experience !== '' ? $experience : null,
                $vehicleInfo !== '' ? $vehicleInfo : null,
                $vehicleCategory !== '' ? $vehicleCategory : null,
                $type === 'vehicle' ? $dailyRate : null,
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
                $type === 'vehicle' ? 'Vehicle listing sent to admin' : 'Host request sent to admin',
                $type === 'vehicle'
                    ? 'Your vehicle listing is now in the admin dashboard for review.'
                    : 'Your Become a Host request is now in the admin dashboard for review.',
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
            'application' => self::latestFor($userId, $type),
            'message' => $type === 'vehicle'
                ? 'Your vehicle listing was sent to admin for approval.'
                : 'Your host request was sent to admin. You will be notified after review.',
        ]);
    }

    public static function mine(): void
    {
        $userId = Auth::requireUser();
        $type = (string) ($_GET['type'] ?? 'host');
        if (!in_array($type, ['host', 'vehicle'], true)) {
            $type = 'host';
        }
        Response::ok(['application' => self::latestFor($userId, $type), 'user' => Auth::user()]);
    }

    public static function listHosts(): void
    {
        $stmt = Database::pdo()->query(
            "SELECT u.id, u.full_name, u.avatar_url, u.location, u.bio,
                    a.city, a.country, a.listing_type, a.created_at
             FROM users u
             LEFT JOIN host_applications a ON a.id = (
                 SELECT a2.id FROM host_applications a2
                 WHERE a2.user_id = u.id AND a2.status = 'approved'
                 ORDER BY a2.created_at DESC LIMIT 1
             )
             WHERE u.role = 'host' OR a.id IS NOT NULL ORDER BY u.full_name ASC"
        );
        Response::ok(['hosts' => $stmt->fetchAll()]);
    }

    public static function listVehicles(): void
    {
        $pdo = Database::pdo();
        $stmt = $pdo->query(
            "SELECT a.id, a.user_id, u.full_name, a.city, a.country, a.vehicle_info,
                    a.vehicle_category, a.daily_rate
             FROM host_applications a
             INNER JOIN users u ON u.id = a.user_id
             WHERE a.status = 'approved' AND a.listing_type = 'vehicle'
               AND a.vehicle_info IS NOT NULL AND a.vehicle_category IS NOT NULL
               AND a.daily_rate IS NOT NULL
             ORDER BY a.created_at DESC"
        );
        $vehicles = $stmt->fetchAll();
        foreach ($vehicles as &$vehicle) {
            $vehicle['name'] = trim((string) explode(',', (string) $vehicle['vehicle_info'])[0]);
            $vehicle['location'] = trim(($vehicle['city'] ?? '') . ', ' . ($vehicle['country'] ?? 'India'), ', ');
            $vehicle['category'] = $vehicle['vehicle_category'];
            $vehicle['price'] = (float) $vehicle['daily_rate'];
        }
        unset($vehicle);
        Response::ok(['vehicles' => $vehicles]);
    }

    private static function latestFor(int $userId, string $type = 'host'): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, listing_type, city, country, phone, bio, experience, vehicle_info,
                    vehicle_category, daily_rate, status, review_note, created_at, updated_at
             FROM host_applications WHERE user_id = ? AND listing_type = ? ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$userId, $type]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
