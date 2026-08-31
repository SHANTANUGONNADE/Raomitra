<?php
declare(strict_types=1);

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $config = require dirname(__DIR__) . '/config/config.php';
        $db = $config['db'];
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];

        $server = new PDO(
            sprintf('mysql:host=%s;charset=%s', $db['host'], $db['charset']),
            $db['user'],
            $db['pass'],
            $options
        );
        $server->exec(
            'CREATE DATABASE IF NOT EXISTS `raomitra` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
        );
        $server->exec('USE `raomitra`');
        self::$pdo = $server;

        return self::$pdo;
    }
}
