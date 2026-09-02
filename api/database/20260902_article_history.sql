CREATE TABLE IF NOT EXISTS `tb_article_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `last_view_time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_history_user_article` (`user_id`, `article_id`),
  KEY `idx_article_history_last_view` (`last_view_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
