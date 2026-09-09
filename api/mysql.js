'use strict';

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

function parseUrl(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (!/^mysql/i.test(u.protocol)) return null;
        const sslMode = (u.searchParams.get('ssl-mode') || u.searchParams.get('ssl') || '').toLowerCase();
        return {
            host: u.hostname,
            port: Number(u.port || 3306),
            user: decodeURIComponent(u.username || ''),
            password: decodeURIComponent(u.password || ''),
            database: (u.pathname || '/raomitra').replace(/^\//, '').split('?')[0] || 'raomitra',
            ssl: sslMode && sslMode !== '0' && sslMode !== 'false' && sslMode !== 'disabled',
        };
    } catch (e) {
        return null;
    }
}

function config() {
    const fromUrl = parseUrl(process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.RAOMITRA_DATABASE_URL || '');
    if (fromUrl) return fromUrl;
    return {
        host: process.env.RAOMITRA_DB_HOST || '',
        port: Number(process.env.RAOMITRA_DB_PORT || 3306),
        user: process.env.RAOMITRA_DB_USER || '',
        password: process.env.RAOMITRA_DB_PASS || '',
        database: process.env.RAOMITRA_DB_NAME || 'raomitra',
        ssl: ['1', 'true', 'yes'].includes(String(process.env.RAOMITRA_DB_SSL || '').toLowerCase()),
    };
}

function isConfigured() {
    const c = config();
    const host = String(c.host || '').toLowerCase();
    if (!host || !c.user) return false;
    if (host === '127.0.0.1' || host === 'localhost') return false;
    return true;
}

async function getPool() {
    if (!isConfigured()) return null;
    if (pool) return pool;
    const c = config();
    pool = mysql.createPool({
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
        database: c.database || 'raomitra',
        waitForConnections: true,
        connectionLimit: 4,
        ssl: c.ssl ? { rejectUnauthorized: false } : undefined,
    });
    await ensureSchema(pool);
    return pool;
}

async function ensureUserColumn(p, column, ddl) {
    const [rows] = await p.query(
        `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [column]
    );
    if (!rows[0] || Number(rows[0].n) === 0) {
        await p.query(`ALTER TABLE users ADD COLUMN ${column} ${ddl}`);
    }
}

async function updateUserProfile(userId, fields) {
    const p = await getPool();
    if (!p) return null;
    await p.query(
        'UPDATE users SET full_name = ?, bio = ?, location = ?, avatar_url = ?, cover_url = ? WHERE id = ?',
        [fields.full_name, fields.bio, fields.location, fields.avatar_url, fields.cover_url, userId]
    );
    return findUserById(userId);
}

async function ensureSchema(p) {
    await p.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            full_name VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('customer','host','co_admin','admin') NOT NULL DEFAULT 'customer',
            avatar_url MEDIUMTEXT NULL,
            cover_url MEDIUMTEXT NULL,
            bio VARCHAR(400) NULL,
            location VARCHAR(120) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_users_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await ensureUserColumn(p, 'cover_url', 'MEDIUMTEXT NULL');
    await ensureUserColumn(p, 'bio', 'VARCHAR(400) NULL');
    await ensureUserColumn(p, 'location', 'VARCHAR(120) NULL');
    await p.query(`
        CREATE TABLE IF NOT EXISTS wallets (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            currency VARCHAR(8) NOT NULL DEFAULT 'USD',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_wallets_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            type VARCHAR(40) NOT NULL,
            title VARCHAR(180) NOT NULL,
            body TEXT NULL,
            link VARCHAR(255) NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS community_posts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await p.query(`
        CREATE TABLE IF NOT EXISTS community_replies (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id INT UNSIGNED NOT NULL,
            user_id INT UNSIGNED NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [admins] = await p.query(
        "SELECT id FROM users WHERE email IN ('admin@raomitra.com','admin@roamitra.com') LIMIT 1"
    );
    if (!admins.length) {
        const hash = bcrypt.hashSync('Admin1234!', 10);
        const [result] = await p.query(
            'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            ['Roamitra Admin', 'admin@raomitra.com', hash, 'admin']
        );
        await p.query('INSERT INTO wallets (user_id, balance, currency) VALUES (?, 0, ?)', [result.insertId, 'USD']);
    }
}

async function findUserByEmail(email) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return rows[0] || null;
}

async function findUserById(id) {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
}

async function createUser({ full_name, email, password_hash, role }) {
    const p = await getPool();
    const [result] = await p.query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [full_name, email, password_hash, role || 'customer']
    );
    const userId = result.insertId;
    await p.query('INSERT INTO wallets (user_id, balance, currency) VALUES (?, 0, ?)', [userId, 'USD']);
    await p.query(
        'INSERT INTO notifications (user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?)',
        [userId, 'community', 'Welcome to Roamitra', 'Your account is ready. Plan a trip, join the community, or try the translator.', 'planner.html']
    );
    return findUserById(userId);
}

async function listPosts() {
    const p = await getPool();
    if (!p) return null;
    const [rows] = await p.query(`
        SELECT p.id, p.user_id, p.title, p.body, p.created_at, u.full_name,
            (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = p.id) AS reply_count
        FROM community_posts p
        LEFT JOIN users u ON u.id = p.user_id
        ORDER BY p.id DESC
        LIMIT 30
    `);
    return rows;
}

async function createPost(userId, title, body) {
    const p = await getPool();
    const [result] = await p.query(
        'INSERT INTO community_posts (user_id, title, body) VALUES (?, ?, ?)',
        [userId, title, body]
    );
    return result.insertId;
}

async function updateUserRole(userId, role) {
    const p = await getPool();
    if (!p) return false;
    const [result] = await p.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    return result.affectedRows > 0;
}

async function addReply(postId, userId, body) {
    const p = await getPool();
    const [result] = await p.query(
        'INSERT INTO community_replies (post_id, user_id, body) VALUES (?, ?, ?)',
        [postId, userId, body]
    );
    return result.insertId;
}

module.exports = {
    isConfigured,
    getPool,
    findUserByEmail,
    findUserById,
    createUser,
    listPosts,
    createPost,
    addReply,
    updateUserRole,
    updateUserProfile,
    storageLabel() {
        return isConfigured() ? 'mysql:raomitra' : 'vercel-tmp (not phpMyAdmin)';
    },
};
