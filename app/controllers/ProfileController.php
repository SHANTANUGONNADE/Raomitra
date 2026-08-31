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
}
