-- 迁移脚本（仅用于升级 2026-10 前的旧库）。
-- 新库初始化直接执行 kniu_create_tb_article.sql 即可（已含 is_recommend 字段与两个索引），
-- 对新库执行本脚本会报 Duplicate column。基线唯一来源见 kniu_create_tb_*.sql。
ALTER TABLE `tb_article`
ADD COLUMN `is_recommend` TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否推荐(0否,1是)' AFTER `is_show`,
ADD KEY `idx_article_hot` (`is_show`, `hits`, `id`),
ADD KEY `idx_article_recommend` (
    `is_show`,
    `is_recommend`,
    `create_time`,
    `id`
);