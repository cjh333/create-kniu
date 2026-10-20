-- tb_feedback 既有库增量：新增「排序」字段（新库直接用基线 kniusql 建表脚本）。
ALTER TABLE `tb_feedback`
    ADD COLUMN `sid` int NOT NULL DEFAULT 0 COMMENT '排序' AFTER `role_id`,
    ADD KEY `idx_feedback_sid` (`sid`);
