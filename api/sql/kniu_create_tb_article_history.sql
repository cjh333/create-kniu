CREATE TABLE `tb_article_history` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `role_id` bigint unsigned NOT NULL COMMENT '账号ID(tb_role.id)',
    `article_id` bigint unsigned NOT NULL COMMENT '文章ID(tb_article.id)',
    `last_view_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后浏览时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_article_history_role_article` (`role_id`, `article_id`),
    KEY `idx_article_history_last_view` (`last_view_time`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章浏览历史';