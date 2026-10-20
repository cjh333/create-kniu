<?php

namespace Core;

class ErrorCode
{
  /** 成功。 */
  const SUCCESS = 1;

  /** 通用失败：未细分的业务失败（兜底码）。 */
  const FAIL = 0;

  // ------------------------------------------------------------ 1xxx 身份与会话

  /** 登录态无效：未登录或登录已过期。客户端应清理登录态并跳转登录页。 */
  const UNAUTHORIZED = 1001;

  /** 无权限：已登录但权限不足，或操作的不是本人资源。 */
  const FORBIDDEN = 1002;

  /** 账号已被禁用（`tb_role.is_show=0`），无法登录。 */
  const ACCOUNT_DISABLED = 1003;

  /** 账号已被禁言（`tb_role.comment_ban=1`），不能发表评论或回复。 */
  const ACCOUNT_MUTED = 1004;

  /** 验证码错误或已过期（算术验证码、邮箱验证码）。 */
  const CAPTCHA_INVALID = 1005;

  /** 前台身份令牌无效：格式非法或尚未绑定账号。 */
  const IDENTITY_INVALID = 1006;

  /** 账号或密码错误（含修改密码时原密码不正确）。 */
  const CREDENTIAL_INVALID = 1007;

  // ------------------------------------------------- 2xxx 请求参数与业务规则

  /** 参数缺失或格式错误。 */
  const PARAM_INVALID = 2001;

  /** 业务规则拒绝：如昵称一年只能修改一次、不能给自己点赞或收藏。 */
  const RULE_REJECTED = 2002;

  /** 请求过于频繁：如验证码 60 秒重发限频。 */
  const TOO_MANY_REQUESTS = 2003;

  /** 上传被拒绝：扩展名、MIME、大小或路径非法。 */
  const UPLOAD_REJECTED = 2004;

  // ------------------------------------------------------------ 3xxx 目标资源

  /** 资源不存在：文章、评论、账号、配置等在库中查不到。 */
  const NOT_FOUND = 3001;

  /** 资源冲突：唯一键重复，如账号名、昵称已存在。 */
  const CONFLICT = 3002;

  // -------------------------------------------------------------- 4xxx 服务端

  /** 服务器内部错误：未捕获异常或数据库故障。 */
  const SERVER_ERROR = 4001;

  /** 外部依赖不可用：如邮件服务器连接或发信失败。 */
  const SERVICE_UNAVAILABLE = 4002;
}
