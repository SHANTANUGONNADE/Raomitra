<?php
declare(strict_types=1);

final class AuthController
{
    public static function register(array $input): void
    {
        $name = trim((string) preg_replace('/\s+/', ' ', (string) ($input['full_name'] ?? '')));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $confirm = (string) ($input['confirm_password'] ?? $password);

        if ($name === '' || !preg_match("/^[\\p{L}]+(?:[ '\\-][\\p{L}]+)*$/u", $name)) {
            Response::error('Full name can contain letters only (spaces, hyphens, and apostrophes are allowed).');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Enter a valid email address.');
        }
        if (strlen($password) < 8) {
            Response::error('Password must be at least 8 characters.');
        }
        if ($password !== $confirm) {
            Response::error('Passwords do not match.');
        }

        $pdo = Database::pdo();
        $exists = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            Response::error('An account with this email already exists.', 409);
        }

        $pdo->prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
            ->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), 'customer']);
        $userId = (int) $pdo->lastInsertId();
        WalletService::ensure($userId);
        NotificationService::create(
            $userId,
            'community',
            'Welcome to Roamitra',
            'Your account is ready. Plan a trip, join the community, or try the translator.',
            'planner.html'
        );
        Response::ok([
            'registered' => true,
            'message' => 'Signup successfully. Please log in to continue.',
        ]);
    }

    public static function login(array $input): void
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            Response::error('Enter your email and password.');
        }
        $stmt = Database::pdo()->prepare('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            Response::error('Incorrect email or password.', 401);
        }
        $remember = !empty($input['remember']) && $input['remember'] !== 'false' && $input['remember'] !== '0';
        Auth::login((int) $row['id'], $remember);
        WalletService::ensure((int) $row['id']);
        Response::ok(['user' => Auth::user(), 'message' => 'Logged in successfully.']);
    }

    public static function adminLogin(array $input): void
    {
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
            Response::error('Enter your admin email and password.');
        }
        $adminEmails = ['admin@raomitra.com', 'admin@roamitra.com'];
        $pdo = Database::pdo();
        if (in_array($email, $adminEmails, true)) {
            $stmt = $pdo->prepare('SELECT id, password_hash, role FROM users WHERE email IN (?, ?) LIMIT 1');
            $stmt->execute($adminEmails);
        } else {
            $stmt = $pdo->prepare('SELECT id, password_hash, role FROM users WHERE email = ? LIMIT 1');
            $stmt->execute([$email]);
        }
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password_hash'])) {
            Response::error('Incorrect admin email or password.', 401);
        }
        $role = strtolower(trim((string) ($row['role'] ?? '')));
        if (!in_array($role, ['admin', 'co_admin'], true)) {
            Response::error('This account is not an admin yet. Ask an admin to set your role to admin, then sign in again.', 403);
        }
        $remember = !empty($input['remember']) && $input['remember'] !== 'false' && $input['remember'] !== '0';
        Auth::login((int) $row['id'], $remember);
        WalletService::ensure((int) $row['id']);
        Response::ok(['user' => Auth::user(), 'message' => 'Admin signed in.']);
    }

    public static function logout(): void
    {
        Auth::logout();
        Response::ok(['message' => 'Logged out']);
    }

    public static function me(): void
    {
        $user = Auth::user();
        if (!$user) {
            Response::error('Not authenticated.', 401);
        }
        Response::ok(['user' => $user]);
    }
}
