<?php
declare(strict_types=1);

final class WalletService
{
    public static function ensure(int $userId): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare('SELECT id, user_id, balance, currency, updated_at FROM wallets WHERE user_id = ? LIMIT 1');
        $stmt->execute([$userId]);
        $wallet = $stmt->fetch();
        if ($wallet) {
            return $wallet;
        }
        $pdo->prepare('INSERT INTO wallets (user_id, balance, currency) VALUES (?, 0, ?)')->execute([$userId, 'USD']);
        $stmt->execute([$userId]);
        return $stmt->fetch();
    }

    public static function transactions(int $walletId, int $limit = 30): array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT id, type, amount, description, created_at
             FROM wallet_transactions
             WHERE wallet_id = ?
             ORDER BY created_at DESC
             LIMIT ' . (int) $limit
        );
        $stmt->execute([$walletId]);
        return $stmt->fetchAll();
    }
}
