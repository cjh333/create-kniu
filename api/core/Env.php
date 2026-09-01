<?php

namespace Core;

class Env
{
  public static function load(string $file): void
  {
    if (!is_file($file) || !is_readable($file)) {
      return;
    }
    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
      return;
    }
    foreach ($lines as $line) {
      $line = trim($line);
      if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
        continue;
      }
      [$name, $value] = explode('=', $line, 2);
      $name = trim($name);
      if (!preg_match('/^[A-Z_][A-Z0-9_]*$/i', $name) || getenv($name) !== false) {
        continue;
      }
      $value = trim($value);
      if (strlen($value) >= 2) {
        $first = $value[0];
        $last = $value[strlen($value) - 1];
        if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
          $value = substr($value, 1, -1);
        }
      }
      putenv($name . '=' . $value);
      $_ENV[$name] = $value;
      $_SERVER[$name] = $value;
    }
    $processEnv = getenv('PROCESS_ENV');
    if ($processEnv !== false && getenv('APP_ENV') === false) {
      putenv('APP_ENV=' . $processEnv);
      $_ENV['APP_ENV'] = $processEnv;
      $_SERVER['APP_ENV'] = $processEnv;
    }
  }
}