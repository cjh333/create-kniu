-- 既有库补充身份令牌过期时间列（新建库跑 kniu_create_tb_role.sql 基线即可，勿跑本文件）。
-- 存量行该列为 NULL：不立即失效，待各账号下次注册/登录/绑定经 bindIdentityToken 写入过期时间后开始生效。
ALTER TABLE `tb_role` ADD COLUMN `token_expire_time` datetime DEFAULT NULL COMMENT '身份令牌过期时间(NULL=存量令牌待下次登录续期)' AFTER `identity_token`;
