<?php
declare(strict_types=1);

/**
 * Application configuration.
 * Database name is required to remain `raomitra`.
 */
return [
    'app_name' => 'Roamitra',
    'db' => [
        'host' => getenv('RAOMITRA_DB_HOST') ?: '127.0.0.1',
        'name' => 'raomitra',
        'user' => getenv('RAOMITRA_DB_USER') ?: 'root',
        'pass' => getenv('RAOMITRA_DB_PASS') !== false ? (string) getenv('RAOMITRA_DB_PASS') : '',
        'charset' => 'utf8mb4',
    ],
    'openai_api_key' => getenv('OPENAI_API_KEY') ?: '',
    'openai_model' => getenv('OPENAI_MODEL') ?: 'gpt-4o-mini',
];
