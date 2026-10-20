<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\SystemHelper;

class AdminController extends Base
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
    if (session_status() === PHP_SESSION_ACTIVE) {
      session_write_close();
    }
    $scope = (string)$this->input('post.scope/s', 'all');
    if (!in_array($scope, ['memory', 'uptime'], true)) {
      $scope = 'all';
    }

    $info = $this->getSystemInfo($scope);
    $info['username'] = $_SESSION['admin_token']['name'] ?? '';
    $info['role']     = $this->mapRoleName($_SESSION['admin_token']['role'] ?? '');
    $info['role_id'] = (int)($_SESSION['admin_token']['role'] ?? 0);
    $info['role_auth'] = (int)($_SESSION['admin_token']['role_auth'] ?? 0);
    // 服务器敏感面（rootDir/公网 IP/MySQL 版本/服务器软件/平台架构）仅超管（role=1）可见（m3）；
    // 非超管后台账号（role_auth=1）仍需本接口的运行态（内存/uptime/时钟）与登录身份回显，
    // 缺失字段由前端按 '—' 兜底展示，不破坏后台首页加载。
    if ((int)($_SESSION['admin_token']['role'] ?? 0) !== 1) {
      foreach (['platform', 'arch', 'server', 'ip', 'rootDir', 'mysqlVer'] as $sensitiveKey) {
        unset($info[$sensitiveKey]);
      }
    }
    $this->json($info);
  }

  /**
   * 将角色 ID 映射为可读的角色名称。
   *
   * @param int|string $roleId 角色 ID。
   */
  private function mapRoleName($roleId): string
  {
    static $roleMap = null;
    if ($roleMap === null) {
      $roleMap = require __DIR__ . '/../../../config/role.php';
    }
    $roleId = (int)$roleId;
    return $roleMap[$roleId] ?? ((string)($roleId ?: ''));
  }

  private function getSystemInfo(string $scope = 'all'): array
  {
    $cacheFile = SystemHelper::getSystemInfoCacheFile();
    $cacheTime = 30;

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
      $cachedData = json_decode(file_get_contents($cacheFile), true);
      if ($cachedData && is_array($cachedData)) {
        return $scope === 'all' ? $cachedData : $this->refreshDynamicInfo($cachedData, $scope);
      }
    }

    $systemInfo = $this->buildSystemInfo();
    file_put_contents($cacheFile, json_encode($systemInfo));
    return $scope === 'all' ? $systemInfo : $this->refreshDynamicInfo($systemInfo, $scope);
  }

  private function refreshDynamicInfo(array $info, string $scope): array
  {
    if ($scope === 'all' || $scope === 'memory') {
      $info['currentMemory'] = SystemHelper::getAvailableMemory();
      $info['memoryRefreshMs'] = SystemHelper::getMemoryRefreshMs();
    }

    if ($scope === 'all' || $scope === 'uptime') {
      $info['uptime'] = SystemHelper::getSystemUptime();
      $info['uptimeRefreshMs'] = SystemHelper::getUptimeRefreshMs();
    }

    $info['currentTime'] = date('Y-m-d H:i:s');
    $info['UTCTime'] = gmdate('Y-m-d H:i:s');

    return $info;
  }

  // 构建系统信息。
  private function buildSystemInfo(): array
  {
    $staticInfo = $this->getStaticSystemInfo();
    $dynamicInfo = [
      'currentMemory' => SystemHelper::getAvailableMemory(),
      'memoryRefreshMs' => SystemHelper::getMemoryRefreshMs(),
      'uptimeRefreshMs' => SystemHelper::getUptimeRefreshMs(),
      'currentTime' => date('Y-m-d H:i:s'),
      'UTCTime' => gmdate('Y-m-d H:i:s'),
      'uptime' => SystemHelper::getSystemUptime()
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
      'ip' => SystemHelper::getPublicIp((string)($_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname()))),
      'rootDir' => $_SERVER['DOCUMENT_ROOT'] ?? '',
      'mysqlVer' => $this->getCachedMysqlVersion(),
      'totalMemory' => SystemHelper::getTotalMemory(),
      'uploadMaxSize' => $this->getUploadMaxSize()
    ];

    return $staticCache;
  }

  /**
   * 获取上传配置中的最大文件大小，作为后台系统信息的唯一数据源。
   *
   * @return string 格式化后的最大上传文件大小。
   */
  private function getUploadMaxSize(): string
  {
    $config = require dirname(__DIR__, 3) . '/config/upload.php';
    $maxSize = is_array($config) ? (int)($config['MAX_SIZE'] ?? 0) : 0;
    return $maxSize > 0 ? SystemHelper::formatBytes($maxSize, 0) : '—';
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
}
