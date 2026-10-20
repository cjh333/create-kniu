CREATE TABLE `tb_role_follow` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `follower_role_id` bigint unsigned NOT NULL COMMENT '关注者账号ID(tb_role.id)',
    `followed_role_id` bigint unsigned NOT NULL COMMENT '被关注者账号ID(tb_role.id)',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关注时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_role_follow_pair` (`follower_role_id`, `followed_role_id`),
    KEY `idx_role_follow_followed` (`followed_role_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '账号关注关系';
