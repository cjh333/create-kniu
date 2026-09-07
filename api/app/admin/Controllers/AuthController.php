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

  /** 安静检查后台会话；未登录也返回 HTTP 200，避免启动探测产生 401。 */
  public function sessionStatus(): void
  {
    if (!$this->validateToken()) {
      $this->json(['loggedIn' => false]);
      return;
    }
    $roleId = (int)($_SESSION['admin_token']['role'] ?? 0);
    $roles = require __DIR__ . '/../../../config/role.php';
    $this->json([
      'loggedIn' => true,
      'username' => (string)($_SESSION['admin_token']['name'] ?? ''),
      'role' => $roles[$roleId] ?? (string)$roleId,
      'role_id' => $roleId,
      'role_auth' => (int)($_SESSION['admin_token']['role_auth'] ?? 0)
    ]);
  }

  // 登录。
  public function logup(): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }

    if ($this->validateToken()) {
      $front = $this->syncFrontIdentity(
        (string)$this->input('post.identity_token/s', ''),
        (int)($_SESSION['admin_token']['id'] ?? 0),
        (string)($_SESSION['admin_token']['name'] ?? '')
      );
      $this->json([
        'id' => (int)($_SESSION['admin_token']['id'] ?? 0),
        'name' => $_SESSION['admin_token']['name'] ?? '',
        'role' => $_SESSION['admin_token']['role'] ?? '',
        'role_auth' => $_SESSION['admin_token']['role_auth'] ?? 0,
        'front_user_id' => $front['id'],
        'nickname' => $front['nickname']
      ], '您已登录', 1);
      return;
    }

    $username = $this->input('post.username') ?? '';
    $password = $this->input('post.password') ?? '';

    if (!$this->verifyArithmeticCaptcha()) {
      $this->json([], '验证码错误', 0);
      return;
    }

    if (empty($username) || empty($password)) {
      $this->json([], '用户名和密码不能为空', 0);
      return;
    }

    $result = Db::name('tb_role')
      ->where('name', '=', htmlspecialchars($username, ENT_QUOTES))
      ->field(['id', 'name', 'password', 'role', 'role_auth', 'is_show'])
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
      session_regenerate_id(true);
      $token = bin2hex(random_bytes(32));

      // 加载认证配置
      $authConfig = require __DIR__ . '/../../../config/auth.php';
      $loginExpireSeconds = max(1, (int)($authConfig['LOGIN_EXPIRE_DAYS'] ?? 7)) * 86400;

      $_SESSION['admin_token'] = [
        'id' => (int)$userData['id'],
        'token' => $token,
        'name' => $userData['name'],
        'role' => $userData['role'] ?? '',
        'role_auth' => $userData['role_auth'] ?? 0,
        'expire' => time() + $loginExpireSeconds
      ];

      $front = $this->syncFrontIdentity(
        (string)$this->input('post.identity_token/s', ''),
        (int)$userData['id'],
        html_entity_decode((string)$userData['name'], ENT_QUOTES)
      );

      $this->json([
        'id' => (int)$userData['id'],
        'token' => $token,
        'name' => $userData['name'],
        'role' => $userData['role'] ?? '',
        'role_auth' => $userData['role_auth'] ?? 0,
        'front_user_id' => $front['id'],
        'nickname' => $front['nickname']
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

  /** 后台登录成功后同步建立前台身份，保证前后台登录状态一致。 */
  private function syncFrontIdentity(string $token, int $roleId, string $name): array
  {
    $nickname = trim(html_entity_decode($name, ENT_QUOTES));
    if (!preg_match('/^[a-f0-9]{64}$/i', $token) || $roleId <= 0 || $nickname === '') {
      return ['id' => 0, 'nickname' => $nickname];
    }
    $tokenHash = hash('sha256', strtolower($token));
    $encodedName = htmlspecialchars($nickname, ENT_QUOTES);
    $now = date('Y-m-d H:i:s');
    $account = Db::name('tb_front_user')->where('role_id', '=', $roleId)->find();
    if (!$account) $account = Db::name('tb_front_user')->where('nickname', '=', $encodedName)->find();
    $tokenUser = Db::name('tb_front_user')->where('identity_token', '=', $tokenHash)->find();

    if ($account) {
      if ($tokenUser && (int)$tokenUser['id'] !== (int)$account['id']) {
        Db::name('tb_front_user')->where('id', '=', (int)$tokenUser['id'])->delete();
      }
      Db::name('tb_front_user')->where('id', '=', (int)$account['id'])->update([
        'role_id' => $roleId,
        'identity_token' => $tokenHash,
        'nickname' => $encodedName,
        'update_time' => $now
      ]);
      $frontUserId = (int)$account['id'];
    } elseif ($tokenUser) {
      Db::name('tb_front_user')->where('id', '=', (int)$tokenUser['id'])->update([
        'role_id' => $roleId,
        'nickname' => $encodedName,
        'update_time' => $now
      ]);
      $frontUserId = (int)$tokenUser['id'];
    } else {
      $frontUserId = (int)Db::name('tb_front_user')->insert([
        'role_id' => $roleId,
        'identity_token' => $tokenHash,
        'nickname' => $encodedName,
        'create_time' => $now,
        'update_time' => $now
      ]);
    }
    $_SESSION['front_token'] = [
      'id' => $roleId,
      'name' => $nickname,
      'expire' => $_SESSION['admin_token']['expire'] ?? (time() + 86400 * 7)
    ];
    return ['id' => $frontUserId, 'nickname' => $nickname];
  }
}
