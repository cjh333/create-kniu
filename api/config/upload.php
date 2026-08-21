<?php

$env = getenv('APP_ENV') ?: 'development';
$config = [
  'development' => [
    // 开发环境开启文件上传。
    'ENABLE' => true,
    // 最大文件大小 10MB。
    'MAX_SIZE' => 10 * 1024 * 1024,
    // 允许的文件类型。
    'ALLOWED_TYPES' => [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/mp4',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime'
    ],
    // 允许的文件扩展名。
    'ALLOWED_EXTENSIONS' => [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'ico',
      'mp3',
      'ogg',
      'wav',
      'm4a',
      'mp4',
      'webm',
      'mov'
    ],
    // 上传文件根目录。
    'UPLOAD_PATH' => dirname(__DIR__, 2) . '/public/upload/',
    // 子目录配置（文件夹名称保持小写）。
    'SUBDIRS' => [
      'article' => 'article/',
      'logo' => 'logo/',
      'avatar' => 'avatar/',
      'product' => 'product/'
    ],
    // 文件 URL 前缀。
    'URL_PREFIX' => '/upload/'
  ],
  'production' => [
    // 生产环境开启文件上传。
    'ENABLE' => true,
    // 最大文件大小 10MB。
    'MAX_SIZE' => 10 * 1024 * 1024,
    // 允许的文件类型。
    'ALLOWED_TYPES' => [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/mp4',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime'
    ],
    // 允许的文件扩展名。
    'ALLOWED_EXTENSIONS' => [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp',
      'ico',
      'mp3',
      'ogg',
      'wav',
      'm4a',
      'mp4',
      'webm',
      'mov'
    ],
    // 上传文件根目录。
    'UPLOAD_PATH' => dirname(__DIR__, 2) . '/public/upload/',
    // 子目录配置（文件夹名称保持小写）。
    'SUBDIRS' => [
      'article' => 'article/',
      'logo' => 'logo/',
      'avatar' => 'avatar/',
      'product' => 'product/'
    ],
    // 文件 URL 前缀。
    'URL_PREFIX' => '/upload/'
  ]
];
return $config[$env] ?? $config['development'];
