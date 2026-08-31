<?php
declare(strict_types=1);

final class BookingController
{
    public static function create(array $input): void
    {
        $userId = Auth::requireUser();
        $name = trim((string) ($input['vehicle_name'] ?? ''));
        $category = trim((string) ($input['category'] ?? ''));
        $location = trim((string) ($input['location'] ?? ''));
        $rate = (float) ($input['daily_rate'] ?? 0);
        $start = (string) ($input['start_date'] ?? '');
        $end = (string) ($input['end_date'] ?? '');
        $notes = trim((string) ($input['notes'] ?? ''));

        if ($name === '' || strlen($name) > 180) {
            Response::error('Choose a vehicle to book.');
        }
        $startTs = strtotime($start);
        $endTs = strtotime($end);
        if (!$startTs || !$endTs) {
            Response::error('Pick valid pickup and return dates.');
        }
        if ($endTs < $startTs) {
            Response::error('Return date must be on or after the pickup date.');
        }
        $days = (int) max(1, round(($endTs - $startTs) / 86400) + 1);
        $rate = max(0, round($rate, 2));
        $total = round($rate * $days, 2);

        $pdo = Database::pdo();
        $pdo->prepare(
            'INSERT INTO vehicle_bookings
             (user_id, vehicle_name, category, location, daily_rate, start_date, end_date, days, total, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $userId,
            $name,
            $category !== '' ? $category : null,
            $location !== '' ? $location : null,
            $rate,
            date('Y-m-d', $startTs),
            date('Y-m-d', $endTs),
            $days,
            $total,
            $notes !== '' ? $notes : null,
            'confirmed',
        ]);
        $id = (int) $pdo->lastInsertId();

        NotificationService::create(
            $userId,
            'booking',
            'Booking confirmed',
            $name . ' is reserved for ' . $days . ' day(s). Total $' . number_format($total, 2) . '.',
            'profile.html'
        );
        NotificationService::notifyStaff(
            'booking',
            'New vehicle booking',
            Auth::user()['full_name'] . ' booked ' . $name . '.',
            'admin.html'
        );

        Response::ok([
            'booking' => self::find($id, $userId),
            'message' => 'Your booking is confirmed.',
        ]);
    }

    public static function mine(): void
    {
        $userId = Auth::requireUser();
        $stmt = Database::pdo()->prepare(
            'SELECT id, vehicle_name, category, location, daily_rate, start_date, end_date, days, total, notes, status, created_at
             FROM vehicle_bookings WHERE user_id = ? ORDER BY created_at DESC'
        );
        $stmt->execute([$userId]);
        Response::ok(['bookings' => $stmt->fetchAll()]);
    }

    private static function find(int $id, int $userId): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, vehicle_name, category, location, daily_rate, start_date, end_date, days, total, notes, status, created_at
             FROM vehicle_bookings WHERE id = ? AND user_id = ? LIMIT 1'
        );
        $stmt->execute([$id, $userId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }
}
