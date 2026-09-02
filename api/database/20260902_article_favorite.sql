CREATE TABLE IF NOT EXISTS `tb_article_favorite` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `article_id` BIGINT UNSIGNED NOT NULL,
  `create_time` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_article_favorite_user_article` (`user_id`, `article_id`),
  KEY `idx_article_favorite_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
