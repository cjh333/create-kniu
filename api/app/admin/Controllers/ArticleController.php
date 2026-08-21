<?php

namespace App\Admin\Controllers;

use Core\AdminBaseController;
use Core\Db;

class ArticleController extends AdminBaseController
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

  // 删除。
  public function articleDelete(): void
  {
    $id = $this->input('post.id') ?? '';
    Db::name('tb_article')
      ->where('id', '=', $id)
      ->delete();
    $this->json([], '删除成功', 1);
  }

  // 修改。
  public function articleUpdate(): void
  {
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
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'article')
        ->update(['is_select' => $data['is_selectall']]);
      $articleResult = Db::name('tb_article')
        ->whereIn('id', explode(',', $id))
        ->update(['is_select' => $data['is_select']]);
      $result = $selectallResult + $articleResult;
    } else {
      $selectallResult = Db::name('tb_selectall')
        ->where('name', '=', 'article')
        ->update(['is_select' => $data['is_selectall']]);
      $articleResult = Db::name('tb_article')
        ->where('id', '=', $id)
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
    $selectall = Db::name('tb_selectall')->where('name', '=', 'article')->value('is_select') ?? 0;
    $result = Db::name($table)
      ->order($field, $sort)
      ->page($pageCurrent, $pageRow);
    $result['data'] = $this->decodeFields($result['data'] ?? [], ['title', 'subtitle', 'summary', 'content']);
    $result['selectall'] = $selectall;
    $this->json($result);
  }

  // 查询某一条。
  public function articleDetail(): void
  {
    $id = $this->input('post.id') ?? '';
    $result = Db::name('tb_article')
      ->where('id', '=', $id)
      ->find();
    $result = $this->decodeFields($result, ['title', 'subtitle', 'summary', 'content']);
    $this->json($result);
  }

  // 删除封面图片。
  public function articleCoverDelete(): void
  {
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
