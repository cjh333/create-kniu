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
    $this->ensureFields();
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
    $this->ensureFields();
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

    $existing = Db::name('tb_about')
      ->where('role_id', '=', $userId)
      ->find();
    if ($existing) {
      Db::name('tb_about')
        ->where('id', '=', (int)$existing['id'])
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

  private function ensureFields(): void
  {
    $columns = Db::query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tb_about'");
    $existing = array_column($columns, 'COLUMN_NAME');
    if (!in_array('avatar', $existing, true)) Db::execute("ALTER TABLE `tb_about` ADD COLUMN `avatar` text NULL AFTER `role_id`");
    if (!in_array('summary', $existing, true)) Db::execute("ALTER TABLE `tb_about` ADD COLUMN `summary` longtext NULL AFTER `avatar`");
    if (in_array('aboutme', $existing, true)) {
      Db::execute("UPDATE `tb_about` SET `summary` = `aboutme` WHERE `aboutme` IS NOT NULL AND `aboutme` <> ''");
      Db::execute("ALTER TABLE `tb_about` DROP COLUMN `aboutme`");
    }
    // 兼容早期迁移产生的脏归属：记录 id 与现有账号 id 对应，但 role_id 已失效。
    // 仅修复明确可判断的孤立记录，避免覆盖已有有效账号资料。
    Db::execute("UPDATE `tb_about` ua INNER JOIN `tb_role` r ON r.`id` = ua.`id` SET ua.`role_id` = r.`id` WHERE NOT EXISTS (SELECT 1 FROM `tb_role` owner WHERE owner.`id` = ua.`role_id`)");
  }
}
