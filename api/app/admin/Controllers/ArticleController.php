<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\ErrorCode;

class ArticleController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  // 编辑器图片、音频和视频上传。
  public function articleMediaUpload(): void
  {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
      $this->json([], '请选择需要上传的媒体文件', ErrorCode::PARAM_INVALID);
      return;
    }
    $path = $this->uploadFile($_FILES['file'], 'article');
    if (!$path) {
      $this->json([], '媒体文件上传失败', ErrorCode::UPLOAD_REJECTED);
      return;
    }
    $this->json(['url' => $path], '上传成功', ErrorCode::SUCCESS);
  }

  // 增加。
  public function articleAdd(): void
  {
    $roleId = $this->currentUserId();
    if ($roleId <= 0) {
      http_response_code(403);
      $this->json([], '请先登录', ErrorCode::UNAUTHORIZED);
      return;
    }
    $coverPath = '';
    if (isset($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
      $coverPath = $this->uploadFile($_FILES['cover'], 'article');
      if (!$coverPath) {
        $this->json([], '文件上传失败', ErrorCode::UPLOAD_REJECTED);
        return;
      }
    }
    $data = [
      'role_id' => $roleId,
      'sid' => $this->input('post.sid') ?? 0,
      'title' => $this->input('post.title') ?? '',
      'subtitle' => $this->input('post.subtitle') ?? '',
      'summary' => $this->input('post.summary') ?? '',
      'content' => $this->input('post.content') ?? '',
      'content_mode' => ($this->input('post.content_mode') ?? 'rich') === 'markdown' ? 'markdown' : 'rich',
      'url' => $this->input('post.url') ?? '',
      'cover' => $coverPath,
      'create_time' => $this->input('post.create_time') ?? date('Y-m-d H:i:s'),
      'is_show' => $this->input('post.is_show') ?? 1
    ];
    $recommend = $this->input('post.is_recommend');
    if ($recommend !== null && $recommend !== '') {
      if (!$this->isAdmin()) {
        http_response_code(403);
        $this->json([], '仅管理员可设置推荐文章', ErrorCode::FORBIDDEN);
        return;
      }
      $data['is_recommend'] = (int)$recommend === 1 ? 1 : 0;
    }
    $data = $this->encodeFields($data, ['title', 'subtitle', 'summary', 'content']);
    try {
      Db::name('tb_article')->insert($data);
    } catch (\Throwable $e) {
      // 异常细节（表名/SQL 片段）只进日志，不透传前端。
      error_log('[Article] articleAdd failed: ' . $e->getMessage());
      $this->json([], '文章添加失败', ErrorCode::SERVER_ERROR);
      return;
    }
    $this->json([], '添加成功', ErrorCode::SUCCESS);
  }

  // 删除。普通用户仅能删除自己发布的文章；管理员可删除任意文章。
  public function articleDelete(): void
  {
    $id = $this->input('post.id') ?? '';
    if (!$this->isAdmin()) {
      // 普通用户仅能删除自己发布的文章。
      // 只需判断归属存在，避免拖回正文大字段。
      $exists = Db::name('tb_article')
        ->field(['id'])
        ->where(['id' => $id, 'role_id' => $this->currentUserId()])
        ->find();
      if (!$exists) {
        http_response_code(403);
        $this->json([], '只能删除自己发布的文章', ErrorCode::FORBIDDEN);
        return;
      }
    }
    Db::name('tb_article')->where('id', '=', $id)->delete();
    $this->json([], '删除成功', ErrorCode::SUCCESS);
  }

  // 修改。普通用户仅能修改自己发布的文章；管理员可修改任意文章，批量操作仅管理员。
  public function articleUpdate(): void
  {
    $isAdmin = $this->isAdmin();
    $type = $this->input('post.type') ?? null;
    $id = $this->input('post.id') ?? null;

    // 处理文件上传。
    if (isset($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
      $coverPath = $this->uploadFile($_FILES['cover'], 'article');
      if (!$coverPath) {
        $this->json([], '文件上传失败', ErrorCode::UPLOAD_REJECTED);
        return;
      }
      $data['cover'] = $coverPath;
    } else {
      $data['cover'] = $this->input('post.cover') ?? null;
    }

    $data = [
      'is_selectall' => $this->input('post.is_selectall') ?? null,
      'is_select' => $this->input('post.is_select') ?? null,
      'sid' => $this->input('post.sid') ?? null,
      'title' => $this->input('post.title') ?? null,
      'subtitle' => $this->input('post.subtitle') ?? null,
      'summary' => $this->input('post.summary') ?? null,
      'content' => $this->input('post.content') ?? null,
      // 局部更新（如开关切换）未提交 content_mode 时保持 null 以跳过该列，避免把既有 markdown 覆盖为 rich。
      'content_mode' => $this->input('post.content_mode') === null ? null : ($this->input('post.content_mode') === 'markdown' ? 'markdown' : 'rich'),
      'cover' => $data['cover'],
      'create_time' => $this->input('post.create_time') ?? null,
      'url' => $this->input('post.url') ?? null,
      'is_show' => $this->input('post.is_show') ?? null
    ];
    $recommend = $this->input('post.is_recommend');
    if ($recommend !== null) {
      if (!$isAdmin) {
        http_response_code(403);
        $this->json([], '仅管理员可设置推荐文章', ErrorCode::FORBIDDEN);
        return;
      }
      $data['is_recommend'] = (int)$recommend === 1 ? 1 : 0;
    }
    $data = array_filter($data, function (mixed $value) {
      return $value !== null;
    });
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', ErrorCode::PARAM_INVALID);
      return;
    }
    $data = $this->encodeFields($data, ['title', 'subtitle', 'summary', 'content']);
    if ($type === 'KNIU_TABLE_EVENT_CHECKALL') {
      // 批量操作（含全局勾选）仅管理员可用。
      if (!$isAdmin) {
        http_response_code(403);
        $this->json([], '权限不足', ErrorCode::FORBIDDEN);
        return;
      }
      $result = $this->applySelectallBatch('article', 'tb_article', $data['is_selectall'] ?? null, $data['is_select'] ?? null, (string)$id);
    } else {
      if (!$isAdmin) {
        // 普通用户仅能更新自己发布的文章。
        $owned = Db::name('tb_article')
          ->field(['id'])
          ->where(['id' => $id, 'role_id' => $this->currentUserId()])
          ->find();
        if (!$owned) {
          http_response_code(403);
          $this->json([], '只能编辑自己发布的文章', ErrorCode::FORBIDDEN);
          return;
        }
      }
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'article')
        ->update(['is_select' => $data['is_selectall']]);
      $articleQuery = Db::name('tb_article')
        ->where('id', '=', $id);
      if (!$isAdmin) {
        $articleQuery->where('role_id', '=', $this->currentUserId());
      }
      $articleResult = $articleQuery
        ->field(['is_select', 'sid', 'title', 'subtitle', 'summary', 'content', 'content_mode', 'cover', 'create_time', 'url', 'is_show', 'is_recommend'])
        ->update($data);
      $result = $selectallResult + $articleResult;
    }
    if ($result === false) {
      $this->json([], '更新失败', ErrorCode::SERVER_ERROR);
      return;
    }
    if ($result === 0) {
      $this->json([], '数据未发生变化', ErrorCode::RULE_REJECTED);
      return;
    }
    $this->json([], '更新成功', ErrorCode::SUCCESS);
  }

  // 查询列表。
  public function articleList(): void
  {
    $table = 'tb_article';
    $field = $this->input('post.field') ?? $this->getDefaultSortField($table);
    $sort = $this->input('post.sort') ?? 'asc';
    $pageCurrent = (int)($this->input('post.page_current') ?? 1);
    $pageRow = (int)($this->input('post.page_rows') ?? 10);
    $keyword = trim((string)($this->input('post.keyword') ?? ''));
    $selectall = Db::name('tb_selectall')->where('name', '=', 'article')->value('is_select') ?? 0;
    $query = Db::name($table);
    if (!$this->isAdmin()) {
      // 普通用户仅能查看自己发布的文章。
      $query->where('role_id', '=', $this->currentUserId());
    }
    if ($keyword !== '') {
      $query->where('`title`', 'LIKE', $this->likeEncodedPattern($keyword));
    }
    // content longtext 不进列表：编辑弹窗改走 /article_detail 按 id 拉取（editRow 异步回填）；
    // 列表列白名单与 article.html 视图 + 编辑弹窗（editRow 复用行数据，editform.url 为「链接」字段来源）的消费面一致。
    // url 在保存端原文入库（不在 encodeFields 内），故也无需 decodeFields。
    $result = $query
      ->field(['id', 'sid', 'role_id', 'cover', 'title', 'subtitle', 'summary', 'url', 'hits', 'likes', 'is_show', 'is_recommend', 'create_time'])
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['title', 'subtitle', 'summary']);
    // 批量查询账号信息，避免在循环内逐条查询 tb_role 形成 N+1。
    $roleIds = array_values(array_unique(array_filter(array_map(function (array $row) {
      return (int)($row['role_id'] ?? 0);
    }, $result['data']))));
    $roleAccounts = [];
    if ($roleIds) {
      foreach (Db::name('tb_role')->whereIn('id', $roleIds)->field(['id', 'name', 'nickname'])->select() as $role) {
        $roleAccounts[(int)$role['id']] = [
          'account' => html_entity_decode((string)($role['name'] ?? ''), ENT_QUOTES),
          'nickname' => html_entity_decode((string)($role['nickname'] ?? ''), ENT_QUOTES)
        ];
      }
    }
    foreach ($result['data'] as &$article) {
      $roleAccount = $roleAccounts[(int)($article['role_id'] ?? 0)] ?? ['account' => '', 'nickname' => ''];
      $article['account'] = $roleAccount['account'];
      $article['nickname'] = $roleAccount['nickname'];
    }
    unset($article);
    $result['selectall'] = $selectall;
    $this->json($result);
  }

  // 查询某一条。
  public function articleDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $query = Db::name('tb_article')
      ->where('id', '=', $id);
    if (!$this->isAdmin()) {
      // 普通用户仅能查看（编辑回填）自己的文章。
      $query->where('role_id', '=', $this->currentUserId());
    }
    $result = $query->find();
    $result = $this->decodeFields($result, ['title', 'subtitle', 'summary', 'content']);
    $this->json($result);
  }

  // 删除封面图片。
  public function articleCoverDelete(): void
  {
    if (!$this->requireManagePermission()) return;
    try {
      $cover = $this->input('post.cover') ?? '';
      if (empty($cover)) {
        $this->json([], '图片路径不能为空', ErrorCode::UPLOAD_REJECTED);
        return;
      }

      $uploadConfigPath = __DIR__ . '/../../../config/upload.php';
      $uploadConfig = @require $uploadConfigPath;
      if (!$uploadConfig) {
        $this->json([], '配置文件加载失败', ErrorCode::SERVER_ERROR);
        return;
      }

      if (strpos($cover, $uploadConfig['URL_PREFIX']) !== 0) {
        $this->json([], '图片路径无效', ErrorCode::UPLOAD_REJECTED);
        return;
      }
      $relativePath = ltrim(substr($cover, strlen($uploadConfig['URL_PREFIX'])), '/\\');
      $uploadRoot = realpath($uploadConfig['UPLOAD_PATH']);
      $filePath = realpath($uploadConfig['UPLOAD_PATH'] . $relativePath);
      if (!$uploadRoot || !$filePath || strpos($filePath, $uploadRoot . DIRECTORY_SEPARATOR) !== 0) {
        $this->json([], '图片路径越界', ErrorCode::UPLOAD_REJECTED);
        return;
      }

      $debugInfo = [
        'cover' => $cover,
        'url_prefix' => $uploadConfig['URL_PREFIX'],
        'relativePath' => $relativePath,
        'upload_path' => $uploadConfig['UPLOAD_PATH'],
        'filePath' => $filePath,
        'fileExists' => @file_exists($filePath)
      ];
      // 调试信息（含绝对路径）只进日志，不回传前端。
      error_log('[Article] articleCoverDelete: ' . json_encode($debugInfo, JSON_UNESCAPED_UNICODE));

      if (!@file_exists($filePath)) {
        $this->json([], '文件不存在', ErrorCode::NOT_FOUND);
        return;
      }

      if (!@unlink($filePath)) {
        $this->json([], '删除文件失败', ErrorCode::SERVER_ERROR);
        return;
      }

      $this->json([], '删除成功', ErrorCode::SUCCESS);
    } catch (\Exception $e) {
      // 异常细节只进日志，不透传前端。
      error_log('[Article] articleCoverDelete failed: ' . $e->getMessage());
      $this->json([], '服务器错误', ErrorCode::SERVER_ERROR);
    }
  }
}
