<?php

namespace Core;

class AdminBaseController extends Controller
{
  protected function requireManagePermission(): bool
  {
    $role = (int)($_SESSION['admin_token']['role'] ?? 0);
    $roleAuth = (int)($_SESSION['admin_token']['role_auth'] ?? 0);
    if ($role === 1 || $roleAuth === 1) return true;
    http_response_code(403);
    $this->json([], '当前账号仅有查看权限', 0);
    return false;
  }

  /**
   * 构造函数。
   *
   * 验证用户登录状态，如果登录已失效则返回 401 错误。
   *
   * @return void
   */
  public function __construct()
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }

    if (!$this->validateToken()) {
      header('Content-Type: application/json; charset=utf-8');
      http_response_code(401);
      echo json_encode([
        'status' => 0,
        'msg' => '登录已失效，请重新登录',
        'data' => null
      ], JSON_UNESCAPED_UNICODE);
      exit;
    }
    if (!array_key_exists('role_auth', $_SESSION['admin_token'])) {
      $sessionName = (string)($_SESSION['admin_token']['name'] ?? '');
      $sessionUser = Db::name('tb_role')
        ->where('name', '=', $sessionName)
        ->field(['role', 'role_auth'])
        ->find();
      $_SESSION['admin_token']['role'] = $sessionUser['role'] ?? ($_SESSION['admin_token']['role'] ?? 0);
      $_SESSION['admin_token']['role_auth'] = $sessionUser['role_auth'] ?? 0;
    }
    $role = (int)($_SESSION['admin_token']['role'] ?? 0);
    $controller = get_class($this);
    if ($role !== 1 && $controller === 'App\\Admin\\Controllers\\CacheController') {
      http_response_code(403);
      echo json_encode(['status' => 0, 'msg' => '权限不足', 'data' => null], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }
}