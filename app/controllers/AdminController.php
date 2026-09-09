<?php
declare(strict_types=1);

final class AdminController
{
    public static function overview(): void
    {
        Auth::requireRole(['admin', 'co_admin']);
        $pdo = Database::pdo();

        $apps = $pdo->query(
            "SELECT a.id, a.user_id, u.full_name, u.email, a.listing_type, a.city, a.country, a.phone,
                    a.bio, a.experience, a.vehicle_info, a.status, a.review_note, a.created_at
             FROM host_applications a
             INNER JOIN users u ON u.id = a.user_id
             ORDER BY FIELD(a.status,'pending','approved','rejected'), a.created_at DESC"
        )->fetchAll();

        $bookings = $pdo->query(
            "SELECT b.id, b.user_id, u.full_name, u.email, b.vehicle_name, b.category, b.location,
                    b.daily_rate, b.start_date, b.end_date, b.days, b.total, b.status, b.created_at
             FROM vehicle_bookings b
             INNER JOIN users u ON u.id = b.user_id
             ORDER BY b.created_at DESC
             LIMIT 80"
        )->fetchAll();

        $users = $pdo->query(
            'SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 80'
        )->fetchAll();

        $pending = 0;
        foreach ($apps as $app) {
            if (($app['status'] ?? '') === 'pending') {
                $pending++;
            }
        }

        Response::ok([
            'counts' => [
                'pending_hosts' => $pending,
                'bookings' => count($bookings),
                'users' => (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(),
            ],
            'applications' => $apps,
            'bookings' => $bookings,
            'users' => $users,
        ]);
    }

    public static function reviewHost(array $input): void
    {
        $staff = Auth::requireRole(['admin', 'co_admin']);
        $id = (int) ($input['id'] ?? 0);
        $status = (string) ($input['status'] ?? '');
        $note = trim((string) ($input['note'] ?? ''));
        if ($id < 1 || !in_array($status, ['approved', 'rejected'], true)) {
            Response::error('Choose approve or reject for a valid application.');
        }

        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT * FROM host_applications WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $app = $stmt->fetch();
        if (!$app) {
            Response::error('Application not found.', 404);
        }
        if ($app['status'] !== 'pending') {
            Response::error('This application was already reviewed.');
        }

        $pdo->prepare(
            'UPDATE host_applications SET status = ?, review_note = ?, reviewed_by = ? WHERE id = ?'
        )->execute([$status, $note !== '' ? $note : null, (int) $staff['id'], $id]);

        if ($status === 'approved') {
            $pdo->prepare("UPDATE users SET role = 'host' WHERE id = ? AND role = 'customer'")
                ->execute([(int) $app['user_id']]);
            NotificationService::create(
                (int) $app['user_id'],
                'host',
                'You are now a verified host',
                $note !== '' ? $note : 'Your host application was approved. You can list stays or vehicles with Roamitra.',
                'profile.html'
            );
        } else {
            NotificationService::create(
                (int) $app['user_id'],
                'host',
                'Host application not approved',
                $note !== '' ? $note : 'Your application was not approved. You can update details and apply again.',
                'host.html'
            );
        }

        Response::ok(['message' => $status === 'approved' ? 'Host approved.' : 'Application rejected.']);
    }

    public static function setUserRole(array $input): void
    {
        $staff = Auth::requireRole(['admin', 'co_admin']);
        $userId = (int) ($input['user_id'] ?? $input['id'] ?? 0);
        $role = strtolower(trim((string) ($input['role'] ?? '')));
        $allowed = ['customer', 'host', 'co_admin', 'admin'];
        if ($userId < 1 || !in_array($role, $allowed, true)) {
            Response::error('Choose a valid user and role.');
        }

        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT id, role, email FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $target = $stmt->fetch();
        if (!$target) {
            Response::error('User not found.', 404);
        }

        $currentRole = strtolower(trim((string) $target['role']));
        if (in_array($currentRole, ['admin', 'co_admin'], true) && !in_array($role, ['admin', 'co_admin'], true)) {
            $staffLeft = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role IN ('admin','co_admin')")->fetchColumn();
            if ($staffLeft < 2) {
                Response::error('Keep at least one admin account.');
            }
        }

        $pdo->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $userId]);
        if ((int) $staff['id'] === $userId) {
            Auth::login($userId, false);
        }

        Response::ok([
            'message' => 'Role updated to ' . $role . '. Ask that person to log out and log in again.',
            'user_id' => $userId,
            'role' => $role,
        ]);
    }
}
