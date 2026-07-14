<?php
// Copy this file to config.php and fill in real values, OR just set these
// as actual environment variables on your server -- config.php reads env
// vars first and only falls back to hardcoded values here as a convenience.
//
// config.php (with real values) is gitignored and must never be committed.
// The actual DB password lives in db-secret.php, also gitignored, read as
// a fallback when DB_PASS isn't set as an env var (see config.php).

return [
    'host'     => getenv('DB_HOST') ?: 'localhost',
    'db_name'  => getenv('DB_NAME') ?: 'your_database_name',
    'username' => getenv('DB_USER') ?: 'your_db_username',
    'password' => getenv('DB_PASS') ?: 'your_db_password',
];
