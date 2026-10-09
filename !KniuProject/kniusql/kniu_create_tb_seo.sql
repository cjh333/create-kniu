CREATE TABLE `tb_seo` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'ID',
    `sid` bigint NOT NULL DEFAULT 0 COMMENT '排序',
    `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '网站名称',
    `url` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '网站域名',
    `logo` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'Logo',
    `description` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '描述',
    `keywords` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '关键词',
    `author` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '作者',
    `copyright` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '版权',
    `icp` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT 'ICP备案号',
    `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '联系邮箱',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `issue_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发表时间',
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '网站 SEO 设置';
