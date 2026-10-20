-- tb_feedback 既有库增量：新增「反馈结果」字段（新库直接用基线 kniusql 建表脚本）。
ALTER TABLE `tb_feedback`
    ADD COLUMN `result` text NOT NULL COMMENT '反馈结果' AFTER `images`;