<?php

namespace Core;

/**
 * 数据变更信号中心。
 *
 * 目标：任一端写库后，所有在线页面（前台与后台、同浏览器多标签与跨浏览器）
 * 无需刷新页面、业务控制器也无需手写刷新逻辑即可看到最新数据。
 *
 * 设计要点：
 *
 * 1. 埋点下沉到 Core\Db —— insert/update/delete 成功后自动 touch($table)，
 *    业务控制器与新增接口天然具备同步能力，不需要逐个埋点（呼应规则 7：
 *    公共能力归入核心模块）。
 * 2. 一个请求内的多次写只在请求结束（register_shutdown_function）汇总一次：
 *    先 bump 全局 revision，再向 Node 的 /__notify 打一次信号，避免 N 次写
 *    造成 N 次通知把请求拖慢。
 * 3. 静默表不广播：浏览历史、收藏、验证码、身份、已读标记属于用户私有或
 *    高频噪声写入。其中 tb_article_history 每打开一次文章就写，若参与广播
 *    会引发全站刷新风暴，必须排除。
 * 4. revision 只是"数据变了没有"的单调计数，不携带任何业务数据；客户端收到
 *    信号后仍走各自带鉴权的 /api 接口重拉，鉴权边界保持在 PHP（呼应规则 100）。
 * 5. 广播失败静默忽略 —— SSE 只是加速刷新，信号丢失时前端在页面重新可见时
 *    比对 /data_revision 会补拉一次。
 */
class DataSignal
{
  /** revision 持久化文件（runtime 下，需可写）。 */
  private const REVISION_FILE = __DIR__ . '/../runtime/cache/data_revision.json';

  /**
   * 不参与广播的表：用户私有数据或高频噪声写入。
   *
   * @var string[]
   */
  private const SILENT_TABLES = [
    'tb_article_history',            // 浏览历史：每次打开文章都写，最严重的刷新风暴源。
    'tb_article_favorite',           // 收藏：仅本人关心，个人中心自己会拉。
    'tb_email_code',                 // 邮箱验证码：短时效凭证，与展示数据无关。
    'tb_front_user',                 // 前台身份：含令牌与登录时间，禁止外泄式广播。
    'tb_reply_notification_read',    // 回复已读标记：按接收人私有。
    'tb_reply_notification_status',  // 回复红点状态：按接收人私有。
  ];

  /** 本次请求是否发生过需要广播的写操作。 */
  private static bool $changed = false;

  /** shutdown 回调是否已注册（整个请求只注册一次）。 */
  private static bool $shutdownRegistered = false;

  /**
   * 标记一次数据变更（由 Core\Db 的写操作出口调用）。
   *
   * 空表名（无法判定来源，如 Db::execute 解析不出表名）按"需要广播"处理，
   * 宁可多刷一次也不能漏刷。
   *
   * @param string $table 变更的表名；空字符串表示来源未知。
   * @return void
   */
  public static function touch(string $table = ''): void
  {
    $table = strtolower(trim($table));
    if ($table !== '' && in_array($table, self::SILENT_TABLES, true)) return;
    // 任何会话类存储都不参与广播。
    if ($table !== '' && strpos($table, 'session') !== false) return;
    if (self::$changed) return;
    self::$changed = true;
    if (!self::$shutdownRegistered) {
      self::$shutdownRegistered = true;
      register_shutdown_function([self::class, 'flush']);
    }
  }

  /**
   * 读取当前数据版本号（文件不存在或不可读时返回 0）。
   *
   * @return int
   */
  public static function revision(): int
  {
    $file = self::REVISION_FILE;
    if (!is_file($file)) return 0;
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') return 0;
    $decoded = json_decode($raw, true);
    return (int)($decoded['revision'] ?? 0);
  }

  /**
   * 请求结束时汇总广播一次（由 register_shutdown_function 触发）。
   *
   * @return void
   */
  public static function flush(): void
  {
    if (!self::$changed) return;
    self::$changed = false;
    $revision = self::bump();
    self::notify(['type' => 'data-change', 'revision' => (string)$revision]);
  }

  /**
   * 递增并持久化 revision。
   *
   * 并发下偶尔丢失一次自增只意味着"这次变更与上次合并成一次通知"，
   * 不影响最终一致性，故不做跨进程互斥。
   *
   * @return int 递增后的版本号；写入失败时返回当前值。
   */
  private static function bump(): int
  {
    $file = self::REVISION_FILE;
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) return self::revision();
    $next = self::revision() + 1;
    $payload = json_encode([
      'revision' => $next,
      'time' => date('Y-m-d H:i:s'),
    ]);
    if (@file_put_contents($file, $payload, LOCK_EX) === false) return self::revision();
    return $next;
  }

  /**
   * 向 Node 通知端点发一个 fire-and-forget 请求（回环、极短超时、失败静默）。
   *
   * 与 SSE 通道一致：只发"去刷新"信号，不透传任何业务或用户数据。
   *
   * @param array<string, string> $params 附加在 NOTIFY_URL 上的查询参数。
   * @return void
   */
  public static function notify(array $params = []): void
  {
    $appConfig = require __DIR__ . '/../config/app.php';
    $url = (string)($appConfig['NOTIFY_URL'] ?? '');
    if ($url === '') return;
    $parts = parse_url($url);
    if (!$parts || empty($parts['host'])) return;
    $scheme = strtolower($parts['scheme'] ?? 'http');
    $port = (int)($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    $query = [];
    if (isset($parts['query']) && $parts['query'] !== '') parse_str($parts['query'], $query);
    $query = array_merge($query, $params);
    $path = ($parts['path'] ?? '/') . (empty($query) ? '' : '?' . http_build_query($query));
    $request = 'GET ' . $path . ' HTTP/1.1' . "\r\n" .
      'Host: ' . $parts['host'] . ':' . $port . "\r\n" .
      'Connection: close' . "\r\n" .
      "\r\n";
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client(
      'tcp://' . $parts['host'] . ':' . $port,
      $errno,
      $errstr,
      0.2,
      STREAM_CLIENT_CONNECT
    );
    if ($fp === false) return;
    stream_set_timeout($fp, 0, 200000);
    @fwrite($fp, $request);
    @fclose($fp);
  }
}
