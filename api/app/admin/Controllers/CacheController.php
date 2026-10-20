<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\ErrorCode;
use Core\SystemHelper;

class CacheController extends Base
{
  public function __construct()
  {
    parent::__construct();
    // 清缓存仅超管可用。限制下沉到本控制器自身：原实现在基类按类名字符串比较，
    // 类名一经改动或复制该 ACL 会静默失效（fail-open）。
    if (!$this->isAdmin()) {
      http_response_code(403);
      echo json_encode(['status' => ErrorCode::FORBIDDEN, 'msg' => '权限不足', 'data' => null], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }

  // 清除缓存。
  public function clearCache(): void
  {
    $result = SystemHelper::clearCache();

    if (!$result['success']) {
      $this->json([], $result['message'], ErrorCode::FAIL);
      return;
    }

    $this->json([
      'cleared_files' => $result['cleared_files'],
      'cleared_dirs' => $result['cleared_dirs']
    ], $result['message'], ErrorCode::SUCCESS);
  }
}
