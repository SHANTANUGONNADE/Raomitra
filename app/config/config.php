<?php
declare(strict_types=1);

/**
 * Application configuration.
 * Database name is required to remain `raomitra` for MySQL.
 */
$dbUrl = getenv('DATABASE_URL') ?: getenv('MYSQL_URL') ?: getenv('RAOMITRA_DATABASE_URL') ?: '';
$db = [
    'host' => getenv('RAOMITRA_DB_HOST') ?: '127.0.0.1',
    'port' => (int) (getenv('RAOMITRA_DB_PORT') ?: 3306),
    'name' => 'raomitra',
    'user' => getenv('RAOMITRA_DB_USER') ?: 'root',
    'pass' => getenv('RAOMITRA_DB_PASS') !== false ? (string) getenv('RAOMITRA_DB_PASS') : '',
    'charset' => 'utf8mb4',
    'ssl' => in_array(strtolower((string) (getenv('RAOMITRA_DB_SSL') ?: '')), ['1', 'true', 'yes'], true),
];
if (is_string($dbUrl) && $dbUrl !== '' && preg_match('#^mysqls?://#i', $dbUrl) === 1) {
    $parts = parse_url($dbUrl);
    if (is_array($parts)) {
        $db['host'] = $parts['host'] ?? $db['host'];
        $db['port'] = isset($parts['port']) ? (int) $parts['port'] : $db['port'];
        $db['user'] = isset($parts['user']) ? rawurldecode($parts['user']) : $db['user'];
        $db['pass'] = isset($parts['pass']) ? rawurldecode($parts['pass']) : $db['pass'];
        $pathName = ltrim((string) ($parts['path'] ?? ''), '/');
        if ($pathName !== '') {
            $db['name'] = explode('?', $pathName)[0];
        }
        $query = [];
        parse_str((string) ($parts['query'] ?? ''), $query);
        if (!empty($query['ssl-mode']) || !empty($query['ssl'])) {
            $db['ssl'] = true;
        }
    }
}

return [
    'app_name' => 'Roamitra',
    'session_secret' => getenv('RAOMITRA_SESSION_SECRET') ?: 'raomitra-local-session-key',
    'db' => $db,
    'openai_api_key' => getenv('OPENAI_API_KEY') ?: '',
    'openai_model' => getenv('OPENAI_MODEL') ?: 'gpt-4o-mini',
];
