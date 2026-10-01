<?php
$env = getenv('APP_ENV') ?: 'development';
$config = [
  'ENABLE' => false,  // 开发环境默认开启日志。
  'LEVEL' => $env === 'development' ? 'debug' : 'info',  // 日志级别：debug, info, notice, warning, error, critical, alert, emergency。
  'FILE_PATH' => __DIR__ . '/../runtime/log/api.log'  // 日志文件路径。
];
return $config;
