-- 权限重构（2026-09-02）
-- 1. tb_article 增加作者字段（tb_role 账号 id）
ALTER TABLE `tb_article`
  ADD COLUMN `user_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `id`;

-- 2. tb_front_user 增加账号绑定字段（tb_role 账号 id）
ALTER TABLE `tb_front_user`
  ADD COLUMN `role_id` BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `id`;

-- 3. 关于我（按账号存储，普通用户后台编辑、前台 #/about 展示本人内容）
CREATE TABLE IF NOT EXISTS `tb_user_about` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `content` LONGTEXT NULL,
  `create_time` DATETIME NOT NULL,
  `update_time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_about_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
