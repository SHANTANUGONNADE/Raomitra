<?php
declare(strict_types=1);

/**
 * Vercel serverless entrypoint. Local XAMPP continues to use public/api/index.php.
 */
require dirname(__DIR__) . '/public/api/index.php';
