-- 既有库补充：连接档案密码列扩宽以容纳 AES-256-GCM 密文（M3 安全修复配套）。
-- 密文格式 enc:v1:base64(iv).base64(cipher+tag)，明文 190 字节加密后约 308 字符，varchar(190) 会截断。
-- 新建库跑 kniu_create_tb_database_profile.sql 基线即可，勿跑本文件。
-- 存量明文密码无需迁移数据：读取侧兼容明文（无 enc:v1: 前缀原样返回），
-- 下次编辑保存该档案时自动以密文落库。
ALTER TABLE `tb_database_profile` MODIFY `password` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '' COMMENT '密码(AES-256-GCM密文,enc:v1:前缀;未配DB_PROFILE_KEY时为明文)';
