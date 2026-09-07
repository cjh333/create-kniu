<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;

class DailyController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  // 增加。
  public function dailyAdd(): void
  {
    if (!$this->requireManagePermission()) return;
    $data = [
      'sid' => $this->input('post.sid') ?? 0,
      'cn' => $this->input('post.cn') ?? '',
      'en' => $this->input('post.en') ?? '',
      'is_show' => $this->input('post.is_show') ?? 1
    ];
    $data = $this->encodeFields($data, ['cn', 'en']);
    Db::name('tb_daily')->insert($data);
    $this->json([], '添加成功', 1);
  }

  // 删除。
  public function dailyDelete(): void
  {
    if (!$this->requireManagePermission()) return;
    $id = $this->input('post.id') ?? '';
    Db::name('tb_daily')
      ->where('id', '=', $id)
      ->delete();
    $this->json([], '删除成功', 1);
  }

  // 修改。
  public function dailyUpdate(): void
  {
    if (!$this->requireManagePermission()) return;
    $type = $this->input('post.type') ?? null;
    $id = $this->input('post.id') ?? null;
    $data = [
      'is_selectall' => $this->input('post.is_selectall') ?? null,
      'is_select' => $this->input('post.is_select') ?? null,
      'sid' => $this->input('post.sid') ?? null,
      'cn' => $this->input('post.cn') ?? null,
      'en' => $this->input('post.en') ?? null,
      'is_show' => $this->input('post.is_show') ?? null
    ];
    $data = array_filter($data, function ($value) {
      return $value !== null && $value !== '';
    });
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', 0);
      return;
    }
    $data = $this->encodeFields($data, ['cn', 'en']);
    if ($type === 'KNIU_TABLE_EVENT_CHECKALL') {
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'daily')
        ->update(['is_select' => $data['is_selectall']]);
      $dailyResult = Db::name('tb_daily')
        ->whereIn('id', explode(',', $id))
        ->update(['is_select' => $data['is_select']]);
      $result = $selectallResult + $dailyResult;
    } else {
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'daily')
        ->update(['is_select' => $data['is_selectall']]);
      $dailyResult = Db::name('tb_daily')
        ->where('id', '=', $id)
        ->field(['is_select', 'sid', 'cn', 'en', 'is_show'])
        ->update($data);
      $result = $selectallResult + $dailyResult;
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

  // 查询列表。
  public function dailyList(): void
  {
    $table = 'tb_daily';
    $field = $this->input('post.field') ?? $this->getDefaultSortField($table);
    $sort = $this->input('post.sort') ?? 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $keyword = trim((string)($this->input('post.keyword') ?? ''));
    $selectall = Db::name('tb_selectall')->where('name', '=', 'daily')->value('is_select') ?? 0;
    $query = Db::name($table);
    if ($keyword !== '') {
      $query->where('LOWER(`cn`)', 'LIKE', $this->likeEncodedPattern($keyword));
    }
    $result = $query
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['cn', 'en']);
    $result['selectall'] = $selectall;
    $this->json($result);
  }

  // 查询某一条。
  public function dailyDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $result = Db::name('tb_daily')
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['cn', 'en']);
    $this->json($result);
  }
}