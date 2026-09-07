<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;

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
      $this->json([], '请选择需要上传的媒体文件', 0);
      return;
    }
    $path = $this->uploadFile($_FILES['file'], 'article');
    if (!$path) {
      $this->json([], '媒体文件上传失败', 0);
      return;
    }
    $this->json(['url' => $path], '上传成功', 1);
  }

  // 增加。
  public function articleAdd(): void
  {
    $coverPath = '';
    if (isset($_FILES['cover']) && $_FILES['cover']['error'] === UPLOAD_ERR_OK) {
      $coverPath = $this->uploadFile($_FILES['cover'], 'article');
      if (!$coverPath) {
        $this->json([], '文件上传失败', 0);
        return;
      }
    }
    $data = [
      'user_id' => $this->currentUserId(),
      'sid' => $this->input('post.sid') ?? 0,
      'title' => $this->input('post.title') ?? '',
      'subtitle' => $this->input('post.subtitle') ?? '',
      'summary' => $this->input('post.summary') ?? '',
      'content' => $this->input('post.content') ?? '',
      'url' => $this->input('post.url') ?? '',
      'cover' => $coverPath,
      'create_time' => $this->input('post.create_time') ?? date('Y-m-d H:i:s'),
      'is_show' => $this->input('post.is_show') ?? 1
    ];
    $data = $this->encodeFields($data, ['title', 'subtitle', 'summary', 'content']);
    Db::name('tb_article')->insert($data);
    $this->json([], '添加成功', 1);
  }

  // 删除。普通用户仅能删除自己发布的文章；管理员可删除任意文章。
  public function articleDelete(): void
  {
    $id = $this->input('post.id') ?? '';
    if (!$this->isAdmin()) {
      // 普通用户仅能删除自己发布的文章。
      $exists = Db::name('tb_article')
        ->where(['id' => $id, 'user_id' => $this->currentUserId()])
        ->find();
      if (!$exists) {
        http_response_code(403);
        $this->json([], '只能删除自己发布的文章', 0);
        return;
      }
    }
    Db::name('tb_article')->where('id', '=', $id)->delete();
    $this->json([], '删除成功', 1);
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
        $this->json([], '文件上传失败', 0);
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
      'cover' => $data['cover'],
      'create_time' => $this->input('post.create_time') ?? null,
      'url' => $this->input('post.url') ?? null,
      'is_show' => $this->input('post.is_show') ?? null
    ];
    $data = array_filter($data, function ($value) {
      return $value !== null;
    });
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', 0);
      return;
    }
    $data = $this->encodeFields($data, ['title', 'subtitle', 'summary', 'content']);
    if ($type === 'KNIU_TABLE_EVENT_CHECKALL') {
      // 批量操作（含全局勾选）仅管理员可用。
      if (!$isAdmin) {
        http_response_code(403);
        $this->json([], '权限不足', 0);
        return;
      }
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'article')
        ->update(['is_select' => $data['is_selectall']]);
      $articleResult = Db::name('tb_article')
        ->whereIn('id', explode(',', $id))
        ->update(['is_select' => $data['is_select']]);
      $result = $selectallResult + $articleResult;
    } else {
      if (!$isAdmin) {
        // 普通用户仅能更新自己发布的文章。
        $owned = Db::name('tb_article')
          ->where(['id' => $id, 'user_id' => $this->currentUserId()])
          ->find();
        if (!$owned) {
          http_response_code(403);
          $this->json([], '只能编辑自己发布的文章', 0);
          return;
        }
      }
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'article')
        ->update(['is_select' => $data['is_selectall']]);
      $articleQuery = Db::name('tb_article')
        ->where('id', '=', $id);
      if (!$isAdmin) {
        $articleQuery->where('user_id', '=', $this->currentUserId());
      }
      $articleResult = $articleQuery
        ->field(['is_select', 'sid', 'title', 'subtitle', 'summary', 'content', 'cover', 'create_time', 'url', 'is_show'])
        ->update($data);
      $result = $selectallResult + $articleResult;
    }
    if ($result === false) {
      $this->json([], '更新失败', 0);
      return;
    }
    if ($result === 0) {
      $this->json([], '数据未发生变化', 0);
      return;
    }
    $this->json([], '更新成功', 1);
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
      $query->where('user_id', '=', $this->currentUserId());
    }
    if ($keyword !== '') {
      $query->where('LOWER(`title`)', 'LIKE', $this->likeEncodedPattern($keyword));
    }
    $result = $query
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['title', 'subtitle', 'summary', 'content']);
    foreach ($result['data'] as &$article) {
      $role = Db::name('tb_role')->where('id', '=', (int)($article['user_id'] ?? 0))->find();
      $article['publisher'] = (string)($role['name'] ?? '');
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
      $query->where('user_id', '=', $this->currentUserId());
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
        $this->json([], '图片路径不能为空', 0);
        return;
      }

      $uploadConfigPath = __DIR__ . '/../../../config/upload.php';
      $uploadConfig = @require $uploadConfigPath;
      if (!$uploadConfig) {
        $this->json([], '配置文件加载失败', 0);
        return;
      }

      if (strpos($cover, $uploadConfig['URL_PREFIX']) !== 0) {
        $this->json([], '图片路径无效', 0);
        return;
      }
      $relativePath = ltrim(substr($cover, strlen($uploadConfig['URL_PREFIX'])), '/\\');
      $uploadRoot = realpath($uploadConfig['UPLOAD_PATH']);
      $filePath = realpath($uploadConfig['UPLOAD_PATH'] . $relativePath);
      if (!$uploadRoot || !$filePath || strpos($filePath, $uploadRoot . DIRECTORY_SEPARATOR) !== 0) {
        $this->json([], '图片路径越界', 0);
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

      if (!@file_exists($filePath)) {
        $this->json($debugInfo, '文件不存在', 0);
        return;
      }

      if (!@unlink($filePath)) {
        $this->json($debugInfo, '删除文件失败', 0);
        return;
      }

      $this->json([], '删除成功', 1);
    } catch (\Exception $e) {
      $this->json(['error' => $e->getMessage()], '服务器错误', 0);
    }
  }
}
