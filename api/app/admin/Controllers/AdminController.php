<?php

namespace App\Admin\Controllers;

use Core\AdminBaseController;
use Core\Db;
use Core\SystemHelper;

class AdminController extends AdminBaseController
{
  public function __construct()
  {
    parent::__construct();
  }

  // 管理员首页信息。
  public function admin(): void
  {
    $this->json([
      'welcome' => '欢迎使用后台管理系统',
      'version' => '1.0.0',
      'server_time' => date('Y-m-d H:i:s'),
      'user_count' => Db::name('tb_role')->count(),
      'article_count' => Db::name('tb_article')->count(),
      'daily_count' => Db::name('tb_daily')->count()
    ]);
  }

  // 系统信息。
  public function system(): void
  {
    $info = $this->getSystemInfo();
    $info['username'] = $_SESSION['admin_token']['name'] ?? '';
    $info['role']     = $this->mapRoleName($_SESSION['admin_token']['role'] ?? '');
    $info['role_id'] = (int)($_SESSION['admin_token']['role'] ?? 0);
    $info['role_auth'] = (int)($_SESSION['admin_token']['role_auth'] ?? 0);
    $this->json($info);
  }

  // 将角色 ID 映射为可读的角色名称。
  private function mapRoleName($roleId): string
  {
    static $roleMap = null;
    if ($roleMap === null) {
      $roleMap = require __DIR__ . '/../../../config/role.php';
    }
    $roleId = (int)$roleId;
    return $roleMap[$roleId] ?? ((string)($roleId ?: ''));
  }

  // 获取系统信息。
  private function getSystemInfo(): array
  {
    $cacheFile = SystemHelper::getSystemInfoCacheFile();
    $cacheTime = 30;

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
      $cachedData = json_decode(file_get_contents($cacheFile), true);
      if ($cachedData && is_array($cachedData)) {
        $cachedData['currentMemory'] = SystemHelper::getPhpAvailableMemory();
        $cachedData['currentTime'] = date('Y-m-d H:i:s');
        $cachedData['UTCTime'] = gmdate('Y-m-d H:i:s');
        return $cachedData;
      }
    }
    $systemInfo = $this->buildSystemInfo();
    file_put_contents($cacheFile, json_encode($systemInfo));
    return $systemInfo;
  }

  // 构建系统信息。
  private function buildSystemInfo(): array
  {
    $staticInfo = $this->getStaticSystemInfo();
    $dynamicInfo = [
      'currentMemory' => SystemHelper::getPhpAvailableMemory(),
      'currentTime' => date('Y-m-d H:i:s'),
      'UTCTime' => gmdate('Y-m-d H:i:s'),
      'uptime' => $this->getSystemUpTime()
    ];

    return array_merge($staticInfo, $dynamicInfo);
  }

  // 获取静态系统信息。
  private function getStaticSystemInfo(): array
  {
    static $staticCache = null;

    if ($staticCache !== null) {
      return $staticCache;
    }
    $staticCache = [
      'platform' => PHP_OS,
      'arch' => php_uname('m'),
      'server' => $_SERVER['SERVER_SOFTWARE'] ?? '',
      'ip' => $_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname()),
      'rootDir' => $_SERVER['DOCUMENT_ROOT'] ?? '',
      'mysqlVer' => $this->getCachedMysqlVersion(),
      'totalMemory' => SystemHelper::getPhpMemoryLimit()
    ];

    return $staticCache;
  }

  // 获取 MySQL 版本。
  private function getCachedMysqlVersion(): string
  {
    static $mysqlVersion = null;

    if ($mysqlVersion === null) {
      try {
        if (function_exists('mysqli_get_client_info')) {
          $mysqlVersion = mysqli_get_client_info();
        } else {
          $result = Db::query('SELECT VERSION() as version');
          $mysqlVersion = $result[0]['version'] ?? 'Unknown';
        }
      } catch (\Exception $e) {
        $mysqlVersion = 'Unknown';
      }
    }

    return $mysqlVersion;
  }

  // 获取运行时间。
  private function getSystemUpTime(): string
  {
    if (function_exists('sys_getloadavg')) {
      $load = sys_getloadavg();
      return sprintf('Load: %.2f, %.2f, %.2f', $load[0], $load[1], $load[2]);
    }
    $requestTime = $_SERVER['REQUEST_TIME_FLOAT'] ?? $_SERVER['REQUEST_TIME'] ?? time();
    $uptime = microtime(true) - $requestTime;
    return sprintf('PHP运行: %.2fs', $uptime);
  }
}