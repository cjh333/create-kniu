CREATE TABLE IF NOT EXISTS `tb_front_user` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `identity_token` CHAR(64) NOT NULL,
  `nickname` VARCHAR(30) NOT NULL,
  `create_time` DATETIME NOT NULL,
  `update_time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_front_identity_token` (`identity_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `tb_comment`
  ADD COLUMN `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `article_id`;
