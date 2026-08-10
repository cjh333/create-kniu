<?php

$env = 'production';
$config = [
  'development' => [
    'ENABLE' => true,  // 开发环境默认开启日志。
    'LEVEL' => 'debug',  // 日志级别：debug, info, notice, warning, error, critical, alert, emergency。
    'FILE_PATH' => __DIR__ . '/../runtime/log/api.log'  // 日志文件路径。
  ],
  'production' => [
    'ENABLE' => false,  // 生产环境默认关闭日志。
    'LEVEL' => 'info',  // 生产环境日志级别设为 info。
    'FILE_PATH' => __DIR__ . '/../runtime/log/api.log'  // 日志文件路径。
  ]
];
return $config[$env];
