<?php
$config = [
  'TYPE' => 'mysql',
  'HOST' => getenv('DB_HOST') ?: '127.0.0.1',
  'DATABASE' => getenv('DB_DATABASE') ?: 'db_kniu',
  'USERNAME' => getenv('DB_USERNAME') ?: 'root',
  'PASSWORD' => getenv('DB_PASSWORD') ?: '',
  'CHARSET'  => 'utf8mb4',
  'COLLATION' => 'utf8mb4_unicode_ci',
  'PERSISTENT' => false
];
return $config;
