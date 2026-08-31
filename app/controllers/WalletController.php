<?php
declare(strict_types=1);

final class WalletController
{
    public static function show(): void
    {
        $userId = Auth::requireUser();
        $wallet = WalletService::ensure($userId);
        Response::ok([
            'wallet' => $wallet,
            'transactions' => WalletService::transactions((int) $wallet['id']),
        ]);
    }
}
