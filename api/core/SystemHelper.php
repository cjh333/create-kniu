<?php

namespace Core;

class SystemHelper
{
  /**
   * 子进程兜底通道的硬超时（秒）。
   *
   * Windows 上取内存/开机时长要起 PowerShell，而它依赖 WMI（`Get-CimInstance`）。
   * WMI 在异常机器上会**无限期挂住**，`exec()` 又没有超时能力 ⇒ 一个挂住的调用会把
   * 这个 PHP 进程一直占住；这类请求攒够「池子大小」个，整站 `/api` 就会全部 504。
   * 宁可这次拿不到数（显示 Unknown），也不能让一个探针把服务拖垮。
   */
  private const SHELL_TIMEOUT_SECONDS = 4;

  private static ?string $cacheDir = null;

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
   * 获取机器物理内存总量（已安装内存）。
   *
   * 注意：这里要的是「这台机器装了多少内存」（如 32GB），**不是** PHP 的
   * `memory_limit`——那是单个 PHP 进程的上限（默认 128M），曾被误当作总内存显示。
   *
   * @return string 形如 "32GB"；读取失败返回 "Unknown"。
   */
  public static function getTotalMemory(): string
  {
    $total = self::readMemoryInfo()['total'];

    return $total > 0 ? self::formatMemory($total) : 'Unknown';
  }

  /**
   * 获取当前可用（空闲）物理内存。
   *
   * 注意：**不是** `memory_get_usage()`——那是当前 PHP 进程自己占用的内存。
   *
   * @return string 形如 "6.01GB"；读取失败返回 "Unknown"。
   */
  public static function getAvailableMemory(): string
  {
    $available = self::readMemoryInfo()['available'];

    return $available > 0 ? self::formatMemory($available) : 'Unknown';
  }

  /**
   * 获取系统已运行时长（开机至今）。
   *
   * 注意：**不是**当次请求的耗时——`sys_getloadavg()` 在 Windows 上不存在，原来的实现
   * 会退化成 `microtime(true) - REQUEST_TIME_FLOAT`，在「运行时间」一行显示成
   * 「PHP运行: 0.00s」，与标签含义完全无关（还会被子进程读取的耗时污染）。
   *
   * @return string 形如 "5天 4小时 12分"；读取失败返回 "Unknown"。
   */
  public static function getSystemUptime(): string
  {
    $seconds = self::readUptimeSeconds();

    return $seconds > 0 ? self::formatDuration($seconds) : 'Unknown';
  }

  /**
   * 「运行时间」一行的前端轮询间隔（毫秒）。
   *
   * `formatDuration()` 的显示精度是**分钟**（"5天 4小时 12分"），所以 1 分钟一取就够，
   * 不必跟着「可用内存」的高频轮询走——那是给秒级变动的量用的。
   *
   * 唯一的例外是**开机不足 1 分钟**：此时显示的是秒（"42秒"），需要按秒级跟一下，
   * 否则零头会僵在那里不动（与「可用内存被 static 冻住」是同一类观感问题）。
   *
   * @return int 毫秒。
   */
  public static function getUptimeRefreshMs(): int
  {
    return self::uptimeRefreshMsFromSeconds(self::readUptimeSeconds());
  }

  /**
   * 由「开机秒数」推导前端轮询间隔（毫秒）。
   *
   * **必须把「读取失败」与「刚开机」区分开**：`readUptimeSeconds()` 读不到时返回 0，
   * 若照 `< 60` 一并当作「开机不足 1 分钟」，故障态就会拿到**最快的**轮询频率（1 秒一次），
   * 而每次探测又要起一个可能卡死的子进程 —— 请求会以远高于服务速度的速率堆积，
   * 占满 PHP 进程并长期持住 Session 文件锁，最终整站 `/api` 全部 504。
   *
   * 因此定死一条原则：**探测失败绝不能比探测成功更频繁**。失败按最慢档兜底。
   *
   * @param int $seconds 开机至今秒数；0 表示读取失败。
   * @return int 毫秒，取值 1000 / 60000。
   */
  private static function uptimeRefreshMsFromSeconds(int $seconds): int
  {
    if ($seconds <= 0) {
      return 60000;
    }

    return $seconds < 60 ? 1000 : 60000;
  }

  /**
   * 读取开机至今的秒数，按平台分派。
   *
   * 与内存同理：**只做同一请求内的备忘**（`getSystemUptime()` 与 `getUptimeRefreshMs()`
   * 都会用到它，没备忘会在子进程兜底通道上白白多起一次 PowerShell）。
   *
   * @return int 秒数；读取失败返回 0。
   */
  private static function readUptimeSeconds(): int
  {
    static $seconds = null;
    static $secondsRequest = null;

    $requestId = (string)($_SERVER['REQUEST_TIME_FLOAT'] ?? '');
    if ($seconds !== null && $secondsRequest === $requestId) {
      return $seconds;
    }

    $seconds = self::readPlatformUptimeSeconds();
    $secondsRequest = $requestId;

    return $seconds;
  }

  /**
   * 分平台的运行时长读取（结果由 `readUptimeSeconds()` 按请求备忘）。
   *
   * @return int 秒数；读取失败返回 0。
   */
  private static function readPlatformUptimeSeconds(): int
  {
    if (PHP_OS_FAMILY === 'Windows') {
      return self::readWindowsUptimeSeconds();
    }

    if (is_readable('/proc/uptime')) {
      $raw = @file_get_contents('/proc/uptime');
      if (is_string($raw) && preg_match('/^(\d+(?:\.\d+)?)/', trim($raw), $found) === 1) {
        return (int)round((float)$found[1]);
      }
      return 0;
    }

    // macOS / BSD：kern.boottime 形如 `{ sec = 1758000000, usec = 0 } ...`。
    $lines = [];
    $status = 0;
    @exec('sysctl -n kern.boottime', $lines, $status);
    if ($status === 0 && isset($lines[0]) && preg_match('/sec\s*=\s*(\d+)/', $lines[0], $found) === 1) {
      return max(0, time() - (int)$found[1]);
    }

    return 0;
  }

  /**
   * Windows：优先 FFI 的 `GetTickCount64`（微秒级），不可用时退回 PowerShell。
   *
   * @return int 秒数；读取失败返回 0。
   */
  private static function readWindowsUptimeSeconds(): int
  {
    $library = self::windowsFfi();
    if ($library !== null) {
      try {
        // 64 位标量返回值在 64 位 PHP 上被 FFI 直接转成 int；32 位下才是对象。
        $ticks = $library->GetTickCount64();
        $milliseconds = is_object($ticks) ? (int)$ticks->cdata : (int)$ticks;
        return (int)intdiv($milliseconds, 1000);
      } catch (\Throwable $error) {
        // 落到下面的子进程兜底。
      }
    }

    if (!function_exists('exec') && !function_exists('proc_open')) {
      return 0;
    }

    $script = '[int64]((Get-Date)-(Get-CimInstance Win32_OperatingSystem).LastBootUpTime).TotalSeconds';
    $result = self::runBoundedCommand(
      [self::resolveWindowsPowerShell(), '-NoProfile', '-NonInteractive', '-Command', $script],
      self::SHELL_TIMEOUT_SECONDS
    );
    if ($result['status'] !== 0 || $result['output'] === '') {
      return 0;
    }

    $text = self::lastLine($result['output']);

    return ctype_digit($text) ? (int)$text : 0;
  }

  /**
   * 把秒数格式化为可读时长。
   *
   * @param int $seconds 秒数。
   * @return string 形如 "5天 4小时 12分" / "3小时 5分" / "42秒"。
   */
  private static function formatDuration(int $seconds): string
  {
    $days = intdiv($seconds, 86400);
    $hours = intdiv($seconds % 86400, 3600);
    $minutes = intdiv($seconds % 3600, 60);
    $rest = $seconds % 60;

    if ($days > 0) {
      return sprintf('%d天 %d小时 %d分', $days, $hours, $minutes);
    }
    if ($hours > 0) {
      return sprintf('%d小时 %d分', $hours, $minutes);
    }
    if ($minutes > 0) {
      return sprintf('%d分 %d秒', $minutes, $rest);
    }

    return sprintf('%d秒', $rest);
  }

  /**
   * 读取物理内存信息（总量 + 可用量），按平台分派。
   *
   * 「可用内存」是实时变动的指标，因此**只做同一请求内的备忘**，绝不跨请求复用旧值
   * （dev 服务器是单进程常驻，用时间窗缓存会把值冻住）。
   *
   * @return array{total:int,available:int} 字节数；读取失败时两项均为 0。
   */
  private static function readMemoryInfo(): array
  {
    static $snapshot = null;
    static $snapshotRequest = null;

    $requestId = (string)($_SERVER['REQUEST_TIME_FLOAT'] ?? '');
    if ($snapshot !== null && $snapshotRequest === $requestId) {
      return $snapshot;
    }

    if (PHP_OS_FAMILY === 'Windows') {
      $snapshot = self::readWindowsMemoryInfo();
    } elseif (is_readable('/proc/meminfo')) {
      $snapshot = self::readProcMeminfo();
    } else {
      $snapshot = self::readSysctlMemoryInfo();
    }
    $snapshotRequest = $requestId;

    return $snapshot;
  }

  /**
   * 前端刷新「可用内存」的推荐间隔（毫秒）。
   *
   * 读一次内存的代价在不同环境下差好几个数量级（FFI 约 1µs，子进程 0.5~1.5s），
   * 由后端把节奏告诉前端，免得前端写死一个对某台机器过重的间隔。
   *
   * @return int 推荐刷新间隔（毫秒）。
   */
  public static function getMemoryRefreshMs(): int
  {
    return self::isMemoryReadCheap() ? 2000 : 15000;
  }

  /**
   * 当前环境下读取内存是否足够廉价（可高频调用）。
   *
   * @return bool 廉价返回 true。
   */
  private static function isMemoryReadCheap(): bool
  {
    if (PHP_OS_FAMILY === 'Windows') {
      return self::readWindowsMemoryViaFfi()['total'] > 0;
    }

    return is_readable('/proc/meminfo');
  }

  /**
   * Windows 内存读取：优先 FFI（进程内、微秒级），不可用时退回子进程。
   *
   * 为什么必须优先 FFI：「可用内存」要实时变动，而本机实测每起一次 PowerShell
   * 子进程约 1.5s（进程创建 + PowerShell 自身启动占大头），高频刷新会把请求拖垮。
   *
   * @return array{total:int,available:int} 字节数。
   */
  private static function readWindowsMemoryInfo(): array
  {
    $viaFfi = self::readWindowsMemoryViaFfi();
    if ($viaFfi['total'] > 0) {
      return $viaFfi;
    }

    return self::readWindowsMemoryViaShell();
  }

  /**
   * Windows FFI 快通道：直调 kernel32，进程内完成（实测约 1µs/次）。
   *
   * 需要 `extension=ffi`，且 `ffi.enable` 允许在普通脚本里使用（默认 preload 对
   * `cli-server` 这类 SAPI 不生效）；未启用时静默返回 0，由调用方退回子进程方案。
   *
   * @return array{total:int,available:int} 字节数；不可用时两项均为 0。
   */
  private static function readWindowsMemoryViaFfi(): array
  {
    $empty = ['total' => 0, 'available' => 0];
    $library = self::windowsFfi();
    if ($library === null) {
      return $empty;
    }

    try {
      $installedKb = $library->new('uint64_t');
      $hasInstalled = $library->GetPhysicallyInstalledSystemMemory(\FFI::addr($installedKb)) !== 0;

      $status = $library->new('MEMORYSTATUSEX');
      $status->dwLength = \FFI::sizeof($status);
      $hasStatus = $library->GlobalMemoryStatusEx(\FFI::addr($status)) !== 0;

      return [
        'total' => $hasInstalled
          ? (int)$installedKb->cdata * 1024
          : ($hasStatus ? (int)$status->ullTotalPhys : 0),
        'available' => $hasStatus ? (int)$status->ullAvailPhys : 0
      ];
    } catch (\Throwable $error) {
      return $empty;
    }
  }

  /**
   * 取（并缓存）kernel32 的 FFI 句柄；环境不支持时返回 null。
   *
   * FFI 是可选能力（`extension=ffi` + `ffi.enable=true`），不可用时所有调用方
   * 都必须有子进程兜底，不能当成硬依赖。
   *
   * @return \FFI|null FFI 句柄。
   */
  private static function windowsFfi(): ?\FFI
  {
    static $library = false;

    if ($library === false) {
      $library = null;
      if (extension_loaded('ffi') && class_exists('FFI')) {
        try {
          $library = \FFI::cdef(self::windowsFfiDefinition(), 'kernel32.dll');
        } catch (\Throwable $error) {
          $library = null;
        }
      }
    }

    return $library;
  }

  /**
   * kernel32 相关 API 的 FFI 声明。
   *
   * - `GetPhysicallyInstalledSystemMemory`：SMBIOS 口径的**已安装**内存，32GB 机器上
   *   精确返回 32GiB（即后台要显示的「总内存大小」）。
   * - `GlobalMemoryStatusEx`：当前**可用**物理内存，与任务管理器「可用」同口径。
   * - `GetTickCount64`：系统开机至今的毫秒数（「运行时间」一行用它）。
   *
   * @return string C 声明文本。
   */
  private static function windowsFfiDefinition(): string
  {
    return 'typedef struct {'
      . 'uint32_t dwLength; uint32_t dwMemoryLoad;'
      . 'uint64_t ullTotalPhys; uint64_t ullAvailPhys;'
      . 'uint64_t ullTotalPageFile; uint64_t ullAvailPageFile;'
      . 'uint64_t ullTotalVirtual; uint64_t ullAvailVirtual;'
      . 'uint64_t ullAvailExtendedVirtual;'
      . '} MEMORYSTATUSEX;'
      . 'int GlobalMemoryStatusEx(MEMORYSTATUSEX *lpBuffer);'
      . 'int GetPhysicallyInstalledSystemMemory(uint64_t *TotalMemoryInKilobytes);'
      . 'uint64_t GetTickCount64(void);';
  }

  /**
   * Windows 慢通道：起 PowerShell 子进程取内存（FFI 不可用时的兜底）。
   *
   * 不用 `wmic`（Windows 11 24H2 起已从系统移除），也不用 COM 的 `winmgmts:`
   * （需 php_com_dotnet，本项目实测未启用、`class_exists('COM')` 为 false）。
   *
   * 总量优先取「已安装物理内存」（`Win32_PhysicalMemory` 容量求和）：32GB 机器上它
   * 精确等于 32GiB，而 `Win32_ComputerSystem.TotalPhysicalMemory` 会因硬件保留只报
   * 31.68GiB；取不到时退化为 `TotalVisibleMemorySize`。
   *
   * @return array{total:int,available:int} 字节数。
   */
  private static function readWindowsMemoryViaShell(): array
  {
    $empty = ['total' => 0, 'available' => 0];
    if (!function_exists('exec') && !function_exists('proc_open')) {
      return $empty;
    }

    $script = '$d=(Get-CimInstance Win32_PhysicalMemory|Measure-Object -Property Capacity -Sum).Sum;'
      . '$o=Get-CimInstance Win32_OperatingSystem;'
      . 'if(-not $d){$d=([int64]$o.TotalVisibleMemorySize)*1024};'
      // 必须用 PHP 单引号：PowerShell 的 $d / $o 不能被 PHP 插值吃掉。
      . '\'{0},{1}\' -f ([int64]$d),(([int64]$o.FreePhysicalMemory)*1024)';
    $result = self::runBoundedCommand(
      [self::resolveWindowsPowerShell(), '-NoProfile', '-NonInteractive', '-Command', $script],
      self::SHELL_TIMEOUT_SECONDS
    );
    if ($result['status'] !== 0 || $result['output'] === '') {
      return $empty;
    }

    $parts = explode(',', self::lastLine($result['output']));
    if (count($parts) !== 2) {
      return $empty;
    }

    return [
      'total' => (int)$parts[0],
      'available' => (int)$parts[1]
    ];
  }

  /**
   * 解析 Windows PowerShell 可执行文件路径。
   *
   * @return string 可执行文件路径；系统目录里没有时退回命令名（交给 PATH 解析）。
   */
  private static function resolveWindowsPowerShell(): string
  {
    static $shell = null;

    if ($shell !== null) {
      return $shell;
    }

    $root = getenv('SystemRoot');
    if (!is_string($root) || $root === '') {
      $root = 'C:\\Windows';
    }
    $candidate = rtrim($root, '\\/') . '\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
    $shell = is_file($candidate) ? $candidate : 'powershell';

    return $shell;
  }

  /**
   * 执行外部命令，并保证在给定时间内返回（超时即杀掉子进程）。
   *
   * 命令用**数组形式**传入（PHP 7.4+ 支持）：不经 `cmd.exe` 中转，参数由 PHP 逐项
   * 加引号，既能正确处理带空格的路径，又让 `proc_terminate()` 直接杀掉目标进程 ——
   * 走字符串形式时杀掉的只是 `cmd.exe`，真正的 `powershell.exe` 会变成孤儿继续跑。
   *
   * @param string|array<int,string> $command 命令与参数。
   * @param float $timeoutSeconds 硬超时（秒）。
   * @return array{status:int,output:string} 退出码与标准输出；超时或无法执行时 status 为 -1。
   */
  private static function runBoundedCommand(string|array $command, float $timeoutSeconds): array
  {
    if (!function_exists('proc_open')) {
      return self::runUnboundedCommand($command);
    }

    // 输出走临时文件而不是管道：**Windows 的管道不支持非阻塞读**，
    // `stream_get_contents()` 会一直阻塞到子进程退出 —— 那样下面的超时判定根本没机会执行
    // （实测：写 30 秒的命令会真的等满 30 秒，硬超时形同虚设）。
    $stdoutFile = @tempnam(sys_get_temp_dir(), 'kniu_proc_out_');
    $stderrFile = @tempnam(sys_get_temp_dir(), 'kniu_proc_err_');
    if ($stdoutFile === false || $stderrFile === false) {
      if (is_string($stdoutFile) && $stdoutFile !== '') {
        @unlink($stdoutFile);
      }
      if (is_string($stderrFile) && $stderrFile !== '') {
        @unlink($stderrFile);
      }
      return self::runUnboundedCommand($command);
    }

    $descriptors = [1 => ['file', $stdoutFile, 'w'], 2 => ['file', $stderrFile, 'w']];
    $pipes = [];
    $process = @proc_open($command, $descriptors, $pipes);
    if (!is_resource($process)) {
      @unlink($stdoutFile);
      @unlink($stderrFile);
      return self::runUnboundedCommand($command);
    }

    $exitCode = -1;
    $deadline = microtime(true) + $timeoutSeconds;

    while (true) {
      $status = proc_get_status($process);
      if (!$status['running']) {
        $exitCode = (int)$status['exitcode'];
        break;
      }

      if (microtime(true) >= $deadline) {
        self::terminateProcess($process, $status);
        break;
      }

      usleep(20000);
    }

    @proc_close($process);
    $output = (string)@file_get_contents($stdoutFile);
    @unlink($stdoutFile);
    @unlink($stderrFile);

    if ($exitCode < 0) {
      return ['status' => -1, 'output' => ''];
    }

    return ['status' => $exitCode, 'output' => $output];
  }

  /**
   * 强杀子进程**树**。
   *
   * Windows 上命令经 `cmd.exe` 中转，`proc_terminate()` 只杀得掉最外层那个 `cmd.exe`；
   * 真正卡在 WMI 里的 `powershell.exe` 会变成孤儿继续常驻 —— 每 15 秒超时一次就积一个，
   * 所以必须先用 `taskkill /T` 连子树一起杀。
   *
   * @param resource $process `proc_open()` 返回的进程资源。
   * @param array<string,mixed> $status 最近的 `proc_get_status()` 结果。
   * @return void
   */
  private static function terminateProcess($process, array $status): void
  {
    if (PHP_OS_FAMILY === 'Windows' && !empty($status['pid']) && function_exists('exec')) {
      @exec('taskkill /F /T /PID ' . (int)$status['pid'], $killedLines, $killedCode);
    }

    @proc_terminate($process, 9);
  }

  /**
   * 无 `proc_open()` 时的退路：退回 `exec()`（**没有超时能力**，仅在极老环境兜底）。
   *
   * @param string|array<int,string> $command 命令与参数。
   * @return array{status:int,output:string} 退出码与标准输出。
   */
  private static function runUnboundedCommand(string|array $command): array
  {
    if (!function_exists('exec')) {
      return ['status' => -1, 'output' => ''];
    }

    if (is_array($command)) {
      $parts = [];
      foreach ($command as $part) {
        $part = (string)$part;
        $parts[] = str_contains($part, ' ') ? '"' . $part . '"' : $part;
      }
      $command = implode(' ', $parts);
    }

    $lines = [];
    $status = 0;
    @exec($command, $lines, $status);

    return ['status' => $status, 'output' => implode("\n", $lines)];
  }

  /**
   * 取多行输出的最后一行（PowerShell 可能有版本横幅等额外输出）。
   *
   * @param string $output 完整标准输出。
   * @return string 最后一行的去空白内容。
   */
  private static function lastLine(string $output): string
  {
    $lines = preg_split('/\R/', trim($output)) ?: [];
    $lines = array_values(array_filter($lines, static function (string $line): bool {
      return trim($line) !== '';
    }));

    return $lines === [] ? '' : trim((string)end($lines));
  }

  /**
   * Linux：解析 /proc/meminfo。
   *
   * @return array{total:int,available:int} 字节数。
   */
  private static function readProcMeminfo(): array
  {
    $empty = ['total' => 0, 'available' => 0];
    $raw = @file_get_contents('/proc/meminfo');
    if (!is_string($raw) || $raw === '') {
      return $empty;
    }

    $values = ['MemTotal' => 0, 'MemAvailable' => 0, 'MemFree' => 0, 'Buffers' => 0, 'Cached' => 0];
    foreach (preg_split('/\R/', $raw) as $line) {
      if (preg_match('/^(MemTotal|MemAvailable|MemFree|Buffers|Cached):\s+(\d+)\s*kB/', $line, $found) === 1) {
        $values[$found[1]] = (int)$found[2] * 1024;
      }
    }

    // MemAvailable 由内核 3.14+ 提供；老内核退化为「空闲 + 缓冲 + 缓存」。
    $available = $values['MemAvailable'] > 0
      ? $values['MemAvailable']
      : $values['MemFree'] + $values['Buffers'] + $values['Cached'];

    return ['total' => $values['MemTotal'], 'available' => $available];
  }

  /**
   * macOS / BSD：sysctl 取总量、vm_stat 取可用量。
   *
   * @return array{total:int,available:int} 字节数。
   */
  private static function readSysctlMemoryInfo(): array
  {
    $empty = ['total' => 0, 'available' => 0];
    if (!function_exists('exec')) {
      return $empty;
    }

    $total = 0;
    $lines = [];
    $status = 0;
    @exec('sysctl -n hw.memsize', $lines, $status);
    if ($status === 0 && isset($lines[0]) && ctype_digit(trim($lines[0]))) {
      $total = (int)trim($lines[0]);
    }

    // vm_stat 首行给出页尺寸，可用量 = free + inactive + speculative 页数之和。
    $available = 0;
    $vmLines = [];
    $vmStatus = 0;
    @exec('vm_stat', $vmLines, $vmStatus);
    if ($vmStatus === 0 && $vmLines) {
      $pageSize = 4096;
      if (preg_match('/page size of (\d+) bytes/i', $vmLines[0], $found) === 1) {
        $pageSize = (int)$found[1];
      }
      $pages = 0;
      foreach ($vmLines as $line) {
        if (preg_match('/^Pages (free|inactive|speculative):\s+(\d+)/', $line, $found) === 1) {
          $pages += (int)$found[2];
        }
      }
      $available = $pages * $pageSize;
    }

    return ['total' => $total, 'available' => $available];
  }

  /**
   * 把字节数格式化为紧凑内存字符串：不带空格、不留 ".00" 尾巴。
   *
   * @param int $bytes 字节数。
   * @return string 形如 "32GB"、"6.01GB"、"512MB"。
   */
  private static function formatMemory(int $bytes): string
  {
    $units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    $value = (float)max($bytes, 0);
    $power = 0;
    while ($value >= 1024 && $power < count($units) - 1) {
      $value /= 1024;
      $power++;
    }

    if ($power === 0) {
      return (string)(int)$value . $units[$power];
    }

    $text = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');

    return $text . $units[$power];
  }
}
