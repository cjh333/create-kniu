<?php

namespace Core;

class Mailer
{
  /** 发送纯文本邮件。 */
  public static function send(string $to, string $subject, string $body): array
  {
    $config = require __DIR__ . '/../config/mail.php';
    $env = getenv('APP_ENV') ?: 'development';
    $username = trim((string)($config['USERNAME'] ?? ''));
    $password = (string)($config['PASSWORD'] ?? '');

    if ($username === '' || $password === '') {
      return self::fallback($config, $env, $to, $subject, $body);
    }

    $host = (string)($config['HOST'] ?? '');
    $port = (int)($config['PORT'] ?? 465);
    $encryption = strtolower((string)($config['ENCRYPTION'] ?? 'ssl'));
    $timeout = max(3, (int)($config['TIMEOUT'] ?? 12));
    if ($host === '') return ['status' => false, 'msg' => '邮件服务未配置主机', 'dev' => false];

    $remote = ($encryption === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $errno = 0;
    $errstr = '';
    $context = self::sslContext($host, $config);
    $socket = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) {
      // 缺 CA 证书包时 ssl:// 表现为 errno=0 且 errstr 为空，只说「无法连接」
      // 会误导去排查网络，这里补一条可操作的证书提示。
      $hint = ($encryption === 'ssl' && $errstr === '')
        ? '（TLS 握手失败，通常是缺少根证书包：检查 MAIL_CAFILE 或 api/config/cert/cacert.pem）'
        : '';
      return ['status' => false, 'msg' => '无法连接邮件服务器：' . $errstr . $hint, 'dev' => false];
    }
    stream_set_timeout($socket, $timeout);

    try {
      $banner = self::read($socket);
      if (self::code($banner) !== 220) return self::quit($socket, false, '邮件服务器握手失败');

      self::write($socket, 'EHLO ' . (function_exists('gethostname') ? (gethostname() ?: 'localhost') : 'localhost'));
      $ehlo = self::read($socket);
      if (self::code($ehlo) !== 250) {
        self::write($socket, 'HELO localhost');
        $helo = self::read($socket);
        if (self::code($helo) !== 250) return self::quit($socket, false, '邮件服务器拒绝 EHLO/HELO');
      }

      if ($encryption === 'tls') {
        self::write($socket, 'STARTTLS');
        $reply = self::read($socket);
        if (self::code($reply) !== 220) return self::quit($socket, false, '邮件服务器不支持 STARTTLS');
        if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
          return self::quit($socket, false, 'STARTTLS 加密协商失败');
        }
        // 加密后重新握手
        self::write($socket, 'EHLO localhost');
        $ehlo2 = self::read($socket);
        if (self::code($ehlo2) !== 250) return self::quit($socket, false, '加密后 EHLO 失败');
      }

      self::write($socket, 'AUTH LOGIN');
      $reply = self::read($socket);
      if (self::code($reply) !== 334) return self::quit($socket, false, '邮件服务器不支持 AUTH LOGIN');
      self::write($socket, base64_encode($username));
      $reply = self::read($socket);
      if (self::code($reply) !== 334) return self::quit($socket, false, '邮箱账号被拒绝');
      self::write($socket, base64_encode($password));
      $reply = self::read($socket);
      if (self::code($reply) !== 235) return self::quit($socket, false, '邮箱授权码被拒绝');

      $from = trim((string)($config['FROM_ADDRESS'] ?? '')) ?: $username;
      self::write($socket, 'MAIL FROM: <' . $from . '>');
      $reply = self::read($socket);
      if (self::code($reply) !== 250) return self::quit($socket, false, '发件人被拒绝');

      self::write($socket, 'RCPT TO: <' . $to . '>');
      $reply = self::read($socket);
      if (self::code($reply) !== 250 && self::code($reply) !== 251) {
        return self::quit($socket, false, '收件人被拒绝');
      }

      self::write($socket, 'DATA');
      $reply = self::read($socket);
      if (self::code($reply) !== 354) return self::quit($socket, false, '邮件数据阶段被拒绝');

      $message = self::buildMessage($config, $to, $subject, $body);
      self::write($socket, $message . "\r\n.");
      $reply = self::read($socket);
      if (self::code($reply) !== 250) return self::quit($socket, false, '邮件发送失败');

      self::write($socket, 'QUIT');
      fclose($socket);
      return ['status' => true, 'msg' => '邮件已发送', 'dev' => false];
    } catch (\Throwable $e) {
      if (is_resource($socket)) fclose($socket);
      return ['status' => false, 'msg' => '发送异常：' . $e->getMessage(), 'dev' => false];
    }
  }

  /**
   * 构建带 CA 证书包的 SSL 上下文。
   *
   * Windows 版 PHP 常常没配 openssl.cafile，此时 ssl:// 连接会「静默失败」：
   * 返回 false、errno=0、errstr 为空字符串，看上去像网络不通，实际是证书无法校验。
   * 因此这里显式挂上项目自带（或 MAIL_CAFILE 指定）的根证书包。
   *
   * @return resource|null SSL 上下文；创建失败时返回 null。
   */
  private static function sslContext(string $host, array $config)
  {
    $cafile = trim((string)($config['CAFILE'] ?? ''));
    $options = [
      'verify_peer' => true,
      'verify_peer_name' => true,
      'SNI_enabled' => true,
      'peer_name' => $host
    ];
    if ($cafile !== '' && is_file($cafile)) {
      $options['cafile'] = $cafile;
    }
    $context = @stream_context_create(['ssl' => $options]);
    return $context ?: null;
  }

  /** 组装邮件报文（UTF-8 主题/正文做 base64 编码，避免中文乱码）。 */
  private static function buildMessage(array $config, string $to, string $subject, string $body): string
  {
    $from = trim((string)($config['FROM_ADDRESS'] ?? ''));
    $fromName = trim((string)($config['FROM_NAME'] ?? 'KniuSystem')) ?: 'KniuSystem';
    if ($from === '') $from = trim((string)($config['USERNAME'] ?? 'noreply@localhost'));
    $headers = [
      'Date: ' . date('r'),
      'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $from . '>',
      'To: <' . $to . '>',
      'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      'X-Mailer: KniuSystem'
    ];
    return implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($body), 76, "\r\n");
  }

  /** 未配置 SMTP：开发环境写日志，生产环境报错。 */
  private static function fallback(array $config, string $env, string $to, string $subject, string $body): array
  {
    if ($env !== 'development') {
      return ['status' => false, 'msg' => '邮件服务未配置，请联系管理员', 'dev' => false];
    }
    $dir = (string)($config['LOG_DIR'] ?? __DIR__ . '/../runtime/mail');
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $file = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . 'mail-' . date('Y-m-d') . '.log';
    $content = sprintf(
      "[%s] to=%s subject=%s\n%s\n----------------------------------------\n",
      date('Y-m-d H:i:s'),
      $to,
      $subject,
      $body
    );
    @file_put_contents($file, $content, FILE_APPEND);
    return ['status' => true, 'msg' => '开发模式：邮件内容已写入日志 ' . $file, 'dev' => true];
  }

  /**
   * @param resource $socket
   */
  private static function write($socket, string $line): void
  {
    fwrite($socket, $line . "\r\n");
  }

  /**
   * 读取 SMTP 响应（支持多行，以 "code<space>" 结尾为结束）。
   *
   * @param resource $socket
   */
  private static function read($socket): string
  {
    $data = '';
    while (!feof($socket)) {
      $line = fgets($socket, 515);
      if ($line === false) break;
      $data .= $line;
      if (preg_match('/^\d{3} /', $line)) break;
    }
    return $data;
  }

  private static function code(string $reply): int
  {
    return (int)substr(trim($reply), 0, 3);
  }

  /**
   * @param resource|null $socket
   */
  private static function quit($socket, bool $status, string $msg): array
  {
    if (is_resource($socket)) {
      @fwrite($socket, "QUIT\r\n");
      fclose($socket);
    }
    return ['status' => $status, 'msg' => $msg, 'dev' => false];
  }
}
