<?php

$env = 'development';
$config = [
  'development' => [
    'TIMEZONE' => 'Asia/Shanghai',  // 时区设置。
    'APP_NAME' => 'API Application',  // 应用名称。
    'DEBUG' => true  // 调试模式。
  ],
  'production' => [
    'TIMEZONE' => 'Asia/Shanghai',  // 时区设置。
    'APP_NAME' => 'API Application',  // 应用名称。
    'DEBUG' => false  // 调试模式。
  ]
];
return $config[$env];
