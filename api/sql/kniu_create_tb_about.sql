CREATE TABLE `tb_about` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `role_id` bigint unsigned NOT NULL COMMENT '账号ID(tb_role.id)',
    `avatar` longtext COLLATE utf8mb4_unicode_ci NULL COMMENT '头像',
    `summary` longtext COLLATE utf8mb4_unicode_ci NULL COMMENT '简述',
    `content` longtext COLLATE utf8mb4_unicode_ci NULL COMMENT '内容',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `issue_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发表时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_about_role` (`role_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '关于我';