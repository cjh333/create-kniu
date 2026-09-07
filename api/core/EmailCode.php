<?php

namespace Core;

use Core\Db;

/**
 * 邮箱验证码服务（注册 / 找回密码共用）。
 *
 * 约定：
 * - 邮箱统一小写去空格后参与比较与存储；
 * - 验证码只以 sha256 摘要入库，明文仅出现在邮件正文里；
 * - 同一 (邮箱, 场景) 只保留最新一条有效验证码，旧码立即作废；
 * - verify() 只校验不消费，业务成功后由 consume() 落库标记已用，
 *   避免后续步骤失败导致验证码被白白烧掉。
 */
class EmailCode
{
  public const SCENE_REGISTER = 'register';
  public const SCENE_RESET = 'reset';

  /** 读取邮件配置（每次调用重新加载，便于修改配置后立即生效）。 */
  public static function config(): array
  {
    return require __DIR__ . '/../config/mail.php';
  }

  public static function normalizeEmail(string $email): string
  {
    return strtolower(trim($email));
  }

  public static function validEmail(string $email): bool
  {
    if ($email === '' || strlen($email) > 190) return false;
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
  }

  public static function validScene(string $scene): bool
  {
    return in_array($scene, [self::SCENE_REGISTER, self::SCENE_RESET], true);
  }

  /**
   * 签发并发送一条验证码。
   *
   * @return array{ status: bool, msg: string, id: int, expire: int, dev: bool }
   */
  public static function issue(string $email, string $scene): array
  {
    $config = self::config();
    $interval = max(0, (int)($config['CODE_INTERVAL'] ?? 60));
    $expireSeconds = max(30, (int)($config['CODE_EXPIRE'] ?? 600));
    $now = time();

    self::prune();

    $last = Db::name('tb_email_code')
      ->where('email', '=', $email)
      ->where('scene', '=', $scene)
      ->order('id', 'desc')
      ->find();
    if ($last) {
      $issuedAt = strtotime((string)$last['create_time']) ?: 0;
      $waited = $now - $issuedAt;
      if ($waited < $interval) {
        return [
          'status' => false,
          'msg' => '发送过于频繁，请 ' . ($interval - $waited) . ' 秒后再试',
          'id' => 0,
          'expire' => 0,
          'dev' => false
        ];
      }
    }

    // 同邮箱同场景的旧验证码一律作废，只保留最新一条。
    Db::name('tb_email_code')
      ->where('email', '=', $email)
      ->where('scene', '=', $scene)
      ->where('used', '=', 0)
      ->update(['used' => 1]);

    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $expireAt = date('Y-m-d H:i:s', $now + $expireSeconds);
    $id = (int)Db::name('tb_email_code')->insert([
      'email' => $email,
      'scene' => $scene,
      'code_hash' => hash('sha256', $code),
      'expire_time' => $expireAt,
      'used' => 0,
      'ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64),
      'create_time' => date('Y-m-d H:i:s', $now)
    ]);

    $minutes = max(1, (int)round($expireSeconds / 60));
    $action = $scene === self::SCENE_RESET ? '找回密码' : '注册账号';
    $subject = '【KniuSystem】' . $action . '验证码';
    $body = "您好：\r\n\r\n"
      . "您正在进行" . $action . "操作，邮箱验证码为：" . $code . "\r\n\r\n"
      . "验证码 " . $minutes . " 分钟内有效，请勿转发给他人。\r\n"
      . "如非本人操作，请忽略本邮件。\r\n\r\n"
      . "KniuSystem";

    $sent = Mailer::send($email, $subject, $body);
    if (!$sent['status']) {
      return [
        'status' => false,
        'msg' => $sent['msg'] ?: '验证码发送失败，请稍后重试',
        'id' => 0,
        'expire' => 0,
        'dev' => (bool)($sent['dev'] ?? false)
      ];
    }

    return [
      'status' => true,
      'msg' => (string)$sent['msg'],
      'id' => $id,
      'expire' => $expireSeconds,
      'dev' => (bool)($sent['dev'] ?? false)
    ];
  }

  /**
   * 校验验证码（不消费）。
   *
   * @return array{ status: bool, msg: string, id: int }
   */
  public static function verify(string $email, string $scene, string $code): array
  {
    $code = trim($code);
    if (!preg_match('/^\d{6}$/', $code)) {
      return ['status' => false, 'msg' => '请输入6位邮箱验证码', 'id' => 0];
    }
    $row = Db::name('tb_email_code')
      ->where('email', '=', $email)
      ->where('scene', '=', $scene)
      ->where('used', '=', 0)
      ->where('expire_time', '>', date('Y-m-d H:i:s'))
      ->order('id', 'desc')
      ->find();
    if (!$row) {
      return ['status' => false, 'msg' => '验证码错误或已过期，请重新获取', 'id' => 0];
    }
    if (!hash_equals((string)$row['code_hash'], hash('sha256', $code))) {
      return ['status' => false, 'msg' => '验证码错误或已过期，请重新获取', 'id' => 0];
    }
    return ['status' => true, 'msg' => '验证通过', 'id' => (int)$row['id']];
  }

  /** 标记验证码已使用。 */
  public static function consume(int $id): void
  {
    if ($id <= 0) return;
    Db::name('tb_email_code')->where('id', '=', $id)->update(['used' => 1]);
  }

  /** 清理过期一天以上的历史验证码，避免表无限膨胀。 */
  private static function prune(): void
  {
    $cut = date('Y-m-d H:i:s', time() - 86400);
    Db::name('tb_email_code')->where('expire_time', '<', $cut)->delete();
  }
}
