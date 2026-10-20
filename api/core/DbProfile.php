<?php

namespace Core;

class DbProfile
{
  private const TABLE = 'tb_database_profile';
  private const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'gbk', 'big5'];
  private const MAX_NAME = 64;
  private const MAX_HOST = 190;
  private const MAX_USER = 64;
  private const MAX_PASS = 190;

  /**
   * 在系统连接上执行档案读写。
   *
   * 档案表存系统库：即使当前连接已被某档案接管（可能指向外部服务器），
   * 档案管理自身必须仍可达——先保存接管现场，切回系统库执行 `$fn`，finally 还原。
   * 与 `tb_database_sort` 等排序表的系统库口径一致。
   *
   * @param \Closure $fn 在系统连接上执行的读写体。
   * @return mixed `$fn` 的返回值。
   */
  private static function onSystem(\Closure $fn)
  {
    $managed = Db::managedConnection();
    Db::useManaged(null);
    try {
      return $fn();
    } finally {
      Db::useManaged($managed);
    }
  }

  /**
   * 表行 → 档案结构（字段与原 JSON 档案一一对应）。
   *
   * @param array<string, mixed> $row 表行。
   * @return array<string, mixed> 档案。
   */
  private static function rowToProfile(array $row): array
  {
    return [
      'id' => (string)$row['id'],
      'name' => (string)$row['name'],
      'host' => (string)$row['host'],
      'port' => (int)$row['port'],
      'username' => (string)$row['username'],
      'password' => (string)$row['password'],
      'database' => (string)$row['database'],
      'charset' => (string)$row['charset'],
      'created_at' => (string)$row['created_at'],
      'updated_at' => (string)$row['updated_at'],
    ];
  }

  /**
   * 表缺失容错判定：与原 JSON「文件不存在 = 空档案库」口径一致。
   *
   * @param \Exception $e 表操作异常。
   * @return bool 是否为表缺失类错误。
   */
  private static function isMissingTable(\Exception $e): bool
  {
    return strpos($e->getMessage(), "doesn't exist") !== false;
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
   * 全部档案（按 id 序）。
   *
   * @return array<int, array<string, mixed>> 档案列表；表缺失按空列表（与原 JSON 文件缺失口径一致）。
   */
  public static function all(): array
  {
    return self::onSystem(function () {
      try {
        $rows = Db::query('SELECT * FROM `' . self::TABLE . '` ORDER BY `id` ASC');
      } catch (\Exception $e) {
        if (self::isMissingTable($e)) {
          return [];
        }
        throw $e;
      }
      return array_map([self::class, 'rowToProfile'], $rows);
    });
  }

  /**
   * 按 id 取一条档案。
   *
   * @param string $id 档案 id。
   * @return array<string, mixed>|null 命中的档案，无则 null（表缺失同 null）。
   */
  public static function find(string $id): ?array
  {
    return self::onSystem(function () use ($id) {
      try {
        $rows = Db::query("SELECT * FROM `" . self::TABLE . "` WHERE `id` = '" . Db::escape($id) . "' LIMIT 1");
      } catch (\Exception $e) {
        if (self::isMissingTable($e)) {
          return null;
        }
        throw $e;
      }
      return $rows === [] ? null : self::rowToProfile($rows[0]);
    });
  }

  /**
   * 当前生效的档案。
   *
   * @return array<string, mixed>|null 当前档案；未设置或指向已删除的档案时为 null（= 用系统连接）。
   */
  public static function active(): ?array
  {
    return self::onSystem(function () {
      try {
        $rows = Db::query('SELECT * FROM `' . self::TABLE . '` WHERE `is_active` = 1 ORDER BY `id` ASC LIMIT 1');
      } catch (\Exception $e) {
        if (self::isMissingTable($e)) {
          return null;
        }
        throw $e;
      }
      return $rows === [] ? null : self::rowToProfile($rows[0]);
    });
  }

  /**
   * 当前档案 id（空串 = 未设置）。
   *
   * @return string 档案 id。
   */
  public static function activeId(): string
  {
    $active = self::active();
    return $active === null ? '' : (string)$active['id'];
  }

  /**
   * 指定「当前连接」。
   *
   * 传空串表示**取消档案接管**，回到 `.env` 的系统连接。
   * 表版 `is_active` 全表至多一行 =1；删除当前档案时该行随之消失，等价于原 JSON 版清空 active。
   *
   * @param string $id 档案 id，空串表示取消。
   * @return void
   * @throws \InvalidArgumentException 目标档案不存在。
   */
  public static function setActive(string $id): void
  {
    self::onSystem(function () use ($id) {
      if ($id !== '' && self::find($id) === null) {
        throw new \InvalidArgumentException('连接不存在');
      }
      Db::execute('UPDATE `' . self::TABLE . '` SET `is_active` = 0 WHERE `is_active` = 1');
      if ($id !== '') {
        Db::execute("UPDATE `" . self::TABLE . "` SET `is_active` = 1 WHERE `id` = '" . Db::escape($id) . "'");
      }
      return null;
    });
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
    return self::onSystem(function () use ($input, $id) {
      $existing = null;
      if ($id !== '') {
        $existing = self::find($id);
        if ($existing === null) {
          throw new \InvalidArgumentException('连接不存在');
        }
      }
      $profile = self::normalize($input, $existing);
      // 同名去重：同一条服务器存两份会让「当前连接」指向两条分不清的档案。
      $dup = Db::query("SELECT `id` FROM `" . self::TABLE . "` WHERE `name` = '" . Db::escape($profile['name']) . "'"
        . ($id !== '' ? " AND `id` <> '" . Db::escape($id) . "'" : '')
        . ' LIMIT 1');
      if ($dup !== []) {
        throw new \InvalidArgumentException('已存在同名连接');
      }
      $now = date('Y-m-d H:i:s');
      if ($existing === null) {
        $profile['id'] = 'c_' . bin2hex(random_bytes(6));
        $profile['created_at'] = $now;
      } else {
        $profile['id'] = (string)$existing['id'];
        $profile['created_at'] = (string)($existing['created_at'] ?? $now);
      }
      $profile['updated_at'] = $now;
      // 同名检查已拦住 name 撞击，REPLACE 只会命中主键 id（更新场景）。
      Db::execute("REPLACE INTO `" . self::TABLE . "`"
        . " (`id`, `name`, `host`, `port`, `username`, `password`, `database`, `charset`, `created_at`, `updated_at`) VALUES ("
        . "'" . Db::escape($profile['id']) . "', "
        . "'" . Db::escape($profile['name']) . "', "
        . "'" . Db::escape($profile['host']) . "', "
        . (int)$profile['port'] . ", "
        . "'" . Db::escape($profile['username']) . "', "
        . "'" . Db::escape($profile['password']) . "', "
        . "'" . Db::escape($profile['database']) . "', "
        . "'" . Db::escape($profile['charset']) . "', "
        . "'" . $profile['created_at'] . "', "
        . "'" . $now . "')");
      // 第一条档案自动成为「当前连接」：首次配置少点一次「设为当前」。
      // 只补空位，不动用户已选定的值（改别的档案不会把当前连接带跑）。
      $hasActive = Db::query('SELECT `id` FROM `' . self::TABLE . '` WHERE `is_active` = 1 LIMIT 1');
      if ($hasActive === []) {
        Db::execute("UPDATE `" . self::TABLE . "` SET `is_active` = 1 WHERE `id` = '" . Db::escape($profile['id']) . "'");
      }
      return $profile;
    });
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
    return self::onSystem(function () use ($id) {
      try {
        $affected = Db::execute("DELETE FROM `" . self::TABLE . "` WHERE `id` = '" . Db::escape($id) . "'");
      } catch (\Exception $e) {
        if (self::isMissingTable($e)) {
          return false;
        }
        throw $e;
      }
      return $affected > 0;
    });
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
    // 连接超时 2 秒：probe 会对列表里每条档案建真实连接，目标主机不可达时
    // 不设超时会被系统默认值（可达数十秒）逐条串行阻塞，档案列表页整体挂起。
    $link = @mysqli_init();
    if ($link instanceof \mysqli) {
      @mysqli_options($link, MYSQLI_OPT_CONNECT_TIMEOUT, 2);
      $connected = @mysqli_real_connect(
        $link,
        (string)$profile['host'],
        (string)$profile['username'],
        (string)$profile['password'],
        $database === '' ? null : $database,
        (int)$profile['port']
      );
      if (!$connected) {
        @mysqli_close($link);
        $link = false;
      }
    }
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
