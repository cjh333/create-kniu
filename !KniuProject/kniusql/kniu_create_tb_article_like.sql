-- 文章每日点赞幂等表（S2）：(role_id, article_id, like_date) 唯一键兜底并发，
-- 取代按会话存储的 article_like_* 键——同账号多设备/多会话并发点赞不再双计数。
-- 计数语义与旧 session 版一致：净余额（可取消），取消删当日行并 likes-1。
CREATE TABLE `tb_article_like` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '自增ID',
    `role_id` bigint unsigned NOT NULL COMMENT '点赞账号ID(tb_role.id)',
    `article_id` bigint unsigned NOT NULL COMMENT '文章ID(tb_article.id)',
    `like_date` date NOT NULL COMMENT '点赞日期(按日幂等)',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_article_like_day` (`role_id`, `article_id`, `like_date`),
    KEY `idx_article_like_article` (`article_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '文章每日点赞幂等';
