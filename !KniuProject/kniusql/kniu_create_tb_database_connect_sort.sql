CREATE TABLE `tb_database_connect_sort` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `connect_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '连接档案ID(DbProfile c_xxx)',
    `sid` bigint NOT NULL DEFAULT 0 COMMENT '排序',
    `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近一次排序更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_database_connect_sort` (`connect_id`),
    KEY `idx_database_connect_sort_sid` (`sid`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '后台数据库管理-连接档案列表排序';
