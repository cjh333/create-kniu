<?php

namespace Core;

class Db
{
  protected static ?\mysqli $connection = null;
  protected static ?\mysqli $managedConnection = null;

  /**
   * 接管本请求内 `Db` 的连接（传 null 表示交还系统连接）。
   *
   * @param \mysqli|null $connection 目标连接。
   * @return void
   */
  public static function useManaged(?\mysqli $connection): void
  {
    self::$managedConnection = $connection;
  }

  /**
   * 取当前被接管的连接（未接管时为 null）。
   *
   * 供「本请求内临时切回系统连接」的调用方保存现场：先取接管连接，
   * `useManaged(null)` 切回系统库做完操作，再 `useManaged($managed)` 还原。
   * 典型场景：数据库管理模块的排序档案存系统库，而当前连接已被档案接管。
   *
   * @return \mysqli|null 被接管的连接；未接管时为 null。
   */
  public static function managedConnection(): ?\mysqli
  {
    return self::$managedConnection;
  }
  /** @var string 当前操作的数据表名。 */
  protected $name;
  /** @var array 查询构造选项（field / where / order / limit 等）。 */
  protected $options = [];
  /** @var array 字段自增自减增量，形如 ['hits' => 1]。 */
  protected $increment = [];
  /** @var array JOIN 子句片段列表。 */
  protected $joins = [];

  /**
   * 连接到数据库。
   *
   * @return \mysqli 数据库连接对象。
   * @throws \Exception 数据库连接失败时抛出异常。
   */
  protected function connect()
  {
    // 已被「当前连接档案」接管时直接返回它（见 useManaged 的注释）。
    if (self::$managedConnection) {
      return self::$managedConnection;
    }
    if (!self::$connection) {
      $config = require dirname(__DIR__) . '/config/database.php';
      $host = $config['PERSISTENT'] ? 'p:' . $config['HOST'] : $config['HOST'];
      self::$connection = \mysqli_connect(
        $host,
        $config['USERNAME'],
        $config['PASSWORD'],
        $config['DATABASE']
      );

      if (!self::$connection) {
        throw new \Exception('数据库连接失败: ' . \mysqli_connect_error());
      }
      \mysqli_set_charset(self::$connection, $config['CHARSET']);
    }
    return self::$connection;
  }

  /**
   * 指定操作的表名。
   *
   * @param string $name 表名。
   * @return Db 当前实例。
   */
  public static function table($name)
  {
    $instance = new self();
    $instance->name = $name;
    return $instance;
  }

  /**
   * 指定操作的表名（与 table 方法相同）。
   *
   * @param string $name 表名。
   * @return Db 当前实例。
   */
  public static function name($name)
  {
    return self::table($name);
  }

  /**
   * 创建一个原始 SQL 表达式。
   *
   * @param string $value 原始 SQL 表达式。
   * @return object 包含原始 SQL 表达式的对象。
   */
  public static function raw($value)
  {
    return new class($value) {
      /** @var string 原始 SQL 表达式。 */
      protected $value;

      /** @param string $value 原始 SQL 表达式。 */
      public function __construct($value)
      {
        $this->value = $value;
      }
      /** @return string 原始 SQL 表达式。 */
      public function getValue()
      {
        return $this->value;
      }
    };
  }

  /**
   * 指定查询的字段。
   *
   * @param array|string $fields 字段列表，数组或逗号分隔的字符串。
   * @return Db 当前实例。
   */
  public function field($fields)
  {
    if (is_array($fields)) {
      $this->options['field'] = '`' . implode('`,`', $fields) . '`';
    } else {
      $this->options['field'] = str_replace(' ', '', $fields);
    }
    return $this;
  }

  /**
   * 添加查询条件。
   *
   * @param string|array|callable $field 字段名、条件数组或回调函数。
   * @param string|null $operator 操作符。
   * @param mixed|null $value 值。
   * @return Db 当前实例。
   */
  public function where($field, $operator = null, $value = null)
  {
    if (is_string($field) && strpos($field, ' ') !== false && $operator === null && $value === null) {
      $this->options['where'][] = $field;
    } elseif (is_array($field)) {
      foreach ($field as $key => $val) {
        if (is_array($val)) {
          $this->where($key, $val[0], $val[1]);
        } else {
          $this->where($key, '=', $val);
        }
      }
    } elseif (is_callable($field)) {
      $query = new self();
      $field($query);
      if (!empty($query->options['where'])) {
        $this->options['where'][] = '(' . implode(' AND ', $query->options['where']) . ')';
      }
    } else {
      // 当传入两参数时，默认操作符为等号。
      if ($value === null && $operator !== null) {
        $value = $operator;
        $operator = '=';
      }
      if (is_numeric($value)) {
        $this->options['where'][] = "{$field} {$operator} {$value}";
      } else {
        $this->options['where'][] = "{$field} {$operator} '" . \mysqli_real_escape_string(($this->connect()), $value) . "'";
      }
    }
    return $this;
  }

  /**
   * 添加 IN 查询条件。
   *
   * @param string $field 字段名。
   * @param array $values 值数组。
   * @return Db 当前实例。
   */
  public function whereIn($field, $values)
  {
    if (empty($values) || !is_array($values)) {
      return $this;
    }

    $escapedValues = [];
    foreach ($values as $value) {
      if (is_numeric($value)) {
        $escapedValues[] = $value;
      } else {
        $escapedValues[] = "'" . \mysqli_real_escape_string(($this->connect()), $value) . "'";
      }
    }

    $valuesString = implode(', ', $escapedValues);
    $this->options['where'][] = "{$field} IN ({$valuesString})";

    return $this;
  }

  /**
   * 转义 SQL 字符串值，供无法走 where() 链式的原始条件使用。
   *
   * 多列 OR 组合等 where() 无法表达的原始条件，必须用本方法转义后再拼接，
   * 禁止直接嵌入用户输入，与 where()/whereIn() 的转义口径保持一致。
   *
   * @param mixed $value 待转义的值。
   * @return string 已转义、可直接嵌入单引号内的值。
   */
  public static function escape($value)
  {
    $instance = new self();
    return \mysqli_real_escape_string($instance->connect(), (string)$value);
  }

  /**
   * 添加排序条件。
   *
   * @param array|string $field 排序字段，数组或字符串。
   * @param string $direction 排序方向，默认为'asc'。
   * @return Db 当前实例。
   */
  public function order($field, $direction = 'asc')
  {
    $validIdentifier = function (mixed $value) { return is_string($value) && preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $value); };
    $validDirection = function (mixed $value) { $value = strtoupper((string)$value); return in_array($value, ['ASC', 'DESC'], true) ? $value : 'ASC'; };
    if (is_array($field)) {
      $orders = [];
      foreach ($field as $key => $value) {
        if ($validIdentifier($key)) $orders[] = "`{$key}` " . $validDirection($value);
      }
      $this->options['order'] = implode(', ', $orders);
    } else {
      $this->options['order'] = $validIdentifier($field) ? "`{$field}` " . $validDirection($direction) : '`id` ASC';
    }
    return $this;
  }

  /**
   * 添加限制条件。
   *
   * @param int $offset 偏移量。
   * @param int|null $length 限制数量，默认为 null。
   * @return Db 当前实例。
   */
  public function limit($offset, $length = null)
  {
    if ($length === null) {
      $this->options['limit'] = "0, {$offset}";
    } else {
      $this->options['limit'] = "{$offset}, {$length}";
    }
    return $this;
  }

  /** 分页每页条数全局上限：与前端 changePageSize 夹取、/db_rows 的 MAX_PAGE_ROWS 同一口径。 */
  public const PAGE_ROWS_MAX = 200;

  /**
   * 夹取页码下界：0/负数/非数字统一回 1，防负偏移。
   *
   * @param mixed $page 请求传入的页码。
   * @return int
   */
  public static function clampPage($page): int
  {
    return max(1, (int)$page);
  }

  /**
   * 夹取每页条数到 [1, PAGE_ROWS_MAX]：0/''/负值统一回 1（防除零与 `LIMIT 0,-5`），
   * 超上限截到 PAGE_ROWS_MAX（与 /db_rows、前端 changePageSize 同口径）。
   *
   * @param mixed $listRows 请求传入的每页条数。
   * @return int
   */
  public static function clampPageRows($listRows): int
  {
    return max(1, min(self::PAGE_ROWS_MAX, (int)$listRows));
  }

  /**
   * 分页查询。
   *
   * @param int $page 当前页码，默认为 1。
   * @param int $listRows 每页条数，默认为 10。
   * @return array 包含数据和分页信息的数组。
   */
  public function page($page = 1, $listRows = 10)
  {
    $page = self::clampPage($page);
    $listRows = self::clampPageRows($listRows);
    $total = $this->count();
    $totalPages = ceil($total / $listRows);
    $page = max(1, min($page, $totalPages));
    $offset = ($page - 1) * $listRows;
    $this->limit($offset, $listRows);
    $data = $this->select();
    return [
      'data' => $data,
      'page_current' => (int)$page,
      'page_rows' => (int)$listRows,
      'page_total' => (int)$totalPages,
      'total' => (int)$total
    ];
  }

  /**
   * 添加关联查询。
   *
   * @param string $table 关联表名。
   * @param string $on 关联条件。
   * @param string $type 关联类型，默认为 'INNER'。
   * @return Db 当前实例。
   */
  public function join($table, $on, $type = 'INNER')
  {
    $this->joins[] = "{$type} JOIN {$table} ON {$on}";
    return $this;
  }

  /**
   * 添加分组条件。
   *
   * @param string $field 分组字段。
   * @return Db 当前实例。
   */
  public function group($field)
  {
    $this->options['group'] = $field;
    return $this;
  }

  /**
   * 添加 having 条件。
   *
   * @param string $condition having 条件。
   * @return Db 当前实例。
   */
  public function having($condition)
  {
    $this->options['having'] = $condition;
    return $this;
  }

  /**
   * 执行查询操作。
   *
   * @return array 查询结果数组。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public function select()
  {
    $fields = $this->options['field'] ?? '*';
    $sql = "SELECT {$fields} FROM {$this->name}";

    if (!empty($this->joins)) {
      $sql .= ' ' . implode(' ', $this->joins);
    }

    if (!empty($this->options['where'])) {
      $whereConditions = implode(' AND ', $this->options['where']);
      $sql .= " WHERE {$whereConditions}";
    }
    if (!empty($this->options['group'])) {
      $sql .= " GROUP BY {$this->options['group']}";
    }
    if (!empty($this->options['having'])) {
      $sql .= " HAVING {$this->options['having']}";
    }
    if (!empty($this->options['order'])) {
      $sql .= " ORDER BY {$this->options['order']}";
    }
    if (!empty($this->options['limit'])) {
      $sql .= " LIMIT {$this->options['limit']}";
    }

    $result = \mysqli_query(($this->connect()), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error(($this->connect())));
    }
    return \mysqli_fetch_all($result, \MYSQLI_ASSOC);
  }

  /**
   * 查询单条记录。
   *
   * @return array|null 查询结果，不存在时返回 null。
   */
  public function find()
  {
    $this->limit(1);
    $result = $this->select();
    return isset($result[0]) ? $result[0] : null;
  }

  /**
   * 查询单个字段值。
   *
   * @param string $field 字段名。
   * @return mixed|null 查询结果，不存在时返回 null。
   */
  public function value($field)
  {
    $this->field($field);
    $this->limit(1);
    $result = $this->select();
    return isset($result[0][$field]) ? $result[0][$field] : null;
  }

  /**
   * 查询单列数据。
   *
   * @param string $column 列名。
   * @param string|null $key 键名，默认为 null。
   * @return array 查询结果数组。
   */
  public function column($column, $key = null)
  {
    if ($key !== null) {
      $this->field([$key, $column]);
    } else {
      $this->field($column);
    }

    $result = $this->select();
    $columnData = [];

    if ($key !== null) {
      foreach ($result as $row) {
        $columnData[$row[$key]] = $row[$column];
      }
    } else {
      foreach ($result as $row) {
        $columnData[] = $row[$column];
      }
    }

    return $columnData;
  }

  /**
   * 查询记录总数。
   *
   * @return int 记录总数。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public function count()
  {
    $order = isset($this->options['order']) ? $this->options['order'] : null;

    $sql = "SELECT COUNT(*) as total FROM {$this->name}";
    if (!empty($this->options['where'])) {
      $whereConditions = implode(' AND ', $this->options['where']);
      $sql .= " WHERE {$whereConditions}";
    }
    $result = \mysqli_query(($this->connect()), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error(($this->connect())));
    }
    $row = \mysqli_fetch_assoc($result);

    if ($order !== null) {
      $this->options['order'] = $order;
    }

    return (int)$row['total'];
  }

  /**
   * 执行插入操作。
   *
   * @param array $data 插入数据。
   * @return int 插入的 ID。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public function insert($data = [])
  {
    $data = array_filter($data, function (mixed $value) {
      return $value !== null;
    });

    if (empty($data)) {
      return 0;
    }

    $fields = array_keys($data);
    $values = array_values($data);
    $placeholders = [];

    foreach ($values as $value) {
      if (is_object($value) && method_exists($value, 'getValue')) {
        $placeholders[] = $value->getValue();
      } else {
        $escapedValue = \mysqli_real_escape_string(($this->connect()), $value);
        $placeholders[] = "'{$escapedValue}'";
      }
    }

    $fieldsString = '`' . implode('`,`', $fields) . '`';
    $valuesString = implode(', ', $placeholders);

    $sql = "INSERT INTO {$this->name} ({$fieldsString}) VALUES ({$valuesString})";
    $result = \mysqli_query(($this->connect()), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error(($this->connect())));
    }
    return \mysqli_insert_id(($this->connect()));
  }

  /**
   * 批量执行插入操作。
   *
   * @param array $data 插入数据数组。
   * @return int 受影响的行数。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public function insertAll($data = [])
  {
    if (empty($data) || !is_array($data)) {
      return 0;
    }

    $data = array_filter($data, function (mixed $item) {
      return !empty($item) && is_array($item);
    });

    if (empty($data)) {
      return 0;
    }

    $fields = array_keys($data[0]);
    $valuesList = [];

    foreach ($data as $item) {
      $itemValues = [];
      foreach ($fields as $field) {
        if (isset($item[$field])) {
          $value = $item[$field];
          if (is_object($value) && method_exists($value, 'getValue')) {
            $itemValues[] = $value->getValue();
          } else {
            $escapedValue = \mysqli_real_escape_string(($this->connect()), $value);
            $itemValues[] = "'{$escapedValue}'";
          }
        } else {
          $itemValues[] = 'NULL';
        }
      }
      $valuesList[] = '(' . implode(', ', $itemValues) . ')';
    }

    $fieldsString = '`' . implode('`,`', $fields) . '`';
    $valuesString = implode(', ', $valuesList);

    $sql = "INSERT INTO {$this->name} ({$fieldsString}) VALUES {$valuesString}";
    $result = \mysqli_query(($this->connect()), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error(($this->connect())));
    }
    return \mysqli_affected_rows(($this->connect()));
  }

  /**
   * 执行更新操作。
   *
   * @param array $data 更新数据。
   * @return int 受影响的行数。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public function update($data = [])
  {
    $allowedFields = [];
    if (!empty($this->options['field'])) {
      $fieldString = str_replace(['`', ' '], '', $this->options['field']);
      $allowedFields = explode(',', $fieldString);
    }

    $data = array_filter($data, function (mixed $value) {
      return $value !== null;
    });

    $filteredData = [];
    foreach ($data as $key => $value) {
      if (!empty($allowedFields) && !in_array($key, $allowedFields)) {
        continue;
      }
      $filteredData[$key] = $value;
    }

    if (empty($filteredData) && empty($this->increment)) {
      return 0;
    }

    $set = [];
    foreach ($filteredData as $key => $value) {
      if (is_object($value) && method_exists($value, 'getValue')) {
        $set[] = "{$key} = {$value->getValue()}";
      } else {
        $escapedValue = \mysqli_real_escape_string(($this->connect()), $value);
        $set[] = "{$key} = '{$escapedValue}'";
      }
    }

    foreach ($this->increment as $field => $step) {
      $set[] = "{$field} = {$field} + {$step}";
    }
    $this->increment = [];

    $sql = "UPDATE {$this->name} SET " . implode(', ', $set);
    if (!empty($this->options['where'])) {
      $whereConditions = implode(' AND ', $this->options['where']);
      $sql .= " WHERE {$whereConditions}";
    }
    $result = \mysqli_query(($this->connect()), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error(($this->connect())));
    }
    return \mysqli_affected_rows(($this->connect()));
  }

  /**
   * 执行删除操作。
   *
   * @return int 受影响的行数。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public function delete()
  {
    $sql = "DELETE FROM {$this->name}";

    if (!empty($this->options['where'])) {
      $whereConditions = implode(' AND ', $this->options['where']);
      $sql .= " WHERE {$whereConditions}";
    }

    $result = \mysqli_query(($this->connect()), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error(($this->connect())));
    }
    return \mysqli_affected_rows(($this->connect()));
  }

  /**
   * 增加字段值。
   *
   * @param string $field 字段名。
   * @param int $step 步长，默认为 1。
   * @return Db 当前实例。
   */
  public function inc($field, $step = 1)
  {
    $this->increment[$field] = $step;
    return $this;
  }

  /**
   * 减少字段值。
   *
   * @param string $field 字段名。
   * @param int $step 步长，默认为 1。
   * @return Db 当前实例。
   */
  public function dec($field, $step = 1)
  {
    $this->increment[$field] = -$step;
    return $this;
  }

  /**
   * 执行SQL查询。
   *
   * @param string $sql SQL 语句。
   * @return array 查询结果数组。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public static function query($sql)
  {
    $instance = new self();
    $result = \mysqli_query($instance->connect(), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error($instance->connect()));
    }
    return \mysqli_fetch_all($result, \MYSQLI_ASSOC);
  }

  /**
   * 执行 SQL 语句。
   *
   * @param string $sql SQL 语句。
   * @return int 受影响的行数。
   * @throws \Exception SQL 执行失败时抛出异常。
   */
  public static function execute($sql)
  {
    $instance = new self();
    $result = \mysqli_query($instance->connect(), $sql);
    if ($result === false) {
      throw new \Exception(\mysqli_error($instance->connect()));
    }
    return \mysqli_affected_rows($instance->connect());
  }

  /**
   * 开始事务。
   *
   * @return bool 事务开始是否成功。
   */
  public static function beginTrans()
  {
    $instance = new self();
    return \mysqli_begin_transaction(($instance->connect()));
  }

  /**
   * 提交事务。
   *
   * @return bool 事务提交是否成功。
   */
  public static function commit()
  {
    $instance = new self();
    return \mysqli_commit(($instance->connect()));
  }

  /**
   * 回滚事务。
   *
   * @return bool 事务回滚是否成功。
   */
  public static function rollback()
  {
    $instance = new self();
    return \mysqli_rollback(($instance->connect()));
  }
}
