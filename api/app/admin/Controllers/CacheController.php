<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\SystemHelper;

class CacheController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  // 清除缓存。
  public function clearCache(): void
  {
    $result = SystemHelper::clearCache();

    if (!$result['success']) {
      $this->json([], $result['message'], 0);
      return;
    }

    $this->json([
      'cleared_files' => $result['cleared_files'],
      'cleared_dirs' => $result['cleared_dirs']
    ], $result['message'], 1);
  }

  public function getCacheStats(): void
  {
    $stats = SystemHelper::getCacheStats();
    $this->json($stats);
  }
}
