<?php

$config = require dirname(__DIR__) . '/config/database.php';
$db = new mysqli($config['HOST'], $config['USERNAME'], $config['PASSWORD'], $config['DATABASE']);
if ($db->connect_error) throw new RuntimeException($db->connect_error);
$db->set_charset($config['CHARSET']);

$hashPassword = static function (string $password): string {
  $salt = bin2hex(random_bytes(16));
  return $salt . '$' . hash_pbkdf2('sha512', $password, hex2bin($salt), 100000, 128);
};

$users = $db->query('SELECT `nickname` FROM `tb_front_user` ORDER BY `id` ASC');
$find = $db->prepare('SELECT `id` FROM `tb_role` WHERE `name` = ? LIMIT 1');
$insert = $db->prepare('INSERT INTO `tb_role` (`sid`,`name`,`password`,`role`,`role_auth`,`is_show`) VALUES (0,?,?,2,2,1)');
while ($user = $users->fetch_assoc()) {
  $nickname = (string)$user['nickname'];
  $find->bind_param('s', $nickname);
  $find->execute();
  if ($find->get_result()->fetch_assoc()) continue;
  $password = $hashPassword('000000');
  $insert->bind_param('ss', $nickname, $password);
  $insert->execute();
}

echo "Front-user backend accounts are synchronized.\n";
