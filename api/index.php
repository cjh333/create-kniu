<?php
require_once __DIR__ . '/vendor/autoload.php';

use Core\Env;
use Core\Router;
use Core\SessionName;

Env::load(dirname(__DIR__) . '/.env');

$runtimeEnv = getenv('APP_ENV') ?: 'development';
ini_set('display_errors', $runtimeEnv === 'production' ? '0' : '1');
ini_set('log_errors', 1);
error_reporting(E_ALL);

// 指定项目内 session 存储目录，避免受全局 php.ini 的 save_path 权限影响。
$sessionPath = __DIR__ . '/runtime/session';
if (!is_dir($sessionPath)) {
  mkdir($sessionPath, 0777, true);
}
session_save_path($sessionPath);
session_name(SessionName::resolve(getenv('SESSION_NAME') ?: null, $sessionPath));
$authConfig = require __DIR__ . '/config/auth.php';
$loginExpireSeconds = max(1, (int)($authConfig['LOGIN_EXPIRE_DAYS'] ?? 7)) * 86400;
ini_set('session.gc_maxlifetime', (string)$loginExpireSeconds);
session_set_cookie_params(['lifetime' => $loginExpireSeconds, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Strict']);
session_start();

// 加载应用配置。
$appConfig = require __DIR__ . '/config/app.php';

// 加载日志配置。
$loggerConfig = require __DIR__ . '/config/log.php';

// 设置时区。
date_default_timezone_set($appConfig['TIMEZONE']);

// 添加 CORS 头。
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$hostOrigin = (!empty($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
if ($origin === '' || $origin === $hostOrigin) header('Access-Control-Allow-Origin: ' . ($origin ?: $hostOrigin));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $origin !== '' && $origin !== $hostOrigin) {
  http_response_code(403);
  echo json_encode(['status' => 0, 'msg' => 'CSRF来源校验失败', 'data' => null], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit;
}

// 日志记录函数。
function logMessage($level, $message)
{
  global $loggerConfig;

  // 检查日志是否启用。
  if (!$loggerConfig['ENABLE']) {
    return;
  }

  // 检查日志级别。
  $levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
  // 如果当前级别低于配置的级别，不记录。
  if (array_search($level, $levels) < array_search($loggerConfig['LEVEL'], $levels)) {
    return;
  }

  // 记录日志。
  $timestamp = date('Y-m-d H:i:s');
  $logEntry = "[$timestamp] $level: $message\n";
  file_put_contents($loggerConfig['FILE_PATH'], $logEntry, FILE_APPEND);
}

try {
  require_once __DIR__ . DIRECTORY_SEPARATOR . 'config/router.php';

  $router = new Router();
  $uri = '';

  // 处理 PATH_INFO（兼容阿里云虚拟主机）。
  if (isset($_SERVER['PATH_INFO']) && !empty($_SERVER['PATH_INFO'])) {
    $uri = $_SERVER['PATH_INFO'];
  } else if (isset($_SERVER['ORIG_PATH_INFO']) && !empty($_SERVER['ORIG_PATH_INFO'])) {
    // 阿里云虚拟主机有时使用 ORIG_PATH_INFO。
    $uri = $_SERVER['ORIG_PATH_INFO'];
  } else if (isset($_SERVER['REQUEST_URI'])) {
    // 直接使用 REQUEST_URI 并移除查询字符串。
    $requestUri = $_SERVER['REQUEST_URI'];
    if (($pos = strpos($requestUri, '?')) !== false) {
      $requestUri = substr($requestUri, 0, $pos);
    }

    // 移除脚本名称部分。
    $scriptName = $_SERVER['SCRIPT_NAME'];
    $scriptDir = dirname($scriptName);

    // 处理 Windows 和 Unix 路径分隔符。
    $scriptDir = str_replace('\\', '/', $scriptDir);
    $requestUri = str_replace('\\', '/', $requestUri);

    if (strpos($requestUri, $scriptDir) === 0) {
      $uri = substr($requestUri, strlen($scriptDir));
    } else {
      $uri = $requestUri;
    }
  }

  // 确保 URI 以 / 开头。
  if ($uri !== '' && $uri[0] !== '/') {
    $uri = '/' . $uri;
  }

  // 记录访问日志 - 开始时间。
  $startTime = microtime(true);
  $startMemory = memory_get_usage();

  $logMessage = date('Y-m-d H:i:s') . ' Request: ' . $_SERVER['REQUEST_METHOD'] . ' ' . $uri . "\n";
  $logMessage .= ' REQUEST_URI: ' . ($_SERVER['REQUEST_URI'] ?? 'N/A') . "\n";
  $logMessage .= ' PATH_INFO: ' . ($_SERVER['PATH_INFO'] ?? 'N/A') . "\n";
  $logMessage .= ' ORIG_PATH_INFO: ' . ($_SERVER['ORIG_PATH_INFO'] ?? 'N/A') . "\n";
  $logMessage .= ' SCRIPT_NAME: ' . ($_SERVER['SCRIPT_NAME'] ?? 'N/A') . "\n";
  $logMessage .= ' CLIENT_IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'N/A') . "\n";
  $logMessage .= ' USER_AGENT: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'N/A') . "\n";

  // 记录请求参数。
  if (!empty($_GET)) {
    $logMessage .= ' GET_PARAMS: ' . json_encode($_GET, JSON_UNESCAPED_UNICODE) . "\n";
  }
  if (!empty($_POST)) {
    // 过滤敏感信息。
    $postData = $_POST;
    if (isset($postData['password'])) {
      $postData['password'] = '***';
    }
    $logMessage .= ' POST_PARAMS: ' . json_encode($postData, JSON_UNESCAPED_UNICODE) . "\n";
  }

  logMessage('info', $logMessage);

  $router->dispatch($uri);

  // 记录响应日志。
  $endTime = microtime(true);
  $endMemory = memory_get_usage();
  $executionTime = round(($endTime - $startTime) * 1000, 2);
  $memoryUsage = round(($endMemory - $startMemory) / 1024, 2);

  $responseLog = date('Y-m-d H:i:s') . ' Response: ' . $_SERVER['REQUEST_METHOD'] . ' ' . $uri . "\n";
  $responseLog .= ' Execution Time: ' . $executionTime . ' ms\n';
  $responseLog .= ' Memory Usage: ' . $memoryUsage . ' KB\n';
  $responseLog .= ' HTTP Status: ' . (http_response_code() ?? 200) . "\n";
  logMessage('info', $responseLog);
} catch (Exception $e) {
  // 记录详细错误信息。
  $errorMsg = date('Y-m-d H:i:s') . ' ERROR: ' . $e->getMessage() . "\n";
  $errorMsg .= ' Request: ' . $_SERVER['REQUEST_METHOD'] . ' ' . $uri . "\n";
  $errorMsg .= ' Client IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'N/A') . "\n";
  $errorMsg .= ' File: ' . $e->getFile() . "\n";
  $errorMsg .= ' Line: ' . $e->getLine() . "\n";
  $errorMsg .= ' Trace: ' . $e->getTraceAsString() . "\n";

  // 记录请求参数。
  if (!empty($_GET)) {
    $errorMsg .= ' GET Params: ' . json_encode($_GET, JSON_UNESCAPED_UNICODE) . "\n";
  }
  if (!empty($_POST)) {
    $postData = $_POST;
    if (isset($postData['password'])) {
      $postData['password'] = '***';
    }
    $errorMsg .= ' POST Params: ' . json_encode($postData, JSON_UNESCAPED_UNICODE) . "\n";
  }

  logMessage('error', $errorMsg);

  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'status' => 0,
    'msg' => '服务器内部错误',
    'data' => null
  ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
