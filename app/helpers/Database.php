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

        if (!in_array('mysql', PDO::getAvailableDrivers(), true)) {
            throw new RuntimeException('PDO MySQL driver is not available.');
        }

        $config = require dirname(__DIR__) . '/config/config.php';
        $db = $config['db'];
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        if (!empty($db['ssl']) && defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }

        $host = (string) $db['host'];
        $port = (int) ($db['port'] ?: 3306);
        $name = (string) $db['name'];
        $charset = (string) $db['charset'];
        $serverless = getenv('VERCEL') === '1';

        try {
            self::$pdo = new PDO(
                sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset),
                $db['user'],
                $db['pass'],
                $options
            );
        } catch (PDOException $e) {
            if ($serverless) {
                throw $e;
            }
            $server = new PDO(
                sprintf('mysql:host=%s;port=%d;charset=%s', $host, $port, $charset),
                $db['user'],
                $db['pass'],
                $options
            );
            $server->exec(
                'CREATE DATABASE IF NOT EXISTS `raomitra` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
            );
            $server->exec('USE `raomitra`');
            self::$pdo = $server;
        }

        return self::$pdo;
    }
}
