-- 既有库补充：sitemap 排序覆盖索引（SEO 审查 Minor）——
-- tb_article 上 `WHERE is_show=1 ORDER BY create_time DESC, id DESC LIMIT 5000`
-- 原走 idx_article_visible(is_show,id) 不覆盖 create_time 排序，全表 filesort。
-- 新建库跑 kniu_create_tb_article.sql 基线即可，勿跑本文件。
ALTER TABLE `tb_article` ADD KEY `idx_article_sitemap` (`is_show`, `create_time`, `id`);
