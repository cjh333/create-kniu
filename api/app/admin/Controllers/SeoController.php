<?php

namespace App\Admin\Controllers;

use Core\AdminBaseController;
use Core\Db;

class SeoController extends AdminBaseController
{
  public function __construct()
  {
    parent::__construct();
  }

  // 修改。
  public function seoUpdate(): void
  {
    $id = $this->input('post.id') ?? null;
    if (empty($id)) {
      $this->json([], 'SEO记录ID不能为空', 0);
      return;
    }
    $data = [
      'sid' => $this->input('post.sid') ?? null,
      'title' => $this->input('post.title') ?? null,
      'url' => $this->input('post.url') ?? null,
      'logo' => $this->input('post.logo') ?? null,
      'description' => $this->input('post.description') ?? null,
      'keywords' => $this->input('post.keywords') ?? null,
      'author' => $this->input('post.author') ?? null,
      'copyright' => $this->input('post.copyright') ?? null,
      'record' => $this->input('post.record') ?? null,
      'email' => $this->input('post.email') ?? null
    ];
    $data = array_filter($data, function ($value) {
      return $value !== null;
    });
    if (empty($data)) {
      $this->json([], '没有提供任何要更新的数据', 0);
      return;
    }
    $result = Db::name('tb_seo')
      ->where('id', '=', $id)
      ->field(['sid', 'title', 'url', 'logo', 'description', 'keywords', 'author', 'copyright', 'record', 'email'])
      ->update($data);
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

  // 查询。
  public function seoList(): void
  {
    $result = Db::name('tb_seo')->select();
    if (empty($result)) {
      $this->json([], 'SEO设置不存在', 0);
      return;
    }
    $this->json($result);
  }
}
