<?php

$env = getenv('APP_ENV') ?: 'development';
$config = [
  'development' => [
    'ENABLE' => true,  // 开发环境开启认证。
    'LOGIN_EXPIRE_DAYS' => 7,  // 登录状态有效天数。
    'TOKEN_KEY' => 'KNIU_USER_TOKEN',  // token 存储键名。
    'SESSION_KEY' => 'KNIU_USER_SESSION',  // session 存储键名。
    'USERNAME_KEY' => 'KNIU_USERNAME',  // 用户名存储键名。
    'REDIRECT_URL' => '/logup',  // 认证失败重定向 URL。
    'CAPTCHA_NUMBER_MAX' => 20  // 验证码加减法的最大范围（20 表示 20 以内）。
  ],
  'production' => [
    'ENABLE' => true,  // 生产环境开启认证。
    'LOGIN_EXPIRE_DAYS' => 7,  // 登录状态有效天数。
    'TOKEN_KEY' => 'KNIU_USER_TOKEN',  // token 存储键名。
    'SESSION_KEY' => 'KNIU_USER_SESSION',  // session 存储键名。
    'USERNAME_KEY' => 'KNIU_USERNAME',  // 用户名存储键名。
    'REDIRECT_URL' => '/logup',  // 认证失败重定向 URL。
    'CAPTCHA_NUMBER_MAX' => 20  // 验证码加减法的最大范围（20 表示 20 以内）。
  ]
];
return $config[$env] ?? $config['development'];
