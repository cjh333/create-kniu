CREATE TABLE `tb_email_code` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '邮箱',
    `scene` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '场景',
    `code_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '验证码SHA-256摘要',
    `expire_time` datetime NOT NULL COMMENT '过期时间',
    `used` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '是否已使用(0否,1是)',
    `ip` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '请求IP',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_email_code_verify` (
        `email`,
        `scene`,
        `used`,
        `expire_time`
    ),
    KEY `idx_email_code_expire` (`expire_time`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '邮箱验证码';