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
   * 后台未登录的拒绝语义：HTTP 401 + 业务码 1001（登录态无效）。
   * 前端请求层据此统一跳转登录页（与前台页面守卫跳登录页的目标一致，仅响应形式按后台约定）。
   * @return never 方法输出 401 响应后终止脚本。
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
   * 单字段排序（sid）更新的统一入口（A3-m5 收口）。
   *
   * commentUpdate / feedbackUpdate 等后台单字段排序端点共用：
   * id/sid 强转 → id<=0 拒（2001）→ UPDATE → json。鉴权由调用方先行处理。
   *
   * @param string $table 目标表名（如 tb_comment）。
   * @return never
   */
  protected function updateSortField(string $table): void
  {
    $id = (int)$this->input('post.id/d', 0);
    $sid = max(0, (int)$this->input('post.sid/d', 0));
    if ($id <= 0) {
      $this->json([], '参数错误', ErrorCode::PARAM_INVALID);
    }
    Db::name($table)->where('id', '=', $id)->update(['sid' => $sid]);
    $this->json(['id' => $id, 'sid' => $sid], '排序已保存', ErrorCode::SUCCESS);
  }

  /**
   * 批量勾选（KNIU_TABLE_EVENT_CHECKALL）的统一落库。
   *
   * 先按需写 tb_selectall 的全局勾选态（$selectAll 为 null 表示本次未提交，跳过），
   * 再把选中 id 集合的 is_select 置为提交值。article/daily/nav/role 四个控制器的
   * 批量分支逐字一致，收口到此；权限校验由各控制器自行处理。
   *
   * @param string $name tb_selectall.name 业务名（article/daily/nav/role）。
   * @param string $table 业务表名（如 tb_article）。
   * @param mixed $selectAll 全局勾选值；null=跳过 tb_selectall 写入。
   * @param mixed $select 选中集合的勾选值；null 时 Db::update 过滤为空 set，返回 0。
   * @param string $id 逗号分隔的选中 id。
   * @return int 合计影响行数。
   */
  protected function applySelectallBatch(string $name, string $table, mixed $selectAll, mixed $select, string $id): int
  {
    $result = 0;
    if ($selectAll !== null) {
      $result += Db::name('tb_selectall')
        ->where('name', '=', $name)
        ->update(['is_select' => $selectAll]);
    }
    $result += Db::name($table)
      ->whereIn('id', explode(',', $id))
      ->update(['is_select' => $select]);
    return $result;
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
  }
}