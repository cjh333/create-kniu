<?php

namespace Core;

class Router
{
  /** @var array 路由表，形如 [HTTP 方法][路径] => 'Controller@action'。 */
  private static $routes = [];
  /**
   * 免登录接口清单缓存（来自 api/config/auth.php 的 NO_AUTH）。
   * null 表示尚未加载；元素为「路径去掉前导斜杠」的接口名，如 'getDaily'。
   */
  private static ?array $noAuthList = null;
  /** @var array 控制器解析缓存，形如 [控制器类名 => 文件路径]。 */
  private static $controllerCache = [];
  /** @var string 当前请求的查询串（不含前导 ?）。 */
  private $params = '';
  /** @var bool 当前请求的路由是否需要登录鉴权（默认 true）。 */
  private $authRequired = true;

  /**
   * 添加 GET 请求路由。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @return void
   */
  public static function get($route, $params = [])
  {
    self::guardAuthParam(func_num_args(), __METHOD__);
    self::add($route, $params, 'GET');
  }

  /**
   * 添加 POST 请求路由。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @return void
   */
  public static function post($route, $params = [])
  {
    self::guardAuthParam(func_num_args(), __METHOD__);
    self::add($route, $params, 'POST');
  }

  /**
   * 添加 PUT 请求路由。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @return void
   */
  public static function put($route, $params = [])
  {
    self::guardAuthParam(func_num_args(), __METHOD__);
    self::add($route, $params, 'PUT');
  }

  /**
   * 添加 DELETE 请求路由。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @return void
   */
  public static function delete($route, $params = [])
  {
    self::guardAuthParam(func_num_args(), __METHOD__);
    self::add($route, $params, 'DELETE');
  }

  /**
   * 拒绝「路由注册第三个参数」这种旧写法。
   *
   * 免登录清单已统一收敛到 api/config/auth.php 的 NO_AUTH，注册处再传第三个参数会被 PHP
   * 静默忽略，造成「以为放行了其实没有」的假象，因此直接抛异常在注册期暴露。
   *
   * @param int $argCount 实际传入的参数个数。
   * @param string $method 调用方方法名。
   * @return void
   * @throws \InvalidArgumentException 传入第三个参数时抛出。
   */
  private static function guardAuthParam($argCount, $method)
  {
    if ($argCount > 2) {
      throw new \InvalidArgumentException(
        $method . '() 不再接受第三个参数；免登录接口请登记到 api/config/auth.php 的 NO_AUTH'
      );
    }
  }

  /**
   * 添加路由。
   *
   * 所有接口默认需要登录鉴权，免登录接口只能在 api/config/auth.php 的 NO_AUTH 中登记，
   * 由 dispatch() 统一走 Core\Controller::requireLogin() 闸门。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @param string $method HTTP方法，默认为 'GET'。
   * @return void
   * @throws \InvalidArgumentException 路由参数格式无效时抛出异常。
   */
  private static function add($route, $params = [], $method = 'GET')
  {
    $method = strtoupper($method);
    // 确保参数始终是字符串格式。
    if (is_array($params)) {
      if (isset($params[0]) && is_string($params[0])) {
        self::$routes[$method][$route] = $params[0];
      } else {
        throw new \InvalidArgumentException('Route parameters must contain a valid controller@action string');
      }
    } else {
      self::$routes[$method][$route] = (string)$params;
    }
  }

  /**
   * 免登录接口清单（api/config/auth.php 的 NO_AUTH，全局唯一来源）。
   *
   * @return array 形如 ['getDaily', 'logup', ...] 的接口名列表。
   */
  private static function noAuthList()
  {
    if (self::$noAuthList === null) {
      $authConfig = require __DIR__ . '/../config/auth.php';
      $list = $authConfig['NO_AUTH'] ?? [];
      self::$noAuthList = array_map(function (mixed $name) {
        return ltrim((string)$name, '/');
      }, is_array($list) ? $list : []);
    }
    return self::$noAuthList;
  }

  /**
   * 请求路径是否在免登录清单内。
   *
   * @param string $url 已去除 /api 前缀的请求路径，可带查询串。
   * @return bool 是否免登录。
   */
  private function isNoAuthRoute($url)
  {
    $path = explode('?', (string)$url, 2)[0];
    return in_array(ltrim($path, '/'), self::noAuthList(), true);
  }

  /**
   * 分发路由。
   *
   * @param string $url 请求 URL。
   * @return void
   */
  public function dispatch($url)
  {
    $method = $_SERVER['REQUEST_METHOD'];
    $url = $this->normalizeUrl($url);

    if (!$this->routeExists($method, $url)) {
      $this->sendRouteNotFoundError($url, $method);
      return;
    }

    $this->params = self::$routes[strtoupper($method)][$url];
    // 免登录清单来自 api/config/auth.php 的 NO_AUTH；不在清单内的一律需要登录。
    $this->authRequired = !$this->isNoAuthRoute($url);

    if (!$this->validateRouteParams()) {
      return;
    }

    $parts = explode('@', $this->params, 2);
    [$controller, $action] = $parts;
    $controller = $this->resolveControllerNamespace($controller);

    $this->executeControllerAction($controller, $action, $url);
  }

  /**
   * 验证路由参数。
   *
   * @return bool 路由参数是否有效。
   */
  private function validateRouteParams()
  {
    $method = $_SERVER['REQUEST_METHOD'];
    $url = $this->normalizeUrl($_SERVER['REQUEST_URI'] ?? '');

    if (!is_string($this->params)) {
      $this->sendErrorResponse(500, 'Route parameters must be string', [
        'params' => $this->params,
        'params_type' => gettype($this->params),
        'url' => $url,
        'method' => $method
      ]);
      return false;
    }

    if (strpos($this->params, '@') === false) {
      $this->sendErrorResponse(500, 'Invalid route parameter format', [
        'params' => $this->params,
        'url' => $url,
        'method' => $method,
        'expected_format' => 'Controller@action'
      ]);
      return false;
    }

    $parts = explode('@', $this->params, 2);
    if (count($parts) !== 2 || empty($parts[0]) || empty($parts[1])) {
      $this->sendErrorResponse(500, 'Invalid controller or action format', [
        'params' => $this->params,
        'parts' => $parts,
        'url' => $url,
        'method' => $method
      ]);
      return false;
    }

    return true;
  }

  /**
   * 规范化 URL。
   *
   * @param string $url 原始 URL。
   * @return string 规范化后的 URL。
   */
  private function normalizeUrl($url)
  {
    if (strpos($url, '/api') === 0) {
      return substr($url, 4);
    }
    return $url;
  }

  /**
   * 解析控制器命名空间。
   *
   * @param string $controllerName 控制器名称。
   * @return string 完整的控制器类名（包含命名空间）。
   */
  private function resolveControllerNamespace($controllerName)
  {
    if (isset(self::$controllerCache[$controllerName])) {
      return self::$controllerCache[$controllerName];
    }

    $controllerPath = $this->findControllerFile($controllerName);

    if ($controllerPath) {
      $namespace = $this->convertFilePathToNamespace($controllerPath, $controllerName);
      $fullClassName = $namespace . '\\' . $controllerName;
      self::$controllerCache[$controllerName] = $fullClassName;
      return $fullClassName;
    }

    $defaultClassName = 'App\\Controllers\\' . $controllerName;
    self::$controllerCache[$controllerName] = $defaultClassName;
    return $defaultClassName;
  }

  /**
   * 查找控制器文件。
   *
   * @param string $controllerName 控制器名称。
   * @return string|null 控制器文件路径，不存在时返回 null。
   */
  private function findControllerFile($controllerName)
  {
    $appDir = __DIR__ . '/../app';
    $controllerFiles = $this->scanForControllerFiles($appDir, $controllerName);

    if (count($controllerFiles) > 0) {
      return $controllerFiles[0];
    }

    return null;
  }

  /**
   * 扫描控制器文件。
   *
   * @param string $directory 扫描目录。
   * @param string $controllerName 控制器名称。
   * @return array 找到的控制器文件路径数组。
   */
  private function scanForControllerFiles($directory, $controllerName)
  {
    $foundFiles = [];

    if (!is_dir($directory)) {
      return $foundFiles;
    }

    $items = scandir($directory);

    foreach ($items as $item) {
      if ($item === '.' || $item === '..') {
        continue;
      }

      $fullPath = $directory . '/' . $item;

      if (is_dir($fullPath)) {
        $controllersDir = $fullPath . '/Controllers';

        if (is_dir($controllersDir)) {
          $controllerFile = $controllersDir . '/' . $controllerName . '.php';

          if (file_exists($controllerFile)) {
            $foundFiles[] = $controllerFile;
          }
        }

        $subDirFiles = $this->scanForControllerFiles($fullPath, $controllerName);
        $foundFiles = array_merge($foundFiles, $subDirFiles);
      }
    }

    return $foundFiles;
  }

  /**
   * 将文件路径转换为命名空间。
   *
   * @param string $filePath 文件路径。
   * @param string $controllerName 控制器名称。
   * @return string 命名空间。
   */
  private function convertFilePathToNamespace($filePath, $controllerName)
  {
    // 规范化路径。
    $filePath = realpath($filePath);
    $appDir = realpath(__DIR__ . '/../app');

    if (!$filePath || !$appDir) {
      return 'App\\Controllers\\' . $controllerName;
    }

    // 确保路径格式一致。
    $filePath = str_replace('\\', '/', $filePath);
    $appDir = str_replace('\\', '/', $appDir);

    // 获取相对于app目录的相对路径。
    $relativePath = str_replace($appDir, '', $filePath);
    $relativePath = trim($relativePath, '/');

    // 解析路径部分。
    $pathParts = explode('/', $relativePath);
    $namespaceParts = [];

    foreach ($pathParts as $part) {
      // 跳过 Controllers 目录和控制器文件。
      if ($part === 'Controllers' || $part === $controllerName . '.php') {
        continue;
      }

      if (!empty($part)) {
        // 清理路径中的特殊字符。
        $part = preg_replace('/[^a-zA-Z0-9]/', '', $part);
        if (!empty($part)) {
          $namespaceParts[] = ucfirst($part);
        }
      }
    }

    if (empty($namespaceParts)) {
      return 'App\\Controllers\\' . $controllerName;
    }

    return 'App\\' . implode('\\', $namespaceParts) . '\\Controllers';
  }

  /**
   * 检查路由是否存在。
   *
   * @param string $method HTTP方法。
   * @param string $url 路由路径。
   * @return bool 路由是否存在。
   */
  private function routeExists($method, $url)
  {
    return isset(self::$routes[strtoupper($method)][$url]);
  }

  /**
   * 执行控制器动作。
   *
   * 正常路径只做 class/method 判定；只有确实要回 404 时才递归扫描目录，
   * 用于在错误日志里附带控制器文件定位信息，避免每个请求都扫描 app 目录树。
   *
   * @param string $controller 控制器类名。
   * @param string $action 动作方法名。
   * @param string $url 请求 URL。
   * @return void
   */
  private function executeControllerAction($controller, $action, $url)
  {
    if ($this->isValidControllerAction($controller, $action)) {
      $this->invokeControllerAction($controller, $action);
    } else {
      $controllerFile = $this->getControllerFilePath($controller);
      $this->sendControllerNotFoundError($controller, $action, file_exists($controllerFile), $controllerFile);
    }
  }

  /**
   * 获取控制器文件路径。
   *
   * @param string $controller 控制器类名。
   * @return string 控制器文件路径。
   */
  private function getControllerFilePath($controller)
  {
    // 移除命名空间前缀，获取控制器名称。
    $controllerName = str_replace(['App\\', '\\Controllers'], '', $controller);

    // 使用动态路径查找。
    $controllerPath = $this->findControllerFile($controllerName);

    if ($controllerPath) {
      return $controllerPath;
    }

    // 如果动态查找失败，回退到默认路径。
    return __DIR__ . '/../app/controllers/' . $controllerName . '.php';
  }

  /**
   * 验证控制器动作是否有效。
   *
   * @param string $controller 控制器类名。
   * @param string $action 动作方法名。
   * @return bool 控制器动作是否有效。
   */
  private function isValidControllerAction($controller, $action)
  {
    return class_exists($controller) && method_exists($controller, $action);
  }

  /**
   * 调用控制器动作。
   *
   * 调用前统一过登录鉴权闸门：默认所有接口都需要登录，只有登记在
   * api/config/auth.php 的 NO_AUTH 中的接口才放行游客
   * （Core\Controller::requireLogin 为唯一入口）。
   *
   * @param string $controller 控制器类名。
   * @param string $action 动作方法名。
   * @return void
   */
  private function invokeControllerAction($controller, $action)
  {
    try {
      $instance = new $controller();
      $instance->requireLogin($this->authRequired);
      $instance->$action();
    } catch (\Throwable $e) {
      $this->sendErrorResponse(500, '服务器处理失败', [
        'controller' => $controller,
        'action' => $action,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
      ]);
    }
  }

  /**
   * 发送路由不存在错误。
   *
   * @param string $url 请求 URL。
   * @param string $method HTTP 方法。
   * @return void
   */
  private function sendRouteNotFoundError($url, $method)
  {
    $errorMsg = "Route not found: " . $url;
    // 不携带全量 registered_routes（D-L19）：404 免登录可达，洪水请求会把
    // 整张路由表逐条写进 error_log 撑爆日志；url/method 已足够定位。
    $this->sendErrorResponse(404, $errorMsg, [
      'url' => $url,
      'method' => $method
    ]);
  }

  /**
   * 发送无效路由错误。
   *
   * @param string $url 请求 URL。
   * @param string $method HTTP 方法。
   * @return void
   */
  private function sendInvalidRouteError($url, $method)
  {
    $this->sendErrorResponse(500, 'Invalid route parameter format', [
      'params' => $this->params,
      'url' => $url,
      'method' => $method
    ]);
  }

  /**
   * 发送控制器不存在错误。
   *
   * @param string $controller 控制器类名。
   * @param string $action 动作方法名。
   * @param bool $fileExists 控制器文件是否存在。
   * @param string $controllerFile 控制器文件路径。
   * @return void
   */
  private function sendControllerNotFoundError($controller, $action, $fileExists, $controllerFile)
  {
    $errorMsg = "Controller or action not found: " . $controller . '::' . $action;
    $this->sendErrorResponse(404, $errorMsg, [
      'controller' => $controller,
      'action' => $action,
      'class_exists' => class_exists($controller),
      'method_exists' => class_exists($controller) ? method_exists($controller, $action) : false,
      'controller_file_exists' => $fileExists,
      'controller_file_path' => $controllerFile
    ]);
  }

  /**
   * 发送错误响应。
   *
   * 统一返回 { status: 0, msg, data: null }，HTTP 状态码保留在响应头，
   * 前端可经 httpStatus 区分 404/500 等；调试信息写入 PHP 错误日志。
   *
   * @param int $statusCode HTTP 状态码。
   * @param string $message 错误消息。
   * @param mixed $debugData 调试信息（仅记录日志，不回传前端）。
   * @return void
   */
  private function sendErrorResponse($statusCode, $message, $debugData = [])
  {
    if (ob_get_level()) {
      ob_end_clean();
    }
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    // 路由层错误按 HTTP 语义映射业务码：404 资源不存在、500 服务器内部错误，其余归入通用失败。
    $businessCode = ErrorCode::FAIL;
    if ($statusCode === 404) {
      $businessCode = ErrorCode::NOT_FOUND;
    } elseif ($statusCode === 500) {
      $businessCode = ErrorCode::SERVER_ERROR;
    }
    // 调试信息仅记入日志，不随响应回传，保持响应体统一。
    if (!empty($debugData)) {
      error_log('[Router] ' . $message . ' :: ' . json_encode($debugData, JSON_UNESCAPED_UNICODE));
    }
    echo json_encode([
      'status' => $businessCode,
      'msg' => $message,
      'data' => null
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  }
}
