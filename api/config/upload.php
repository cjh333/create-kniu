<?php

$env = 'development';
$config = [
  'development' => [
    // 开发环境开启文件上传。
    'ENABLE' => true,
    // 最大文件大小 50MB。
    'MAX_SIZE' => 50 * 1024 * 1024,
    // 允许的文件类型。
    'ALLOWED_TYPES' => [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    // 允许的文件扩展名。
    'ALLOWED_EXTENSIONS' => [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp'
    ],
    // 上传文件根目录。
    'UPLOAD_PATH' => $_SERVER['DOCUMENT_ROOT'] . '/public/uploads/',
    // 子目录配置（文件夹名称保持小写）。
    'SUBDIRS' => [
      'article' => 'article/',
      'avatar' => 'avatar/',
      'product' => 'product/'
    ],
    // 文件 URL 前缀。
    'URL_PREFIX' => '/uploads/'
  ],
  'production' => [
    // 生产环境开启文件上传。
    'ENABLE' => true,
    // 最大文件大小 50MB。
    'MAX_SIZE' => 50 * 1024 * 1024,
    // 允许的文件类型。
    'ALLOWED_TYPES' => [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ],
    // 允许的文件扩展名。
    'ALLOWED_EXTENSIONS' => [
      'jpg',
      'jpeg',
      'png',
      'gif',
      'webp'
    ],
    // 上传文件根目录。
    'UPLOAD_PATH' => $_SERVER['DOCUMENT_ROOT'] . '/public/uploads/',
    // 子目录配置（文件夹名称保持小写）。
    'SUBDIRS' => [
      'article' => 'article/',
      'avatar' => 'avatar/',
      'product' => 'product/'
    ],
    // 文件 URL 前缀。
    'URL_PREFIX' => '/uploads/'
  ]
];
return $config[$env];
