CREATE TABLE `tb_selectall` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '后台业务表标识',
    `is_select` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '全选状态',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_selectall_name` (`name`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '后台表格全选状态';