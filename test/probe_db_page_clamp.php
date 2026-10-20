<?php

// 分页夹取回归探针（2026-10-19，D-L1/D2-4）：page/rows 四态（0/''/负值/超上限）全收口。
// 运行：php test/probe_db_page_clamp.php（纯静态夹取函数，无需数据库连接）。

use Core\Db;

require __DIR__ . '/../api/core/Db.php';

$rowsCases = [
  // [输入, 期望]
  [1, 1], [15, 15], [200, 200], [201, 200], [5000, 200],
  [0, 1], [-5, 1], ['', 1], ['abc', 1], [null, 1], ['50', 50], [10.9, 10], [true, 1], [false, 1],
];
$pageCases = [
  [1, 1], [2, 2], [999, 999], [0, 1], [-3, 1], ['', 1], ['4', 4], [null, 1], [2.9, 2],
];

$pass = 0;
$fail = [];
$total = count($rowsCases) + count($pageCases);

foreach ($rowsCases as [$in, $expect]) {
  $out = Db::clampPageRows($in);
  if ($out === $expect) {
    $pass++;
  } else {
    $fail[] = 'clampPageRows(' . var_export($in, true) . ') 期望 ' . $expect . ' 实际 ' . var_export($out, true);
  }
}
foreach ($pageCases as [$in, $expect]) {
  $out = Db::clampPage($in);
  if ($out === $expect) {
    $pass++;
  } else {
    $fail[] = 'clampPage(' . var_export($in, true) . ') 期望 ' . $expect . ' 实际 ' . var_export($out, true);
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
