<?php

namespace App\Admin\Controllers;

use Core\Base;
use Core\Db;
use Core\ErrorCode;

class SeoController extends Base
{
  public function __construct()
  {
    parent::__construct();
  }

  // 修改。
  public function seoUpdate(): void
  {
    if (!$this->requireManagePermission()) return;
    $id = $this->input('post.id') ?? null;
    if (empty($id)) {
      $this->json([], 'SEO记录ID不能为空', ErrorCode::PARAM_INVALID);
      return;
    }
    if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
      $logoPath = $this->uploadFile($_FILES['logo'], 'logo');
      if (!$logoPath) {
        $this->json([], 'Logo上传失败，请检查文件格式和大小', ErrorCode::UPLOAD_REJECTED);
        return;
      }
    } else {
      $logoPath = $this->input('post.logo') ?? null;
    }
    $data = [
      'sid' => $this->input('post.sid') ?? null,
      'title' => $this->input('post.title') ?? null,
      'url' => $this->input('post.url') ?? null,
      'logo' => $logoPath,
      'description' => $this->input('post.description') ?? null,
      'keywords' => $this->input('post.keywords') ?? null,
      'author' => $this->input('post.author') ?? null,
      'copyright' => $this->input('post.copyright') ?? null,
      'icp' => $this->input('post.icp') ?? null,
      'email' => $this->input('post.email') ?? null
    ];
    $data = array_filter($data, function (mixed $value) {
      return $value !== null;
    });
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', ErrorCode::PARAM_INVALID);
      return;
    }
    $data = $this->encodeFields($data, ['title', 'url', 'logo', 'description', 'keywords', 'author', 'copyright', 'icp', 'email']);
    $result = Db::name('tb_seo')
      ->where('id', '=', $id)
      ->field(['sid', 'title', 'url', 'logo', 'description', 'keywords', 'author', 'copyright', 'icp', 'email'])
      ->update($data);
    if ($result === false) {
      $this->json([], '更新失败', ErrorCode::SERVER_ERROR);
      return;
    }
    if ($result === 0) {
      $this->json([], '数据未发生变化', ErrorCode::RULE_REJECTED);
      return;
    }
    $this->json([], '更新成功', 1);
  }

  // 查询。
  public function seoList(): void
  {
    $result = Db::name('tb_seo')->select();
    if (empty($result)) {
      $this->json([], 'SEO设置不存在', ErrorCode::NOT_FOUND);
      return;
    }
    $result = $this->decodeFields($result, ['title', 'url', 'logo', 'description', 'keywords', 'author', 'copyright', 'icp', 'email']);
    $this->json($result);
  }
}
