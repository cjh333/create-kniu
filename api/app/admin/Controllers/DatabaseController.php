<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\DbProfile;
use Core\ErrorCode;

/**
 * 数据库管理（类 AdminSQL）。
 *
 * 权限口径：**只对超级管理员（role=1）开放**，普通用户与 role_auth=1 的「编辑」一律拒绝。
 * 与 `requireManagePermission()`（role=1 或 role_auth=1）刻意区分——本模块能执行任意 SQL、
 * 能新建/删除库表，权限面必须收窄到唯一超级管理员。
 *
 * 两条贯穿全模块的安全约定：
 *   ① **标识符（库名/表名/列名）永远拼进 SQL**，因此每个入口都先过 `validIdentifier()`
 *      白名单（`^[A-Za-z0-9_]{1,64}$`），不合法一律 2001，绝不进入 SQL 文本；
 *   ② **数据值一律 `Db::escape()`**，且列名同样走白名单，二者缺一即 SQL 注入。
 *
 * 编解码口径：数据库管理**按原样存取，不做 HTML 编解码**——它的职责就是维护真实数据，
 * 编码会污染库内原文。前端表格用 `textContent` 渲染，不依赖后端转义。
 */
class DatabaseController extends Base
{
  /** 单次导入 / 导出的字节上限（8MB），防止把内存打满。 */
  private const MAX_SQL_BYTES = 8388608;

  /** SQL 控制台单次允许执行的语句条数。 */
  private const MAX_STATEMENTS = 200;

  /** 数据行浏览单页最大条数。 */
  private const MAX_PAGE_ROWS = 200;

  /** SQL 控制台回显的最大行数。 */
  private const MAX_RESULT_ROWS = 500;

  /**
   * 列编辑允许的类型白名单：类型字符串**逐字拼进 ALTER 语句**，必须枚举校验，
   * 与 `validIdentifier()` 同一条安全线的另一半。`enum`/`set` 因需要带引号的
   * 枚举值列表（`'a','b'`）不在编辑弹窗支持范围（保持原类型不变即可绕开）。
   */
  private const COLUMN_TYPES = [
    'bigint', 'int', 'mediumint', 'smallint', 'tinyint', 'decimal', 'float', 'double', 'bit',
    'char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext',
    'binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob', 'longblob',
    'date', 'datetime', 'timestamp', 'time', 'year', 'json',
  ];

  /**
   * MySQL 自带的系统 schema：**不属于「用户创建的数据库」**，库列表里一律不出现。
   *
   * 用**精确枚举 + `NOT IN`** 而不是 `LIKE '%schema'`：后者会把用户自建的
   * `my_schema` / `log_schema` 一并滤掉——那些是真实可管理的库。
   * 名字按 MySQL 在 `information_schema.SCHEMATA` 里的实际形态（Linux 下 schema 名大小写敏感）。
   *
   * 只影响**列表展示**：这些库仍然可以被直接访问（`/db_tables` 等接口不做拦截），
   * 因为「不显示」是界面口径，「不允许操作」是另一回事，两者不该混在一起。
   */
  private const SYSTEM_SCHEMAS = ['information_schema', 'performance_schema', 'mysql', 'sys'];

  /**
   * 超级管理员闸门：非 role=1 一律 403 + 1002。
   *
   * @return void
   */
  private function requireSuperAdmin(): void
  {
    if ($this->isAdmin()) {
      return;
    }
    http_response_code(403);
    $this->json([], '数据库管理仅对超级管理员开放', ErrorCode::FORBIDDEN);
  }

  /**
   * 每个动作的统一入口：**先鉴权，再接管「当前连接」**。
   *
   * 顺序不可颠倒：鉴权链路（`Base::__construct()` 按会话里的 name 回查 `tb_role`）
   * 必须先跑在 `.env` 那条**系统连接**上，否则把当前连接切到别的服务器后，
   * 当前管理员在那个库里查不到自己 ⇒ 直接锁在门外。详见 `Core\Db::useManaged()`。
   *
   * 接管失败（档案里的参数连不上）时回 `4002` 而不是把异常抛给框架兜成 500：
   * 前端据此把用户送到连接页改参数，而不是在库列表页看到「服务器内部错误」。
   *
   * @return void
   */
  private function guard(): void
  {
    $this->requireSuperAdmin();
    $profile = DbProfile::active();
    if ($profile === null) {
      return;
    }
    try {
      Db::useManaged(DbProfile::connect($profile));
    } catch (\Throwable $e) {
      $this->json([], '当前连接不可用：' . $e->getMessage(), ErrorCode::SERVICE_UNAVAILABLE);
    }
  }

  /**
   * 标识符白名单：库名、表名、列名拼进 SQL 前必须通过。
   *
   * @param mixed $value 待校验标识符。
   * @param string $label 报错时使用的名称。
   * @return string 通过校验的标识符。
   */
  private function validIdentifier($value, string $label): string
  {
    $name = trim((string)$value);
    if (preg_match('/^[A-Za-z0-9_]{1,64}$/', $name) !== 1) {
      $this->json([], "{$label}只能由字母、数字和下划线组成（1-64 位）", ErrorCode::PARAM_INVALID);
    }
    return $name;
  }

  /**
   * 读取并校验数据库名参数。
   *
   * @param string $key 请求参数名。
   * @return string 数据库名。
   */
  private function databaseParam(string $key = 'database'): string
  {
    return $this->validIdentifier($this->input("post.{$key}/s", ''), '数据库名');
  }

  /**
   * 读取并校验表名参数。
   *
   * @return string 表名。
   */
  private function tableParam(): string
  {
    return $this->validIdentifier($this->input('post.table/s', ''), '数据表名');
  }

  /**
   * 数据库管理审计日志。
   *
   * 任意 SQL / 建库 / 删表都属于不可逆操作，落到文件日志以便事后追溯。
   *
   * @param string $action 操作名。
   * @param array<string, mixed> $context 上下文。
   * @return void
   */
  private function writeAudit(string $action, array $context = []): void
  {
    $dir = dirname(__DIR__, 3) . '/runtime/log';
    if (!is_dir($dir)) {
      @mkdir($dir, 0777, true);
    }
    $line = json_encode([
      'time' => date('Y-m-d H:i:s'),
      'user' => (string)($_SESSION['admin_token']['name'] ?? ''),
      'user_id' => $this->currentUserId(),
      'ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
      'action' => $action,
      'context' => $context,
    ], JSON_UNESCAPED_UNICODE);
    @file_put_contents($dir . '/db_admin.log', $line . PHP_EOL, FILE_APPEND | LOCK_EX);
  }

  /**
   * 库是否存在。
   *
   * @param string $database 数据库名。
   * @return bool
   */
  private function databaseExists(string $database): bool
  {
    $rows = Db::query('SHOW DATABASES');
    foreach ($rows as $row) {
      if ((string)reset($row) === $database) {
        return true;
      }
    }
    return false;
  }

  /**
   * 表是否存在（含视图：`information_schema.TABLES` 对两者都登记）。
   *
   * @param string $database 数据库名。
   * @param string $table 数据表名。
   * @return bool
   */
  private function tableExists(string $database, string $table): bool
  {
    $rows = Db::query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = \''
      . Db::escape($database) . '\' AND TABLE_NAME = \'' . Db::escape($table) . '\' LIMIT 1'
    );
    return (bool)$rows;
  }

  /**
   * 读写前的存在性闸门：库或表不存在 → 业务码 3001 并终止。
   *
   * 为什么必须有：`SHOW COLUMNS / SHOW INDEX FROM 不存在的表` 在 MySQL 里是**抛异常**，
   * 而 `dbTableStructure` / `dbRows` / `primaryKeyOf` 这些直读路径没有 try/catch
   * ⇒ 未捕获异常 → 框架兜底成 **HTTP 500**。
   * 单表页支持直达链接 `#/databasetable?database=…&table=…`，书签、回退栈、
   * 或「别人刚把表删了」都很容易带上已失效的表名 —— 那种情况要的是
   * 「数据表不存在」（前端据此提示并退回上一层），而不是 500。
   * 注意 **业务码不可与 HTTP 同值**（SKILL 错误码约定），所以用 NOT_FOUND(3001)。
   *
   * @param string $database 数据库名。
   * @param string $table 数据表名。
   * @return void
   */
  private function requireTable(string $database, string $table): void
  {
    if (!$this->databaseExists($database)) {
      $this->json([], '数据库不存在', ErrorCode::NOT_FOUND);
    }
    if (!$this->tableExists($database, $table)) {
      $this->json([], '数据表不存在', ErrorCode::NOT_FOUND);
    }
  }

  /**
   * 读取单表的主键列。
   *
   * 无主键的表（含视图）**不允许写入**，避免 UPDATE/DELETE 命中全表。
   *
   * @param string $database 数据库名。
   * @param string $table 表名。
   * @return string 主键列名；无主键返回空串。
   */
  private function primaryKeyOf(string $database, string $table): string
  {
    $rows = Db::query("SHOW INDEX FROM `{$database}`.`{$table}` WHERE Key_name = 'PRIMARY'");
    foreach ($rows as $row) {
      $name = (string)($row['Column_name'] ?? '');
      if ($name !== '') {
        return $name;
      }
    }
    return '';
  }

  /**
   * 按分号切分 SQL 脚本，跳过字符串与注释里的分号。
   *
   * 朴素的 explode(';') 会把 INSERT ... VALUES ('a;b') 拆坏，因此这里做一次
   * 单遍状态机扫描：跟踪单引号/双引号/反引号、-- 与 # 行注释、块注释与转义反斜杠。
   *
   * @param string $sql SQL 脚本。
   * @return array<int, string> 语句数组（已去空白、已剔除纯注释）。
   */
  private function splitStatements(string $sql): array
  {
    $statements = [];
    $buffer = '';
    $length = strlen($sql);
    $quote = '';
    $inLineComment = false;
    $inBlockComment = false;
    for ($i = 0; $i < $length; $i++) {
      $char = $sql[$i];
      $next = $i + 1 < $length ? $sql[$i + 1] : '';
      if ($inLineComment) {
        if ($char === "\n") {
          $inLineComment = false;
          $buffer .= $char;
        }
        continue;
      }
      if ($inBlockComment) {
        if ($char === '*' && $next === '/') {
          $inBlockComment = false;
          $i++;
        }
        continue;
      }
      if ($quote !== '') {
        $buffer .= $char;
        if ($char === '\\' && $quote !== '`' && $next !== '') {
          $buffer .= $next;
          $i++;
          continue;
        }
        if ($char === $quote) {
          $quote = '';
        }
        continue;
      }
      if ($char === '-' && $next === '-') {
        $inLineComment = true;
        $i++;
        continue;
      }
      if ($char === '#') {
        $inLineComment = true;
        continue;
      }
      if ($char === '/' && $next === '*') {
        $inBlockComment = true;
        $i++;
        continue;
      }
      if ($char === "'" || $char === '"' || $char === '`') {
        $quote = $char;
        $buffer .= $char;
        continue;
      }
      if ($char === ';') {
        $trimmed = trim($buffer);
        if ($trimmed !== '') {
          $statements[] = $trimmed;
        }
        $buffer = '';
        continue;
      }
      $buffer .= $char;
    }
    $trimmed = trim($buffer);
    if ($trimmed !== '') {
      $statements[] = $trimmed;
    }
    return $statements;
  }

  /**
   * 逐条执行 SQL 脚本并汇总结果。
   *
   * @param string $sql SQL 脚本。
   * @param bool $stopOnError 遇错是否立即中断（导入用 true，SQL 控制台用 false）。
   * @return array<int, array<string, mixed>> 每条语句的执行结果。
   */
  private function runScript(string $sql, bool $stopOnError): array
  {
    $results = [];
    foreach ($this->splitStatements($sql) as $index => $statement) {
      if (count($results) >= self::MAX_STATEMENTS) {
        $results[] = ['index' => $index, 'ok' => false, 'message' => '超过单次 ' . self::MAX_STATEMENTS . ' 条上限，已中止'];
        break;
      }
      $results[] = $this->runStatement($statement, $index);
      if ($stopOnError && !$results[$index]['ok']) {
        break;
      }
    }
    return $results;
  }

  /**
   * 执行单条 SQL。
   *
   * SELECT/SHOW 一类返回前若干行，其余返回受影响行数。
   *
   * @param string $statement 单条 SQL。
   * @param int $index 语句序号（从 0 起）。
   * @return array<string, mixed> 执行结果。
   */
  private function runStatement(string $statement, int $index): array
  {
    // 高危语句闸门：即使 superadmin 场景也挡住「读服务器文件 / 写服务器文件 / 关库」三条路，
    // 防止会话被劫持后一步穿透到文件系统与实例级破坏。
    $upper = strtoupper($statement);
    $blocked = null;
    if (str_contains($upper, 'LOAD_FILE')) {
      $blocked = '禁止 LOAD_FILE（读取服务器文件）';
    } elseif (preg_match('/INTO\s+(OUTFILE|DUMPFILE)/', $upper)) {
      $blocked = '禁止 INTO OUTFILE/DUMPFILE（写入服务器文件）';
    } elseif (preg_match('/\b(SHUTDOWN|KILL)\b/', $upper)) {
      $blocked = '禁止 SHUTDOWN/KILL（实例级操作）';
    }
    if ($blocked !== null) {
      return [
        'index' => $index,
        'ok' => false,
        'kind' => 'error',
        'affected' => 0,
        'message' => $blocked,
        'sql' => mb_substr($statement, 0, 400),
        'rows' => [],
      ];
    }
    $head = strtoupper(substr(ltrim($statement), 0, 6));
    $isQuery = in_array($head, ['SELECT', 'SHOW  ', 'DESCRI', 'EXPLAI', 'WITH  '], true)
      || str_starts_with(strtoupper(ltrim($statement)), 'SELECT')
      || str_starts_with(strtoupper(ltrim($statement)), 'SHOW')
      || str_starts_with(strtoupper(ltrim($statement)), 'DESC')
      || str_starts_with(strtoupper(ltrim($statement)), 'EXPLAIN')
      || str_starts_with(strtoupper(ltrim($statement)), 'WITH');
    try {
      if ($isQuery) {
        $rows = Db::query($statement);
        $total = count($rows);
        return [
          'index' => $index,
          'ok' => true,
          'kind' => 'query',
          'affected' => $total,
          'truncated' => $total > self::MAX_RESULT_ROWS,
          'sql' => mb_substr($statement, 0, 400),
          'rows' => array_slice($rows, 0, self::MAX_RESULT_ROWS),
        ];
      }
      $affected = Db::execute($statement);
      return [
        'index' => $index,
        'ok' => true,
        'kind' => 'execute',
        'affected' => (int)$affected,
        'sql' => mb_substr($statement, 0, 400),
        'rows' => [],
      ];
    } catch (\Throwable $e) {
      return [
        'index' => $index,
        'ok' => false,
        'kind' => 'error',
        'affected' => 0,
        'message' => (string)$e->getMessage(),
        'sql' => mb_substr($statement, 0, 400),
        'rows' => [],
      ];
    }
  }

  /**
   * 生成单条 INSERT 语句。
   *
   * 表名**必须带库名限定**（`db.table`）：连接默认库是配置文件里的那个，
   * 漏掉库名会把写入打到错误的库里。
   *
   * @param string $database 数据库名。
   * @param string $table 表名。
   * @param array<string, mixed> $values 列值（列名已白名单校验）。
   * @return string INSERT 语句。
   */
  private function buildInsert(string $database, string $table, array $values): string
  {
    $columns = [];
    $literals = [];
    foreach ($values as $column => $value) {
      $name = $this->validIdentifier((string)$column, '列名');
      $columns[] = "`{$name}`";
      $literals[] = $value === null ? 'NULL' : "'" . Db::escape((string)$value) . "'";
    }
    return "INSERT INTO `{$database}`.`{$table}` (" . implode(',', $columns) . ') VALUES ('
      . implode(',', $literals) . ')';
  }

  /**
   * 生成单条 UPDATE 语句。
   *
   * @param string $database 数据库名。
   * @param string $table 表名。
   * @param array<string, mixed> $values 列值。
   * @param string $primaryKey 主键列名。
   * @param string $primaryValue 主键值。
   * @return string UPDATE 语句。
   */
  private function buildUpdate(string $database, string $table, array $values, string $primaryKey, string $primaryValue): string
  {
    $sets = [];
    foreach ($values as $column => $value) {
      $name = $this->validIdentifier((string)$column, '列名');
      $sets[] = "`{$name}` = " . ($value === null ? 'NULL' : "'" . Db::escape((string)$value) . "'");
    }
    if (!$sets) {
      return '';
    }
    $key = $this->validIdentifier($primaryKey, '主键列名');
    return "UPDATE `{$database}`.`{$table}` SET " . implode(',', $sets)
      . " WHERE `{$key}` = '" . Db::escape($primaryValue) . "' LIMIT 1";
  }

  /**
   * 把任意值转成 SQL 字面量（导出用）。
   *
   * @param mixed $value 单元格值。
   * @return string SQL 字面量。
   */
  private function literal($value): string
  {
    if ($value === null) {
      return 'NULL';
    }
    if (is_int($value) || is_float($value)) {
      return (string)$value;
    }
    $text = (string)$value;
    if (preg_match('/^-?\d+(\.\d+)?$/', $text) === 1 && strlen($text) < 20) {
      return $text;
    }
    return "'" . Db::escape($text) . "'";
  }

  /* ==================== 接口 ==================== */

  /**
   * 库列表（含表数量与体积）——**只列用户创建的库**，MySQL 自带的系统 schema
   * （见 `SYSTEM_SCHEMAS`）不出现在列表里。
   *
   * @return void
   */
  public function dbList(): void
  {
    $this->guard();
    // 标识符白名单在这里用不上（系统 schema 名是常量），但仍走 Db::escape 拼串，
    // 与模块内「一切拼进 SQL 的值都要转义」的约定保持一致。
    $excluded = implode(', ', array_map(function (string $name): string {
      return "'" . Db::escape($name) . "'";
    }, self::SYSTEM_SCHEMAS));
    $rows = [];
    try {
      $rows = Db::query(
        'SELECT s.SCHEMA_NAME AS db_name, COUNT(t.TABLE_NAME) AS table_count, '
        . 'COALESCE(SUM(t.DATA_LENGTH + t.INDEX_LENGTH), 0) AS total_bytes '
        . 'FROM information_schema.SCHEMATA s '
        . 'LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = s.SCHEMA_NAME '
        . 'WHERE s.SCHEMA_NAME NOT IN (' . $excluded . ') '
        . 'GROUP BY s.SCHEMA_NAME ORDER BY s.SCHEMA_NAME ASC'
      );
    } catch (\Throwable $e) {
      // 连不上时回 **4002 而不是 500**：前端凭这条码把用户送到「数据库连接」页去改参数
      // （首次进入、库没起来、档案参数失效都会走到这里）。
      // 500 在页面上只是一句「服务器内部错误」，用户不知道该去哪儿修。
      $this->json([], '数据库连接失败：' . $e->getMessage(), ErrorCode::SERVICE_UNAVAILABLE);
    }
    $current = (string)($this->input('post.database/s') ?? '');
    $this->json([
      'current' => $current,
      'list' => array_map(function (array $row): array {
        return [
          'name' => (string)$row['db_name'],
          'table_count' => (int)$row['table_count'],
          'total_bytes' => (int)$row['total_bytes'],
          'is_current' => (string)$row['db_name'] === $current,
        ];
      }, $rows),
    ]);
  }

  /**
   * 新建数据库。
   *
   * @return void
   */
  public function dbCreate(): void
  {
    $this->guard();
    $database = $this->databaseParam('name');
    if ($this->databaseExists($database)) {
      $this->json([], '该数据库已存在', ErrorCode::CONFLICT);
    }
    try {
        Db::execute("CREATE DATABASE `{$database}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch (\Throwable $e) {
      $this->json([], '新建数据库失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_create', ['database' => $database]);
    $this->json(['name' => $database], '数据库创建成功');
  }

  /**
   * 数据表列表。
   *
   * @return void
   */
  public function dbTables(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    if (!$this->databaseExists($database)) {
      $this->json([], '数据库不存在', ErrorCode::NOT_FOUND);
    }
    $rows = Db::query(
      'SELECT TABLE_NAME, TABLE_TYPE, ENGINE, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, TABLE_COLLATION, TABLE_COMMENT '
      . 'FROM information_schema.TABLES WHERE TABLE_SCHEMA = \''
      . Db::escape($database) . '\' ORDER BY TABLE_NAME ASC'
    );
    $this->json([
      'database' => $database,
      'list' => array_map(function (array $row): array {
        return [
          'name' => (string)$row['TABLE_NAME'],
          'type' => (string)$row['TABLE_TYPE'],
          'engine' => (string)($row['ENGINE'] ?? ''),
          'rows' => (int)($row['TABLE_ROWS'] ?? 0),
          'data_length' => (int)($row['DATA_LENGTH'] ?? 0),
          'index_length' => (int)($row['INDEX_LENGTH'] ?? 0),
          'collation' => (string)($row['TABLE_COLLATION'] ?? ''),
          'comment' => (string)($row['TABLE_COMMENT'] ?? ''),
        ];
      }, $rows),
    ]);
  }

  /**
   * 新建数据表（字段由前端提交结构化定义）。
   *
   * @return void
   */
  public function dbTableCreate(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    if (!$this->databaseExists($database)) {
      $this->json([], '数据库不存在', ErrorCode::NOT_FOUND);
    }
    $rawFields = $this->input('post.fields', []);
    if (!is_array($rawFields) || !$rawFields) {
      $this->json([], '至少需要一个字段定义', ErrorCode::PARAM_INVALID);
    }
    $definitions = [];
    foreach (array_values($rawFields) as $field) {
      if (!is_array($field)) {
        $this->json([], '字段定义格式不正确', ErrorCode::PARAM_INVALID);
      }
      $name = $this->validIdentifier((string)($field['name'] ?? ''), '字段名');
      $type = strtoupper(trim((string)($field['type'] ?? '')));
      $length = (int)($field['length'] ?? 0);
      $allowedTypes = [
        'TINYINT' => 0, 'SMALLINT' => 0, 'MEDIUMINT' => 0, 'INT' => 0, 'BIGINT' => 0,
        'FLOAT' => 0, 'DOUBLE' => 0, 'DECIMAL' => 2,
        'CHAR' => 1, 'VARCHAR' => 1, 'TEXT' => 0, 'TINYTEXT' => 0, 'MEDIUMTEXT' => 0, 'LONGTEXT' => 0,
        'DATE' => 0, 'DATETIME' => 0, 'TIMESTAMP' => 0, 'TIME' => 0, 'YEAR' => 0,
        'BINARY' => 1, 'VARBINARY' => 1, 'BLOB' => 0, 'TINYBLOB' => 0, 'MEDIUMBLOB' => 0, 'LONGBLOB' => 0,
        'JSON' => 0,
      ];
      if (!isset($allowedTypes[$type])) {
        $this->json([], "字段「{$name}」的类型「{$type}」不支持", ErrorCode::PARAM_INVALID);
      }
      $sqlType = $type;
      if ($allowedTypes[$type] > 0) {
        $max = $allowedTypes[$type] === 1 ? 65535 : 65;
        if ($length < 1 || $length > $max) {
          $this->json([], "字段「{$name}」的长度必须在 1-{$max} 之间", ErrorCode::PARAM_INVALID);
        }
        $sqlType = $type . "({$length})";
      }
      $piece = "`{$name}` {$sqlType}";
      if (!empty($field['primary'])) {
        $piece .= ' NOT NULL';
        if ($type === 'INT' || $type === 'BIGINT') {
          $piece .= ' AUTO_INCREMENT';
        }
      } elseif (!empty($field['nullable'])) {
        $piece .= ' NULL';
      } else {
        $piece .= ' NOT NULL';
      }
      if (!empty($field['default']) && $piece !== '' && strpos($piece, 'AUTO_INCREMENT') === false) {
        $default = (string)$field['default'];
        $piece .= ' DEFAULT ' . (preg_match('/^-?\d+(\.\d+)?$/', $default) === 1 ? $default : "'" . Db::escape($default) . "'");
      }
      if (!empty($field['comment'])) {
        $comment = mb_substr((string)$field['comment'], 0, 120);
        $piece .= ' COMMENT ' . "'" . Db::escape($comment) . "'";
      }
      $definitions[] = $piece;
    }
    $primary = [];
    foreach (array_values($rawFields) as $field) {
      if (!empty($field['primary']) && is_array($field)) {
        $primary[] = $this->validIdentifier((string)($field['name'] ?? ''), '字段名');
      }
    }
    $suffix = '';
    if ($primary) {
      $quoted = array_map(function (string $name): string {
        return "`{$name}`";
      }, $primary);
      $suffix = ', PRIMARY KEY (' . implode(',', $quoted) . ')';
    }
    $sql = "CREATE TABLE `{$database}`.`{$table}` (\n  " . implode(",\n  ", $definitions) . $suffix
      . "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    try {
      Db::execute($sql);
    } catch (\Throwable $e) {
      $this->json([], '新建数据表失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_table_create', ['database' => $database, 'table' => $table]);
    $this->json(['database' => $database, 'table' => $table], '数据表创建成功');
  }

  /**
   * 表结构：列定义 + 索引 + 表注释。
   *
   * @return void
   */
  public function dbTableStructure(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    $this->requireTable($database, $table);
    $columns = Db::query("SHOW FULL COLUMNS FROM `{$database}`.`{$table}`");
    $indexes = Db::query("SHOW INDEX FROM `{$database}`.`{$table}`");
    // 字符/文本类列的最大长度来自 information_schema（`SHOW COLUMNS` 的 Type 里
    // `longtext` 不带长度，而界面上「长度」列要显示 4294967295；数值/时间列该值为
    // NULL ⇒ 前端显示为空，与工具类产品口径一致）。
    $lengthRows = Db::query(
      'SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = \''
      . Db::escape($database) . '\' AND TABLE_NAME = \'' . Db::escape($table) . '\''
    );
    $lengthMap = [];
    foreach ($lengthRows as $row) {
      $lengthMap[(string)$row['COLUMN_NAME']] = $row['CHARACTER_MAXIMUM_LENGTH'];
    }
    $indexMap = [];
    foreach ($indexes as $index) {
      $name = (string)($index['Key_name'] ?? '');
      if ($name === '') {
        continue;
      }
      if (!isset($indexMap[$name])) {
        $indexMap[$name] = [
          'name' => $name,
          'unique' => (string)($index['Non_unique'] ?? '1') === '0',
          'type' => (string)($index['Index_type'] ?? ''),
          'columns' => [],
        ];
      }
      $indexMap[$name]['columns'][] = (string)($index['Column_name'] ?? '');
    }
    $tableComment = '';
    $rowRows = Db::query(
      'SELECT TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = \''
      . Db::escape($database) . '\' AND TABLE_NAME = \'' . Db::escape($table) . '\' LIMIT 1'
    );
    if ($rowRows) {
      $tableComment = (string)($rowRows[0]['TABLE_COMMENT'] ?? '');
    }
    $primaryKey = $this->primaryKeyOf($database, $table);
    $this->json([
      'database' => $database,
      'table' => $table,
      'comment' => $tableComment,
      'primary_key' => $primaryKey,
      'writable' => $primaryKey !== '',
      'columns' => array_map(function (array $row) use ($lengthMap): array {
        return [
          'name' => (string)$row['Field'],
          'type' => (string)$row['Type'],
          'length' => $lengthMap[(string)$row['Field']] ?? null,
          'null' => (string)($row['Null'] ?? '') === 'YES',
          'key' => (string)($row['Key'] ?? ''),
          'default' => $row['Default'] ?? null,
          'extra' => (string)($row['Extra'] ?? ''),
          'comment' => (string)($row['Comment'] ?? ''),
        ];
      }, $columns),
      'indexes' => array_values($indexMap),
    ]);
  }

  /**
   * 数据行分页浏览。
   *
   * @return void
   */
  public function dbRows(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    $this->requireTable($database, $table);
    $primaryKey = $this->primaryKeyOf($database, $table);
    // 排序列可空（空 = 回落主键 / 首列），因此只有非空时才过白名单。
    $column = trim((string)($this->input('post.column/s', '')));
    if ($column !== '') {
      $column = $this->validIdentifier($column, '列名');
    }
    $columns = Db::query("SHOW COLUMNS FROM `{$database}`.`{$table}`");
    $columnNames = [];
    foreach ($columns as $item) {
      $columnNames[] = (string)$item['Field'];
    }
    $sort = $primaryKey !== '' && ($column === '' || !in_array($column, $columnNames, true)) ? $primaryKey : $column;
    if ($sort === '' || !in_array($sort, $columnNames, true)) {
      $sort = $columnNames[0] ?? '';
    }
    $direction = strtoupper((string)($this->input('post.direction/s', 'asc'))) === 'DESC' ? 'DESC' : 'ASC';
    $page = max(1, (int)($this->input('post.page_current') ?? 1));
    $size = (int)($this->input('post.page_rows') ?? 20);
    $size = $size > 0 ? min($size, self::MAX_PAGE_ROWS) : 20;
    $keyword = trim((string)($this->input('post.keyword/s', '')));
    $where = '';
    if ($keyword !== '') {
      $branches = [];
      foreach ($columnNames as $name) {
        $safe = $this->validIdentifier($name, '列名');
        $branches[] = "`{$safe}` LIKE '" . Db::escape('%' . $keyword . '%') . "'";
      }
      if ($branches) {
        $where = ' WHERE ' . implode(' OR ', $branches);
      }
    }
    $countRows = Db::query("SELECT COUNT(*) AS total FROM `{$database}`.`{$table}`{$where}");
    $total = (int)($countRows[0]['total'] ?? 0);
    $offset = ($page - 1) * $size;
    $orderBy = $sort !== '' ? " ORDER BY `{$sort}` {$direction}" : '';
    $rows = Db::query("SELECT * FROM `{$database}`.`{$table}`{$where}{$orderBy} LIMIT {$offset}, {$size}");
    $list = array_map(function (array $row) use ($columnNames, $primaryKey): array {
      $cells = [];
      foreach ($columnNames as $name) {
        $value = $row[$name] ?? null;
        $cells[] = [
          'name' => $name,
          'value' => $value === null ? null : (string)$value,
          'is_primary' => $name === $primaryKey,
        ];
      }
      return [
        'primary_key' => $primaryKey,
        'primary_value' => $primaryKey === '' ? '' : (string)($row[$primaryKey] ?? ''),
        'cells' => $cells,
      ];
    }, $rows);
    $this->json([
      'database' => $database,
      'table' => $table,
      'primary_key' => $primaryKey,
      'writable' => $primaryKey !== '',
      'columns' => $columnNames,
      'total' => $total,
      'page' => $page,
      'size' => $size,
      'list' => $list,
    ]);
  }

  /**
   * 新增或更新一行。
   *
   * @return void
   */
  public function dbRowSave(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    $this->requireTable($database, $table);
    $primaryKey = $this->primaryKeyOf($database, $table);
    if ($primaryKey === '') {
      $this->json([], '该表没有主键，数据库管理不允许写入（避免 UPDATE/DELETE 命中全表）', ErrorCode::RULE_REJECTED);
    }
    $values = $this->input('post.values', []);
    if (!is_array($values) || !$values) {
      $this->json([], '没有需要保存的字段', ErrorCode::PARAM_INVALID);
    }
    $columns = Db::query("SHOW COLUMNS FROM `{$database}`.`{$table}`");
    $known = [];
    foreach ($columns as $item) {
      $known[(string)$item['Field']] = true;
    }
    $clean = [];
    foreach ($values as $column => $value) {
      $name = $this->validIdentifier((string)$column, '列名');
      if (!isset($known[$name])) {
        $this->json([], "列「{$name}」不存在于该表", ErrorCode::PARAM_INVALID);
      }
      $clean[$name] = $value === null ? null : (string)$value;
    }
    $id = trim((string)($this->input('post.id/s', '')));
    try {
      if ($id === '') {
        Db::execute($this->buildInsert($database, $table, $clean));
        $message = '新增成功';
      } else {
        $key = $this->validIdentifier($primaryKey, '主键列名');
        unset($clean[$key]);
        $sql = $this->buildUpdate($database, $table, $clean, $key, $id);
        if ($sql === '') {
          $this->json([], '没有需要更新的字段', ErrorCode::PARAM_INVALID);
        }
        Db::execute($sql);
        $message = '更新成功';
      }
    } catch (\Throwable $e) {
      $this->json([], '保存失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_row_save', ['database' => $database, 'table' => $table, 'id' => $id]);
    $this->json(['database' => $database, 'table' => $table, 'id' => $id], $message);
  }

  /**
   * 删除一行（按主键）。
   *
   * @return void
   */
  public function dbRowDelete(): void
   {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    $this->requireTable($database, $table);
    $primaryKey = $this->primaryKeyOf($database, $table);
    if ($primaryKey === '') {
      $this->json([], '该表没有主键，不允许删除（避免命中全表）', ErrorCode::RULE_REJECTED);
    }
    $id = trim((string)($this->input('post.id/s', '')));
    if ($id === '') {
      $this->json([], '缺少主键值', ErrorCode::PARAM_INVALID);
    }
    $key = $this->validIdentifier($primaryKey, '主键列名');
    try {
      $affected = Db::execute("DELETE FROM `{$database}`.`{$table}` WHERE `{$key}` = '" . Db::escape($id) . "' LIMIT 1");
    } catch (\Throwable $e) {
      $this->json([], '删除失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    if ((int)$affected === 0) {
      $this->json([], '该行已不存在', ErrorCode::NOT_FOUND);
    }
    $this->writeAudit('db_row_delete', ['database' => $database, 'table' => $table, 'id' => $id]);
    $this->json(['database' => $database, 'table' => $table], '删除成功');
  }

  /**
   * 删除数据表。
   *
   * @return void
   */
  public function dbTableDrop(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    try {
      Db::execute("DROP TABLE IF EXISTS `{$database}`.`{$table}`");
    } catch (\Throwable $e) {
      $this->json([], '删除数据表失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_table_drop', ['database' => $database, 'table' => $table]);
    $this->json(['database' => $database, 'table' => $table], '数据表已删除');
  }

  /**
   * 编辑列定义（`ALTER TABLE ... CHANGE`，兼容改名）。
   *
   * 语义口径（与前端弹窗逐项对应）：
   *   - `name` 新列名（与旧名相同即不改名）；
   *   - `type` 必须在 `COLUMN_TYPES` 白名单（类型字符串逐字拼 SQL，绝不能放宽）；
   *   - `length` 空串 = 不带显示宽度/长度括号；
   *   - `unsigned` / `zerofill` 仅数值类型有效，其它类型交给 MySQL 报错透传；
   *   - `notNull` true ⇒ `NOT NULL`，false ⇒ `NULL`；
   *   - `default` 空串 = 不写 DEFAULT 子句（即清除默认值）；`NULL`（不分大小写）=
   *     `DEFAULT NULL`；`CURRENT_TIMESTAMP`（不分大小写）= 字面量；纯数字 = 字面量；
   *     其它一律按字符串加引号写入（`Db::escape()` 转义）；
   *   - `autoIncrement` 由 MySQL 校验「自增列必须是键」，失败透传原始错误；
   *   - `comment` 空串 = 不写 COMMENT 子句。
   *
   * 注意：编辑是**全量重定义**——不带 `ON UPDATE CURRENT_TIMESTAMP` 等未开放字段，
   * 原列的这些属性会被清掉；前端弹窗按当前定义回填，所见即所得。
   *
   * @return void
   */
  public function dbColumnEdit(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    $this->requireTable($database, $table);
    $column = $this->validIdentifier($this->input('post.column/s', ''), '列名');
    $this->requireColumn($database, $table, $column);
    $definition = $this->input('post.definition', []);
    if (!is_array($definition)) {
      $this->json([], '列定义参数不合法', ErrorCode::PARAM_INVALID);
    }
    $newName = $this->validIdentifier($definition['name'] ?? '', '新列名');
    $type = strtolower(trim((string)($definition['type'] ?? '')));
    if (!in_array($type, self::COLUMN_TYPES, true)) {
      $this->json([], '类型不在支持列表，请从以下类型中选择：' . implode(' / ', self::COLUMN_TYPES), ErrorCode::PARAM_INVALID);
    }
    $length = trim((string)($definition['length'] ?? ''));
    if ($length !== '' && preg_match('/^\d{1,10}(,\s*\d{1,4})?$/', $length) !== 1) {
      $this->json([], '长度必须是正整数（如 255）或「精度,小数位」（如 10,2）', ErrorCode::PARAM_INVALID);
    }
    $typeClause = strtoupper($type) . ($length !== '' ? "({$length})" : '');
    if (!empty($definition['unsigned'])) {
      $typeClause .= ' UNSIGNED';
    }
    if (!empty($definition['zerofill'])) {
      $typeClause .= ' ZEROFILL';
    }
    $typeClause .= !empty($definition['notNull']) ? ' NOT NULL' : ' NULL';
    $default = trim((string)($definition['default'] ?? ''));
    if ($default !== '') {
      if (strcasecmp($default, 'NULL') === 0) {
        $typeClause .= ' DEFAULT NULL';
      } elseif (preg_match('/^(current_timestamp(\(\))?|now\(\))$/i', $default) === 1) {
        // MySQL 8 的 `SHOW COLUMNS` 会把 `DEFAULT CURRENT_TIMESTAMP` 回显成
        // `current_timestamp()`；三种写法都归一成字面量，编辑弹窗的回填才能无损往返。
        $typeClause .= ' DEFAULT CURRENT_TIMESTAMP';
      } elseif (preg_match('/^-?\d+(\.\d+)?$/', $default) === 1) {
        $typeClause .= " DEFAULT {$default}";
      } else {
        $typeClause .= " DEFAULT '" . Db::escape($default) . "'";
      }
    }
    if (!empty($definition['autoInc'])) {
      $typeClause .= ' AUTO_INCREMENT';
    }
    $comment = trim((string)($definition['comment'] ?? ''));
    if ($comment !== '') {
      $typeClause .= " COMMENT '" . Db::escape($comment) . "'";
    }
    try {
      Db::execute("ALTER TABLE `{$database}`.`{$table}` CHANGE `{$column}` `{$newName}` {$typeClause}");
    } catch (\Throwable $e) {
      $this->json([], '编辑列失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_column_edit', [
      'database' => $database, 'table' => $table, 'column' => $column, 'definition' => $definition,
    ]);
    $this->json(['database' => $database, 'table' => $table, 'column' => $newName], '列定义已更新');
  }

  /**
   * 删除列（`ALTER TABLE ... DROP COLUMN`）。
   *
   * 主键列**后端硬禁删**：删主键会让 `writable=false`、行编辑/删除整页失效，
   * 属于不可逆的结构破坏；确要删主键先删约束（本模块不提供，走 SQL 控制台）。
   *
   * @return void
   */
  public function dbColumnDrop(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    $table = $this->tableParam();
    $this->requireTable($database, $table);
    $column = $this->validIdentifier($this->input('post.column/s', ''), '列名');
    $this->requireColumn($database, $table, $column);
    if ($this->primaryKeyOf($database, $table) === $column) {
      $this->json([], '主键列不允许删除；确需删除请先在 SQL 控制台移除主键约束', ErrorCode::PARAM_INVALID);
    }
    try {
      Db::execute("ALTER TABLE `{$database}`.`{$table}` DROP COLUMN `{$column}`");
    } catch (\Throwable $e) {
      $this->json([], '删除列失败：' . (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_column_drop', ['database' => $database, 'table' => $table, 'column' => $column]);
    $this->json(['database' => $database, 'table' => $table, 'column' => $column], '列已删除');
  }

  /**
   * 校验列存在，不存在直接以 NOT_FOUND 结束请求。
   *
   * 必须在 `requireTable()` 之后调用：`SHOW COLUMNS` 对不存在的表抛异常
   * （与 `primaryKeyOf()` 同一陷阱），表级存在性由前者兜住。
   *
   * @param string $database 数据库名。
   * @param string $table 表名。
   * @param string $column 列名。
   * @return void
   */
  private function requireColumn(string $database, string $table, string $column): void
  {
    $rows = Db::query("SHOW COLUMNS FROM `{$database}`.`{$table}` LIKE '" . Db::escape($column) . "'");
    if (!$rows) {
      $this->json([], '数据列不存在', ErrorCode::NOT_FOUND);
    }
  }

  /**
   * 导出数据库为 .sql 文本（text/plain 直出，前端包 Blob 下载）。
   *
   * @return void
   */
  public function dbExport(): void
  {
    $this->guard();
    $database = $this->databaseParam();
    if (!$this->databaseExists($database)) {
      $this->json([], '数据库不存在', ErrorCode::NOT_FOUND);
    }
    $tables = Db::query(
      'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = \''
      . Db::escape($database) . "' ORDER BY TABLE_NAME ASC"
    );
    $out = "-- KniuSystem 数据库导出\n-- 数据库：{$database}\n-- 时间：" . date('Y-m-d H:i:s') . "\n\n";
    $out .= "CREATE DATABASE IF NOT EXISTS `{$database}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n";
    $out .= "USE `{$database}`;\n\n";
    $truncated = false;
    foreach ($tables as $entry) {
      $name = $this->validIdentifier((string)$entry['TABLE_NAME'], '表名');
      $type = (string)$entry['TABLE_TYPE'];
      if ($type !== 'BASE TABLE') {
        continue;
      }
      $create = Db::query("SHOW CREATE TABLE `{$database}`.`{$name}`");
      if (!$create) {
        continue;
      }
      $createSql = (string)($create[0]['Create Table'] ?? '');
      $out .= "DROP TABLE IF EXISTS `{$name}`;\n{$createSql};\n\n";
      $total = (int)(Db::query("SELECT COUNT(*) AS total FROM `{$database}`.`{$name}`")[0]['total'] ?? 0);
      $batch = 200;
      for ($offset = 0; $offset < $total; $offset += $batch) {
        $rows = Db::query("SELECT * FROM `{$database}`.`{$name}` LIMIT {$offset}, {$batch}");
        if (!$rows) {
          continue;
        }
        $columns = array_keys($rows[0]);
        $quoted = array_map(function (mixed $column): string {
          $safe = $this->validIdentifier((string)$column, '列名');
          return "`{$safe}`";
        }, $columns);
        $values = [];
        foreach ($rows as $row) {
          $cells = [];
          foreach ($columns as $column) {
            $cells[] = $this->literal($row[$column] ?? null);
          }
          $values[] = '(' . implode(',', $cells) . ')';
        }
        $out .= 'INSERT INTO `' . $name . '` (' . implode(',', $quoted) . ") VALUES\n"
          . implode(",\n", $values) . ";\n";
        if (strlen($out) > self::MAX_SQL_BYTES) {
          $out .= "\n-- 导出已达 " . round(self::MAX_SQL_BYTES / 1048576, 1) . "MB 上限，后续数据未导出\n";
          $truncated = true;
          break 2;
        }
      }
      $out .= "\n";
    }
    $this->writeAudit('db_export', ['database' => $database, 'bytes' => strlen($out), 'truncated' => $truncated]);
    if (ob_get_level()) {
      ob_end_clean();
    }
    header('Content-Type: text/plain; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $database . '.sql"');
    echo $out;
    exit;
  }

  /**
   * 导入数据库：支持粘贴 SQL 文本或上传 .sql 文件。
   *
   * @return void
   */
  public function dbImport(): void
  {
    $this->guard();
    $sql = (string)($this->input('post.sql', ''));
    $source = '粘贴文本';
    $file = $_FILES['file'] ?? null;
    if (is_array($file) && (int)($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
      $extension = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
      if ($extension !== 'sql') {
        $this->json([], '只允许上传 .sql 文件', ErrorCode::UPLOAD_REJECTED);
      }
      if ((int)$file['size'] > self::MAX_SQL_BYTES) {
        $this->json([], 'SQL 文件超过 ' . round(self::MAX_SQL_BYTES / 1048576, 1) . 'MB 上限', ErrorCode::UPLOAD_REJECTED);
      }
      $content = @file_get_contents((string)$file['tmp_name']);
      if ($content === false || trim($content) === '') {
        $this->json([], 'SQL 文件内容为空或读取失败', ErrorCode::UPLOAD_REJECTED);
      }
      $sql = $content;
      $source = '文件 ' . (string)$file['name'];
    }
    if (trim($sql) === '') {
      $this->json([], '请粘贴 SQL 文本或选择 .sql 文件', ErrorCode::PARAM_INVALID);
    }
    if (strlen($sql) > self::MAX_SQL_BYTES) {
      $this->json([], 'SQL 内容超过 ' . round(self::MAX_SQL_BYTES / 1048576, 1) . 'MB 上限', ErrorCode::PARAM_INVALID);
    }
    $results = $this->runScript($sql, true);
    $failed = 0;
    $executed = 0;
    foreach ($results as $item) {
      if ($item['ok']) {
        $executed++;
      } else {
        $failed++;
      }
    }
    $this->writeAudit('db_import', ['source' => $source, 'executed' => $executed, 'failed' => $failed]);
    $this->json([
      'source' => $source,
      'executed' => $executed,
      'failed' => $failed,
      'results' => $results,
    ], $failed > 0 ? "导入完成，但有 {$failed} 条失败" : '导入成功');
  }

  /**
   * SQL 控制台：逐条执行并回显结果。
   *
   * @return void
   */
  public function dbQuery(): void
  {
    $this->guard();
    $sql = (string)($this->input('post.sql', ''));
    if (trim($sql) === '') {
      $this->json([], '请输入要执行的 SQL', ErrorCode::PARAM_INVALID);
    }
    if (strlen($sql) > self::MAX_SQL_BYTES) {
      $this->json([], 'SQL 内容超过 ' . round(self::MAX_SQL_BYTES / 1048576, 1) . 'MB 上限', ErrorCode::PARAM_INVALID);
    }
    $results = $this->runScript($sql, false);
    $failed = 0;
    $affected = 0;
    foreach ($results as $item) {
      if ($item['ok']) {
        $affected += (int)($item['affected'] ?? 0);
      } else {
        $failed++;
      }
    }
    $this->writeAudit('db_query', [
      'bytes' => strlen($sql),
      'statements' => count($results),
      'failed' => $failed,
    ]);
    $this->json([
      'statements' => count($results),
      'failed' => $failed,
      'affected' => $affected,
      'results' => $results,
    ], $failed > 0 ? "执行完成，有 {$failed} 条失败" : '执行完成');
  }

  /* ──────────────────────────── 数据库连接档案 ──────────────────────────── */

  /*
   * 本组四个动作**只做 `requireSuperAdmin()`，刻意不调 `guard()`**。
   *
   * 「数据库连接」页是**当前连接坏掉时的修复入口**：如果它也去接管那条坏连接，
   * 用户会被 4002 挡在自己的修复页面之外，只能去手改文件才能恢复。
   * 所以本组一律只碰**档案文件**和**请求里显式传来的参数**，绝不碰被管理的连接。
   */

  /**
   * 从请求里读一组连接参数。
   *
   * @return array<string, mixed> 可直接交给 `DbProfile::normalize()` 的输入。
   */
  private function profilePayload(): array
  {
    return [
      'name' => (string)$this->input('post.name/s', ''),
      'host' => (string)$this->input('post.host/s', ''),
      // ⚠ 整型用的是 `d` 不是 `i`（见 `Controller::convertType()`），写 `i` 会静默落回字符串。
      'port' => (int)$this->input('post.port/d', 3306),
      'username' => (string)$this->input('post.username/s', ''),
      'password' => (string)$this->input('post.password/s', ''),
      'database' => (string)$this->input('post.database/s', ''),
      'charset' => (string)$this->input('post.charset/s', 'utf8mb4'),
    ];
  }

  /**
   * 连接档案列表。
   *
   * 密码**永不下发**（只给 `has_password` 布尔位），见 `DbProfile::mask()`。
   *
   * @return void
   */
  public function dbConnectionList(): void
  {
    $this->requireSuperAdmin();
    $activeId = DbProfile::activeId();
    $this->json([
      'active' => $activeId,
      'list' => array_map(function (array $item) use ($activeId): array {
        return DbProfile::mask($item, $activeId);
      }, DbProfile::all()),
    ]);
  }

  /**
   * 新建 / 更新一条连接档案。
   *
   * 保存前**必须测通**：连不上的参数一律拒绝落库。档案是「当前连接」的候选池，
   * 放进去一条连不通的，用户点「设为当前」就把整个数据库管理打成 4002。
   *
   * 密码留空 = 沿用原值（列表从不下发密码，编辑表单里密码框天然是空的）。
   *
   * @return void
   */
  public function dbConnectionSave(): void
  {
    $this->requireSuperAdmin();
    $id = trim((string)$this->input('post.id/s', ''));
    $payload = $this->profilePayload();
    $probe = ['ok' => false, 'version' => '', 'databases' => 0, 'error' => ''];
    try {
      $existing = null;
      if ($id !== '') {
        $existing = DbProfile::find($id);
        if ($existing === null) {
          $this->json([], '连接不存在', ErrorCode::NOT_FOUND);
        }
      }
      // 用「请求参数 + 原密码」拼出完整档案再测：直接拿请求参数去测，
      // 密码留空会被当成空密码账号，把一次正常保存误判成密码错误。
      $probe = DbProfile::probe(DbProfile::normalize($payload, $existing));
      if (!$probe['ok']) {
        $this->json(['probe' => $probe], '连接测试未通过：' . $probe['error'], ErrorCode::SERVICE_UNAVAILABLE);
      }
      $profile = DbProfile::save($payload, $id);
    } catch (\InvalidArgumentException $e) {
      $this->json([], $e->getMessage(), ErrorCode::PARAM_INVALID);
    } catch (\RuntimeException $e) {
      $this->json([], $e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_connection_save', ['id' => (string)$profile['id'], 'host' => (string)$profile['host']]);
    $this->json([
      'profile' => DbProfile::mask($profile, DbProfile::activeId()),
      'probe' => $probe,
    ], '连接「' . (string)$profile['name'] . '」已保存');
  }

  /**
   * 删除一条连接档案。
   *
   * 删掉的若是当前连接，`DbProfile::remove()` 会把 active 一并清空，
   * 于是模块自动回到 `.env` 的系统连接（不会指向一个不存在的 id）。
   *
   * @return void
   */
  public function dbConnectionDelete(): void
  {
    $this->requireSuperAdmin();
    $id = trim((string)$this->input('post.id/s', ''));
    if ($id === '') {
      $this->json([], '缺少连接标识', ErrorCode::PARAM_INVALID);
    }
    if (!DbProfile::remove($id)) {
      $this->json([], '连接不存在', ErrorCode::NOT_FOUND);
    }
    $this->writeAudit('db_connection_delete', ['id' => $id]);
    $this->json(['active' => DbProfile::activeId()], '连接已删除');
  }

  /**
   * 测试连接。
   *
   * 两种用法：传 `id` 测一条**已保存**的档案；或带 `host` 等参数测**表单里还没保存**的值
   * （编辑时改了主机想先试一下，不必先存再试）。
   *
   * @return void
   */
  public function dbConnectionTest(): void
  {
    $this->requireSuperAdmin();
    $id = trim((string)$this->input('post.id/s', ''));
    $payload = $this->profilePayload();
    // 本接口**不落库**，连接名称与测试结果无关：`normalize()` 是给保存路径写的、
    // 要求名称必填，这里补一个占位名，免得「只想试试这串参数」被 2001 挡回来。
    if ($payload['name'] === '') {
      $payload['name'] = '未命名连接';
    }
    try {
      $existing = null;
      if ($id !== '') {
        $existing = DbProfile::find($id);
        if ($existing === null) {
          $this->json([], '连接不存在', ErrorCode::NOT_FOUND);
        }
      }
      // 有 id 且表单没填主机 ⇒ 纯测这条档案（「测试」按钮的默认行为）。
      $profile = ($existing !== null && $payload['host'] === '')
        ? $existing
        : DbProfile::normalize($payload, $existing);
    } catch (\InvalidArgumentException $e) {
      $this->json([], $e->getMessage(), ErrorCode::PARAM_INVALID);
    }
    $probe = DbProfile::probe($profile);
    if (!$probe['ok']) {
      $this->json(['probe' => $probe], '连接失败：' . $probe['error'], ErrorCode::SERVICE_UNAVAILABLE);
    }
    $this->json(
      ['probe' => $probe],
      "连接成功（MySQL {$probe['version']}，可见 {$probe['databases']} 个库）"
    );
  }

  /**
   * 把某条档案设为「当前连接」。
   *
   * 切换前同样必测连通性：切到一条连不通的档案，整个数据库管理立刻全线 4002。
   * `id` 传空串表示**取消接管**、回到 `.env` 的系统连接（保底逃生口）。
   *
   * @return void
   */
  public function dbConnectionActivate(): void
  {
    $this->requireSuperAdmin();
    $id = trim((string)$this->input('post.id/s', ''));
    if ($id === '') {
      try {
        DbProfile::setActive('');
      } catch (\Throwable $e) {
        $this->json([], (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
      }
      $this->writeAudit('db_connection_activate', ['id' => '']);
      $this->json(['active' => ''], '已回到系统配置的连接');
    }
    $profile = DbProfile::find($id);
    if ($profile === null) {
      $this->json([], '连接不存在', ErrorCode::NOT_FOUND);
    }
    $probe = DbProfile::probe($profile);
    if (!$probe['ok']) {
      $this->json(['probe' => $probe], '连接测试未通过，未切换：' . $probe['error'], ErrorCode::SERVICE_UNAVAILABLE);
    }
    try {
      DbProfile::setActive($id);
    } catch (\Throwable $e) {
      $this->json([], (string)$e->getMessage(), ErrorCode::SERVER_ERROR);
    }
    $this->writeAudit('db_connection_activate', ['id' => $id, 'host' => (string)$profile['host']]);
    $this->json(
      ['active' => $id, 'probe' => $probe],
      '已切换到「' . (string)$profile['name'] . '」'
    );
  }
}
