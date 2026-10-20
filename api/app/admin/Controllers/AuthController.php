<?php

namespace App\Admin\Controllers;

use Core\Controller;
use Core\Db;
use Core\ErrorCode;

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
      ], '您已登录', ErrorCode::SUCCESS);
      return;
    }

    $username = $this->input('post.username') ?? '';
    $password = $this->input('post.password') ?? '';

    if (!$this->verifyArithmeticCaptcha()) {
      $this->json([], '验证码错误', ErrorCode::CAPTCHA_INVALID);
      return;
    }

    if (empty($username) || empty($password)) {
      $this->json([], '用户名和密码不能为空', ErrorCode::PARAM_INVALID);
      return;
    }

    // 防爆破：按「账号+IP」持久化计数，连续失败 5 次锁 10 分钟（算术验证码可被脚本破解，不作为唯一闸门）。
    if ($this->checkLoginLock('admin', $username)) {
      $this->json([], '失败次数过多，请 10 分钟后再试', ErrorCode::CREDENTIAL_INVALID);
      return;
    }

    $result = Db::name('tb_role')
      ->where('name', '=', htmlspecialchars($username, ENT_QUOTES))
      ->field(['id', 'name', 'password', 'role', 'role_auth', 'is_show'])
      ->select();

    if (empty($result)) {
      // 账号不存在与密码错误同口径：登记失败计数 + 同文案同码，防账号枚举。
      $this->registerLoginFailure('admin', $username);
      $this->json([], '用户名或密码错误', ErrorCode::CREDENTIAL_INVALID);
      return;
    }

    $userData = $result[0];

    if (isset($userData['is_show']) && $userData['is_show'] == 0) {
      $this->json([], '该账号已被禁用，请联系管理员', ErrorCode::ACCOUNT_DISABLED);
      return;
    }

    if ($this->verifyPassword($password, $userData['password'])) {
      session_regenerate_id(true);
      // 清锁键必须与失败计数键同源（原始输入）：库内 name 是 htmlspecialchars 编码值，
      // 账号名含特殊字符时两者 md5 键不同，会导致成功登录后失败计数永远清不掉。
      $this->clearLoginLock('admin', $username);
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
      ], '登录成功', ErrorCode::SUCCESS);
      return;
    }
    $this->registerLoginFailure('admin', $username);
    $this->json([], '用户名或密码错误', ErrorCode::CREDENTIAL_INVALID);
  }

  // 退出登录。
  public function logout(): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    // 与 frontProfileClear 同口径：退出同时摘除该账号的前台身份令牌绑定，
    // 否则前端 localStorage 里的旧令牌在有效期内仍可认证（共享账号模型，
    // 后台退出即前后台一起退出）。
    $roleId = $this->currentLoginId();
    if ($roleId > 0) {
      Db::name('tb_role')->where('id', '=', $roleId)->update(['identity_token' => Db::raw('NULL'), 'token_expire_time' => Db::raw('NULL')]);
    }
    unset($_SESSION['admin_token']);
    if (session_status() === PHP_SESSION_ACTIVE) {
      $_SESSION = [];
      // session_destroy 只销毁服务端数据，浏览器仍持有旧 Cookie——须同步过期，
      // 否则配合未初始化会话存在会话 ID 复用窗口（对齐 frontProfileClear 的写法）。
      if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
      }
      session_destroy();
    }
    $this->json([], '退出登录成功', ErrorCode::SUCCESS);
  }

  /** 后台登录成功后把前台身份令牌同步到统一账号表。 */
  private function syncFrontIdentity(string $token, int $roleId, string $name): array
  {
    $nickname = trim(html_entity_decode($name, ENT_QUOTES));
    if (!preg_match('/^[a-f0-9]{64}$/i', $token) || $roleId <= 0 || $nickname === '') {
      return ['id' => 0, 'nickname' => $nickname];
    }
    $tokenHash = hash('sha256', strtolower($token));
    $this->bindIdentityToken($tokenHash, $roleId, true);
    $_SESSION['front_token'] = [
      'id' => $roleId,
      'name' => $nickname,
      'expire' => $_SESSION['admin_token']['expire'] ?? (time() + 86400 * 7)
    ];
    return ['id' => $roleId, 'nickname' => $nickname];
  }
}
