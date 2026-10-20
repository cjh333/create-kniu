-- 既有库补充后台列表排序列 sid 的索引（新建库直接跑 kniu_create_tb_*.sql 基线即可，勿跑本文件）。
-- 背景：后台文章/评论/账号列表均按 sid 排序分页，无索引时每次列表加载触发 filesort。
ALTER TABLE `tb_article` ADD KEY `idx_article_sid` (`sid`);
ALTER TABLE `tb_comment` ADD KEY `idx_comment_sid` (`sid`);
ALTER TABLE `tb_role` ADD KEY `idx_role_sid` (`sid`);
