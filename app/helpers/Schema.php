<?php
declare(strict_types=1);

final class Schema
{
    public static function migrate(): void
    {
        $pdo = Database::pdo();
        if (Database::isSqlite()) {
            self::migrateSqlite($pdo);
            self::seedAdmin($pdo);
            return;
        }

        $pdo->exec("SET NAMES utf8mb4");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS app_sessions (
                id VARCHAR(128) NOT NULL PRIMARY KEY,
                data LONGBLOB NOT NULL,
                expires_at INT UNSIGNED NOT NULL,
                KEY idx_app_sessions_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                full_name VARCHAR(120) NOT NULL,
                email VARCHAR(190) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'customer',
                avatar_url MEDIUMTEXT NULL,
                cover_url MEDIUMTEXT NULL,
                bio VARCHAR(400) NULL,
                location VARCHAR(120) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_users_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS trips (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                destination VARCHAR(180) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                budget DECIMAL(12,2) NULL,
                budget_currency VARCHAR(8) NOT NULL DEFAULT 'USD',
                traveling_with ENUM('solo','couple','family','friends','group') NOT NULL DEFAULT 'solo',
                group_size TINYINT UNSIGNED NULL,
                arrival_time ENUM('morning','afternoon','evening','late_night') NULL,
                departure_time ENUM('morning','afternoon','evening','late_night') NULL,
                preferences JSON NULL,
                pace ENUM('relaxed','moderate','packed') NOT NULL DEFAULT 'moderate',
                status ENUM('draft','generated','saved') NOT NULL DEFAULT 'draft',
                is_saved TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_trips_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                KEY idx_trips_user (user_id),
                KEY idx_trips_saved (user_id, is_saved)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS itineraries (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                trip_id INT UNSIGNED NOT NULL,
                version INT UNSIGNED NOT NULL DEFAULT 1,
                is_current TINYINT(1) NOT NULL DEFAULT 1,
                itinerary_json LONGTEXT NOT NULL,
                summary TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_itineraries_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
                UNIQUE KEY uniq_trip_version (trip_id, version),
                KEY idx_itineraries_current (trip_id, is_current)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS itinerary_messages (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                trip_id INT UNSIGNED NOT NULL,
                itinerary_id INT UNSIGNED NULL,
                role ENUM('user','assistant') NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_itinerary_messages_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS notifications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                type VARCHAR(40) NOT NULL,
                title VARCHAR(180) NOT NULL,
                body TEXT NULL,
                link VARCHAR(255) NULL,
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                KEY idx_notifications_user (user_id, is_read, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS wallets (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                currency VARCHAR(8) NOT NULL DEFAULT 'USD',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_wallets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY uniq_wallets_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                wallet_id INT UNSIGNED NOT NULL,
                type ENUM('credit','debit') NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                description VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_wallet_tx_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
                KEY idx_wallet_tx (wallet_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS translator_prefs (
                user_id INT UNSIGNED PRIMARY KEY,
                source_lang VARCHAR(16) NOT NULL DEFAULT 'en',
                target_lang VARCHAR(16) NOT NULL DEFAULT 'hi',
                CONSTRAINT fk_translator_prefs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS translator_history (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                source_lang VARCHAR(16) NOT NULL,
                target_lang VARCHAR(16) NOT NULL,
                source_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                mode ENUM('text','voice') NOT NULL DEFAULT 'text',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_translator_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                KEY idx_translator_user (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS community_posts (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                title VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_community_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS community_replies (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                post_id INT UNSIGNED NOT NULL,
                user_id INT UNSIGNED NOT NULL,
                body TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_community_replies_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
                CONSTRAINT fk_community_replies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS host_applications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                listing_type ENUM('host','vehicle') NOT NULL DEFAULT 'host',
                city VARCHAR(120) NOT NULL,
                country VARCHAR(120) NOT NULL DEFAULT 'India',
                phone VARCHAR(40) NOT NULL,
                bio TEXT NOT NULL,
                experience VARCHAR(80) NULL,
                vehicle_info VARCHAR(255) NULL,
                status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
                review_note VARCHAR(255) NULL,
                reviewed_by INT UNSIGNED NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_host_apps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                KEY idx_host_apps_status (status, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS vehicle_bookings (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                vehicle_name VARCHAR(180) NOT NULL,
                category VARCHAR(40) NULL,
                location VARCHAR(180) NULL,
                daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                days SMALLINT UNSIGNED NOT NULL DEFAULT 1,
                total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                notes VARCHAR(255) NULL,
                status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                KEY idx_bookings_user (user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        self::seedAdmin($pdo);

        self::ensureColumn($pdo, 'trips', 'arrival_time', "ALTER TABLE trips ADD COLUMN arrival_time ENUM('morning','afternoon','evening','late_night') NULL AFTER group_size");
        self::ensureColumn($pdo, 'trips', 'departure_time', "ALTER TABLE trips ADD COLUMN departure_time ENUM('morning','afternoon','evening','late_night') NULL AFTER arrival_time");
        self::ensureColumn($pdo, 'trips', 'group_size', 'ALTER TABLE trips ADD COLUMN group_size TINYINT UNSIGNED NULL AFTER traveling_with');
        self::ensureColumn($pdo, 'trips', 'is_saved', 'ALTER TABLE trips ADD COLUMN is_saved TINYINT(1) NOT NULL DEFAULT 0 AFTER status');
        self::ensureColumn($pdo, 'users', 'cover_url', 'ALTER TABLE users ADD COLUMN cover_url MEDIUMTEXT NULL AFTER avatar_url');
        self::ensureColumn($pdo, 'users', 'bio', 'ALTER TABLE users ADD COLUMN bio VARCHAR(400) NULL AFTER cover_url');
        self::ensureColumn($pdo, 'users', 'location', 'ALTER TABLE users ADD COLUMN location VARCHAR(120) NULL AFTER bio');
        try {
            $pdo->exec('ALTER TABLE users MODIFY avatar_url MEDIUMTEXT NULL');
        } catch (Throwable $e) {
            // already wide enough
        }
        self::widenRoleColumn($pdo);
    }

    private static function widenRoleColumn(PDO $pdo): void
    {
        $stmt = $pdo->prepare(
            'SELECT DATA_TYPE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute(['users', 'role']);
        $type = strtolower((string) ($stmt->fetchColumn() ?: ''));
        if ($type === 'enum') {
            $pdo->exec("ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'customer'");
        }
        $pdo->exec("UPDATE users SET role = 'admin' WHERE LOWER(TRIM(role)) IN ('admin','administrator','superadmin','super_admin')");
        $pdo->exec("UPDATE users SET role = 'co_admin' WHERE LOWER(REPLACE(TRIM(role),'-','_')) IN ('co_admin','coadmin')");
        $pdo->exec("UPDATE users SET role = 'host' WHERE LOWER(TRIM(role)) IN ('host','vendor')");
    }

    private static function ensureColumn(PDO $pdo, string $table, string $column, string $alterSql): void
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$table, $column]);
        if ((int) $stmt->fetchColumn() === 0) {
            $pdo->exec($alterSql);
        }
    }

    private static function seedAdmin(PDO $pdo): void
    {
        $exists = $pdo->query("SELECT id FROM users WHERE role IN ('admin','co_admin') LIMIT 1")->fetch();
        if ($exists) {
            return;
        }
        $email = 'admin@raomitra.com';
        $found = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $found->execute([$email]);
        $row = $found->fetch();
        if ($row) {
            $pdo->prepare("UPDATE users SET role = 'admin' WHERE id = ?")->execute([(int) $row['id']]);
            return;
        }
        $pdo->prepare('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)')
            ->execute(['Roamitra Admin', $email, password_hash('Admin1234!', PASSWORD_DEFAULT), 'admin']);
        WalletService::ensure((int) $pdo->lastInsertId());
    }

    private static function migrateSqlite(PDO $pdo): void
    {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS app_sessions (
                id TEXT PRIMARY KEY,
                data BLOB NOT NULL,
                expires_at INTEGER NOT NULL
            )
        ");
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions (expires_at)');
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'customer',
                avatar_url TEXT NULL,
                cover_url TEXT NULL,
                bio TEXT NULL,
                location TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                destination TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                budget REAL NULL,
                budget_currency TEXT NOT NULL DEFAULT 'USD',
                traveling_with TEXT NOT NULL DEFAULT 'solo',
                group_size INTEGER NULL,
                arrival_time TEXT NULL,
                departure_time TEXT NULL,
                preferences TEXT NULL,
                pace TEXT NOT NULL DEFAULT 'moderate',
                status TEXT NOT NULL DEFAULT 'draft',
                is_saved INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS itineraries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                is_current INTEGER NOT NULL DEFAULT 1,
                itinerary_json TEXT NOT NULL,
                summary TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
                UNIQUE (trip_id, version)
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS itinerary_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL,
                itinerary_id INTEGER NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NULL,
                link TEXT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS wallets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                balance REAL NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS wallet_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                wallet_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                amount REAL NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS translator_prefs (
                user_id INTEGER PRIMARY KEY,
                source_lang TEXT NOT NULL DEFAULT 'en',
                target_lang TEXT NOT NULL DEFAULT 'hi',
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS translator_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                source_lang TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                source_text TEXT NOT NULL,
                translated_text TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'text',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS community_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS community_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS host_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                listing_type TEXT NOT NULL DEFAULT 'host',
                city TEXT NOT NULL,
                country TEXT NOT NULL DEFAULT 'India',
                phone TEXT NOT NULL,
                bio TEXT NOT NULL,
                experience TEXT NULL,
                vehicle_info TEXT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                review_note TEXT NULL,
                reviewed_by INTEGER NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS vehicle_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                vehicle_name TEXT NOT NULL,
                category TEXT NULL,
                location TEXT NULL,
                daily_rate REAL NOT NULL DEFAULT 0,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                days INTEGER NOT NULL DEFAULT 1,
                total REAL NOT NULL DEFAULT 0,
                notes TEXT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        ");
        self::ensureSqliteColumn($pdo, 'users', 'cover_url', 'TEXT NULL');
        self::ensureSqliteColumn($pdo, 'users', 'bio', 'TEXT NULL');
        self::ensureSqliteColumn($pdo, 'users', 'location', 'TEXT NULL');
    }

    private static function ensureSqliteColumn(PDO $pdo, string $table, string $column, string $ddl): void
    {
        $rows = $pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll();
        foreach ($rows as $row) {
            if (strcasecmp((string) ($row['name'] ?? ''), $column) === 0) {
                return;
            }
        }
        $pdo->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $ddl);
    }
}
