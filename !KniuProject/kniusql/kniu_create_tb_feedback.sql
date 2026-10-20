CREATE TABLE `tb_feedback` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `role_id` bigint unsigned NOT NULL COMMENT '提交账号ID(tb_role.id)',
    `sid` int NOT NULL DEFAULT 0 COMMENT '排序',
    `title` varchar(200) NOT NULL COMMENT '问题标题',
    `content` text NOT NULL COMMENT '问题简述',
    `images` varchar(1000) NOT NULL DEFAULT '' COMMENT '问题图片相对路径,逗号分隔,最多2张',
    `result` text NOT NULL COMMENT '反馈结果',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
    PRIMARY KEY (`id`),
    KEY `idx_feedback_role` (`role_id`),
    KEY `idx_feedback_sid` (`sid`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '前台问题反馈';