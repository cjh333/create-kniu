<?php

// clientIp 受信代理回归探针（2026-10-19，C-M1）：非受信来源必须忽略 CF-Connecting-IP，
// 受信来源（仓库默认仅 loopback）才采信；头缺失/格式非法一律回 REMOTE_ADDR。
// CIDR 分支（如 Cloudflare 回源网段）随部署配置激活，仓库默认配置不含 CIDR 条目。
// 运行：php test/probe_client_ip.php（纯静态函数 + 仓库内配置，无需框架引导）。

use Core\Controller;

require __DIR__ . '/../api/core/Controller.php';

$cases = [
  // [REMOTE_ADDR, CF-Connecting-IP(或 null), 期望]
  ['203.0.113.7', '198.51.100.9', '203.0.113.7'],
  ['127.0.0.1', '198.51.100.9', '198.51.100.9'],
  ['127.0.0.1', 'not-an-ip', '127.0.0.1'],
  ['::1', '198.51.100.9', '198.51.100.9'],
  ['127.0.0.1', null, '127.0.0.1'],
];

$pass = 0;
$fail = [];
foreach ($cases as $i => [$remote, $cf, $expect]) {
  $_SERVER['REMOTE_ADDR'] = $remote;
  if ($cf === null) {
    unset($_SERVER['HTTP_CF_CONNECTING_IP']);
  } else {
    $_SERVER['HTTP_CF_CONNECTING_IP'] = $cf;
  }
  $out = Controller::clientIp();
  if ($out === $expect) {
    $pass++;
  } else {
    $fail[] = sprintf('#%d remote=%s cf=%s 期望 %s 实际 %s', $i, $remote, var_export($cf, true), $expect, $out);
  }
}
unset($_SERVER['HTTP_CF_CONNECTING_IP']);

if ($fail) {
  echo 'FAILED: ' . count($fail) . '/' . count($cases) . PHP_EOL;
  foreach ($fail as $line) {
    echo '  - ' . $line . PHP_EOL;
  }
  exit(1);
}
echo "PASS {$pass}/" . count($cases) . PHP_EOL;
