<?php

$env = getenv('APP_ENV') ?: 'development';
// 内网 Node 服务的通知触发地址（回环触发 SSE 广播）。生产环境可在环境变量里覆盖。
$notifyUrl = getenv('NOTIFY_URL') ?: 'http://localhost:6987/__notify';
$config = [
  'development' => [
    'TIMEZONE' => 'Asia/Shanghai',  // 时区设置。
    'APP_NAME' => 'API Application',  // 应用名称。
    'DEBUG' => true,  // 调试模式。
    'NOTIFY_URL' => $notifyUrl  // SSE 广播触发地址。
  ],
  'production' => [
    'TIMEZONE' => 'Asia/Shanghai',  // 时区设置。
    'APP_NAME' => 'API Application',  // 应用名称。
    'DEBUG' => false,  // 调试模式。
    'NOTIFY_URL' => $notifyUrl  // SSE 广播触发地址。
  ]
];
return $config[$env] ?? $config['development'];
