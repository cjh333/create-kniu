<?php
$config = [
  'ENABLE' => true,  // 开发环境开启认证。
  'LOGIN_EXPIRE_DAYS' => 1,  // 登录状态有效天数。
  'TOKEN_KEY' => 'KNIU_USER_TOKEN',  // token 存储键名。
  'SESSION_KEY' => 'KNIU_USER_SESSION',  // session 存储键名。
  'USERNAME_KEY' => 'KNIU_USERNAME',  // 用户名存储键名。
  'REDIRECT_URL' => '/logup',  // 认证失败重定向 URL。
  'CAPTCHA_NUMBER_MAX' => 20,  // 验证码加减法的最大范围（20 表示 20 以内）。
  // 无需登录鉴权的接口。
  'NO_AUTH' => [
    // 前台公开内容：游客可见的首页、详情与评论列表。
    'getDaily',
    'getArticle',
    'getInfo',
    'getDetail',
    'getComments',
    'getPublisherAbout',
    // 前台账号：注册、登录、绑定、退出与会话探测都在未登录态调用。
    'frontRegister',
    'frontLogin',
    'frontBind',
    'frontProfileClear',
    'frontSessionSync',
    // 邮箱验证码与找回密码。
    'email_code',
    'password_reset',
    // 后台登录相关：验证码、登录、退出登录、会话探测。
    'captcha',
    'logup',
    'logout',
    'session_status'
  ]
];
return $config;
