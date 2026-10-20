<?php

// SQL 控制台高危闸门回归探针（2026-10-19，C-M2/C3-M1）：注释剥离后判定，
// 防空块注释插词、-- / # 行注释绕过、版本注释分隔符紧贴关键词（/*!50000 OUTFILE*/）
// 与 --+换行形态绕过（C3-M1）。
// 运行：php test/probe_sql_gate.php（纯静态函数，无需框架引导与数据库连接）。

use App\Admin\Controllers\DatabaseController;

spl_autoload_register(function (string $class): void {
  $map = [
    'App\\Admin\\Controllers\\' => __DIR__ . '/../api/app/admin/Controllers/',
    'Core\\' => __DIR__ . '/../api/core/',
  ];
  foreach ($map as $prefix => $dir) {
    if (str_starts_with($class, $prefix)) {
      $file = $dir . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
      if (is_file($file)) {
        require $file;
      }
      return;
    }
  }
});

// [payload, 期望拦截文案包含的关键字]
$blockedCases = [
  ["SELECT LOAD_FILE('/etc/passwd')", 'LOAD_FILE'],
  // 单记号被注释打断后 MySQL 侧是语法错误（无执行面），闸门从宽一并拦截。
  ["SELECT LOAD/**/_FILE('/etc/passwd')", 'LOAD_FILE'],
  ["SELECT LOAD  _FILE('/etc/passwd')", 'LOAD_FILE'],
  // INTO 与 OUTFILE 是两个独立关键词，注释/行注释分隔后 MySQL 照常执行——真实绕过面。
  ["SELECT * FROM t INTO/**/OUTFILE '/tmp/x'", 'OUTFILE'],
  ["SELECT * FROM t INTO -- c\nOUTFILE '/tmp/x'", 'OUTFILE'],
  ["SELECT * FROM t INTO #c\nOUTFILE '/tmp/x'", 'OUTFILE'],
  // 执行型注释内容会被 MySQL 执行，必须保持可见。
  ["/*!50000 SELECT * FROM t INTO OUTFILE '/tmp/x' */", 'OUTFILE'],
  // C3-M1 回归：版本注释只剥分隔符——分隔符紧贴关键词的形态必须拦截。
  ["SELECT * FROM t INTO/*!50000 OUTFILE*/ '/tmp/x'", 'OUTFILE'],
  ["SELECT * FROM t/*!50000INTO*/ OUTFILE '/tmp/x'", 'OUTFILE'],
  ["SELECT * FROM t INTO/*!*/OUTFILE '/tmp/x'", 'OUTFILE'],
  // C3-M1 回归：-- 后直接接换行同样开启行注释（MySQL 手册口径）。
  ["SELECT * FROM t INTO--\nOUTFILE '/tmp/x'", 'OUTFILE'],
  ["SELECT * FROM t INTO --\nOUTFILE '/tmp/x'", 'OUTFILE'],
  // 版本注释包裹 LOAD_FILE：内容被执行，必须保持可见（重构前已能捕获，防误杀回归）。
  ["/*!50000 SELECT LOAD_FILE('/etc/passwd') */", 'LOAD_FILE'],
  ["SELECT/*!50000*/LOAD_FILE('/etc/passwd')", 'LOAD_FILE'],
  ["SHUTDOWN", 'SHUTDOWN'],
  ["KILL QUERY 5", 'KILL'],
  // 字符串字面量在剥离后仍整体参与扫描（既有从宽口径，防字面量藏毒）。
  ["SELECT * FROM t WHERE note = 'INTO OUTFILE 示例'", 'OUTFILE'],
];

$safeCases = [
  'SELECT * FROM tb_article WHERE id = 1',
  'SELECT COUNT(*) FROM tb_comment',
  // 字符串内的 --/# 会触发行注释剥离，但剩余文本不含高危关键词，不应误拦。
  "UPDATE tb_role SET nickname = 'a -- b # c' WHERE id = 1",
  'INSERT INTO tb_nav (name) VALUES (\'top\')',
  // mysqldump 常见版本注释头：不含高危关键词，不应误拦。
  "/*!40101 SET NAMES utf8mb4 */",
  "/*!50503 SET character_set_client = utf8mb4 */",
];

$pass = 0;
$fail = [];
$total = count($blockedCases) + count($safeCases);

foreach ($blockedCases as $i => [$sql, $expect]) {
  $reason = DatabaseController::sqlHighRiskReason($sql);
  if ($reason !== null && str_contains($reason, $expect)) {
    $pass++;
  } else {
    $fail[] = sprintf('blocked#%d 未按预期拦截（期望含 %s，实际 %s）: %s', $i, $expect, var_export($reason, true), $sql);
  }
}
foreach ($safeCases as $i => $sql) {
  $reason = DatabaseController::sqlHighRiskReason($sql);
  if ($reason === null) {
    $pass++;
  } else {
    $fail[] = sprintf('safe#%d 被误拦（%s）: %s', $i, $reason, $sql);
  }
}

if ($fail) {
  echo 'FAILED: ' . count($fail) . '/' . $total . PHP_EOL;
  foreach ($fail as $line) {
    echo '  - ' . $line . PHP_EOL;
  }
  exit(1);
}
echo "PASS {$pass}/{$total}" . PHP_EOL;
