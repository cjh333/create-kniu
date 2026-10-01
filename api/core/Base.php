<?php

namespace Core;

class Base extends Controller
{
  /**
   * 当前登录账号的 tb_role.id。
   *
   * 实现收敛到 Core\Controller::sessionLoginId()：优先读会话中的 id（logup 后写入）；
   * 旧会话（无 id 字段）按 name 查库并回填，避免重复查询。
   */
  protected function currentUserId(): int
  {
    return $this->sessionLoginId();
  }

  /**
   * 后台未登录的拒绝语义：HTTP 401 + 业务码 201（登录态无效）。
   * 前端请求层据此统一跳转登录页（与前台页面守卫跳登录页的目标一致，仅响应形式按后台约定）。
   */
  protected function rejectLogin(string $message, int $code = ErrorCode::UNAUTHORIZED): void
  {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    echo json_encode([
      'status' => $code,
      'msg' => $message,
      'data' => null
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /** 是否为管理员（role=1）。 */
  protected function isAdmin(): bool
  {
    return (int)($_SESSION['admin_token']['role'] ?? 0) === 1;
  }

  protected function requireManagePermission(): bool
  {
    $role = (int)($_SESSION['admin_token']['role'] ?? 0);
    $roleAuth = (int)($_SESSION['admin_token']['role_auth'] ?? 0);
    if ($role === 1 || $roleAuth === 1) return true;
    http_response_code(403);
    $this->json([], '当前账号仅有查看权限', ErrorCode::FORBIDDEN);
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
      // 与后台接口的统一拒绝口径保持一致（401，前端请求层据此跳登录页）。
      $this->rejectLogin('登录已失效，请重新登录');
    }
    if (!array_key_exists('role_auth', $_SESSION['admin_token'])) {
      $sessionName = (string)($_SESSION['admin_token']['name'] ?? '');
      $sessionUser = Db::name('tb_role')
        ->where('name', '=', $sessionName)
        ->field(['id', 'role', 'role_auth'])
        ->find();
      $_SESSION['admin_token']['id'] = $sessionUser['id'] ?? 0;
      $_SESSION['admin_token']['role'] = $sessionUser['role'] ?? ($_SESSION['admin_token']['role'] ?? 0);
      $_SESSION['admin_token']['role_auth'] = $sessionUser['role_auth'] ?? 0;
    }
    $role = (int)($_SESSION['admin_token']['role'] ?? 0);
    $controller = get_class($this);
    if ($role !== 1 && $controller === 'App\\Admin\\Controllers\\CacheController') {
      http_response_code(403);
      echo json_encode(['status' => ErrorCode::FORBIDDEN, 'msg' => '权限不足', 'data' => null], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }
}