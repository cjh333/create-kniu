CREATE TABLE `tb_database_profile` (
    `id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '档案ID(c_前缀)',
    `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '连接名称',
    `host` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '主机地址',
    `port` int NOT NULL DEFAULT 3306 COMMENT '端口',
    `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '用户名',
    `password` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '密码(明文,沿用原JSON口径)',
    `database` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '默认数据库名(空=不指定)',
    `charset` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'utf8mb4' COMMENT '字符集',
    `is_active` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否当前连接(全表至多一行=1)',
    `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_database_profile_name` (`name`),
    KEY `idx_database_profile_active` (`is_active`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '后台数据库管理';