<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;

class NavController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  // 增加。
  public function navAdd(): void
  {
    if (!$this->requireManagePermission()) return;
    $data = [
      'is_select' => $this->input('post.is_select') ?? 0,
      'sid' => $this->input('post.sid') ?? 0,
      'name' => $this->input('post.name') ?? '',
      'url' => $this->input('post.url') ?? '',
      'is_show' => $this->input('post.is_show') ?? 1
    ];
    $data = $this->encodeFields($data, ['name', 'url']);
    Db::name('tb_nav')->insert($data);
    $this->json([], '添加成功', 1);
  }

  // 删除。
  public function navDelete(): void
  {
    if (!$this->requireManagePermission()) return;
    $id = $this->input('post.id') ?? '';
    if (empty($id)) {
      $this->json([], 'ID不能为空', 0);
      return;
    }
    $result = Db::name('tb_nav')
      ->where('id', '=', $id)
      ->delete();
    if ($result === false) {
      $this->json([], '删除失败', 0);
      return;
    }
    if ($result === 0) {
      $this->json([], '导航不存在或已被删除', 0);
      return;
    }
    $this->json([], '删除成功', 1);
  }

  // 修改。
  public function navUpdate(): void
  {
    if (!$this->requireManagePermission()) return;
    $type = $this->input('post.type') ?? null;
    $id = $this->input('post.id') ?? null;
    $data = [
      'is_selectall' => $this->input('post.is_selectall') ?? null,
      'is_select' => $this->input('post.is_select') ?? null,
      'sid' => $this->input('post.sid') ?? null,
      'name' => $this->input('post.name') ?? null,
      'url' => $this->input('post.url') ?? null,
      'is_show' => $this->input('post.is_show') ?? null
    ];
    $data = array_filter($data, function ($value) {
      return $value !== null && $value !== '';
    });
    $isSelectall = $data['is_selectall'] ?? null;
    unset($data['is_selectall']);
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', 0);
      return;
    }
    $data = $this->encodeFields($data, ['name', 'url']);
    if ($type === 'KNIU_TABLE_EVENT_CHECKALL') {
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'nav')
        ->update(['is_select' => $isSelectall]);
      $dailyResult = Db::name('tb_nav')
        ->whereIn('id', explode(',', $id))
        ->update(['is_select' => $data['is_select']]);
      $result = $selectallResult + $dailyResult;
    } else {
      $dailyResult = Db::name('tb_nav')
        ->where('id', '=', $id)
        ->field(['is_select', 'sid', 'name', 'url', 'is_show'])
        ->update($data);
      $result = $dailyResult;
    }
    if ($result === false) {
      $this->json([], '更新失败', 0);
      return;
    }
    if ($result === 0) {
      $this->json([], '数据未发生变化', 0);
      return;
    }
    $this->json([], '更新成功', 1);
  }

  // 查询。
  public function navList(): void
  {
    $table = 'tb_nav';
    $field = $this->input('post.field') ?? $this->getDefaultSortField($table);
    $sort = $this->input('post.sort') ?? 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $selectall = Db::name('tb_selectall')->where('id', '=', 1)->value('is_select') ?? 0;
    $result = Db::name($table)
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['name', 'url']);
    $result['selectall'] = $selectall;
    $this->json($result);
  }

  // 查询某一条。
  public function navDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $result = Db::name('tb_nav')
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['name', 'url']);
    $this->json($result);
  }
}