CREATE TABLE `tb_daily` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `is_select` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '后台勾选状态',
    `sid` bigint NOT NULL DEFAULT 0 COMMENT '排序',
    `is_show` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否显示(0否,1是)',
    `cn` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '中文内容',
    `en` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '英文内容',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `issue_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发表时间',
    PRIMARY KEY (`id`),
    KEY `idx_daily_visible` (`is_show`, `sid`, `id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '每日一句';