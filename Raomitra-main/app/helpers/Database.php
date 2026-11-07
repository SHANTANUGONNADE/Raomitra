<?php
declare(strict_types=1);

final class Database
{
    private static ?PDO $pdo = null;
    private static string $driver = 'mysql';

    public static function driver(): string
    {
        self::pdo();
        return self::$driver;
    }

    public static function isSqlite(): bool
    {
        return self::driver() === 'sqlite';
    }

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $config = require dirname(__DIR__) . '/config/config.php';
        $db = $config['db'];
        $host = strtolower(trim((string) $db['host']));
        $serverless = getenv('VERCEL') === '1';
        $localHost = $host === '' || $host === '127.0.0.1' || $host === 'localhost';

        if ($serverless && $localHost) {
            return self::connectSqlite();
        }

        if (in_array('mysql', PDO::getAvailableDrivers(), true)) {
            try {
                return self::connectMysql($db, $serverless);
            } catch (Throwable $e) {
                if ($serverless) {
                    return self::connectSqlite();
                }
                throw $e;
            }
        }

        if ($serverless && in_array('sqlite', PDO::getAvailableDrivers(), true)) {
            return self::connectSqlite();
        }

        throw new RuntimeException('No PDO database driver is available.');
    }

    private static function connectMysql(array $db, bool $serverless): PDO
    {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ];
        if (!empty($db['ssl']) && defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }

        $host = (string) $db['host'];
        $port = (int) ($db['port'] ?: 3306);
        $name = (string) ($db['name'] ?: 'raomitra');
        $charset = (string) $db['charset'];

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

        self::$driver = 'mysql';
        return self::$pdo;
    }

    private static function connectSqlite(): PDO
    {
        if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
            throw new RuntimeException('PDO SQLite driver is not available.');
        }
        $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'raomitra.sqlite';
        self::$pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        self::$pdo->exec('PRAGMA foreign_keys = ON');
        try {
            self::$pdo->exec('PRAGMA journal_mode = WAL');
        } catch (Throwable $e) {
            // Some serverless filesystems reject WAL; DELETE mode still works.
        }
        self::$driver = 'sqlite';
        return self::$pdo;
    }
}
