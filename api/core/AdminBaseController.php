<?php

namespace Core;

class AdminBaseController extends Controller
{
  /**
   * 构造函数。
   *
   * 验证用户登录状态，如果登录已失效则返回 401 错误。
   *
   * @return void
   */
  public function __construct()
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }

    if (!$this->validateToken()) {
      header('Content-Type: application/json; charset=utf-8');
      http_response_code(401);
      echo json_encode([
        'status' => 0,
        'msg' => '登录已失效，请重新登录',
        'data' => null
      ], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }
}