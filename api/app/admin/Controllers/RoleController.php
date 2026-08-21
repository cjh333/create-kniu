<?php

namespace App\Admin\Controllers;

use Core\AdminBaseController;
use Core\Db;

class RoleController extends AdminBaseController
{
  public function __construct()
  {
    parent::__construct();
  }

  // 增加。
  public function roleAdd(): void
  {
    $data = [
      'sid' => $this->input('post.sid') ?? 0,
      'name' => $this->input('post.name') ?? '',
      'password' => $this->hashPassword($this->input('post.password')) ?? '',
      'role' => $this->input('post.role') ?? 0,
      'role_auth' => $this->input('post.role_auth') ?? 0,
      'is_show' => $this->input('post.is_show') ?? 1
    ];
    $data = $this->encodeFields($data, ['name']);
    Db::name('tb_role')->insert($data);
    $this->json([], '添加成功', 1);
  }

  // 删除。
  public function roleDelete(): void
  {
    $id = $this->input('post.id') ?? '';
    Db::name('tb_role')
      ->where('id', '=', $id)
      ->delete();
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
      'password' => $this->input('post.password') ?? null,
      'role' => $this->input('post.role') ?? null,
      'role_auth' => $this->input('post.role_auth') ?? null,
      'is_show' => $this->input('post.is_show') ?? null
    ];
    $data = array_filter($data, function ($value) {
      return $value !== null && $value !== '';
    });
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', 0);
      return;
    }
    $data = $this->encodeFields($data, ['name']);
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
    if ($type === 'KNIU_TABLE_EVENT_CHECKALL') {
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'role')
        ->update(['is_select' => $data['is_selectall']]);
      $roleResult = Db::name('tb_role')
        ->whereIn('id', explode(',', $id))
        ->update(['is_select' => $data['is_select']]);
      $result = $selectallResult + $roleResult;
    } else {
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'role')
        ->update(['is_select' => $data['is_selectall']]);
      $roleResult = Db::name('tb_role')
        ->where('id', '=', $id)
        ->field(['is_select', 'sid', 'name', 'password', 'role', 'role_auth', 'is_show'])
        ->update($data);
      $result = $selectallResult + $roleResult;
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

  // 查询角色列表。
  public function roleList(): void
  {
    $table = 'tb_role';
    $field = $this->input('post.field') ?? $this->getDefaultSortField($table);
    $sort = $this->input('post.sort') ?? 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $selectall = Db::name('tb_selectall')->where('name', '=', 'role')->value('is_select') ?? 0;
    $result = Db::name($table)
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['name']);
    $result['selectall'] = $selectall;
    $this->json($result);
  }

  // 查询某一条。
  public function roleDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $result = Db::name('tb_role')
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['name']);
    $this->json($result);
  }
}
