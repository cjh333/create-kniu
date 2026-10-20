CREATE TABLE `tb_database_table_sort` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `profile_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '连接档案ID(空串=系统连接)',
    `db_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据库名',
    `table_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '数据表名',
    `sid` bigint NOT NULL DEFAULT 0 COMMENT '排序',
    `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最近一次排序更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_database_table_sort_scope` (`profile_id`, `db_name`, `table_name`),
    KEY `idx_database_table_sort_sid` (`sid`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '后台数据库管理-数据表列表排序';
