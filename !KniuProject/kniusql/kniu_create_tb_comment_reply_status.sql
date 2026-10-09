CREATE TABLE `tb_comment_reply_status` (
    `reply_id` int unsigned NOT NULL COMMENT '回复ID',
    `recipient_user_id` int unsigned NOT NULL COMMENT '接收回复的账号ID',
    `is_read` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否已读(0否,1是)',
    `issue_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发表时间',
    PRIMARY KEY (`reply_id`, `recipient_user_id`),
    KEY `idx_comment_reply_status_recipient` (`recipient_user_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论回复通知已读状态';