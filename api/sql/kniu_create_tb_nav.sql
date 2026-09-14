CREATE TABLE `tb_nav` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `parent_id` bigint unsigned NOT NULL DEFAULT 0 COMMENT '父级导航ID',
    `is_select` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '后台勾选状态',
    `sid` bigint NOT NULL DEFAULT 0 COMMENT '排序',
    `is_show` tinyint unsigned NOT NULL DEFAULT 1 COMMENT '是否显示(0否,1是)',
    `is_open` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否新窗口打开(0否,1是)',
    `nav_type` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '导航位置(0顶部,1底部)',
    `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '导航名称',
    `url` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '链接地址',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `issue_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发表时间',
    PRIMARY KEY (`id`),
    KEY `idx_nav_parent_visible` (
        `parent_id`,
        `is_show`,
        `sid`,
        `id`
    )
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '导航栏';