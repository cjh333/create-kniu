<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\ErrorCode;

class RoleController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  private function hasManagePermission(): bool
  {
    return (int)($_SESSION['admin_token']['role'] ?? 0) === 1
      || (int)($_SESSION['admin_token']['role_auth'] ?? 0) === 1;
  }

  private function denyPermission(): void
  {
    http_response_code(403);
    $this->json([], '权限不足', ErrorCode::FORBIDDEN);
  }

  /**
   * 角色权限同步：管理员(role=1)权限为 1，普通用户(role=2)权限为 2。
   *
   * @param mixed $role 角色值。
   * @return int 角色权限值。
   */
  private function syncRoleAuth($role): int
  {
    return (int)$role === 1 ? 1 : 2;
  }

  // 增加。
  public function roleAdd(): void
  {
    if (!$this->hasManagePermission()) {
      $this->denyPermission();
      return;
    }
    $data = [
      'sid' => $this->input('post.sid') ?? 0,
      'name' => $this->input('post.name') ?? '',
      'password' => $this->hashPassword($this->input('post.password')) ?? '',
      'role' => $this->input('post.role') ?? 0,
      'role_auth' => $this->input('post.role_auth') ?? 0,
      'is_show' => $this->input('post.is_show') ?? 1
      ,'comment_audit' => $this->input('post.comment_audit') ?? 1
      ,'comment_ban' => $this->input('post.comment_ban') ?? 0
    ];
    $data['role_auth'] = $this->syncRoleAuth($data['role']);
    $data = $this->encodeFields($data, ['name']);
    Db::name('tb_role')->insert($data);
    $this->json([], '添加成功', 1);
  }

  // 删除。
  public function roleDelete(): void
  {
    if (!$this->hasManagePermission()) {
      $this->denyPermission();
      return;
    }
    $id = $this->input('post.id') ?? '';
    $roleId = (int)$id;
    if ($roleId <= 0 || $roleId === $this->currentUserId()) {
      $this->json([], '不能删除当前登录账号', ErrorCode::FORBIDDEN);
      return;
    }
    Db::beginTrans();
    try {
      $articleIds = Db::name('tb_article')->where('role_id', '=', $roleId)->column('id');
      if ($articleIds) {
        Db::name('tb_article_favorite')->whereIn('article_id', $articleIds)->delete();
        Db::name('tb_article_history')->whereIn('article_id', $articleIds)->delete();
        Db::name('tb_comment')->whereIn('article_id', $articleIds)->delete();
        Db::name('tb_article')->whereIn('id', $articleIds)->delete();
      }
      Db::name('tb_comment_reply_status')->where('recipient_user_id', '=', $roleId)->delete();
      $commentIds = Db::name('tb_comment')->where('role_id', '=', $roleId)->column('id');
      if ($commentIds) {
        Db::name('tb_comment_reply_status')->whereIn('reply_id', $commentIds)->delete();
        Db::name('tb_comment')->whereIn('parent_id', $commentIds)->delete();
        Db::name('tb_comment')->whereIn('id', $commentIds)->delete();
      }
      Db::name('tb_article_favorite')->where('role_id', '=', $roleId)->delete();
      Db::name('tb_article_history')->where('role_id', '=', $roleId)->delete();
      Db::name('tb_about')->where('role_id', '=', $roleId)->delete();
      Db::name('tb_role')->where('id', '=', $roleId)->delete();
      Db::commit();
    } catch (\Throwable $e) {
      Db::rollback();
      $this->json([], '删除账号失败', ErrorCode::SERVER_ERROR);
      return;
    }
    $this->json([], '删除成功', 1);
  }

  // 修改。
  public function roleUpdate(): void
  {
    $type = $this->input('post.type') ?? null;
    $id = $this->input('post.id') ?? null;
    $data = [
      'is_selectall' => $this->input('post.is_selectall') ?? null,
      'is_select' => $this->input('post.is_select') ?? null,
      'sid' => $this->input('post.sid') ?? null,
      'name' => $this->input('post.name') ?? null,
      'nickname' => $this->input('post.nickname') ?? null,
      'password' => $this->input('post.password') ?? null,
      'role' => $this->input('post.role') ?? null,
      'role_auth' => $this->input('post.role_auth') ?? null,
      'is_show' => $this->input('post.is_show') ?? null
      ,'comment_audit' => $this->input('post.comment_audit') ?? null
      ,'comment_ban' => $this->input('post.comment_ban') ?? null
    ];
    $hasManagePermission = $this->hasManagePermission();
    $oldPassword = (string)($this->input('post.old_password') ?? '');
    if (!$hasManagePermission) {
      $newPassword = (string)($this->input('post.new_password') ?? '');
      $currentUserId = $this->currentUserId();
      if ($currentUserId <= 0) {
        $this->denyPermission();
        return;
      }
      // 修改自己密码：一律以会话身份为准，不依赖前端传来的 id
      // （前端 id 缺失或过期缓存发错值时不应导致"权限不足"）。
      // 仅在前端显式带了他人 id 时才按越权拒绝。
      if ($id !== null && (string)$id !== '' && (int)$id !== $currentUserId) {
        $this->denyPermission();
        return;
      }
      $id = $currentUserId;
      if ($oldPassword === '' || $newPassword === '') {
        $this->json([], '请输入原密码和新密码', ErrorCode::PARAM_INVALID);
        return;
      }
      $storedPassword = (string)(Db::name('tb_role')->where('id', '=', $currentUserId)->value('password') ?? '');
      if ($storedPassword === '' || !$this->verifyPassword($oldPassword, $storedPassword)) {
        $this->json([], '旧密码不正确', ErrorCode::CREDENTIAL_INVALID);
        return;
      }
      $type = null;
      $data = ['password' => $newPassword];
    } elseif ($id !== null && (string)($data['password'] ?? '') !== '') {
      // 管理员修改任意账号密码时也必须验证该账号的当前密码。
      // 仅修改用户名、角色、排序或启用状态时不要求原密码。
      if ($oldPassword === '') {
        $this->json([], '修改密码时请输入原密码', ErrorCode::PARAM_INVALID);
        return;
      }
      $storedPassword = (string)(Db::name('tb_role')->where('id', '=', $id)->value('password') ?? '');
      if ($storedPassword === '' || !$this->verifyPassword($oldPassword, $storedPassword)) {
        $this->json([], '原密码不正确', ErrorCode::CREDENTIAL_INVALID);
        return;
      }
    }
    $data = array_filter($data, function (mixed $value) {
      return $value !== null && $value !== '';
    });
    if (array_key_exists('nickname', $data)) {
      $nickname = trim(html_entity_decode((string)$data['nickname'], ENT_QUOTES));
      if ($nickname === '') {
        $this->json([], '昵称不能为空', ErrorCode::PARAM_INVALID);
        return;
      }
      $oldIssueTime = Db::name('tb_role')->where('id', '=', $id)->value('issue_time');
      if ($oldIssueTime && strtotime((string)$oldIssueTime) > strtotime('-1 year')) {
        $this->json([], '昵称一年内只能修改一次', ErrorCode::RULE_REJECTED);
        return;
      }
      $data['nickname'] = $nickname;
      $data['issue_time'] = date('Y-m-d H:i:s');
    }
    if (array_key_exists('role', $data)) {
      $data['role_auth'] = $this->syncRoleAuth($data['role']);
    }
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', ErrorCode::PARAM_INVALID);
      return;
    }
    $data = $this->encodeFields($data, ['name', 'nickname']);
    if (isset($data['password'])) {
      $password = $data['password'];
      $hasDollar = strpos($password, '$') !== false;
      $parts = $hasDollar ? explode('$', $password, 2) : [null, null];
      $salt = $parts[0];
      $hash = $parts[1] ?? '';
      $alreadyHashed = $hasDollar && strlen($salt) === 32 && ctype_xdigit($salt) && strlen($hash) === 128 && ctype_xdigit($hash);
      if (!$alreadyHashed) {
        $data['password'] = $this->hashPassword($password);
      }
    }
    // 本次是否真的改了密码：批量勾选（KNIU_TABLE_EVENT_CHECKALL）只改 is_select 状态，不算改密码。
    $passwordChanged = $type !== 'KNIU_TABLE_EVENT_CHECKALL' && isset($data['password']);
    if ($type === 'KNIU_TABLE_EVENT_CHECKALL') {
      $selectallResult = array_key_exists('is_selectall', $data)
        ? Db::name('tb_selectall')->where('name', '=', 'role')->update(['is_select' => $data['is_selectall']])
        : 0;
      $roleResult = Db::name('tb_role')
        ->whereIn('id', explode(',', $id))
        ->update(['is_select' => $data['is_select']]);
      $result = $selectallResult + $roleResult;
    } else {
      $selectallResult = array_key_exists('is_selectall', $data)
        ? Db::name('tb_selectall')->where('name', '=', 'role')->update(['is_select' => $data['is_selectall']])
        : 0;
      $roleResult = Db::name('tb_role')
        ->where('id', '=', $id)
        ->field(['is_select', 'sid', 'name', 'nickname', 'password', 'role', 'role_auth', 'comment_audit', 'comment_ban', 'is_show', 'issue_time'])
        ->update($data);
      $result = $selectallResult + $roleResult;
    }
    if ($result === false) {
      $this->json([], '更新失败', ErrorCode::SERVER_ERROR);
      return;
    }
    if ($result === 0) {
      $this->json([], '数据未发生变化', ErrorCode::RULE_REJECTED);
      return;
    }
    // 密码一旦落库，被改账号的已有登录态立即失效——由后端强制保证，前端只负责跳转。
    $logoutSelf = $passwordChanged ? $this->forceLogoutAfterPasswordChange((int)$id) : false;
    $this->json(['logout' => $logoutSelf], '更新成功', 1);
  }

  /**
   * 修改密码成功后的强制登出：被改账号的已有后台会话必须立即失效。
   *
   * 改的是当前登录账号 → 直接销毁当前会话（返回 true，前端据此跳登录页）；
   * 管理员改他人密码 → 保留管理员会话，仅删除被改账号在文件会话存储中的会话文件。
   *
   * @param int $targetId 被改密码的账号 tb_role.id。
   * @return bool 当前会话是否已被销毁（true 表示本请求结束后已处于登出态）。
   */
  private function forceLogoutAfterPasswordChange(int $targetId): bool
  {
    if ($targetId <= 0) {
      return false;
    }
    if ($targetId === $this->currentUserId()) {
      // 该账号在其它设备上的会话同样必须失效，再销毁当前请求自身的会话。
      $this->destroySessionsOfUser($targetId);
      unset($_SESSION['admin_token']);
      if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
      }
      return true;
    }
    $this->destroySessionsOfUser($targetId);
    return false;
  }

  /**
   * 删除指定账号在文件会话存储中的全部会话文件（保留当前请求自身的会话）。
   *
   * 会话序列化格式为 php 处理器的 "键|序列化值"，admin_token 是扁平数组，
   * 故按 "admin_token|a:N:{...}" 截出内部片断再取 id 即可，无需 session_decode
   * （session_decode 会覆盖当前请求的 $_SESSION）。
   *
   * @param int $userId 目标账号 tb_role.id。
   * @return int 实际删除的会话文件数量。
   */
  private function destroySessionsOfUser(int $userId): int
  {
    $savePath = (string)session_save_path();
    // php.ini 支持 "N;/path" 多级目录写法，取分号后的真实路径。
    $separator = strrpos($savePath, ';');
    if ($separator !== false) {
      $savePath = substr($savePath, $separator + 1);
    }
    if ($savePath === '' || !is_dir($savePath)) {
      return 0;
    }
    $currentSid = (string)session_id();
    $files = glob(rtrim($savePath, '/\\') . DIRECTORY_SEPARATOR . 'sess_*');
    if (!is_array($files)) {
      return 0;
    }
    $removed = 0;
    foreach ($files as $file) {
      $sid = substr(basename($file), 5);
      if ($sid === '' || $sid === $currentSid) {
        continue;
      }
      $content = @file_get_contents($file);
      if ($content === false || $content === '') {
        continue;
      }
      $tokenSegment = [];
      if (preg_match('/admin_token\|a:\d+:\{([^{}]*)\}/', $content, $tokenSegment) !== 1) {
        continue;
      }
      $idSegment = [];
      if (preg_match('/s:2:"id";i:(\d+);/', $tokenSegment[1], $idSegment) !== 1) {
        continue;
      }
      if ((int)$idSegment[1] !== $userId) {
        continue;
      }
      if (@unlink($file)) {
        $removed++;
      }
    }
    return $removed;
  }

  // 查询角色列表。
  public function roleList(): void
  {
    $table = 'tb_role';
    $field = $this->input('post.field') ?? $this->getDefaultSortField($table);
    $sort = $this->input('post.sort') ?? 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $keyword = trim((string)($this->input('post.keyword') ?? ''));
    $selectall = Db::name('tb_selectall')->where('name', '=', 'role')->value('is_select') ?? 0;
    $query = Db::name($table);
    if (!$this->hasManagePermission()) {
      // 普通用户仅能查看自己的账号行。
      $query->where('id', '=', $this->currentUserId());
    }
    if ($keyword !== '') {
      $query->where('`name`', 'LIKE', $this->likeEncodedPattern($keyword));
    }
    $result = $query
      ->field(['id', 'sid', 'name', 'nickname', 'role', 'role_auth', 'comment_audit', 'comment_ban', 'is_show', 'create_time', 'issue_time'])
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['name', 'nickname']);
    $result['selectall'] = $selectall;
    $this->json($result);
  }

  // 查询某一条。
  public function roleDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    if (!$this->hasManagePermission() && (int)$id !== $this->currentUserId()) {
      $this->denyPermission();
      return;
    }
    // 与 roleList 同列集合：禁止把 password 哈希与 identity_token 返回给前端。
    $result = Db::name('tb_role')
      ->field(['id', 'sid', 'name', 'nickname', 'role', 'role_auth', 'comment_audit', 'comment_ban', 'is_show', 'create_time', 'issue_time'])
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['name', 'nickname']);
    $this->json($result);
  }
}
