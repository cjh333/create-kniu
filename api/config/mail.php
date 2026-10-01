<?php
$config = [
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
  'CODE_FAIL_LIMIT' => (int)(getenv('MAIL_CODE_FAIL_LIMIT') ?: 5),  // 同一验证码连续失败上限（次）
  'CODE_LOCK_SECONDS' => (int)(getenv('MAIL_CODE_LOCK_SECONDS') ?: 600),  // 达到失败上限后的锁定时长（秒）
  'CAFILE' => getenv('MAIL_CAFILE') ?: __DIR__ . '/cert/cacert.pem',
  'LOG_DIR' => __DIR__ . '/../runtime/mail'
];
return $config;
