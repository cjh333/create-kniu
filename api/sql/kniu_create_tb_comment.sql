CREATE TABLE `tb_comment` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `article_id` bigint unsigned NOT NULL COMMENT '文章ID(tb_article.id)',
    `role_id` bigint unsigned NOT NULL COMMENT '账号ID(tb_role.id)',
    `parent_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT '父评论ID，0为顶层评论',
    `is_show` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否已审核显示(0否,1是)',
    `message` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '评论内容',
    `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '发表IP',
    `likes` int unsigned NOT NULL DEFAULT 0 COMMENT '点赞数',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发表时间',
    PRIMARY KEY (`id`),
    KEY `idx_comment_article_visible` (`article_id`, `is_show`, `id`),
    KEY `idx_comment_parent` (`parent_id`),
    KEY `idx_comment_role` (`role_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章评论与回复';