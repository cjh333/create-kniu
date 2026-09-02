<?php

namespace App\Admin\Controllers;

use Core\AdminBaseController;
use Core\Db;

/**
 * 「关于我」内容控制器（按账号存储）。
 *
 * 每个 tb_role 账号在 tb_user_about 中至多一行（uk_user_about_user），
 * 普通用户只能读写本人的内容；前台 #/about 按登录账号展示对应内容。
 */
class AboutController extends AdminBaseController
{
  public function __construct()
  {
    parent::__construct();
  }

  /** 查询本人「关于我」内容。 */
  public function aboutDetail(): void
  {
    $userId = $this->currentUserId();
    $row = Db::name('tb_user_about')
      ->where('user_id', '=', $userId)
      ->find();
    $row = $this->decodeFields($row, ['content']);
    $this->json(['content' => (string)($row['content'] ?? '')]);
  }

  /** 保存本人「关于我」内容（存在则更新，不存在则插入）。 */
  public function aboutSave(): void
  {
    $userId = $this->currentUserId();
    $content = (string)$this->input('post.content/s', '');
    $data = $this->encodeFields(['content' => $content], ['content']);
    $now = date('Y-m-d H:i:s');

    $existing = Db::name('tb_user_about')
      ->where('user_id', '=', $userId)
      ->find();
    if ($existing) {
      Db::name('tb_user_about')
        ->where('id', '=', (int)$existing['id'])
        ->update([
          'content' => $data['content'],
          'update_time' => $now
        ]);
    } else {
      Db::name('tb_user_about')->insert([
        'user_id' => $userId,
        'content' => $data['content'],
        'create_time' => $now,
        'update_time' => $now
      ]);
    }
    $this->json([], '保存成功', 1);
  }
}
