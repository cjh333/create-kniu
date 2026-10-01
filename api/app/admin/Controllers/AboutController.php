<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;

/**
 * 「关于我」内容控制器（按账号存储）。
 *
 * 每个 tb_role 账号在 tb_about 中至多一行（uk_user_about_user），
 * 普通用户只能读写本人的内容；前台 #/about 按登录账号展示对应内容。
 */
class AboutController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  /** 查询本人「关于我」内容。 */
  public function aboutDetail(): void
  {
    $userId = $this->currentUserId();
    $row = Db::name('tb_about')
      ->where('role_id', '=', $userId)
      ->find();
    $row = $this->decodeFields($row, ['avatar', 'summary', 'content']);
    $this->json(['avatar' => (string)($row['avatar'] ?? ''), 'summary' => (string)($row['summary'] ?? ''), 'content' => (string)($row['content'] ?? '')]);
  }

  /** 保存本人「关于我」内容（存在则更新，不存在则插入）。 */
  public function aboutSave(): void
  {
    $userId = $this->currentUserId();
    $avatar = $this->input('post.avatar/s', '');
    if (!empty($_FILES['avatar']) && is_array($_FILES['avatar'])) {
      $uploaded = $this->uploadFile($_FILES['avatar'], 'avatar');
      if ($uploaded !== '') $avatar = $uploaded;
    }
    $data = $this->encodeFields([
      'avatar' => (string)$avatar,
      'summary' => (string)$this->input('post.summary/s', ''),
      'content' => (string)$this->input('post.content/s', '')
    ], ['avatar', 'summary', 'content']);
    $now = date('Y-m-d H:i:s');

    // 只需判断存在并取主键，避免拖回头像与正文大字段。
    $existingId = Db::name('tb_about')
      ->where('role_id', '=', $userId)
      ->value('id');
    if ($existingId) {
      Db::name('tb_about')
        ->where('id', '=', (int)$existingId)
        ->update([
          'avatar' => $data['avatar'], 'summary' => $data['summary'], 'content' => $data['content'],
          'issue_time' => $now
        ]);
    } else {
      Db::name('tb_about')->insert([
        'role_id' => $userId,
        'avatar' => $data['avatar'], 'summary' => $data['summary'], 'content' => $data['content'],
        'create_time' => $now,
        'issue_time' => $now
      ]);
    }
    $this->json([], '保存成功', 1);
  }
}
