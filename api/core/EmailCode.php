<?php

namespace Core;

use Core\Db;

class EmailCode
{
  public const SCENE_REGISTER = 'register';
  public const SCENE_RESET = 'reset';

  /** 读取邮件配置（每次调用重新加载，便于修改配置后立即生效）。 */
  public static function config(): array
  {
    return require __DIR__ . '/../config/mail.php';
  }

  /** 验证码连续失败上限（达到即锁定，默认 5 次）。 */
  public static function failLimit(): int
  {
    return max(1, (int)(self::config()['CODE_FAIL_LIMIT'] ?? 5));
  }

  /** 失败锁定秒数（默认 600 秒即 10 分钟，锁定期间禁发新码与校验）。 */
  public static function lockSeconds(): int
  {
    return max(60, (int)(self::config()['CODE_LOCK_SECONDS'] ?? 600));
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

    // 失败锁定优先于发送频率：锁定期内禁止签发新码，防止「重新发码绕过锁定」。
    $lockUntil = self::lockedUntil($email, $scene);
    if ($lockUntil > $now) {
      return [
        'status' => false,
        'msg' => '验证码错误次数过多，请 ' . ceil(($lockUntil - $now) / 60) . ' 分钟后再试',
        'id' => 0,
        'expire' => 0,
        'dev' => false
      ];
    }

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
      'ip' => substr(\Core\Controller::clientIp(), 0, 45),
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
      // 发送失败回滚本次插入的码行：旧码已在签发时全部作废，若残留这条收不到的码，
      // 用户会被卡满重发限频窗口且没有任何可用验证码。
      if ($id > 0) {
        Db::name('tb_email_code')->where('id', '=', $id)->delete();
      }
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
   * 失败保护：同一验证码连续失败达到上限（默认 5 次）后锁定该邮箱场景
   * 10 分钟，锁定期内禁止校验与重发，防止 6 位数字码被在线暴力破解。
   * 锁定按「邮箱 + 场景」维度判定（取该维度最大 lock_until），重新发码不解锁。
   *
   * @return array{ status: bool, msg: string, id: int }
   */
  public static function verify(string $email, string $scene, string $code): array
  {
    $lockUntil = self::lockedUntil($email, $scene);
    if ($lockUntil > time()) {
      return ['status' => false, 'msg' => '验证码错误次数过多，请 ' . ceil(($lockUntil - time()) / 60) . ' 分钟后再试', 'id' => 0];
    }
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
      self::registerFailure((int)$row['id']);
      return ['status' => false, 'msg' => '验证码错误或已过期，请重新获取', 'id' => 0];
    }
    return ['status' => true, 'msg' => '验证通过', 'id' => (int)$row['id']];
  }

  /**
   * 标记验证码已使用。
   *
   * 核销即成功，该码行不再参与校验，失败计数与锁定标记随 prune() 一并过期清理，
   * 「邮箱 + 场景」维度的锁定只由失败上限触发，正常核销不产生锁定。
   */
  public static function consume(int $id): void
  {
    if ($id <= 0) return;
    Db::name('tb_email_code')->where('id', '=', $id)->update(['used' => 1]);
  }

  /**
   * 记录一次校验失败，达到上限时写入锁定截止时间。
   *
   * @param int $id 验证码行 ID。
   * @return void
   */
  private static function registerFailure(int $id): void
  {
    if ($id <= 0) return;
    Db::name('tb_email_code')->where('id', '=', $id)->inc('fail_count')->update([]);
    $failCount = (int)(Db::name('tb_email_code')->where('id', '=', $id)->value('fail_count') ?? 0);
    if ($failCount >= self::failLimit()) {
      $lockUntil = date('Y-m-d H:i:s', time() + self::lockSeconds());
      Db::name('tb_email_code')->where('id', '=', $id)->update(['lock_until' => $lockUntil]);
    }
  }

  /**
   * 查询「邮箱 + 场景」维度当前的锁定截止时间戳。
   *
   * @param string $email 邮箱。
   * @param string $scene 场景。
   * @return int 锁定截止时间戳，未锁定时返回 0。
   */
  private static function lockedUntil(string $email, string $scene): int
  {
    $lockUntil = Db::name('tb_email_code')
      ->where('email', '=', $email)
      ->where('scene', '=', $scene)
      ->where('lock_until', '>', date('Y-m-d H:i:s'))
      ->order('lock_until', 'desc')
      ->value('lock_until');
    return $lockUntil ? (int)strtotime((string)$lockUntil) : 0;
  }

  /** 清理过期一天以上的历史验证码，避免表无限膨胀。 */
  private static function prune(): void
  {
    $cut = date('Y-m-d H:i:s', time() - 86400);
    Db::name('tb_email_code')->where('expire_time', '<', $cut)->delete();
  }
}
