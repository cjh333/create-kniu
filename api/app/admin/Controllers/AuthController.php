<?php

namespace App\Admin\Controllers;

use Core\Controller;
use Core\Db;

class AuthController extends Controller
{
  public function __construct()
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
  }

  // 验证码。
  public function captcha(): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    $this->setCaptcha();
  }

  // 登录。
  public function logup(): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }

    if ($this->validateToken()) {
      $this->json([], '您已登录', 1);
      return;
    }

    $name = $this->input('post.name') ?? '';
    $password = $this->input('post.password') ?? '';
    $gvcode = $this->input('post.gvcode') ?? '';

    $submittedCaptcha = trim((string)$gvcode);
    $expectedCaptcha = isset($_SESSION['captcha']) ? (string)$_SESSION['captcha'] : '';
    if ($expectedCaptcha === '' || !preg_match('/^-?\d+$/', $submittedCaptcha) || (int)$submittedCaptcha !== (int)$expectedCaptcha) {
      $this->json([], '验证码错误', 0);
      return;
    }
    unset($_SESSION['captcha']);

    if (empty($name) || empty($password)) {
      $this->json([], '用户名和密码不能为空', 0);
      return;
    }

    $result = Db::name('tb_role')
      ->where('name', '=', $name)
      ->field(['id', 'name', 'password', 'role', 'is_show'])
      ->select();

    if (empty($result)) {
      $this->json([], '用户不存在', 0);
      return;
    }

    $userData = $result[0];

    if (isset($userData['is_show']) && $userData['is_show'] == 0) {
      $this->json([], '该账号已被禁用，请联系管理员', 0);
      return;
    }

    if ($this->verifyPassword($password, $userData['password'])) {
      $token = bin2hex(random_bytes(32));

      // 加载认证配置
      $authConfig = require __DIR__ . '/../../../config/auth.php';

      $_SESSION['admin_token'] = [
        'token' => $token,
        'name' => $userData['name'],
        'role' => $userData['role'] ?? '',
        'expire' => time() + $authConfig['TOKEN_EXPIRE']
      ];

      $this->json([
        'token' => $token,
        'name' => $userData['name']
      ], '登录成功', 1);
      return;
    }
    $this->json([], '用户名或密码错误', 0);
  }

  // 退出登录。
  public function logout(): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    unset($_SESSION['admin_token']);
    session_destroy();
    $this->json([], '退出登录成功', 1);
  }
}
