CREATE TABLE `tb_article_favorite` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `role_id` bigint unsigned NOT NULL COMMENT '账号ID(tb_role.id)',
    `article_id` bigint unsigned NOT NULL COMMENT '文章ID(tb_article.id)',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_article_favorite_role_article` (`role_id`, `article_id`),
    KEY `idx_article_favorite_article` (`article_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章收藏';