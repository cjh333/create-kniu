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
    // 先提交并**释放会话文件锁**，再做系统探针。
    //
    // 原因：PHP 文件会话在一次请求期间持排他锁，而后台轮询与同浏览器的前台请求**共用一个会话**
    // ⇒ 一个慢 `/system`（无 FFI 的 Windows 上要起 PowerShell，硬超时最坏约 4s）会把前台请求
    // 全部堵在锁上（现象：静态资源正常、`/api/*` 全部挂起）。
    // 鉴权与 `admin_token` 的字段补全已在 `Base::__construct()` 完成并写回，本方法之后只读
    // `$_SESSION`（读不受影响），所以这里提前关会话是安全的。
    if (session_status() === PHP_SESSION_ACTIVE) {
      session_write_close();
    }

    // 轮询意图：'memory'（秒级刷可用内存）/ 'uptime'（分钟级刷运行时间）/ 'all'（默认，全刷）。
    // 白名单归一，未知值按 'all' 处理——绝不能因为传了个没见过的 scope 就返回一份没刷新的数据。
    $scope = (string)$this->input('post.scope/s', 'all');
    if (!in_array($scope, ['memory', 'uptime'], true)) {
      $scope = 'all';
    }

    $info = $this->getSystemInfo($scope);
    $info['username'] = $_SESSION['admin_token']['name'] ?? '';
    $info['role']     = $this->mapRoleName($_SESSION['admin_token']['role'] ?? '');
    $info['role_id'] = (int)($_SESSION['admin_token']['role'] ?? 0);
    $info['role_auth'] = (int)($_SESSION['admin_token']['role_auth'] ?? 0);
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

  /**
   * 获取系统信息。
   *
   * @param string $scope 刷新范围：'memory'（只刷可用内存）/ 'uptime'（只刷运行时间）/ 'all'（全刷）。
   *                      两条轮询各有各的节奏（秒级 / 分钟级），各自只认自己的 scope，
   *                      免得高频那条每次都白算一遍分钟级的运行时间、反之亦然。
   *                      未刷新的字段取自缓存，调用方本就不看它们。
   * @return array 系统信息。
   */
  private function getSystemInfo(string $scope = 'all'): array
  {
    $cacheFile = SystemHelper::getSystemInfoCacheFile();
    $cacheTime = 30;

    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTime) {
      $cachedData = json_decode(file_get_contents($cacheFile), true);
      if ($cachedData && is_array($cachedData)) {
        return $this->refreshDynamicInfo($cachedData, $scope);
      }
    }

    $systemInfo = $this->buildSystemInfo();
    file_put_contents($cacheFile, json_encode($systemInfo));

    return $this->refreshDynamicInfo($systemInfo, $scope);
  }

  /**
   * 按 scope 刷新动态字段。
   *
   * @param array $info 基础数据（来自缓存或新构建）。
   * @param string $scope 刷新范围，取值见 getSystemInfo()。
   * @return array 刷新后的数据。
   */
  private function refreshDynamicInfo(array $info, string $scope): array
  {
    if ($scope === 'all' || $scope === 'memory') {
      $info['currentMemory'] = SystemHelper::getAvailableMemory();
      $info['memoryRefreshMs'] = SystemHelper::getMemoryRefreshMs();
    }

    if ($scope === 'all' || $scope === 'uptime') {
      // 缓存里的 uptime 最多已陈旧 $cacheTime 秒，而它只按分钟显示 ⇒ 现算，
      // 免得前端每分钟取到的仍是「上上分钟」的值。
      // 注意：**没有 FFI 的 Windows 上这次读要起 PowerShell（含硬超时最坏约 4s）**，
      // 所以配套下发的 `uptimeRefreshMs` 必须 fail-closed（读不到 → 60s，绝不能落到 1s 档）：
      // 「慢探针 + 快轮询」会把 PHP 进程与 Session 文件锁持续占满，导致整站 504。
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
      'ip' => $_SERVER['SERVER_ADDR'] ?? gethostbyname(gethostname()),
      'rootDir' => $_SERVER['DOCUMENT_ROOT'] ?? '',
      'mysqlVer' => $this->getCachedMysqlVersion(),
      'totalMemory' => SystemHelper::getTotalMemory()
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
}