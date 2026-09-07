<?php
$env = getenv('APP_ENV') ?: 'development';
$config = [
  'development' => [
    'HOST' => getenv('MAIL_HOST') ?: 'smtp.qq.com',
    'PORT' => (int)(getenv('MAIL_PORT') ?: 465),
    'ENCRYPTION' => strtolower(getenv('MAIL_ENCRYPTION') ?: 'ssl'), // 加密方式：ssl（端口 465，直连 SSL） / tls（端口 587，STARTTLS） / none
    'USERNAME' => getenv('MAIL_USERNAME') ?: '',
    'PASSWORD' => getenv('MAIL_AUTH_CODE') ?: '',
    'FROM_ADDRESS' => getenv('MAIL_FROM_ADDRESS') ?: '',
    'FROM_NAME' => getenv('MAIL_FROM_NAME') ?: 'KniuSystem',
    'TIMEOUT' => (int)(getenv('MAIL_TIMEOUT') ?: 12),
    'CODE_EXPIRE' => (int)(getenv('MAIL_CODE_EXPIRE') ?: 600),  // 验证码有效期（秒）
    'CODE_INTERVAL' => (int)(getenv('MAIL_CODE_INTERVAL') ?: 60),  // 同一邮箱重发间隔（秒）
    // TLS 校验用的根证书包。Windows 下 PHP 常未配置 openssl.cafile，
    // 缺失时 ssl:// 连接会「静默失败」（errno=0 且 errstr 为空），故项目自带一份。
    'CAFILE' => getenv('MAIL_CAFILE') ?: __DIR__ . '/cert/cacert.pem',
    'LOG_DIR' => __DIR__ . '/../runtime/mail'
  ],
  'production' => [
    'HOST' => getenv('MAIL_HOST') ?: '',
    'PORT' => (int)(getenv('MAIL_PORT') ?: 465),
    'ENCRYPTION' => strtolower(getenv('MAIL_ENCRYPTION') ?: 'ssl'),
    'USERNAME' => getenv('MAIL_USERNAME') ?: '',
    'PASSWORD' => getenv('MAIL_AUTH_CODE') ?: '',
    'FROM_ADDRESS' => getenv('MAIL_FROM_ADDRESS') ?: '',
    'FROM_NAME' => getenv('MAIL_FROM_NAME') ?: 'KniuSystem',
    'TIMEOUT' => (int)(getenv('MAIL_TIMEOUT') ?: 12),
    'CODE_EXPIRE' => (int)(getenv('MAIL_CODE_EXPIRE') ?: 600),
    'CODE_INTERVAL' => (int)(getenv('MAIL_CODE_INTERVAL') ?: 60),
    'CAFILE' => getenv('MAIL_CAFILE') ?: __DIR__ . '/cert/cacert.pem',
    'LOG_DIR' => __DIR__ . '/../runtime/mail'
  ]
];
return $config[$env] ?? $config['development'];
