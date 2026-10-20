<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\ErrorCode;

class FeedbackController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  /**
   * 后台「反馈管理」列表：仅管理员可见前台提交的全部问题反馈。
   *
   * 分页参数与 commentList 同口径（field 白名单、方向仅 asc/desc）；
   * 关键字匹配标题/简述/提交人昵称（likeEncodedPattern 统一转义）；
   * 提交人昵称/账号 whereIn 批量映射（禁 N+1）；文本单轮解码返回，
   * images 拆为 imageList 便于详情弹框渲染；status_text 按 result 是否
   * 已填写区分「已回复/待回复」。
   */
  public function feedbackList(): void
  {
    // 与同模块 feedbackResult/feedbackUpdate 同为「管理权限」口径（role=1 或 role_auth=1）：
    // 原用 isAdmin()（仅 role=1）比前端菜单判定（isAdminRole）更严，导致菜单可见却 403。
    if (!$this->requireManagePermission()) {
      http_response_code(403);
      $this->json([], '仅管理员可查看反馈列表', ErrorCode::FORBIDDEN);
      return;
    }
    $field = $this->input('post.field') ?? 'id';
    $field = in_array($field, ['id', 'sid', 'create_time'], true) ? $field : 'id';
    $sort = strtolower((string)($this->input('post.sort') ?? 'desc')) === 'asc' ? 'asc' : 'desc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $keyword = trim((string)($this->input('post.keyword') ?? ''));

    try {
      $query = Db::name('tb_feedback');
      if ($keyword !== '') {
        // 关键词按字面匹配：编码/escape 后消毒 %/_，防通配符全表扫描（C3-m2）。
        $rawKeyword = $this->escapeLikeWildcards(Db::escape(htmlspecialchars($keyword, ENT_QUOTES)));
        $query->where(
          "(`title` LIKE '%{$rawKeyword}%' OR `content` LIKE '%{$rawKeyword}%' OR `role_id` IN " .
            "(SELECT `id` FROM `tb_role` WHERE `nickname` LIKE '%{$rawKeyword}%'))"
        );
      }
      $result = $query
        ->field(['id', 'role_id', 'sid', 'title', 'content', 'images', 'result', 'create_time'])
        ->order($field, $sort)
        ->page($pageCurrent, $pageRow);
      $result['data'] = $this->decodeFields($result['data'] ?? [], ['title', 'content', 'result']);
      $roleIds = array_values(array_unique(array_filter(array_map('intval', array_column($result['data'], 'role_id')))));
      $roleNames = [];
      $roleNicknames = [];
      if ($roleIds) {
        foreach (Db::name('tb_role')->whereIn('id', $roleIds)->field(['id', 'name', 'nickname'])->select() as $role) {
          $roleNames[(int)$role['id']] = html_entity_decode((string)$role['name'], ENT_QUOTES);
          $roleNicknames[(int)$role['id']] = html_entity_decode((string)($role['nickname'] ?? ''), ENT_QUOTES);
        }
      }
      foreach ($result['data'] as &$row) {
        $row['nickname'] = $roleNicknames[(int)$row['role_id']] ?? '';
        $row['account_name'] = $roleNames[(int)$row['role_id']] ?? '';
        $row['imageList'] = array_values(array_filter(array_map('trim', explode(',', (string)($row['images'] ?? '')))));
        unset($row['images']);
        $row['status_text'] = trim((string)($row['result'] ?? '')) !== '' ? '已回复' : '待回复';
        $row['status_type'] = trim((string)($row['result'] ?? '')) !== '' ? 'success' : 'warning';
      }
      unset($row);
      $this->json($result);
    } catch (\Throwable $e) {
      error_log('feedbackList failed: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
      $this->json([], '获取反馈列表失败', ErrorCode::SERVER_ERROR);
    }
  }

  /**
   * 保存指定反馈的处理结果（requireManagePermission：role=1 或 role_auth=1）。
   *
   * 结果限长 2000 字，与前台问题简述同限；文本单轮编码入库（规则 #8），
   * 前台「我的反馈」详情以红字展示该字段。
   */
  public function feedbackResult(): void
  {
    if (!$this->requireManagePermission()) return;
    $id = (int)$this->input('post.id/d', 0);
    $result = trim((string)$this->input('post.result/s', ''));
    if ($id <= 0) {
      $this->json([], '参数错误', ErrorCode::PARAM_INVALID);
      return;
    }
    if (mb_strlen($result) > 2000) {
      $this->json([], '反馈结果不能超过 2000 字', ErrorCode::PARAM_INVALID);
      return;
    }
    try {
      $feedback = Db::name('tb_feedback')->where('id', '=', $id)->field(['id'])->find();
      if (!$feedback) {
        $this->json([], '反馈不存在', ErrorCode::NOT_FOUND);
        return;
      }
      Db::name('tb_feedback')->where('id', '=', $id)->update(
        $this->encodeFields(['result' => $result], ['result'])
      );
      $this->json(['id' => $id, 'result' => $result], '反馈结果已保存', ErrorCode::SUCCESS);
    } catch (\Throwable $e) {
      error_log('feedbackResult failed: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
      $this->json([], '保存反馈结果失败', ErrorCode::SERVER_ERROR);
    }
  }

  /** 保存反馈的后台排序值（与 commentUpdate 同口径）。 */
  public function feedbackUpdate(): void
  {
    if (!$this->requireManagePermission()) return;
    $this->updateSortField('tb_feedback');
  }
}
