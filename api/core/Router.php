<?php

namespace Core;

class Router
{
  private static $routes = [];
  private static $controllerCache = [];
  private $params = '';

  /**
   * 添加 GET 请求路由。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @return void
   */
  public static function get($route, $params = [])
  {
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
    self::add($route, $params, 'DELETE');
  }

  /**
   * 添加路由。
   *
   * @param string $route 路由路径。
   * @param array|string $params 路由参数，格式为 "Controller@action"。
   * @param string $method HTTP方法，默认为 'GET'。
   * @return void
   * @throws InvalidArgumentException 路由参数格式无效时抛出异常。
   */
  private static function add($route, $params = [], $method = 'GET')
  {
    // 确保参数始终是字符串格式。
    if (is_array($params)) {
      if (isset($params[0]) && is_string($params[0])) {
        self::$routes[strtoupper($method)][$route] = $params[0];
      } else {
        throw new \InvalidArgumentException('Route parameters must contain a valid controller@action string');
      }
    } else {
      self::$routes[strtoupper($method)][$route] = (string)$params;
    }
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
   * @param string $controller 控制器类名。
   * @param string $action 动作方法名。
   * @param string $url 请求 URL。
   * @return void
   */
  private function executeControllerAction($controller, $action, $url)
  {
    $controllerFile = $this->getControllerFilePath($controller);
    $fileExists = file_exists($controllerFile);

    if ($this->isValidControllerAction($controller, $action)) {
      $this->invokeControllerAction($controller, $action);
    } else {
      $this->sendControllerNotFoundError($controller, $action, $fileExists, $controllerFile);
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
   * @param string $controller 控制器类名。
   * @param string $action 动作方法名。
   * @return void
   */
  private function invokeControllerAction($controller, $action)
  {
    try {
      $instance = new $controller();
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
    $this->sendErrorResponse(404, $errorMsg, [
      'url' => $url,
      'method' => $method,
      'registered_routes' => self::$routes
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
    // 调试信息仅记入日志，不随响应回传，保持响应体统一。
    if (!empty($debugData)) {
      error_log('[Router] ' . $message . ' :: ' . json_encode($debugData, JSON_UNESCAPED_UNICODE));
    }
    echo json_encode([
      'status' => 0,
      'msg' => $message,
      'data' => null
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  }
}
