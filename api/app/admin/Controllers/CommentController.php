<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;

class CommentController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  /** 为已有站点补齐评论排序字段，避免部署时依赖人工执行迁移。 */
  private function ensureCommentSortField(): void
  {
    $columns = Db::query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tb_comment'");
    if (!in_array('sid', array_column($columns, 'COLUMN_NAME'), true)) {
      Db::execute("ALTER TABLE `tb_comment` ADD COLUMN `sid` int NOT NULL DEFAULT 0 COMMENT '排序' AFTER `parent_id`");
    }
  }

  /** 当前后台账号的统一用户 ID（tb_role.id）。 */
  private function currentFrontUserId(): int
  {
    return $this->frontUserIdByRoleId($this->currentUserId());
  }

  /**
   * 解析"某条回复指向的接收前台用户"的通用 SQL 片段。
   *
   * 前台评论 tb_comment.role_id 存 tb_role.id；对老评论（role_id=0）
   * 按唯一昵称反查 tb_role。state/read/list 三处共用同一 join，
   * 避免三份近似重复的复杂子句。
   */
  private function notificationReplyJoins(): string
  {
    return
      'INNER JOIN `tb_comment` AS `target` ON `target`.`id` = `reply`.`parent_id` ' .
      '';
  }

  /** 判定某回复确实指向指定接收者（recipient）的 WHERE 片段。 */
  private function recipientPredicate(int $recipientId): string
  {
    return
      '`target`.`role_id` = ' . $recipientId . ' ' .
      'AND `reply`.`role_id` <> ' . $recipientId . ' ';
  }

  /**
   * 回复通知只保存每个用户最后读到的评论 ID，不复制评论内容。
   * CREATE TABLE IF NOT EXISTS 让旧数据库升级后可直接使用。
   */
  private function ensureReplyNotificationTable(): void
  {
    Db::execute(
      'CREATE TABLE IF NOT EXISTS `tb_comment_reply_status` (' .
      '`reply_id` int unsigned NOT NULL,' .
      '`recipient_user_id` int unsigned NOT NULL,' .
      '`is_read` tinyint unsigned NOT NULL DEFAULT 0,' .
      '`issue_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,' .
      'PRIMARY KEY (`reply_id`,`recipient_user_id`),' .
      'KEY `idx_reply_notification_recipient` (`recipient_user_id`,`is_read`)' .
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
  }

  /** 查询当前账号收到的、由其他用户发表的未读前台回复。 */
  public function commentReplyState(): void
  {
    $frontUserId = $this->currentFrontUserId();
    if ($frontUserId <= 0) {
      $this->json(['has_unread' => false, 'unread_count' => 0]);
      return;
    }

    try {
      $this->ensureReplyNotificationTable();
      $rows = Db::query(
        'SELECT COUNT(*) AS `unread_count` FROM `tb_comment` AS `reply` ' .
        $this->notificationReplyJoins() .
        'LEFT JOIN `tb_comment_reply_status` AS `reading` ON `reading`.`reply_id` = `reply`.`id` ' .
        'AND `reading`.`recipient_user_id` = ' . $frontUserId . ' ' .
        'WHERE ' . $this->recipientPredicate($frontUserId) .
        'AND `target`.`is_show` = 1 AND `reply`.`is_show` = 1 ' .
        'AND COALESCE(`reading`.`is_read`, 0) = 0'
      );
      $count = (int)($rows[0]['unread_count'] ?? 0);
      $this->json(['has_unread' => $count > 0, 'unread_count' => $count]);
    } catch (\Exception $e) {
      $this->json([], '获取回复通知失败', 0);
    }
  }

  /** 将当前账号已经收到的回复全部标记为已读。 */
  public function commentReplyRead(): void
  {
    $frontUserId = $this->currentFrontUserId();
    if ($frontUserId <= 0) {
      $this->json([], '已读', 1);
      return;
    }

    try {
      $this->ensureReplyNotificationTable();
      $now = date('Y-m-d H:i:s');
      Db::execute(
        'INSERT INTO `tb_comment_reply_status` (`reply_id`,`recipient_user_id`,`is_read`,`issue_time`) ' .
        'SELECT `reply`.`id`,' . $frontUserId . ',1,"' . $now . '" FROM `tb_comment` AS `reply` ' .
        $this->notificationReplyJoins() .
        'WHERE ' . $this->recipientPredicate($frontUserId) .
        'AND `target`.`is_show` = 1 AND `reply`.`is_show` = 1 ' .
        'ON DUPLICATE KEY UPDATE `is_read` = 1, `issue_time` = VALUES(`issue_time`)'
      );
      $this->json([], '已读', 1);
    } catch (\Exception $e) {
      $this->json([], '更新回复通知失败', 0);
    }
  }

  /** 修改单条回复的读取状态。 */
  public function commentReplyUpdate(): void
  {
    $replyId = (int)$this->input('post.id/d', 0);
    $isRead = (int)$this->input('post.is_read/d', 0) === 1 ? 1 : 0;
    if ($replyId <= 0) {
      $this->json([], '参数错误', 0);
      return;
    }

    try {
      $reply = Db::name('tb_comment')->where('id', '=', $replyId)->field(['id', 'parent_id', 'role_id'])->find();
      if (!$reply || (int)$reply['parent_id'] <= 0) {
        $this->json([], '回复不存在', 0);
        return;
      }
      $target = Db::name('tb_comment')->where('id', '=', (int)$reply['parent_id'])->field(['role_id'])->find();
      $recipientId = (int)($target['role_id'] ?? 0);
      if ($recipientId <= 0 || (!$this->isAdmin() && $recipientId !== $this->currentFrontUserId())) {
        http_response_code(403);
        $this->json([], '无权修改该回复的读取状态', 0);
        return;
      }
      $this->ensureReplyNotificationTable();
      $now = date('Y-m-d H:i:s');
      Db::execute(
        'INSERT INTO `tb_comment_reply_status` (`reply_id`,`recipient_user_id`,`is_read`,`issue_time`) VALUES (' .
        $replyId . ',' . $recipientId . ',' . $isRead . ',"' . $now . '") ' .
        'ON DUPLICATE KEY UPDATE `is_read` = VALUES(`is_read`), `issue_time` = VALUES(`issue_time`)'
      );
      $this->json(['is_read' => $isRead], $isRead === 1 ? '已标记为已读' : '已标记为未读', 1);
    } catch (\Exception $e) {
      $this->json([], '更新读取状态失败', 0);
    }
  }

  // 查询评论/回复列表。
  //
  // parent_id 为 0 表示顶层评论，大于 0 表示对某条评论的回复。
  // type 取 comment(顶层) / reply(回复) / all(全部)。
  // audit 取 0(待审核) / 1(已通过) / ''(全部)。
  public function commentList(): void
  {
    $this->ensureCommentSortField();
    $type = $this->input('post.type') ?? 'all';
    $audit = $this->input('post.audit') ?? '';
    $field = $this->input('post.field') ?? 'sid';
    $field = in_array($field, ['id', 'sid', 'likes', 'create_time'], true) ? $field : 'sid';
    $sort = strtolower((string)($this->input('post.sort') ?? 'asc')) === 'desc' ? 'desc' : 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $keyword = trim((string)($this->input('post.keyword') ?? ''));

    $query = Db::name('tb_comment');
    $isAdmin = $this->isAdmin();
    $currentUserId = $this->currentUserId();
    $frontUserId = $this->frontUserIdByRoleId($currentUserId);

    if (!$isAdmin) {
      // tb_comment.role_id 与后台会话 ID 均对应 tb_role.id。
      // 同时按唯一昵称兼容历史评论（旧数据可能没有有效 role_id）。
      $ownConditions = [];
      if ($currentUserId > 0) $ownConditions[] = '`role_id` = ' . $currentUserId;
      $query->where($ownConditions ? '(' . implode(' OR ', $ownConditions) . ')' : '1 = 0');
    }

    if ($type === 'comment') {
      $query->where('parent_id', '=', 0);
    } elseif ($type === 'reply') {
      $query->where('parent_id', '>', 0);
    }

    if ($audit === '0' || $audit === '1') {
      $query->where('is_show', '=', (int)$audit);
    }

    if ($keyword !== '') {
      // 昵称或评论内容任一命中即匹配（OR 语义），用单条原始条件表达。
      $pattern = $this->likeEncodedPattern($keyword);
      $query->where(
        'LOWER(`message`) LIKE "' . $pattern . '"'
      );
    }

    $result = $query
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);

    // 评论内容/昵称后端解码（前端渲染时再做一次转义，双保险）。
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['message']);
    $roleIds = array_values(array_unique(array_filter(array_map('intval', array_column($result['data'], 'role_id')))));
    $roleNames = [];
    $roleNicknames = [];
    if ($roleIds) {
      foreach (Db::name('tb_role')->whereIn('id', $roleIds)->field(['id', 'name', 'nickname'])->select() as $role) {
        $roleNames[(int)$role['id']] = html_entity_decode((string)$role['name'], ENT_QUOTES);
        $roleNicknames[(int)$role['id']] = html_entity_decode((string)($role['nickname'] ?? ''), ENT_QUOTES);
      }
    }

    $replyStates = [];
    if ($type === 'reply' && !empty($result['data'])) {
      $this->ensureReplyNotificationTable();
      $replyIds = array_values(array_filter(array_map('intval', array_column($result['data'], 'id'))));
      if (!empty($replyIds)) {
        $rows = Db::query(
          'SELECT `reply`.`id`,COALESCE(`target`.`role_id`,0) AS `recipient_user_id`,COALESCE(`reading`.`is_read`,0) AS `is_read` ' .
          'FROM `tb_comment` AS `reply` ' .
          $this->notificationReplyJoins() .
          'LEFT JOIN `tb_comment_reply_status` AS `reading` ON `reading`.`reply_id` = `reply`.`id` ' .
          'AND `reading`.`recipient_user_id` = `target`.`role_id` ' .
          'WHERE `reply`.`id` IN (' . implode(',', $replyIds) . ')'
        );
        foreach ($rows as $replyState) $replyStates[(int)$replyState['id']] = $replyState;
      }
    }

    // 关联文章标题，方便后台识别评论归属。
    $articleIds = array_values(array_unique(array_column($result['data'], 'article_id')));
    $articleTitles = [];
    if (!empty($articleIds)) {
      $articles = Db::name('tb_article')
        ->whereIn('id', $articleIds)
        ->field(['id', 'title'])
        ->select();
      foreach ($articles as $article) {
        $articleTitles[(int)$article['id']] = $article['title'] ?? '';
      }
    }
    foreach ($result['data'] as &$row) {
      $row['article_title'] = $articleTitles[(int)$row['article_id']] ?? '未关联文章';
      // 昵称和用户名均来自统一账号表。
      $row['nickname'] = $roleNicknames[(int)$row['role_id']] ?? '';
      $row['account_name'] = $roleNames[(int)$row['role_id']] ?? '';
      // 兼容迁移前遗留的旧前台用户 ID：无法按 role_id 对应账号时按评论昵称回查。
      $row['status_text'] = (int)$row['is_show'] === 1 ? '已通过' : '待审核';
      if ($type === 'reply') {
        $replyState = $replyStates[(int)$row['id']] ?? [];
        $row['is_read'] = (int)($replyState['is_read'] ?? 0);
        $row['recipient_user_id'] = (int)($replyState['recipient_user_id'] ?? 0);
      }
      // 是否本人发表：管理员列表含他人评论时按 role_id 比对；普通用户列表只含自己的，恒为 true。
      $row['is_own'] = $isAdmin
        ? ((int)$row['role_id'] === $currentUserId)
        : true;
    }
    unset($row);
    // 文章标题同样按入库规则解码。
    $result['data'] = $this->decodeFields($result['data'], ['article_title']);

    $this->json($result);
  }

  /** 保存评论或回复的后台排序值。 */
  public function commentUpdate(): void
  {
    if (!$this->requireManagePermission()) return;
    $this->ensureCommentSortField();
    $id = (int)$this->input('post.id/d', 0);
    $sid = max(0, (int)$this->input('post.sid/d', 0));
    if ($id <= 0) {
      $this->json([], '参数错误', 0);
      return;
    }
    Db::name('tb_comment')->where('id', '=', $id)->update(['sid' => $sid]);
    $this->json(['id' => $id, 'sid' => $sid], '排序已保存', 1);
  }

  // 审核评论：audit 传 1 审核通过（前台可见），传 0 设为隐藏/撤回。
  public function commentAudit(): void
  {
    if (!$this->requireManagePermission()) return;
    $id = $this->input('post.id') ?? '';
    // 前端 JSON 传数字(0/1)、表单传字符串('0'/'1')，统一转字符串比较。
    $audit = (string)$this->input('post.audit', '');
    if ($id === '' || ($audit !== '0' && $audit !== '1')) {
      $this->json([], '参数错误', 0);
      return;
    }
    $isReply = (int)(Db::name('tb_comment')->where('id', '=', $id)->value('parent_id') ?? 0) > 0;
    Db::name('tb_comment')
      ->where('id', '=', $id)
      ->update(['is_show' => (int)$audit]);
    // 审核通过一条"回复"后，其接收方（父评论作者）的红点应尽快更新，
    // 通过 SSE 让 Node 广播一次"去刷新"，实现近实时（见 headerController）。
    if ($audit === '1' && $isReply) $this->notifyServer();
    $this->json([], $audit === '1' ? '审核通过' : '已隐藏', 1);
  }

  // 删除评论或回复。
  public function commentDelete(): void
  {
    if ($this->currentUserId() <= 0) {
      http_response_code(403);
      $this->json([], '请先登录', 0);
      return;
    }
    $id = $this->input('post.id') ?? '';
    // 删除顶层评论时，一并删除其下所有回复（parent_id 指向该评论）。
    $comment = Db::name('tb_comment')
      ->where('id', '=', $id)
      ->field(['id', 'parent_id', 'role_id'])
      ->find();
    if ($comment) {
      if (!$this->isAdmin() && (int)$comment['role_id'] !== $this->currentUserId()) {
        http_response_code(403);
        $this->json([], '只能删除自己发表的评论', 0);
        return;
      }
      if ((int)$comment['parent_id'] === 0) {
        Db::name('tb_comment')
          ->where('parent_id', '=', $id)
          ->delete();
      }
      Db::name('tb_comment')
        ->where('id', '=', $id)
        ->delete();
    }
    // 无论目标记录是否已被其它页面删除，都广播一次，让前台重新以数据库结果为准。
    $this->notifyServer();
    $this->json([], '删除成功', 1);
  }

  // 查询某一条。
  public function commentDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $result = Db::name('tb_comment')
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['message']);
    $this->json($result);
  }
}
