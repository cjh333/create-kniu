<?php

$env = 'development';
$config = [
  'development' => [
    'TYPE' => 'mysql',
    'HOST' => '127.0.0.1',
    'DATABASE' => 'db_kniu',
    'USERNAME' => 'root',
    'PASSWORD' => 'root123',
    'CHARSET'  => 'utf8mb4',
    'COLLATION' => 'utf8mb4_unicode_ci',
    'PERSISTENT' => false
  ],
  'production' => [
    'TYPE' => 'mysql',
    'HOST' => 'dphzmy-jzd0ohudotjkf0vk-pub.proxy.dms.aliyuncs.com',
    'DATABASE' => 'qdm673522465_db',
    'USERNAME' => 'lZgUGWWHZbPWyaZBiMWiFnHe',
    'PASSWORD' => 'W48G5wSYoJLPDhcMIsHjjOjFQ37iPa',
    'CHARSET'  => 'utf8mb4',
    'COLLATION' => 'utf8mb4_unicode_ci',
    'PERSISTENT' => false
  ]
];
return $config[$env];
