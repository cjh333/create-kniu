<?php

namespace App\Admin\Controllers;

use Core\AdminBaseController;
use Core\Db;

class CommentController extends AdminBaseController
{
  public function __construct()
  {
    parent::__construct();
  }

  // 查询评论/回复列表。
  //
  // parent_id 为 0 表示顶层评论，大于 0 表示对某条评论的回复。
  // type 取 comment(顶层) / reply(回复) / all(全部)。
  // audit 取 0(待审核) / 1(已通过) / ''(全部)。
  public function commentList(): void
  {
    $type = $this->input('post.type') ?? 'all';
    $audit = $this->input('post.audit') ?? '';
    $field = $this->input('post.field') ?? 'id';
    $sort = $this->input('post.sort') ?? 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $keyword = trim((string)($this->input('post.keyword') ?? ''));

    $query = Db::name('tb_comment');

    if ($type === 'comment') {
      $query->where('parent_id', '=', 0);
    } elseif ($type === 'reply') {
      $query->where('parent_id', '>', 0);
    }

    if ($audit === '0' || $audit === '1') {
      $query->where('is_show', '=', (int)$audit);
    }

    if ($keyword !== '') {
      // 关键词按入库规则编码（htmlspecialchars ENT_QUOTES）后统一小写，
      // 配合 SQL 侧 LOWER() 实现不依赖排序规则的字母大小写不敏感模糊搜索。
      // 昵称或评论内容任一命中即匹配（OR 语义），用单条原始条件表达。
      $pattern = '%' . mb_strtolower(htmlspecialchars($keyword, ENT_QUOTES), 'UTF-8') . '%';
      $query->where(
        '(LOWER(`name`) LIKE "' . $pattern . '" OR LOWER(`message`) LIKE "' . $pattern . '")'
      );
    }

    $result = $query
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);

    // 评论内容/昵称后端解码（前端渲染时再做一次转义，双保险）。
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['name', 'message']);

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
      $row['article_title'] = $articleTitles[(int)$row['article_id']] ?? '';
    }
    unset($row);
    // 文章标题同样按入库规则解码。
    $result['data'] = $this->decodeFields($result['data'], ['article_title']);

    $this->json($result);
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
    Db::name('tb_comment')
      ->where('id', '=', $id)
      ->update(['is_show' => (int)$audit]);
    $this->json([], $audit === '1' ? '审核通过' : '已隐藏', 1);
  }

  // 删除评论或回复。
  public function commentDelete(): void
  {
    if (!$this->requireManagePermission()) return;
    $id = $this->input('post.id') ?? '';
    // 删除顶层评论时，一并删除其下所有回复（parent_id 指向该评论）。
    $comment = Db::name('tb_comment')
      ->where('id', '=', $id)
      ->field(['id', 'parent_id'])
      ->find();
    if ($comment) {
      if ((int)$comment['parent_id'] === 0) {
        Db::name('tb_comment')
          ->where('parent_id', '=', $id)
          ->delete();
      }
      Db::name('tb_comment')
        ->where('id', '=', $id)
        ->delete();
    }
    $this->json([], '删除成功', 1);
  }

  // 查询某一条。
  public function commentDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $result = Db::name('tb_comment')
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['name', 'message']);
    $this->json($result);
  }
}
