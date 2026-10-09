<?php

namespace Core;

use Core\Db;

class Controller
{
  /** @var array|null JSON 请求体缓存（解析一次，多次复用）。 */
  private $jsonBodyCache = null;

  /**
   * 返回 JSON 格式的响应数据。
   *
   * @param mixed $data 要返回的数据。
   * @param string $msg 响应消息，默认为空。
   * @param int $status 响应状态码，1 表示成功，0 表示失败。
   * @return void
   */
  protected function json($data, $msg = '', $status = ErrorCode::SUCCESS)
  {
    if (ob_get_level()) {
      ob_end_clean();
    }
    header('Content-Type: application/json;charset=utf-8');
    $hasData = !empty($data) || is_numeric($data) || is_bool($data);
    $result = [
      'status' => $status,
      'msg' => $msg ?: ($hasData ? 'success' : 'error'),
      'data' => $hasData ? $data : []
    ];
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
  }

  /**
   * 获取输入参数，支持 GET、POST、COOKIE、SERVER 等来源。
   *
   * @param string $key 参数键名，格式为 "method.param/type"，如 "post.name/s"。
   * @param mixed $default 默认值，当参数不存在时返回。
   * @return mixed 处理后的参数值。
   */
  protected function input($key, $default = null)
  {
    $parts = explode('/', $key, 2);
    $type = $parts[1] ?? 's';
    list($method, $param) = explode('.', $parts[0], 2) + [null, $parts[0]];

    $value = $this->getInputValue($method, $param);
    if ($value === null) {
      return $default;
    }

    return $this->convertType($value, $type);
  }

  /**
   * HTML 编解码规则（后端全责，前端零参与）：
   * - 增/改：写入数据库前调用 encodeFields() 对文本字段单轮转义；
   * - 查：查询结果返回前端前调用 decodeFields() 对文本字段单轮解码；
   * - 删：不做任何编解码处理。
   * 编码只存在于数据库内，接口进出两侧各一次，永不累积。
   *
   * 对数据数组中的指定文本字段做单轮 HTML 转义（写入数据库前调用）。
   *
   * @param array $data 待写入的数据数组。
   * @param array $fields 需要转义的字段名列表。
   * @return array 转义后的数据数组。
   */
  protected function encodeFields(array $data, array $fields): array
  {
    foreach ($fields as $field) {
      if (isset($data[$field]) && is_string($data[$field])) {
        $data[$field] = htmlspecialchars($data[$field], ENT_QUOTES);
      }
    }
    return $data;
  }

  /**
   * 对查询结果的指定文本字段做单轮 HTML 解码（返回前端前调用）。
   *
   * 兼容三种形态：单行关联数组（find 结果）、行数组（select/page 结果）、
   * null（find 未命中）——非数组原样返回。递归一层处理行数组。
   *
   * @param mixed $rows 查询结果（单行/行数组/null）。
   * @param array $fields 需要解码的字段名列表。
   * @return mixed 解码后的结果。
   */
  protected function decodeFields($rows, array $fields)
  {
    if (!is_array($rows)) {
      return $rows;
    }
    foreach ($rows as $key => $row) {
      if (is_array($row)) {
        $rows[$key] = $this->decodeFields($row, $fields);
      } elseif (is_string($row) && in_array($key, $fields, true)) {
        $rows[$key] = htmlspecialchars_decode($row, ENT_QUOTES);
      }
    }
    return $rows;
  }

  /**
   * 根据请求方法获取输入参数值。
   *
   * @param string|null $method 请求方法（get/post/cookie/server）。
   * @param string $param 参数名。
   * @return mixed|null 参数值，不存在时返回null。
   */
  private function getInputValue($method, $param)
  {
    if (!$method) {
      return $_REQUEST[$param] ?? null;
    }

    switch (strtolower($method)) {
      case 'get':
        return $_GET[$param] ?? null;
      case 'post':
        // $_POST 仅对 form-urlencoded / multipart 填充；
        // application/json 请求体需从 php://input 解析。
        if (isset($_POST[$param])) {
          return $_POST[$param];
        }
        return $this->getJsonBody()[$param] ?? null;
      case 'cookie':
        return $_COOKIE[$param] ?? null;
      case 'server':
        return $_SERVER[strtoupper($param)] ?? null;
      default:
        return $_REQUEST[$param] ?? null;
    }
  }

  /**
   * 解析 application/json 请求体（缓存结果）。
   *
   * @return array 解析后的关联数组，非 JSON 或解析失败时返回空数组。
   */
  private function getJsonBody(): array
  {
    if ($this->jsonBodyCache !== null) {
      return $this->jsonBodyCache;
    }

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') === false) {
      $this->jsonBodyCache = [];
      return $this->jsonBodyCache;
    }

    $raw = file_get_contents('php://input');
    $parsed = json_decode($raw, true);
    $this->jsonBodyCache = is_array($parsed) ? $parsed : [];
    return $this->jsonBodyCache;
  }

  /**
   * 根据类型转换参数值。
   *
   * @param mixed $value 原始参数值。
   * @param string $type 类型标识：d-整数，f-浮点数，b-布尔值，a-数组，s-字符串。
   * @return mixed 转换后的参数值。
   */
  private function convertType($value, $type)
  {
    switch (strtolower($type)) {
      case 'd':
        return (int)$value;
      case 'f':
        return (float)$value;
      case 'b':
        return (bool)$value;
      case 'a':
        return is_array($value) ? $value : explode(',', $value);
      case 's':
      default:
        return $value;
    }
  }

  /**
   * 生成并输出验证码图片。
   *
   * @return void
   */
  protected function setCaptcha(): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }

    // 构建算术验证码，答案存入会话用于后续校验。
    $captcha = $this->buildArithmeticCaptcha();
    $_SESSION['captcha'] = (string)$captcha['answer'];
    // 先提交验证码会话，再生成并输出图片，避免登录请求抢先读取旧值。
    session_write_close();

    // 硬夹取尺寸：/captcha 在免登录白名单内，用户可控的 width/height 无上限时
    // 一次 imagecreatetruecolor(超大值) 即可吃掉数 GB 内存（未登录 DoS）。
    $width = min(max($this->input('get.width/d', 90), 60), 400);
    $height = min(max($this->input('get.height/d', 30), 20), 160);
    $fontSize = min(max($this->input('get.fontSize/d', 16), 8), 48);

    $image = $this->createCaptchaImage($width, $height, $fontSize, $captcha['text']);
    $this->outputCaptchaImage($image);
  }

  /**
   * 构建算术验证码（两个数相加或相减）。
   *
   * 规则：
   * - 两个操作数尽量不相等。
   * - 减法运算时保证结果不为负数。
   * - 操作数只使用阿拉伯数字。
   * - 运算符只使用标准半角符号（+/-）。
   *
   * @return array{ text: string, answer: int } 包含算式文本和答案的数组。
   */
  private function buildArithmeticCaptcha(): array
  {
    // 从认证配置中读取验证码数字范围。
    $authConfig = require __DIR__ . '/../config/auth.php';
    $maxNumber = $authConfig['CAPTCHA_NUMBER_MAX'] ?? 20;

    // 生成两个不相等的随机操作数。
    $a = rand(1, $maxNumber);
    $b = rand(1, $maxNumber);
    while ($a === $b) {
      $b = rand(1, $maxNumber);
    }

    // 随机选择加法或减法运算符。
    $isAdd = (bool)rand(0, 1);

    // 减法时交换操作数以保证被减数不小于减数，确保结果非负。
    if (!$isAdd && $a < $b) {
      $temp = $a;
      $a = $b;
      $b = $temp;
    }

    // 使用标准半角加减符号。
    $operator = $isAdd ? '+' : '-';
    $answer = $isAdd ? ($a + $b) : ($a - $b);

    return [
      'text' => $a . ' ' . $operator . ' ' . $b . ' = ?',
      'answer' => $answer
    ];
  }

  /**
   * 创建验证码图片。
   *
   * @param int $width 图片宽度。
   * @param int $height 图片高度。
   * @param int $fontSize 字体大小。
   * @param string $code 验证码文本。
   * @return \GdImage 验证码图片资源。
   */
  private function createCaptchaImage($width, $height, $fontSize, $code)
  {
    $image = imagecreatetruecolor($width, $height);
    imagealphablending($image, false);
    imagesavealpha($image, true);

    $bgColor = $this->createBackgroundColor($image);
    $textColor = $this->createTextColor($image);

    imagefilledrectangle($image, 0, 0, $width, $height, $bgColor);
    $this->drawText($image, $width, $height, $fontSize, $code, $textColor);
    $this->addNoise($image, $width, $height, $textColor);

    return $image;
  }

  /**
   * 创建验证码背景颜色。
   *
   * @param \GdImage $image 图片资源。
   * @return int 颜色标识符。
   */
  private function createBackgroundColor($image)
  {
    $alpha = rand(30, 60);
    return imagecolorallocatealpha($image, rand(200, 255), rand(200, 255), rand(200, 255), $alpha);
  }

  /**
   * 创建验证码文本颜色。
   *
   * @param \GdImage $image 图片资源。
   * @return int 颜色标识符。
   */
  private function createTextColor($image)
  {
    return imagecolorallocate($image, rand(0, 150), rand(0, 150), rand(0, 150));
  }

  /**
   * 在验证码图片上绘制文本。
   *
   * @param \GdImage $image 图片资源。
   * @param int $width 图片宽度。
   * @param int $height 图片高度。
   * @param int $fontSize 字体大小。
   * @param string $code 验证码文本。
   * @param int $textColor 文本颜色。
   * @return void
   */
  private function drawText($image, $width, $height, $fontSize, $code, $textColor)
  {
    // 算术验证码不倾斜，保证数字清晰可读且不超出边框。
    $angle = 0;

    // 检测是否包含中文，选择合适的字体。
    $fontFile = $this->getFontForText($code);

    // 预留内边距，循环缩小字号直到文本宽高均完整放入图片。
    $padding = 8;
    $maxWidth = $width - $padding;
    $maxHeight = $height - $padding;

    $bbox = imagettfbbox($fontSize, $angle, $fontFile, $code);
    $textWidth = $bbox[2] - $bbox[0];
    $textHeight = $bbox[1] - $bbox[7];

    while (($textWidth > $maxWidth || $textHeight > $maxHeight) && $fontSize > 8) {
      $fontSize--;
      $bbox = imagettfbbox($fontSize, $angle, $fontFile, $code);
      $textWidth = $bbox[2] - $bbox[0];
      $textHeight = $bbox[1] - $bbox[7];
    }

    // 精确居中：以文本边界框中心对齐图片中心，修正左侧 bearing 偏移。
    // 显式取整，避免 PHP 8.1+ 浮点到整数的隐式转换被废弃。
    $x = (int)($width / 2 - ($bbox[0] + $bbox[4]) / 2);
    $y = (int)($height / 2 - ($bbox[1] + $bbox[5]) / 2);

    imagettftext($image, $fontSize, $angle, $x, $y, $textColor, $fontFile, $code);
    $this->addInterferenceLines($image, $width, $height, $textColor);
  }

  /**
   * 根据文本内容选择合适的字体文件。
   *
   * 当文本包含中文字符时使用中文字体，否则使用默认字体。
   *
   * @param string $text 要绘制的文本。
   * @return string 字体文件路径。
   */
  private function getFontForText(string $text): string
  {
    // 检测是否包含中文字符（Unicode 范围）。
    if (preg_match('/[\x{4e00}-\x{9fa5}]/u', $text)) {
      // 使用微软雅黑字体（Windows 系统自带）。
      $chineseFont = 'C:\\Windows\\Fonts\\msyh.ttc';
      if (file_exists($chineseFont)) {
        return $chineseFont;
      }
      // 尝试其他常见中文字体。
      $fallbackFonts = [
        'C:\\Windows\\Fonts\\simhei.ttf',
        'C:\\Windows\\Fonts\\simsun.ttc',
      ];
      foreach ($fallbackFonts as $font) {
        if (file_exists($font)) {
          return $font;
        }
      }
    }

    // 默认使用原字体。
    return __DIR__ . '/../assets/fonts/captcha.otf';
  }

  /**
   * 添加干扰线。
   *
   * @param \GdImage $image 图片资源。
   * @param int $width 图片宽度。
   * @param int $height 图片高度。
   * @param int $textColor 线条颜色。
   * @return void
   */
  private function addInterferenceLines($image, $width, $height, $textColor)
  {
    for ($i = 0; $i < 5; $i++) {
      if (rand(0, 1) === 0) {
        $this->drawStraightLine($image, $width, $height, $textColor);
      } else {
        $this->drawCurvedLine($image, $width, $height, $textColor);
      }
    }
  }

  /**
   * 绘制直线干扰线。
   *
   * @param \GdImage $image 图片资源。
   * @param int $width 图片宽度。
   * @param int $height 图片高度。
   * @param int $textColor 线条颜色。
   * @return void
   */
  private function drawStraightLine($image, $width, $height, $textColor)
  {
    $edge = rand(0, 3);
    switch ($edge) {
      case 0:
        $x1 = rand(0, $width);
        $y1 = 0;
        $x2 = rand(0, $width);
        $y2 = $height;
        break;
      case 1:
        $x1 = $width;
        $y1 = rand(0, $height);
        $x2 = 0;
        $y2 = rand(0, $height);
        break;
      case 2:
        $x1 = rand(0, $width);
        $y1 = $height;
        $x2 = rand(0, $width);
        $y2 = 0;
        break;
      default:
        $x1 = 0;
        $y1 = rand(0, $height);
        $x2 = $width;
        $y2 = rand(0, $height);
    }
    imageline($image, $x1, $y1, $x2, $y2, $textColor);
  }

  /**
   * 绘制曲线干扰线。
   *
   * @param \GdImage $image 图片资源。
   * @param int $width 图片宽度。
   * @param int $height 图片高度。
   * @param int $textColor 线条颜色。
   * @return void
   */
  private function drawCurvedLine($image, $width, $height, $textColor)
  {
    $cx = rand(0, $width);
    $cy = rand(0, $height);
    $w = rand($width / 3, $width);
    $h = rand($height / 2, $height * 2);
    $start = rand(0, 180);
    $end = min($start + rand(180, 360), 360);

    imagearc($image, $cx, $cy, $w, $h, $start, $end, $textColor);
  }

  /**
   * 添加噪点干扰。
   *
   * @param \GdImage $image 图片资源。
   * @param int $width 图片宽度。
   * @param int $height 图片高度。
   * @param int $textColor 噪点颜色。
   * @return void
   */
  private function addNoise($image, $width, $height, $textColor)
  {
    $pixelCount = $width * $height / 100;
    for ($i = 0; $i < $pixelCount; $i++) {
      imagesetpixel($image, rand(0, $width), rand(0, $height), $textColor);
    }
  }

  /**
   * 输出验证码图片。
   *
   * @param \GdImage $image 图片资源。
   * @return void
   */
  private function outputCaptchaImage($image)
  {
    if (!headers_sent()) {
      header('Content-Type: image/png');
      header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
      header('Pragma: no-cache');
      header('Expires: 0');
      header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
      ob_clean();
      imagepng($image);
    }
    if (is_resource($image) || $image instanceof \GdImage) {
      // 使用 unset 代替已弃用的 imagedestroy
      unset($image);
    }
    exit;
  }

  /**
   * 获取系统运行时间。
   *
   * @return string 系统运行时间，格式为 "X 天 X 小时 X 分钟 X 秒 X 毫秒"。
   */
  protected function getUpTime(): string
  {
    if (strtoupper(PHP_OS_FAMILY) === 'WINDOWS') {
      return $this->getWindowsUpTime();
    } else {
      return $this->getLinuxUpTime();
    }
  }

  /**
   * 获取 Windows 系统运行时间。
   *
   * @return string Windows 系统运行时间。
   */
  private function getWindowsUpTime(): string
  {
    $output = shell_exec('powershell -Command "(Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime.ToString(\"yyyy/MM/dd HH:mm:ss\")"');
    if (!$output || !trim($output)) {
      return 'N/A';
    }

    $bootTime = \DateTime::createFromFormat('Y/m/d H:i:s', trim($output));
    if (!$bootTime) {
      return 'N/A';
    }

    $currentTime = new \DateTime();
    $interval = $currentTime->diff($bootTime);
    return $interval->format('%a天%h小时%i分钟%s秒');
  }

  /**
   * 获取 Linux 系统运行时间。
   *
   * @return string Linux 系统运行时间。
   */
  private function getLinuxUpTime(): string
  {
    $uptime = shell_exec('cat /proc/uptime');
    $uptimeSeconds = (float) explode(' ', $uptime ?? '0 0')[0];
    $currentTime = new \DateTime();
    $bootTime = $currentTime->getTimestamp() - $uptimeSeconds;
    $bootTimeObj = (new \DateTime())->setTimestamp($bootTime);
    $interval = $currentTime->diff($bootTimeObj);
    return $interval->format('%a天%h小时%i分钟%s秒');
  }

  /**
   * 获取系统总内存。
   *
   * @return string 总内存大小，格式为 "X.X GB"。
   */
  protected function getTotalMemory(): string
  {
    if (strtoupper(PHP_OS_FAMILY) === 'WINDOWS') {
      return $this->getWindowsTotalMemory();
    } else {
      return $this->getLinuxTotalMemory();
    }
  }

  /**
   * 获取 Windows 系统总内存。
   *
   * @return string Windows 系统总内存。
   */
  private function getWindowsTotalMemory(): string
  {
    $output = shell_exec('powershell -Command "Get-CimInstance -ClassName Win32_ComputerSystem | Select-Object -ExpandProperty TotalPhysicalMemory"');
    if (!$output || !trim($output)) {
      return 'N/A';
    }

    $memory = (float) trim($output);
    return round($memory / (1024 ** 3), 1) . ' GB';
  }

  /**
   * 获取 Linux 系统总内存。
   *
   * @return string Linux 系统总内存。
   */
  private function getLinuxTotalMemory(): string
  {
    $output = shell_exec('cat /proc/meminfo | grep MemTotal');
    if (!preg_match('/MemTotal:\s+(\d+)\s*kB/', $output ?? '', $matches)) {
      return 'N/A';
    }

    $memory = (float) $matches[1] * 1024;
    return round($memory / (1024 ** 3), 1) . ' GB';
  }

  /**
   * 获取系统可用内存。
   *
   * @return string 可用内存大小，格式为 "X.X GB"。
   */
  protected function getAvailableMemory(): string
  {
    if (strtoupper(PHP_OS_FAMILY) === 'WINDOWS') {
      return $this->getWindowsAvailableMemory();
    } else {
      return $this->getLinuxAvailableMemory();
    }
  }

  /**
   * 获取 Windows 系统可用内存。
   *
   * @return string Windows 系统可用内存。
   */
  private function getWindowsAvailableMemory(): string
  {
    $output = shell_exec('powershell -Command "Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory"');
    if (!$output || !trim($output)) {
      return 'N/A';
    }

    $memoryKB = (float) trim($output);
    $memoryBytes = $memoryKB * 1024;
    return round($memoryBytes / (1024 ** 3), 1) . ' GB';
  }

  /**
   * 获取 Linux 系统可用内存。
   *
   * @return string Linux 系统可用内存。
   */
  private function getLinuxAvailableMemory(): string
  {
    $output = shell_exec('cat /proc/meminfo | grep MemAvailable');
    if (!preg_match('/MemAvailable:\s+(\d+)\s*kB/', $output ?? '', $matches)) {
      return 'N/A';
    }

    $memoryKB = (float) $matches[1];
    $memoryBytes = $memoryKB * 1024;
    return round($memoryBytes / (1024 ** 3), 1) . ' GB';
  }

  /**
   * 对密码进行哈希处理。
   *
   * 输出长度与数据库历史数据保持一致，使用 SHA512 完整输出即 128 个 hex 字符。
   *
   * @param string $password 原始密码。
   * @return string 哈希后的密码，格式为 "salt$hash"。
   */
  protected function hashPassword($password): string
  {
    $salt = bin2hex(random_bytes(16));
    $hash = hash_pbkdf2('sha512', $password, hex2bin($salt), 100000, 128);
    return $salt . '$' . $hash;
  }

  /**
   * 验证密码是否匹配哈希值。
   *
   * 按数据库中已存储的 hash 长度动态计算，兼容历史数据与新生成的哈希。
   *
   * @param string $password 原始密码。
   * @param string $hashedPassword 哈希后的密码。
   * @return bool 密码是否匹配。
   */
  protected function verifyPassword($password, $hashedPassword): bool
  {
    if (strpos($hashedPassword, '$') === false) {
      return false;
    }

    list($salt, $hash) = explode('$', $hashedPassword, 2);
    if (!ctype_xdigit($salt)) {
      return false;
    }

    $saltBinary = hex2bin($salt);
    $calculatedHash = hash_pbkdf2('sha512', $password, $saltBinary, 100000, strlen($hash), false);

    return hash_equals($hash, $calculatedHash);
  }

  /**
   * 渲染视图模板。
   *
   * @param string $view 视图名称。
   * @param array $data 传递给视图的数据。
   * @return string 渲染后的HTML内容。
   */
  protected function render(string $view, array $data = []): string
  {
    $viewPath = $this->getViewPath($view);
    if (!file_exists($viewPath)) {
      return "视图文件不存在: $viewPath";
    }

    extract($data);
    ob_start();
    include $viewPath;
    return ob_get_clean();
  }

  /**
   * 获取视图文件路径。
   *
   * @param string $view 视图名称。
   * @return string 视图文件完整路径。
   */
  private function getViewPath(string $view): string
  {
    $controller = str_replace('Controller', '', get_class($this));
    return $_SERVER['DOCUMENT_ROOT'] . '/views/' . $controller . '/' . $view . '.php';
  }

  /**
   * 验证 Token 是否有效。
   *
   * @return bool Token 是否有效。
   */
  protected function validateToken(): bool
  {
    if (!isset($_SESSION['admin_token'])) {
      return false;
    }

    // 检查 token 是否过期。
    if ($_SESSION['admin_token']['expire'] < time()) {
      return false;
    }

    return true;
  }

  /**
   * 全局统一登录鉴权（前台、后台、路由分发共用同一入口）。
   *
   * 前端页面守卫与后端接口鉴权必须同口径，否则会出现「前端拦住、后端放行」：
   * 已登录 = 后台会话有效（validateToken）或前台身份令牌已绑定 tb_role 账号。
   * 默认所有接口都需要登录，由 Core\Router 在调用 action 前统一执行；
   * 免登录接口在 api/config/router.php 的路由注册处显式传 false。
   *
   * @param bool $required 是否强制鉴权。true=未登录直接拦截；false=只识别身份，游客放行（返回 0）。
   * @param string $message 未登录时返回给前端的提示语。
   * @return int 当前登录身份对应的 tb_role.id；未登录且 $required=false 时返回 0。
   */
  public function requireLogin(bool $required = true, string $message = '请先登录'): int
  {
    $roleId = $this->currentLoginId();
    if ($roleId <= 0 && $required) {
      $this->rejectLogin($message);
    }
    return $roleId;
  }

  /**
   * 未登录时的拒绝响应（前台默认 HTTP 200 + 业务码 201「登录态无效」）。
   * 后台在 Core\Base 中覆盖为 HTTP 401（前端请求层据此跳转登录页）。
   */
  protected function rejectLogin(string $message, int $code = ErrorCode::UNAUTHORIZED): void
  {
    $this->json([], $message, $code);
  }

  /**
   * 当前登录身份（tb_role.id）：后台会话优先，其次前台身份令牌绑定的账号；游客返回 0。
   *
   * @param array|null $frontUser 已解析的前台身份，传入可避免重复查库。
   * @return int tb_role.id，0 表示游客。
   */
  protected function currentLoginId($frontUser = null): int
  {
    if ($this->validateToken()) {
      $sessionRoleId = $this->sessionLoginId();
      if ($sessionRoleId > 0) {
        return $sessionRoleId;
      }
    }
    if ($frontUser === null) {
      $token = $this->validIdentityToken();
      $frontUser = $token !== '' ? $this->roleByIdentityToken($token) : null;
    }
    return (int)($frontUser['role_id'] ?? 0);
  }

  /**
   * 后台会话中的账号 id（旧会话无 id 字段时按 name 回填）。
   *
   * @return int tb_role.id，无会话或解析不到时返回 0。
   */
  protected function sessionLoginId(): int
  {
    if (isset($_SESSION['admin_token']['id']) && (int)$_SESSION['admin_token']['id'] > 0) {
      return (int)$_SESSION['admin_token']['id'];
    }
    $name = (string)($_SESSION['admin_token']['name'] ?? '');
    $id = (int)(Db::name('tb_role')->where('name', '=', $name)->value('id') ?? 0);
    if ($id > 0) {
      $_SESSION['admin_token']['id'] = $id;
    }
    return $id;
  }

  /**
   * 前台身份令牌（64 位 hex）格式校验。
   *
   * @return string 合法则返回小写令牌，否则返回空串。
   */
  protected function validIdentityToken(): string
  {
    $token = strtolower(trim((string)$this->input('post.identity_token/s', '')));
    return preg_match('/^[a-f0-9]{64}$/', $token) ? $token : '';
  }

  /**
   * 按前台身份令牌取出绑定账号（统一账号模型：令牌摘要存在 tb_role）。
   *
   * @param string $token 64 位 hex 身份令牌。
   * @return array|null 账号行（含 role_id），未绑定返回 null。
   */
  protected function roleByIdentityToken(string $token)
  {
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    // 全站身份解析热点：只取业务消费的列，避免把 password 哈希读入内存。
    $role = Db::name('tb_role')
      ->field(['id', 'name', 'nickname', 'is_show', 'comment_ban', 'comment_audit', 'issue_time', 'create_time'])
      ->where('identity_token', '=', hash('sha256', $token))
      ->find();
    if (!$role) return null;
    // 统一返回 tb_role.id、name 与 nickname；昵称不得回退为用户名。
    $role['role_id'] = (int)$role['id'];
    $role['nickname'] = $role['nickname'] ?? '';
    return $role;
  }

  /**
   * 获取默认排序字段。
   *
   * @param string $table 数据库表名。
   * @return string 默认排序字段，如 "sid" 或 "id"。
   */
  protected function getDefaultSortField($table): string
  {
    // 验证表名，只允许字母、数字和下划线
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
      return 'id';
    }

    $result = Db::query("SELECT COUNT(*) as count FROM {$table} WHERE sid > 0");
    $hasValidSid = ($result[0]['count'] ?? 0) > 0;
    return $hasValidSid ? 'sid' : 'id';
  }

  /**
   * 生成关键词模糊搜索的 LIKE 匹配串。
   *
   * 关键词按入库规则编码（htmlspecialchars ENT_QUOTES）后包裹 %。
   * 搜索列均使用 utf8mb4_unicode_ci 排序规则，本身大小写不敏感，
   * 无需 LOWER() 包裹，避免函数导致索引失效。各处列表搜索共用本范式。
   *
   * @param string $keyword 原始关键词。
   * @return string 包裹 % 的匹配串，如 "%abc%"。
   */
  protected function likeEncodedPattern(string $keyword): string
  {
    return '%' . htmlspecialchars($keyword, ENT_QUOTES) . '%';
  }

  /**
   * 校验并消费算术验证码（一次一验，用过即失效）。
   *
   * 从请求的 post.gvcode 读取用户输入，与会话中 setCaptcha() 写入的答案比较；
   * 无论通过与否都会清除会话验证码，防止重放。登录/找回密码/改绑等
   * 多处共用同一校验范式，避免各自重复实现。
   *
   * @return bool 验证码是否匹配。
   */
  protected function verifyArithmeticCaptcha(): bool
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    $submitted = trim((string)$this->input('post.gvcode/s', ''));
    $expected = isset($_SESSION['captcha']) ? (string)$_SESSION['captcha'] : '';
    unset($_SESSION['captcha']);
    return $expected !== ''
      && preg_match('/^-?\d+$/', $submitted) === 1
      && (int)$submitted === (int)$expected;
  }

  /** 前后台统一使用 tb_role.id，保留方法名兼容现有调用。 */
  protected function frontUserIdByRoleId(int $roleId): int
  {
    if ($roleId <= 0) return 0;
    return (int)(Db::name('tb_role')->where('id', '=', $roleId)->value('id') ?? 0);
  }

  /**
   * 处理文件上传。
   *
   * @param array $file 上传的文件数组（$_FILES 格式）。
   * @param string $subDirKey 子目录配置键名，默认为 'article'。
   * @return string 上传成功返回文件相对路径，失败返回空字符串。
   */
  protected function uploadFile($file, $subDirKey = 'article'): string
  {
    $uploadConfig = require __DIR__ . '/../config/upload.php';

    if (!$uploadConfig['ENABLE']) {
      return '';
    }

    // 检查上传错误。
    if ($file['error'] !== UPLOAD_ERR_OK) {
      return '';
    }

    // 验证文件类型。
    $allowedTypes = $uploadConfig['ALLOWED_TYPES'];
    if (!in_array($file['type'], $allowedTypes)) {
      return '';
    }

    // 验证文件扩展名。
    $fileExtension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowedExtensions = $uploadConfig['ALLOWED_EXTENSIONS'];
    if (!in_array($fileExtension, $allowedExtensions)) {
      return '';
    }

    // 验证文件大小。
    $maxSize = $uploadConfig['MAX_SIZE'];
    if ($file['size'] > $maxSize) {
      return '';
    }

    // 验证文件内容（防止文件伪装）。
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $realMimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($realMimeType, $allowedTypes)) {
      return '';
    }

    // 获取子目录配置。
    $subdirs = $uploadConfig['SUBDIRS'];
    $subDir = $subdirs[$subDirKey] ?? 'article/';

    // 创建上传目录。
    $uploadDir = $uploadConfig['UPLOAD_PATH'] . $subDir . date('Y/m/d/');
    if (!is_dir($uploadDir)) {
      mkdir($uploadDir, 0755, true);
    }

    // 生成唯一文件名。
    $fileName = uniqid() . '.' . $fileExtension;
    $filePath = $uploadDir . $fileName;

    // 移动文件。
    if (move_uploaded_file($file['tmp_name'], $filePath)) {
      // 设置文件权限。
      chmod($filePath, 0644);

      // 返回相对路径。
      return $uploadConfig['URL_PREFIX'] . $subDir . date('Y/m/d/') . $fileName;
    }

    return '';
  }
}
