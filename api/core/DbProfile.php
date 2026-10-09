<?php

namespace Core;

/**
 * 数据库连接档案：数据库管理模块的「当前连接」。
 *
 * ── 存储位置为什么是**项目根** `runtime/db-connections.json` ──
 * 本机后端以 `cd api && php -S localhost:9900 -t .` 启动，**docroot 是 `api/` 且没有
 * 路由脚本**；PHP 内置服务器会把 docroot 下真实存在的文件**直接当静态资源发出去**
 * （实测 `GET /runtime/log/db_admin.log` → 200 / 31KB，`runtime/session/sess_*` 同理）。
 * 档案里是**明文密码**，放进 `api/runtime/` 等于对外公开，因此放在 `api/` 之外的
 * `<项目根>/runtime/`（`.gitignore` 已忽略项目根的 `runtime/`）。
 * ⚠ 这条只挡住 PHP 这一侧：Node 本地前端服务（`kniuserver.mjs`）把**整个项目根**当静态根，
 * 项目根的 `runtime/` 在 dev 下仍可被读到（连 `.env` 都是）。生产只暴露 PHP，
 * 故以「落在 PHP docroot 之外」为准。
 *
 * ── 与「系统连接」的关系（本模块最重要的安全属性） ──
 * `Db::connect()` 那条系统连接（`.env` → `api/config/database.php`）**永不改变**：
 * 鉴权、会话回填、其它业务模块都在它上面跑。档案只通过 `Db::useManaged()` 接管
 * **数据库管理模块自己**发出的 SQL。若让切换档案去改系统连接，`Base::__construct()`
 * 会按会话里的 name 去「被切换到的库」回查 `tb_role` —— 切到一个没有该账号的服务器
 * 就会把当前管理员直接锁在门外。
 *
 * ── 档案是**可选覆盖** ──
 * 没有任何档案时，模块行为与本功能上线前完全一致（走 `.env` 那条连接）。
 * 因此 `read()` 对「文件缺失/损坏」一律静默降级为空结构，绝不抛错 ——
 * 它可能在任意一次数据库管理请求里被读到，不能成为新的崩溃点。
 */
class DbProfile
{
  /** 档案文件名（位于项目根 `runtime/` 下）。 */
  private const FILE = 'db-connections.json';

  /** 允许的字符集（交给 mysqli_set_charset 前白名单校验）。 */
  private const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'gbk', 'big5'];

  /** 连接名称长度上限（字符数）。 */
  private const MAX_NAME = 64;

  /** 主机名长度上限。 */
  private const MAX_HOST = 190;

  /** 用户名长度上限。 */
  private const MAX_USER = 64;

  /** 密码长度上限。 */
  private const MAX_PASS = 190;

  /**
   * 取档案文件的绝对路径。
   *
   * `__DIR__` = `api/core` ⇒ 上溯两级即项目根。
   *
   * @return string 绝对路径。
   */
  private static function path(): string
  {
    return dirname(__DIR__, 2) . '/runtime/' . self::FILE;
  }

  /**
   * 字符串长度（优先按字符计，缺 mbstring 时退回字节数）。
   *
   * @param string $value 待计数的字符串。
   * @return int 长度。
   */
  private static function len(string $value): int
  {
    return function_exists('mb_strlen') ? (int)mb_strlen($value, 'UTF-8') : strlen($value);
  }

  /**
   * 读取档案库。
   *
   * @return array{active: string, profiles: array<int, array<string, mixed>>} 档案库结构。
   */
  private static function read(): array
  {
    $empty = ['active' => '', 'profiles' => []];
    $path = self::path();
    if (!is_file($path)) {
      return $empty;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
      return $empty;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
      return $empty;
    }
    $profiles = (isset($decoded['profiles']) && is_array($decoded['profiles'])) ? $decoded['profiles'] : [];
    // 用 foreach 而不是 array_filter 闭包：闭包参数要么标 `array`（JSON 里可能混进标量，
    // 标了就会 TypeError），要么标 `mixed`（则 `$item['id']` 触发 offsetAccess 报错）。
    // 见项目类型规范「闭包内数组偏移访问」。
    $clean = [];
    foreach ($profiles as $item) {
      if (is_array($item) && isset($item['id'])) {
        $clean[] = $item;
      }
    }
    return [
      'active' => isset($decoded['active']) ? (string)$decoded['active'] : '',
      'profiles' => $clean,
    ];
  }

  /**
   * 写回档案库。
   *
   * 「临时文件 + rename」保证原子性（避免进程被杀时留下半截 JSON，
   * 下次 `read()` 直接降级成空库、用户看不到自己刚存的连接）；文件权限收到 0600。
   *
   * @param array<string, mixed> $data 完整档案库结构。
   * @return void
   * @throws \RuntimeException 目录不可创建、序列化失败或写入失败。
   */
  private static function write(array $data): void
  {
    $path = self::path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
      throw new \RuntimeException('无法创建连接档案目录');
    }
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
      throw new \RuntimeException('连接档案序列化失败');
    }
    $tmp = $path . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) {
      @unlink($tmp);
      throw new \RuntimeException('连接档案写入失败');
    }
    @chmod($tmp, 0600);
    if (!@rename($tmp, $path)) {
      @unlink($tmp);
      throw new \RuntimeException('连接档案保存失败');
    }
  }

  /**
   * 校验并归一化一条连接档案。
   *
   * 密码字段的口径：**空串表示「沿用原值」**。列表接口从不下发密码，
   * 所以编辑表单里密码框天然是空的；若把空串当新密码写入，用户每次改个名字
   * 都会把密码清空。新建时没有原值，空密码则如实保存（MySQL 允许空密码账号）。
   *
   * @param array<string, mixed> $input 请求里传来的字段。
   * @param array<string, mixed>|null $existing 已有档案（编辑场景），无则 null。
   * @return array<string, mixed> 归一化后的档案字段（不含 id/时间戳）。
   * @throws \InvalidArgumentException 任一字段不合法。
   */
  public static function normalize(array $input, ?array $existing = null): array
  {
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '' || self::len($name) > self::MAX_NAME) {
      throw new \InvalidArgumentException('连接名称必填，且不超过 ' . self::MAX_NAME . ' 个字符');
    }
    $host = trim((string)($input['host'] ?? ''));
    if (preg_match('/^[A-Za-z0-9._\-]{1,' . self::MAX_HOST . '}$/', $host) !== 1) {
      throw new \InvalidArgumentException('主机地址只能由字母、数字、点、下划线和连字符组成');
    }
    $port = (int)($input['port'] ?? 3306);
    if ($port < 1 || $port > 65535) {
      throw new \InvalidArgumentException('端口必须在 1-65535 之间');
    }
    $username = trim((string)($input['username'] ?? ''));
    if (self::len($username) > self::MAX_USER || preg_match('/[\x00-\x1F]/', $username) === 1) {
      throw new \InvalidArgumentException('用户名不合法');
    }
    $database = trim((string)($input['database'] ?? ''));
    if ($database !== '' && preg_match('/^[A-Za-z0-9_]{1,64}$/', $database) !== 1) {
      throw new \InvalidArgumentException('默认数据库名只能由字母、数字和下划线组成');
    }
    $charset = (string)($input['charset'] ?? 'utf8mb4');
    if (!in_array($charset, self::CHARSETS, true)) {
      throw new \InvalidArgumentException('不支持的字符集');
    }
    $password = array_key_exists('password', $input) ? (string)$input['password'] : '';
    if ($password === '' && $existing !== null) {
      $password = (string)($existing['password'] ?? '');
    }
    if (strlen($password) > self::MAX_PASS || strpos($password, "\0") !== false) {
      throw new \InvalidArgumentException('密码不合法');
    }
    return [
      'name' => $name,
      'host' => $host,
      'port' => $port,
      'username' => $username,
      'password' => $password,
      'database' => $database,
      'charset' => $charset,
    ];
  }

  /**
   * 全部档案（按保存顺序）。
   *
   * @return array<int, array<string, mixed>> 档案列表。
   */
  public static function all(): array
  {
    return self::read()['profiles'];
  }

  /**
   * 按 id 取一条档案。
   *
   * @param string $id 档案 id。
   * @return array<string, mixed>|null 命中的档案，无则 null。
   */
  public static function find(string $id): ?array
  {
    foreach (self::read()['profiles'] as $item) {
      if ((string)$item['id'] === $id) {
        return $item;
      }
    }
    return null;
  }

  /**
   * 当前生效的档案。
   *
   * @return array<string, mixed>|null 当前档案；未设置或指向已删除的档案时为 null（= 用系统连接）。
   */
  public static function active(): ?array
  {
    $data = self::read();
    if ($data['active'] === '') {
      return null;
    }
    foreach ($data['profiles'] as $item) {
      if ((string)$item['id'] === $data['active']) {
        return $item;
      }
    }
    return null;
  }

  /**
   * 当前档案 id（空串 = 未设置）。
   *
   * @return string 档案 id。
   */
  public static function activeId(): string
  {
    return self::read()['active'];
  }

  /**
   * 指定「当前连接」。
   *
   * 传空串表示**取消档案接管**，回到 `.env` 的系统连接。
   *
   * @param string $id 档案 id，空串表示取消。
   * @return void
   * @throws \InvalidArgumentException 目标档案不存在。
   */
  public static function setActive(string $id): void
  {
    $data = self::read();
    if ($id === '') {
      $data['active'] = '';
      self::write($data);
      return;
    }
    if (self::find($id) === null) {
      throw new \InvalidArgumentException('连接不存在');
    }
    $data['active'] = $id;
    self::write($data);
  }

  /**
   * 新建或更新一条档案。
   *
   * @param array<string, mixed> $input 请求字段。
   * @param string $id 档案 id；空串表示新建。
   * @return array<string, mixed> 落库后的档案（**含明文密码**，调用方负责脱敏）。
   * @throws \InvalidArgumentException 字段不合法、目标不存在或重名。
   */
  public static function save(array $input, string $id = ''): array
  {
    $data = self::read();
    $existing = null;
    if ($id !== '') {
      $existing = self::find($id);
      if ($existing === null) {
        throw new \InvalidArgumentException('连接不存在');
      }
    }
    $profile = self::normalize($input, $existing);
    // 同名去重：同一条服务器存两份会让「当前连接」指向两条分不清的档案。
    foreach ($data['profiles'] as $item) {
      if ((string)$item['id'] !== $id && (string)$item['name'] === $profile['name']) {
        throw new \InvalidArgumentException('已存在同名连接');
      }
    }
    $now = date('Y-m-d H:i:s');
    if ($existing === null) {
      $profile['id'] = 'c_' . bin2hex(random_bytes(6));
      $profile['created_at'] = $now;
      $profile['updated_at'] = $now;
      $data['profiles'][] = $profile;
    } else {
      $profile['id'] = (string)$existing['id'];
      $profile['created_at'] = (string)($existing['created_at'] ?? $now);
      $profile['updated_at'] = $now;
      foreach ($data['profiles'] as $index => $item) {
        if ((string)$item['id'] === $id) {
          $data['profiles'][$index] = $profile;
        }
      }
    }
    // 第一条档案自动成为「当前连接」：首次配置少点一次「设为当前」。
    // 只补空位，不动用户已选定的值（改别的档案不会把当前连接带跑）。
    if ($data['active'] === '') {
      $data['active'] = (string)$profile['id'];
    }
    self::write($data);
    return $profile;
  }

  /**
   * 删除一条档案。
   *
   * 删的若是当前连接，一并把 active 清空 —— 否则 active 会指向一个不存在的 id，
   * `active()` 恒返回 null，界面显示的「当前」与实际接管状态长期不一致。
   *
   * @param string $id 档案 id。
   * @return bool 是否删掉了东西。
   */
  public static function remove(string $id): bool
  {
    $data = self::read();
    $kept = [];
    $removed = false;
    foreach ($data['profiles'] as $item) {
      if ((string)$item['id'] === $id) {
        $removed = true;
        continue;
      }
      $kept[] = $item;
    }
    if (!$removed) {
      return false;
    }
    $data['profiles'] = $kept;
    if ($data['active'] === $id) {
      $data['active'] = '';
    }
    self::write($data);
    return true;
  }

  /**
   * 脱敏：抹掉密码，补上布尔标记与「是否当前」。
   *
   * 密码**永不下发**给前端：编辑表单留空即代表不修改（见 `normalize()`）。
   *
   * @param array<string, mixed> $profile 原始档案。
   * @param string $activeId 当前生效的档案 id。
   * @return array<string, mixed> 可安全下发的一条档案。
   */
  public static function mask(array $profile, string $activeId): array
  {
    // 探测连接状态
    $probe = self::probe($profile);
    $status = '正常';
    if (!$probe['ok']) {
      $status = '断开';
      if (strpos($probe['error'], '拒绝') !== false || strpos($probe['error'], '认证') !== false) {
        $status = '异常';
      }
    }
    
    return [
      'id' => (string)$profile['id'],
      'name' => (string)($profile['name'] ?? ''),
      'host' => (string)($profile['host'] ?? ''),
      'port' => (int)($profile['port'] ?? 3306),
      'username' => (string)($profile['username'] ?? ''),
      'database' => (string)($profile['database'] ?? ''),
      'charset' => (string)($profile['charset'] ?? 'utf8mb4'),
      'has_password' => ((string)($profile['password'] ?? '')) !== '',
      'is_active' => (string)$profile['id'] === $activeId,
      'status' => $status,
      'created_at' => (string)($profile['created_at'] ?? ''),
      'updated_at' => (string)($profile['updated_at'] ?? ''),
    ];
  }

  /**
   * 按档案建立一条 mysqli 连接。
   *
   * ⚠ 连接必须用 `@`：本机 `mysqli_report` 取默认值 `MYSQLI_REPORT_ERROR`（=1，不抛异常），
   * 连接失败只会**发 warning**；而 development 下 `display_errors=1`，这条 warning 会
   * 直接写进响应体、把 JSON 顶掉（前端 `JSON.parse` 直接失败）。加 `@` 后改为读
   * `mysqli_connect_error()` 当业务信息回传。
   *
   * @param array<string, mixed> $profile 连接档案。
   * @return \mysqli 已建立且已设置字符集的连接。
   * @throws \RuntimeException 连接失败或字符集不可用。
   */
  public static function connect(array $profile): \mysqli
  {
    $database = (string)($profile['database'] ?? '');
    $link = @mysqli_connect(
      (string)$profile['host'],
      (string)$profile['username'],
      (string)$profile['password'],
      $database === '' ? null : $database,
      (int)$profile['port']
    );
    if ($link === false) {
      throw new \RuntimeException('连接失败：' . (string)(mysqli_connect_error() ?: '未知错误'));
    }
    $charset = (string)($profile['charset'] ?? 'utf8mb4');
    if (!@mysqli_set_charset($link, $charset)) {
      @mysqli_close($link);
      throw new \RuntimeException("字符集 {$charset} 不可用");
    }
    return $link;
  }

  /**
   * 探测一条档案能否连通。
   *
   * 不抛异常：连接失败是**预期结果之一**（用户就是要知道那串参数对不对），
   * 失败信息原样回给前端展示。
   *
   * @param array<string, mixed> $profile 连接档案。
   * @return array{ok: bool, version: string, databases: int, error: string} 探测结果。
   */
  public static function probe(array $profile): array
  {
    try {
      $link = self::connect($profile);
    } catch (\Throwable $e) {
      return ['ok' => false, 'version' => '', 'databases' => 0, 'error' => $e->getMessage()];
    }
    $version = '';
    $result = @mysqli_query($link, 'SELECT VERSION()');
    if ($result !== false) {
      $row = mysqli_fetch_row($result);
      $version = (string)($row[0] ?? '');
      mysqli_free_result($result);
    }
    $databases = 0;
    $result = @mysqli_query($link, 'SHOW DATABASES');
    if ($result !== false) {
      $databases = (int)mysqli_num_rows($result);
      mysqli_free_result($result);
    }
    @mysqli_close($link);
    return ['ok' => true, 'version' => $version, 'databases' => $databases, 'error' => ''];
  }
}
