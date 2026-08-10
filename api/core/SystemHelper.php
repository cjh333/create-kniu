<?php

namespace Core;

class SystemHelper
{
  private static $cacheDir = null;

  /**
   * 获取缓存目录。
   *
   * @return string 缓存目录路径。
   */
  private static function getCacheDir(): string
  {
    if (self::$cacheDir === null) {
      self::$cacheDir = __DIR__ . '/../runtime/cache';
      if (!is_dir(self::$cacheDir)) {
        mkdir(self::$cacheDir, 0755, true);
      }
    }
    return self::$cacheDir;
  }

  /**
   * 获取系统信息缓存文件路径。
   *
   * @return string 系统信息缓存文件路径。
   */
  public static function getSystemInfoCacheFile(): string
  {
    return self::getCacheDir() . '/system_info.json';
  }

  /**
   * 格式化字节数。
   *
   * @param int $bytes 字节数。
   * @param int $precision 小数精度，默认为 2。
   * @return string 格式化后的字节数。
   */
  public static function formatBytes($bytes, $precision = 2): string
  {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
  }

  /**
   * 获取目录统计信息。
   *
   * @param string $dir 目录路径。
   * @return array 目录统计信息，包含文件数量和总大小。
   */
  public static function getDirectoryStats($dir): array
  {
    $fileCount = 0;
    $totalSize = 0;

    if (!is_dir($dir)) {
      return ['file_count' => 0, 'total_size' => 0];
    }

    $items = scandir($dir);
    foreach ($items as $item) {
      if ($item === '.' || $item === '..') {
        continue;
      }

      $path = $dir . '/' . $item;
      if (is_dir($path)) {
        $subStats = self::getDirectoryStats($path);
        $fileCount += $subStats['file_count'];
        $totalSize += $subStats['total_size'];
      } else {
        $fileCount++;
        $totalSize += filesize($path);
      }
    }

    return ['file_count' => $fileCount, 'total_size' => $totalSize];
  }

  /**
   * 删除目录。
   *
   * @param string $dir 目录路径。
   * @return bool 删除是否成功。
   */
  public static function deleteDirectory($dir): bool
  {
    if (!is_dir($dir)) {
      return false;
    }

    $items = scandir($dir);
    foreach ($items as $item) {
      if ($item === '.' || $item === '..') {
        continue;
      }

      $path = $dir . '/' . $item;
      if (is_dir($path)) {
        self::deleteDirectory($path);
      } else {
        unlink($path);
      }
    }

    return rmdir($dir);
  }

  /**
   * 清除缓存。
   *
   * @return array 缓存清除结果。
   */
  public static function clearCache(): array
  {
    $cacheDir = self::getCacheDir();

    if (!is_dir($cacheDir)) {
      return [
        'cleared_files' => 0,
        'cleared_dirs' => 0,
        'success' => false,
        'message' => '缓存目录不存在'
      ];
    }

    $clearedFiles = 0;
    $clearedDirs = 0;

    $files = glob($cacheDir . '/*');
    foreach ($files as $file) {
      if (is_file($file)) {
        if (unlink($file)) {
          $clearedFiles++;
        }
      } elseif (is_dir($file)) {
        if (self::deleteDirectory($file)) {
          $clearedDirs++;
        }
      }
    }

    return [
      'cleared_files' => $clearedFiles,
      'cleared_dirs' => $clearedDirs,
      'success' => true,
      'message' => '缓存清除成功'
    ];
  }

  /**
   * 获取缓存统计信息。
   *
   * @return array 缓存统计信息。
   */
  public static function getCacheStats(): array
  {
    $cacheDir = self::getCacheDir();

    if (!is_dir($cacheDir)) {
      return [
        'total_files' => 0,
        'total_size' => '0 B',
        'cache_dir' => $cacheDir
      ];
    }

    $stats = self::getDirectoryStats($cacheDir);

    return [
      'total_files' => $stats['file_count'],
      'total_size' => self::formatBytes($stats['total_size']),
      'cache_dir' => $cacheDir
    ];
  }

  /**
   * 获取 PHP 内存限制。
   *
   * @return string PHP 内存限制。
   */
  public static function getPhpMemoryLimit(): string
  {
    if (function_exists('ini_get')) {
      $memoryLimit = ini_get('memory_limit');
      if ($memoryLimit == '-1') {
        return 'Unlimited';
      }
      return $memoryLimit;
    }
    return 'Unknown';
  }

  /**
   * 获取PHP可用内存。
   *
   * @return string PHP 可用内存。
   */
  public static function getPhpAvailableMemory(): string
  {
    if (function_exists('memory_get_usage')) {
      $memory = memory_get_usage(true);
      return self::formatBytes($memory);
    }
    return 'Unknown';
  }
}
