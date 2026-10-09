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
  mkdir($sessionPath, 0700, true);
}
// 会话文件仅运行用户可读写；对旧目录（历史上以 0777 创建）也收权
@chmod($sessionPath, 0700);
session_save_path($sessionPath);
// 严格模式：拒绝客户端携带的未初始化会话 ID，防会话固定/投毒
ini_set('session.use_strict_mode', '1');
session_name(SessionName::resolve(getenv('SESSION_NAME') ?: null, $sessionPath));
$authConfig = require __DIR__ . '/config/auth.php';
$loginExpireSeconds = max(1, (int)($authConfig['LOGIN_EXPIRE_DAYS'] ?? 7)) * 86400;
ini_set('session.gc_maxlifetime', (string)$loginExpireSeconds);
// 反向代理与 TLS 终结使 $_SERVER['HTTPS'] 恒为空，需从代理头判断浏览器真实协议。
$cfVisitor = json_decode($_SERVER['HTTP_CF_VISITOR'] ?? '', true);
$forwardedProto = strtolower(trim(explode(',', $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')[0]));
$isSecureRequest = !empty($_SERVER['HTTPS'])
  || (is_array($cfVisitor) && ($cfVisitor['scheme'] ?? '') === 'https')
  || $forwardedProto === 'https';
session_set_cookie_params(['lifetime' => $loginExpireSeconds, 'path' => '/', 'secure' => $isSecureRequest, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

// 加载应用配置。
$appConfig = require __DIR__ . '/config/app.php';

// 加载日志配置。
$loggerConfig = require __DIR__ . '/config/log.php';

// 设置时区。
date_default_timezone_set($appConfig['TIMEZONE']);

// 添加 CORS 头。
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
// 反向代理与 TLS 终结会改变协议，同源校验只比对主机名，忽略 http/https 与端口差异。
$originHost = ($origin === '') ? '' : strtolower((string) parse_url($origin, PHP_URL_HOST));
$serverHost = strtolower((string) preg_replace('/:\d+$/', '', $host));
$isTrustedOrigin = ($origin === '' || ($originHost !== '' && $originHost === $serverHost));
if ($isTrustedOrigin) header('Access-Control-Allow-Origin: ' . ($origin ?: ('http://' . $host)));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && !$isTrustedOrigin) {
  http_response_code(403);
  echo json_encode(['status' => 0, 'msg' => 'CSRF来源校验失败', 'data' => null], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  exit;
}

// 日志记录函数。
function logMessage(array $config, string $level, string $message): void
{
  // 检查日志是否启用。
  if (!$config['ENABLE']) {
    return;
  }

  // 检查日志级别。
  $levels = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
  // 如果当前级别低于配置的级别，不记录。
  if (array_search($level, $levels) < array_search($config['LEVEL'], $levels)) {
    return;
  }

  // 记录日志。
  $timestamp = date('Y-m-d H:i:s');
  $logEntry = "[$timestamp] $level: $message\n";
  file_put_contents($config['FILE_PATH'], $logEntry, FILE_APPEND);
}

$uri = '';

try {
  require_once __DIR__ . DIRECTORY_SEPARATOR . 'config/router.php';

  $router = new Router();

  // 处理 PATH_INFO（兼容阿里云虚拟主机）。
  if (isset($_SERVER['PATH_INFO']) && !empty($_SERVER['PATH_INFO'])) {
    $uri = $_SERVER['PATH_INFO'];
  } else if (isset($_SERVER['ORIG_PATH_INFO']) && !empty($_SERVER['ORIG_PATH_INFO'])) {
    $uri = $_SERVER['ORIG_PATH_INFO'];
  } else if (isset($_SERVER['REQUEST_URI'])) {
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

  /**
   * 日志脱敏：凭证/验证码类参数一律掩码。
   * identity_token 是前台身份凭据、code 是密码重置/邮箱验证码——明文落盘等于日志泄露即接管账号。
   */
  if (!function_exists('maskSensitiveParams')) {
    function maskSensitiveParams(array $params): array
    {
      $sensitiveKeys = [
        'password', 'old_password', 'new_password', 'confirm_password',
        'identity_token', 'token', 'access_token', 'refresh_token',
        'code', 'email_code', 'captcha', 'verify_code',
      ];
      $mask = function ($value) use (&$mask, $sensitiveKeys) {
        if (is_array($value)) {
          $out = [];
          foreach ($value as $k => $v) {
            $out[$k] = in_array(strtolower((string) $k), $sensitiveKeys, true) ? '***' : $mask($v);
          }
          return $out;
        }
        return $value;
      };
      return $mask($params);
    }
  }

  $logMessage = date('Y-m-d H:i:s') . ' Request: ' . $_SERVER['REQUEST_METHOD'] . ' ' . $uri . "\n";
  $logMessage .= ' REQUEST_URI: ' . ($_SERVER['REQUEST_URI'] ?? 'N/A') . "\n";
  $logMessage .= ' PATH_INFO: ' . ($_SERVER['PATH_INFO'] ?? 'N/A') . "\n";
  $logMessage .= ' ORIG_PATH_INFO: ' . ($_SERVER['ORIG_PATH_INFO'] ?? 'N/A') . "\n";
  $logMessage .= ' SCRIPT_NAME: ' . ($_SERVER['SCRIPT_NAME'] ?? 'N/A') . "\n";
  $logMessage .= ' CLIENT_IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'N/A') . "\n";
  $logMessage .= ' USER_AGENT: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'N/A') . "\n";

  // 记录请求参数。
  if (!empty($_GET)) {
    $logMessage .= ' GET_PARAMS: ' . json_encode(maskSensitiveParams($_GET), JSON_UNESCAPED_UNICODE) . "\n";
  }
  if (!empty($_POST)) {
    $logMessage .= ' POST_PARAMS: ' . json_encode(maskSensitiveParams($_POST), JSON_UNESCAPED_UNICODE) . "\n";
  }

  logMessage($loggerConfig, 'info', $logMessage);

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
  logMessage($loggerConfig, 'info', $responseLog);
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
    $errorMsg .= ' GET Params: ' . json_encode(maskSensitiveParams($_GET), JSON_UNESCAPED_UNICODE) . "\n";
  }
  if (!empty($_POST)) {
    $errorMsg .= ' POST Params: ' . json_encode(maskSensitiveParams($_POST), JSON_UNESCAPED_UNICODE) . "\n";
  }

  logMessage($loggerConfig, 'error', $errorMsg);

  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'status' => 0,
    'msg' => '服务器内部错误',
    'data' => null
  ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
