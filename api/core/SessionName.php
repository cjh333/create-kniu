<?php

namespace Core;

use RuntimeException;

/**
 * 解析项目独立的 PHP Session Cookie 名。
 */
final class SessionName
{
  private const PATTERN = '/^KNIU_[A-Fa-f0-9]{48}$/';

  /**
   * 优先使用环境配置；未配置时生成一次并持久化到运行目录。
   */
  public static function resolve(?string $configured, string $runtimeDirectory): string
  {
    $configured = trim((string)$configured);
    if (self::isValid($configured)) {
      return $configured;
    }

    if (!is_dir($runtimeDirectory) && !mkdir($runtimeDirectory, 0777, true) && !is_dir($runtimeDirectory)) {
      throw new RuntimeException('Session 运行目录创建失败');
    }

    $file = rtrim($runtimeDirectory, '/\\') . DIRECTORY_SEPARATOR . 'session.name';
    $stored = is_file($file) ? trim((string)file_get_contents($file)) : '';
    if (self::isValid($stored)) {
      return $stored;
    }

    $generated = 'KNIU_' . bin2hex(random_bytes(24));
    $handle = @fopen($file, 'x');
    if ($handle !== false) {
      fwrite($handle, $generated);
      fclose($handle);
      return $generated;
    }

    $stored = is_file($file) ? trim((string)file_get_contents($file)) : '';
    if (self::isValid($stored)) {
      return $stored;
    }

    if (file_put_contents($file, $generated, LOCK_EX) === false) {
      throw new RuntimeException('Session 名称持久化失败');
    }
    return $generated;
  }

  private static function isValid(string $name): bool
  {
    return preg_match(self::PATTERN, $name) === 1;
  }
}