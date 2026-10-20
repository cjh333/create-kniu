<?php

namespace Core;

use Core\Db;

/**
 * 搜索引擎收录收口（爬虫渲染 + robots + sitemap + 可收录文章 URL）。
 *
 * 本项目前台是 hash 路由 SPA：搜索引擎（尤其百度）不执行 JS，且不把 #/xxx
 * 当作独立 URL 收录，前端 JS 写 meta 对爬虫基本无效——SEO 必须在服务端出 HTML。
 *
 * 四个 GET 入口统一由 api/index.php 最前段调用 handleCrawlableRequest() 处理：
 *   /robots.txt        → 收录规则 + Sitemap 指向
 *   /sitemap.xml       → 动态站点地图（首页 + 全部已显示文章的可收录 URL）
 *   /article-{id}.html → 爬虫：服务端渲染完整文章 HTML（TDK/正文纯文本/JSON-LD/canonical）
 *                        普通用户：302 跳进 SPA 对应详情页（#/detail?id={id}）
 *   / 或 /index.html   → 仅爬虫：服务端渲染首页 HTML（TDK + 文章内链列表）
 *
 * 安全口径：正文一律 html_entity_decode 还原后 strip_tags 纯文本化再输出（段落化），
 * 不内联富文本 HTML，避免服务端渲染引入新的注入面；所有出参经 htmlspecialchars 转义。
 * 可收录 URL 仅此一种形态，SPA 内部 hash 路由不变。
 */
class Seo
{
  /** 已知爬虫 UA 关键字（统一转小写比较）。 */
  private const CRAWLER_HINTS = [
    'baiduspider', 'googlebot', 'bingbot', 'sogou', 'haosouspider', '360spider',
    'yisouspider', 'bytespider', 'duckduckbot', 'slurp', 'petalbot', 'ahrefsbot'
  ];

  /** 正文纯文本描述的最大长度（字符）。 */
  private const DESC_LIMIT = 160;

  /** sitemap 单次输出的最大文章数（防超大站点拖垮响应）。 */
  private const SITEMAP_LIMIT = 5000;

  /**
   * 收录入口分发：由 api/index.php 在会话初始化之前调用，命中即输出并退出。
   *
   * @return void
   */
  public static function handleCrawlableRequest(): void
  {
    $method = (string)($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if ($method !== 'GET' && $method !== 'HEAD') return;
    $path = strtok((string)($_SERVER['REQUEST_URI'] ?? ''), '?') ?: '/';

    if ($path === '/robots.txt') {
      self::outputRobots();
      return;
    }
    if ($path === '/sitemap.xml') {
      self::outputSitemap();
      return;
    }
    if (preg_match('#^/article-(\d+)\.html$#', $path, $m) === 1) {
      self::handleArticle((int)$m[1]);
      return;
    }
    if (($path === '/' || $path === '/index.html') && self::isCrawler()) {
      self::outputHome();
    }
  }

  /** 是否搜索引擎爬虫（按 UA 关键字判定）。 */
  public static function isCrawler(): bool
  {
    $ua = strtolower((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if ($ua === '') return false;
    foreach (self::CRAWLER_HINTS as $hint) {
      if (strpos($ua, $hint) !== false) return true;
    }
    return false;
  }

  /** robots.txt：全站放行，仅屏蔽 API 路径，声明 Sitemap 位置。 */
  private static function outputRobots(): void
  {
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo "User-agent: *\n";
    echo "Allow: /\n";
    echo "Disallow: /api/\n";
    echo 'Sitemap: ' . self::baseUrl() . "/sitemap.xml\n";
    exit;
  }

  /** 动态 sitemap.xml：首页 + 全部已显示文章的可收录 URL（lastmod 取发布时间）。 */
  private static function outputSitemap(): void
  {
    header('Content-Type: application/xml; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $base = self::baseUrl();
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '  <url><loc>' . self::e($base . '/') . '</loc><changefreq>daily</changefreq></url>' . "\n";
    try {
      $rows = Db::name('tb_article')
        ->field(['id', 'issue_time'])
        ->where('is_show', '=', 1)
        ->order(['create_time' => 'desc', 'id' => 'desc'])
        ->limit(self::SITEMAP_LIMIT)
        ->select();
    } catch (\Throwable $e) {
      $rows = [];
    }
    foreach ((array)$rows as $row) {
      $lastmod = date('Y-m-d', strtotime((string)$row['issue_time']));
      echo '  <url><loc>' . self::e($base . '/article-' . (int)$row['id'] . '.html')
        . '</loc><lastmod>' . $lastmod . '</lastmod></url>' . "\n";
    }
    echo '</urlset>';
    exit;
  }

  /** 爬虫首页：TDK + 文章内链列表（供爬虫发现全部文章 URL）。 */
  private static function outputHome(): void
  {
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $site = self::siteMeta();
    $base = self::baseUrl();
    $title = $site['title'] !== '' ? $site['title'] : 'KniuSystem';
    try {
      $rows = Db::name('tb_article')
        ->field(['id', 'title', 'summary', 'content', 'issue_time'])
        ->where('is_show', '=', 1)
        ->order(['create_time' => 'desc', 'id' => 'desc'])
        ->limit(200)
        ->select();
    } catch (\Throwable $e) {
      $rows = [];
    }
    $items = '';
    foreach ((array)$rows as $row) {
      $items .= '    <li><a href="' . self::e($base . '/article-' . (int)$row['id'] . '.html') . '">'
        . self::e(self::textOf((string)$row['title'], 80)) . '</a></li>' . "\n";
    }
    $jsonLd = [
      '@context' => 'https://schema.org',
      '@type' => 'WebSite',
      'name' => $title,
      'url' => $base . '/',
      'description' => self::textOf($site['description'], self::DESC_LIMIT)
    ];
    echo '<!DOCTYPE html>' . "\n" . '<html lang="zh-CN">' . "\n<head>\n"
      . '  <meta charset="UTF-8">' . "\n"
      . '  <title>' . self::e($title) . '</title>' . "\n"
      . '  <meta name="description" content="' . self::e(self::textOf($site['description'], self::DESC_LIMIT)) . '">' . "\n"
      . '  <meta name="keywords" content="' . self::e(self::textOf($site['keywords'], 200)) . '">' . "\n"
      . '  <link rel="canonical" href="' . self::e($base . '/') . '">' . "\n"
      . '  <script type="application/ld+json">' . json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n"
      . "</head>\n<body>\n  <h1>" . self::e($title) . "</h1>\n  <ul>\n" . $items . "  </ul>\n</body>\n</html>";
    exit;
  }

  /**
   * 文章可收录 URL：爬虫返回服务端渲染 HTML，普通用户 302 进 SPA 详情页。
   *
   * @param int $id 文章 tb_article.id。
   * @return void
   */
  private static function handleArticle(int $id): void
  {
    if (!self::isCrawler()) {
      header('Location: ' . self::baseUrl() . '/#/detail?id=' . $id, true, 302);
      exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $site = self::siteMeta();
    $base = self::baseUrl();
    $siteTitle = $site['title'] !== '' ? $site['title'] : 'KniuSystem';
    try {
      $row = Db::name('tb_article')
        ->field(['id', 'title', 'summary', 'content', 'issue_time', 'create_time'])
        ->where('id', '=', $id)
        ->where('is_show', '=', 1)
        ->find();
    } catch (\Throwable $e) {
      $row = null;
    }
    if (!$row) {
      http_response_code(404);
      echo '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        . '<title>文章不存在 - ' . self::e($siteTitle) . '</title></head>'
        . '<body><p>文章不存在或未发布。</p>'
        . '<p><a href="' . self::e($base . '/') . '">返回首页</a></p></body></html>';
      exit;
    }
    $title = self::textOf((string)$row['title'], 120);
    $bodyText = self::textOf((string)$row['content']);
    $description = self::textOf((string)$row['summary'], self::DESC_LIMIT);
    if ($description === '') $description = mb_substr($bodyText, 0, self::DESC_LIMIT);
    $published = date('Y-m-d', strtotime((string)($row['issue_time'] ?: $row['create_time'])));
    // 正文纯文本按空行分段（strip_tags 已去掉全部标签，天然规避服务端渲染的注入面）。
    $paragraphs = '';
    foreach (preg_split('/\n{1,}/', $bodyText) ?: [] as $line) {
      $line = trim($line);
      if ($line !== '') $paragraphs .= '  <p>' . self::e($line) . "</p>\n";
    }
    $jsonLd = [
      '@context' => 'https://schema.org',
      '@type' => 'Article',
      'headline' => $title,
      'description' => $description,
      'datePublished' => $published,
      'inLanguage' => 'zh-CN',
      'articleBody' => $bodyText,
      'mainEntityOfPage' => $base . '/article-' . $id . '.html'
    ];
    if ($site['author'] !== '') $jsonLd['author'] = ['@type' => 'Person', 'name' => $site['author']];
    echo '<!DOCTYPE html>' . "\n" . '<html lang="zh-CN">' . "\n<head>\n"
      . '  <meta charset="UTF-8">' . "\n"
      . '  <title>' . self::e($title) . ' - ' . self::e($siteTitle) . '</title>' . "\n"
      . '  <meta name="description" content="' . self::e($description) . '">' . "\n"
      . '  <meta name="keywords" content="' . self::e(self::textOf($site['keywords'], 200)) . '">' . "\n"
      . '  <link rel="canonical" href="' . self::e($base . '/article-' . $id . '.html') . '">' . "\n"
      . '  <script type="application/ld+json">' . json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>' . "\n"
      . "</head>\n<body>\n"
      . '  <article>' . "\n    <h1>" . self::e($title) . "</h1>\n"
      . '    <time datetime="' . self::e($published) . '">' . self::e($published) . "</time>\n"
      . $paragraphs
      . "  </article>\n"
      . '  <p><a href="' . self::e($base . '/') . '">' . self::e($siteTitle) . '</a></p>' . "\n"
      . "</body>\n</html>";
    exit;
  }

  /** 站点元信息（tb_seo 首行，编码字段单轮解码；异常时回空串兜底）。 */
  private static function siteMeta(): array
  {
    try {
      $row = Db::name('tb_seo')
        ->field(['title', 'url', 'description', 'keywords', 'author'])
        ->order(['sid' => 'asc', 'id' => 'asc'])
        ->find();
    } catch (\Throwable $e) {
      $row = null;
    }
    $row = is_array($row) ? $row : [];
    return [
      'title' => self::textOf((string)($row['title'] ?? ''), 120),
      'url' => trim((string)($row['url'] ?? '')),
      'description' => self::textOf((string)($row['description'] ?? '')),
      'keywords' => self::textOf((string)($row['keywords'] ?? ''), 200),
      'author' => self::textOf((string)($row['author'] ?? ''), 60)
    ];
  }

  /**
   * 站点根 URL：优先后台 tb_seo.url 配置（须带 http/https），否则按当前请求推导。
   *
   * @return string 形如 https://example.com（末尾无斜杠）。
   */
  private static function baseUrl(): string
  {
    $configured = '';
    try {
      $configured = trim((string)Db::name('tb_seo')->order(['sid' => 'asc', 'id' => 'asc'])->value('url'));
    } catch (\Throwable $e) {
      $configured = '';
    }
    if (preg_match('#^https?://[a-z0-9.-]+(:\d+)?$#i', rtrim($configured, '/')) === 1) {
      return rtrim($configured, '/');
    }
    $secure = !empty($_SERVER['HTTPS'])
      || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
    // Host 头免登录可达且可任意伪造：仅接受域名形态（字母/数字/点/连字符 + 可选端口），
    // 其余（注入头、下划线主机名等）一律回 localhost，防 sitemap/canonical/302 被投毒（m6）。
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (preg_match('/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i', $host) !== 1) {
      $host = 'localhost';
    }
    return ($secure ? 'https://' : 'http://') . $host;
  }

  /** HTML 转义。 */
  private static function e(string $value): string
  {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
  }

  /**
   * 入库编码文本 → 纯文本：单轮解码、去标签、折叠空白，可选截断。
   *
   * @param string $encoded 库内编码原文。
   * @param int $limit 截断长度（字符），0 表示不截断。
   * @return string
   */
  private static function textOf(string $encoded, int $limit = 0): string
  {
    $text = strip_tags(html_entity_decode($encoded, ENT_QUOTES, 'UTF-8'));
    $text = trim((string)preg_replace('/\s+/u', ' ', $text));
    if ($limit > 0) $text = mb_substr($text, 0, $limit);
    return $text;
  }
}
