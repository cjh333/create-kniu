<?php

// 权限重构回填（2026-09-02）：
// 1. 历史文章归属首个管理员（role=1 最小 id）账号；
// 2. 前台身份 tb_front_user 按昵称关联 tb_role 账号，写入 role_id。

$config = require dirname(__DIR__) . '/config/database.php';
$db = new mysqli($config['HOST'], $config['USERNAME'], $config['PASSWORD'], $config['DATABASE']);
if ($db->connect_error) throw new RuntimeException($db->connect_error);
$db->set_charset($config['CHARSET']);

// 1. 文章归属。
$adminId = 0;
$row = $db->query('SELECT `id` FROM `tb_role` WHERE `role` = 1 ORDER BY `id` ASC LIMIT 1');
if ($row && $r = $row->fetch_row()) {
  $adminId = (int)$r[0];
}
if ($adminId > 0) {
  $db->query('UPDATE `tb_article` SET `user_id` = ' . $adminId . ' WHERE `user_id` = 0');
  echo "Articles backfilled to admin user #$adminId.\n";
} else {
  echo "No admin role account found, articles keep user_id=0.\n";
}

// 2. 前台身份绑定后台账号。
$stmt = $db->prepare('SELECT `id` FROM `tb_role` WHERE `name` = ? LIMIT 1');
$update = $db->prepare('UPDATE `tb_front_user` SET `role_id` = ? WHERE `id` = ?');
$users = $db->query('SELECT `id`, `nickname` FROM `tb_front_user` WHERE `role_id` = 0');
$count = 0;
while ($user = $users->fetch_assoc()) {
  $name = (string)$user['nickname'];
  $stmt->bind_param('s', $name);
  $stmt->execute();
  $roleId = 0;
  $res = $stmt->get_result();
  if ($res && $r = $res->fetch_row()) {
    $roleId = (int)$r[0];
  }
  if ($roleId > 0) {
    $uid = (int)$user['id'];
    $update->bind_param('ii', $roleId, $uid);
    $update->execute();
    $count++;
  }
}
echo "Front users bound to role accounts: $count.\n";
echo "Backfill done.\n";
