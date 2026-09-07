<?php

namespace App\Index\Controllers;

use Core\Controller;
use Core\Db;
use Core\EmailCode;

class IndexController extends Controller
{
  public function getDaily(): void
  {
    $today = date('z') + 1;
    $result = Db::name('tb_daily')
      ->where('id', '=', $today)
      ->select();
    $result = $this->decodeFields($result, ['cn', 'en']);
    $this->json($result);
  }

  public function getArticle(): void
  {
    // 前台首页文章列表对所有人开放、无归属条件；仅排除后台置为不显示(is_show=0)的文章。
    $result = Db::name('tb_article')
      ->where('is_show', '=', 1)
      ->select();
    $result = $this->decodeFields($result, ['title', 'subtitle', 'summary', 'content']);
    foreach ($result as &$article) {
      $role = Db::name('tb_role')->where('id', '=', (int)($article['user_id'] ?? 0))->find();
      $article['publisher'] = (string)($role['name'] ?? '');
    }
    unset($article);
    $this->json($result);
  }

  /**
   * 数据版本号（公开接口，供前端兜底校验）。
   *
   * 前端主要靠 SSE 的 data-change 信号实时刷新；本接口用于信号丢失场景
   * （Node 重启、SSE 断开、页面长时间处于后台）在页面重新可见时比对版本，
   * 版本不一致即重拉当前页数据。只返回单调计数，不携带任何业务数据。
   */
  public function dataRevision(): void
  {
    $this->json(['revision' => \Core\DataSignal::revision()]);
  }

  public function getInfo(): void
  {
    $result =  [
      'today' => date('z') + 1,
      'photo' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA4ZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuNi1jMDY3IDc5LjE1Nzc0NywgMjAxNS8wMy8zMC0yMzo0MDo0MiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo3OTA5OWY0MC1hZTY2LTQ0NTktYjdlMS0zNWYxMTEzN2JhNzYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QzQ0RDAwQUUyRjM0MTFFNjhGNjNBRUJGNzk1RDg1REIiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QzQ0RDAwQUQyRjM0MTFFNjhGNjNBRUJGNzk1RDg1REIiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTUgKE1hY2ludG9zaCkiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoyNzdkNjVjNS01NmQxLTQwMGItYjY2NS00NjA2MDg3ZmFmMTAiIHN0UmVmOmRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDo4MDM3NDc0YS03NzI0LTExNzktYmUy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',
      'note' => '会点设计，会点前端，会点后端的程序猿。'
    ];
    $this->json($result);
  }

  /**
   * 前台「关于我」内容。
   *
   * 按账号存储：带有效身份令牌且已绑定 tb_role 账号时，展示该账号在
   * tb_user_about 中的本人内容；未登录或无本人内容时回退全局 SEO 配置。
   */
  public function getAbout(): void
  {
    $content = '';
    $token = $this->validIdentityToken();
    if ($token !== '') {
      $frontUser = Db::name('tb_front_user')
        ->where('identity_token', '=', hash('sha256', $token))
        ->find();
      $roleId = $frontUser ? (int)($frontUser['role_id'] ?? 0) : 0;
      if ($roleId > 0) {
        $about = Db::name('tb_user_about')
          ->where('user_id', '=', $roleId)
          ->find();
        $about = $this->decodeFields($about, ['content']);
        $content = (string)($about['content'] ?? '');
      }
    }
    if ($content === '') {
      $result = Db::name('tb_seo')
        ->field(['about_content'])
        ->order('is_select', 'desc')
        ->order('id', 'asc')
        ->find();
      $result = $this->decodeFields($result, ['about_content']);
      $content = (string)($result['about_content'] ?? '');
    }
    $this->json(['content' => $content]);
  }

  public function getDetail(): void
  {
    $id = $this->input('post.id/d', 1);
    $identityToken = strtolower(trim((string)$this->input('post.identity_token/s', '')));

    if ($id <= 0) {
      $this->json([], 'ID参数错误', 0);
      return;
    }

    try {
      $result = Db::name('tb_article')
        ->where('id', '=', $id)
        ->select();

      if (empty($result)) {
        $this->json([], '文章不存在', 0);
        return;
      }

      $result = $this->decodeFields($result, ['title', 'subtitle', 'summary', 'content']);
      $publisherRole = Db::name('tb_role')->where('id', '=', (int)($result[0]['user_id'] ?? 0))->find();
      $result[0]['publisher'] = (string)($publisherRole['name'] ?? '');
      $frontUser = $this->frontUserByToken($identityToken);
      // 是否本人文章：按 tb_article.user_id 与当前身份的 tb_role.id 比对，
      // 不能直接用 validateToken()（那只是后台会话有效）。
      $result[0]['isOwn'] = $this->isOwnedByCurrentUser((int)($result[0]['user_id'] ?? 0), $frontUser);
      $result[0]['likeLocked'] = !empty($_SESSION['article_like_' . $id . '_' . date('Ymd')]);
      if ($frontUser) {
        $userId = (int)$frontUser['id'];
        Db::name('tb_article_history')->where('last_view_time', '<', date('Y-m-d H:i:s', strtotime('-1 year')))->delete();
        $history = Db::name('tb_article_history')->where(['user_id' => $userId, 'article_id' => $id])->find();
        if ($history) {
          Db::name('tb_article_history')->where('id', '=', (int)$history['id'])->update(['last_view_time' => date('Y-m-d H:i:s')]);
        } else {
          Db::name('tb_article_history')->insert(['user_id' => $userId, 'article_id' => $id, 'last_view_time' => date('Y-m-d H:i:s')]);
        }
      }
      $result[0]['favorited'] = $frontUser
        ? Db::name('tb_article_favorite')->where(['user_id' => (int)$frontUser['id'], 'article_id' => $id])->count() > 0
        : false;
      $previous = Db::name('tb_article')
        ->where('is_show', '=', 1)
        ->where('id', '<', $id)
        ->order('id', 'desc')
        ->find();
      $next = Db::name('tb_article')
        ->where('is_show', '=', 1)
        ->where('id', '>', $id)
        ->order('id', 'asc')
        ->find();
      $previous = $this->decodeFields($previous, ['title']);
      $next = $this->decodeFields($next, ['title']);
      $result[0]['previous'] = $previous ? [
        'id' => (int)$previous['id'],
        'title' => $previous['title'] ?: ''
      ] : null;
      $result[0]['next'] = $next ? [
        'id' => (int)$next['id'],
        'title' => $next['title'] ?: ''
      ] : null;
      $this->json($result[0]);
      return;
    } catch (\Exception $e) {
      $this->json([], '获取文章详情失败', 0);
      return;
    }
  }

  /**
   * 获取文章评论列表。
   *
   * 返回该文章下全部已展示评论（含回复），按创建时间正序排列，
   * 顶层评论 parent_id=0，回复记录保留 parent_id 供前端定位。
   */
  public function getComments(): void
  {
    $articleId = $this->input('post.article_id/d', 0);
    $identityToken = strtolower(trim((string)$this->input('post.identity_token/s', '')));
    if ($articleId <= 0) {
      $this->json([], '文章ID参数错误', 0);
      return;
    }

    try {
      $currentUser = $this->frontUserByToken($identityToken);
      $currentUserId = $currentUser ? (int)$currentUser['id'] : 0;
      $currentUserNickname = $currentUser
        ? $this->normalizeFrontNickname(html_entity_decode((string)$currentUser['nickname'], ENT_QUOTES))
        : '';
      $result = Db::name('tb_comment')
        ->where('article_id', '=', $articleId)
        ->where('is_show', '=', 1)
        ->order('id', 'asc')
        ->select();
      $result = $this->decodeFields($result, ['name', 'message']);

      $commentNames = [];
      foreach ($result as $row) {
        $commentNames[(int)$row['id']] = $this->normalizeFrontNickname($row['name'] ?: '匿名');
      }

      $list = array_map(function ($row) use ($commentNames, $currentUserId, $currentUserNickname) {
        $parentId = (int)$row['parent_id'];
        $userId = (int)$row['user_id'];
        $username = $this->normalizeFrontNickname($row['name'] ?: '匿名');
        return [
          'id' => (int)$row['id'],
          'userId' => $userId,
          'isOwn' => $currentUserId > 0 && ($userId === $currentUserId || $username === $currentUserNickname),
          'parentId' => $parentId,
          'replyTo' => $parentId > 0 ? ($commentNames[$parentId] ?? '') : '',
          'username' => $username,
          'avatar' => '',
          'time' => $row['create_time'] ?: '',
          'content' => $row['message'] ?: '',
          'likes' => (int)$row['likes'],
          'liked' => false
        ];
      }, $result);

      $this->json($list);
    } catch (\Exception $e) {
      $this->json([], '获取评论失败', 0);
    }
  }

  /**
   * 提交评论或回复。
   *
   * article_id 关联文章；parent_id 为 0 表示顶层评论，大于 0 表示对某条评论的回复。
   * message 入库前 HTML 转义（后端全责）。
   */
  public function submitComment(): void
  {
    $articleId = $this->input('post.article_id/d', 0);
    $parentId = $this->input('post.parent_id/d', 0);
    $identityToken = strtolower(trim((string)$this->input('post.identity_token/s', '')));
    $message = $this->input('post.message/s', '');

    if ($articleId <= 0) {
      $this->json([], '文章ID参数错误', 0);
      return;
    }
    if (trim($message) === '') {
      $this->json([], '评论内容不能为空', 0);
      return;
    }
    if (!preg_match('/^[a-f0-9]{64}$/', $identityToken)) {
      $this->json([], '请先在个人中心设置用户昵称', 0);
      return;
    }

    try {
      $frontUser = Db::name('tb_front_user')
        ->where('identity_token', '=', hash('sha256', $identityToken))
        ->find();
      if (!$frontUser || trim((string)$frontUser['nickname']) === '') {
        $this->json([], '请先在个人中心设置用户昵称', 0);
        return;
      }
      if ($parentId > 0) {
        $parentComment = Db::name('tb_comment')
          ->where('id', '=', $parentId)
          ->where('article_id', '=', $articleId)
          ->find();
        if (!$parentComment) {
          $this->json([], '回复目标不存在', 0);
          return;
        }
        if ((int)$parentComment['user_id'] === (int)$frontUser['id']) {
          $this->json([], '不能回复自己的评论', 0);
          return;
        }
      }
      $name = html_entity_decode((string)$frontUser['nickname'], ENT_QUOTES);
      $data = $this->encodeFields([
        'article_id' => $articleId,
        'user_id' => (int)$frontUser['id'],
        'parent_id' => $parentId,
        'name' => $name,
        'email' => '',
        'ip' => '',
        'message' => $message,
        // 管理员发表的评论直接展示；普通用户评论仍需后台审核。
        'is_show' => ((int)($_SESSION['admin_token']['role'] ?? 0) === 1) ? 1 : 0
      ], ['name', 'message']);
      $id = Db::name('tb_comment')->insert($data);

      if (!$id) {
        $this->json([], '评论失败', 0);
        return;
      }
      $this->json(['id' => (int)$id], '评论成功', 1);
    } catch (\Exception $e) {
      $this->json([], '评论失败', 0);
    }
  }

  /**
   * 评论点赞。
   *
   * liked=true 点赞数 +1，liked=false 取消点赞数 -1（不低于 0）。
   */
  public function likeComment(): void
  {
    $commentId = $this->input('post.comment_id/d', 0);
    $liked = $this->input('post.liked/b', true);
    $identityToken = strtolower(trim((string)$this->input('post.identity_token/s', '')));

    if ($commentId <= 0) {
      $this->json([], '评论ID参数错误', 0);
      return;
    }

    try {
      $comment = Db::name('tb_comment')->where('id', '=', $commentId)->find();
      if (!$comment) {
        $this->json([], '评论不存在', 0);
        return;
      }
      $frontUser = $this->frontUserByToken($identityToken);
      $legacyOwner = $frontUser
        && $this->normalizeFrontNickname(html_entity_decode((string)$comment['name'], ENT_QUOTES))
          === $this->normalizeFrontNickname(html_entity_decode((string)$frontUser['nickname'], ENT_QUOTES));
      if ($frontUser && ((int)$comment['user_id'] === (int)$frontUser['id'] || $legacyOwner)) {
        $this->json([], '不能给自己的评论点赞', 0);
        return;
      }

      $next = $liked ? ((int)$comment['likes'] + 1) : max(0, (int)$comment['likes'] - 1);
      Db::name('tb_comment')->where('id', '=', $commentId)->update(['likes' => $next]);

      $this->json(['likes' => (int)$next], '操作成功', 1);
    } catch (\Exception $e) {
      $this->json([], '点赞失败', 0);
    }
  }

  /** 删除当前访客自己发表的评论或回复。 */
  public function deleteComment(): void
  {
    $commentId = $this->input('post.comment_id/d', 0);
    $identityToken = strtolower(trim((string)$this->input('post.identity_token/s', '')));
    if ($commentId <= 0) {
      $this->json([], '评论ID参数错误', 0);
      return;
    }

    try {
      $frontUser = $this->frontUserByToken($identityToken);
      if (!$frontUser) {
        $this->json([], '用户身份无效，请重新设置昵称', 0);
        return;
      }
      $comment = Db::name('tb_comment')
        ->where('id', '=', $commentId)
        ->field(['id', 'user_id', 'parent_id', 'name'])
        ->find();
      if (!$comment) {
        $this->json([], '评论不存在', 0);
        return;
      }
      $legacyOwner = $this->normalizeFrontNickname(html_entity_decode((string)$comment['name'], ENT_QUOTES))
          === $this->normalizeFrontNickname(html_entity_decode((string)$frontUser['nickname'], ENT_QUOTES));
      if ((int)$comment['user_id'] !== (int)$frontUser['id'] && !$legacyOwner) {
        $this->json([], '只能删除自己的评论', 0);
        return;
      }
      if ((int)$comment['parent_id'] === 0) {
        Db::name('tb_comment')->where('parent_id', '=', $commentId)->delete();
      }
      Db::name('tb_comment')->where('id', '=', $commentId)->delete();
      $this->json([], '删除成功', 1);
    } catch (\Exception $e) {
      $this->json([], '删除失败', 0);
    }
  }

  /** 文章点赞或取消点赞，返回服务端最新计数。 */
  public function likeArticle(): void
  {
    $articleId = $this->input('post.article_id/d', 0);
    $liked = $this->input('post.liked/b', true);
    $identityToken = strtolower(trim((string)$this->input('post.identity_token/s', '')));

    if ($articleId <= 0) {
      $this->json([], '文章ID参数错误', 0);
      return;
    }

    try {
      $article = Db::name('tb_article')->where('id', '=', $articleId)->find();
      if (!$article) {
        $this->json([], '文章不存在', 0);
        return;
      }
      // 仅作者本人禁止点赞：后台会话有效（validateToken）只代表已登录，不等于文章是本人发的，
      // 否则任何后台账号（含管理员）都无法给他人文章点赞。
      $frontUser = $this->frontUserByToken($identityToken);
      if ($this->isOwnedByCurrentUser((int)($article['user_id'] ?? 0), $frontUser)) {
        $this->json([], '不能给自己的文章点赞', 0);
        return;
      }
      // 同一会话对同一文章每天仅允许成功点赞一次；点赞成功后当天不可取消/重复提交。
      $likeKey = 'article_like_' . $articleId . '_' . date('Ymd');
      if (!empty($_SESSION[$likeKey])) {
        $this->json(['likes' => (int)($article['likes'] ?? 0), 'locked' => true], '操作成功', 1);
        return;
      }
      if (!$liked) {
        $this->json(['likes' => (int)($article['likes'] ?? 0), 'locked' => true], '操作成功', 1);
        return;
      }
      $current = (int)($article['likes'] ?? 0);
      $next = $current + 1;
      Db::name('tb_article')->where('id', '=', $articleId)->update(['likes' => $next]);
      $_SESSION[$likeKey] = 1;
      $this->json(['likes' => $next], '操作成功', 1);
    } catch (\Exception $e) {
      $this->json([], '点赞失败', 0);
    }
  }

  /** 收藏或取消收藏文章。 */
  public function favoriteArticle(): void
  {
    $articleId = $this->input('post.article_id/d', 0);
    $favorited = $this->input('post.favorited/b', true);
    $frontUser = $this->frontUserByToken($this->validIdentityToken());
    if ($articleId <= 0 || !$frontUser) {
      $this->json([], '请先登录后再收藏文章', 0);
      return;
    }
    try {
      $article = Db::name('tb_article')->where('id', '=', $articleId)->find();
      if (!$article) {
        $this->json([], '文章不存在', 0);
        return;
      }
      if ($this->isOwnedByCurrentUser((int)($article['user_id'] ?? 0), $frontUser)) {
        $this->json([], '不能收藏自己发表的文章', 0);
        return;
      }
      $query = Db::name('tb_article_favorite')->where([
        'user_id' => (int)$frontUser['id'],
        'article_id' => $articleId
      ]);
      $existing = $query->find();
      if ($favorited && !$existing) {
        Db::name('tb_article_favorite')->insert([
          'user_id' => (int)$frontUser['id'],
          'article_id' => $articleId,
          'create_time' => date('Y-m-d H:i:s')
        ]);
      } elseif (!$favorited && $existing) {
        Db::name('tb_article_favorite')->where('id', '=', (int)$existing['id'])->delete();
      }
      $this->json(['favorited' => $favorited], '操作成功', 1);
    } catch (\Exception $e) {
      $this->json([], '收藏操作失败', 0);
    }
  }

  private function validIdentityToken(): string
  {
    $token = strtolower(trim((string)$this->input('post.identity_token/s', '')));
    return preg_match('/^[a-f0-9]{64}$/', $token) ? $token : '';
  }

  private function frontUserByToken(string $token)
  {
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) return null;
    return Db::name('tb_front_user')
      ->where('identity_token', '=', hash('sha256', $token))
      ->find();
  }

  /**
   * 当前身份对应的后台账号 ID（tb_role.id）：后台会话优先，其次前台身份绑定的账号。
   * 两者都不存在时返回 0（游客）。与 tb_article.user_id / tb_user_about.user_id 同一坐标系。
   */
  private function currentRoleId($frontUser = null): int
  {
    if ($this->validateToken()) {
      $roleId = (int)($_SESSION['admin_token']['id'] ?? 0);
      if ($roleId > 0) return $roleId;
    }
    return (int)($frontUser['role_id'] ?? 0);
  }

  /**
   * 资源是否归属于当前身份（作者本人）。
   * 注意：validateToken() 只表示后台会话有效，不能用于判定资源归属——否则任何
   * 已登录后台的账号访问他人文章都会被当成作者，从而永远无法点赞。
   */
  private function isOwnedByCurrentUser(int $ownerId, $frontUser = null): bool
  {
    if ($ownerId <= 0) return false;
    return $this->currentRoleId($frontUser) === $ownerId;
  }

  private function normalizeFrontNickname(string $nickname): string
  {
    $nickname = trim($nickname);
    if ($nickname === '') return '';
    return mb_strtolower(mb_substr($nickname, 0, 1, 'UTF-8'), 'UTF-8')
      . mb_substr($nickname, 1, null, 'UTF-8');
  }

  public function frontProfile(): void
  {
    $token = $this->validIdentityToken();
    if ($token === '') {
      $this->json([], '身份令牌无效', 0);
      return;
    }
    $user = Db::name('tb_front_user')
      ->where('identity_token', '=', hash('sha256', $token))
      ->find();
    $nickname = $user ? $this->normalizeFrontNickname(html_entity_decode((string)$user['nickname'], ENT_QUOTES)) : '';
    if (!$user) {
      $this->json(['id' => 0, 'nickname' => '', 'likes' => 0, 'commentCount' => 0, 'favorites' => [], 'history' => []]);
      return;
    }
    $userId = (int)$user['id'];
    $likeRows = Db::query('SELECT COALESCE(SUM(`likes`), 0) AS total, COUNT(*) AS comments FROM `tb_comment` WHERE `user_id` = ' . $userId);
    $favorites = Db::query('SELECT a.`id`, a.`title`, f.`create_time` FROM `tb_article_favorite` f INNER JOIN `tb_article` a ON a.`id` = f.`article_id` WHERE f.`user_id` = ' . $userId . ' AND a.`is_show` = 1 ORDER BY f.`id` DESC');
    $favorites = $this->decodeFields($favorites, ['title']);
    Db::name('tb_article_history')->where('last_view_time', '<', date('Y-m-d H:i:s', strtotime('-1 year')))->delete();
    $history = Db::query('SELECT a.`id`, a.`title`, h.`last_view_time` FROM `tb_article_history` h INNER JOIN `tb_article` a ON a.`id` = h.`article_id` WHERE h.`user_id` = ' . $userId . ' AND a.`is_show` = 1 ORDER BY h.`last_view_time` DESC');
    $history = $this->decodeFields($history, ['title']);
    $this->json([
      'id' => $userId,
      'nickname' => $nickname,
      'likes' => (int)($likeRows[0]['total'] ?? 0),
      'commentCount' => (int)($likeRows[0]['comments'] ?? 0),
      'favorites' => $favorites,
      'history' => $history
    ]);
  }

  public function frontProfileSave(): void
  {
    $token = $this->validIdentityToken();
    $nickname = $this->normalizeFrontNickname((string)$this->input('post.nickname/s', ''));
    if ($token === '') {
      $this->json([], '身份令牌无效', 0);
      return;
    }
    if ($nickname === '' || mb_strlen($nickname, 'UTF-8') > 30) {
      $this->json([], '用户昵称必填且不能超过30个字', 0);
      return;
    }
    $tokenHash = hash('sha256', $token);
    $encodedNickname = htmlspecialchars($nickname, ENT_QUOTES);
    $accountCreated = false;
    $transactionStarted = false;
    try {
      $user = Db::name('tb_front_user')->where('identity_token', '=', $tokenHash)->find();
      if (!$user && !$this->verifyArithmeticCaptcha()) {
        $this->json([], '验证码错误', 0);
        return;
      }
      $duplicateQuery = Db::name('tb_front_user')->where('nickname', '=', $encodedNickname);
      if ($user) $duplicateQuery->where('id', '<>', (int)$user['id']);
      if ($duplicateQuery->find()) {
        $this->json([], '该昵称已存在', 0);
        return;
      }
      $currentEncodedNickname = $user ? (string)$user['nickname'] : '';
      $roleDuplicate = Db::name('tb_role')->where('name', '=', $encodedNickname)->find();
      if ($roleDuplicate && (!$user || $encodedNickname !== $currentEncodedNickname)) {
        $this->json([], '该昵称已存在', 0);
        return;
      }
      Db::beginTrans();
      $transactionStarted = true;
      if ($user) {
        $currentNickname = $this->normalizeFrontNickname(html_entity_decode((string)$user['nickname'], ENT_QUOTES));
        if ($currentNickname === $nickname) {
          if (!$roleDuplicate) {
            Db::name('tb_role')->insert([
              'sid' => 0,
              'name' => $encodedNickname,
              'password' => $this->hashPassword('000000'),
              'role' => 2,
              'role_auth' => 2,
              'is_show' => 1
            ]);
            $accountCreated = true;
          }
          Db::commit();
          $transactionStarted = false;
          $this->json([
            'id' => (int)$user['id'],
            'nickname' => $currentNickname,
            'accountCreated' => $accountCreated,
            'initialPassword' => $accountCreated ? '000000' : ''
          ], $accountCreated ? '账号创建成功，后台初始密码为000000' : '昵称未变更', 1);
          return;
        }
        $lastChangedAt = strtotime((string)($user['update_time'] ?? $user['create_time'] ?? '')) ?: 0;
        if ($lastChangedAt > strtotime('-1 month')) {
          Db::rollback();
          $transactionStarted = false;
          $this->json([], '昵称一个月内只能修改一次', 0);
          return;
        }
        Db::name('tb_front_user')->where('id', '=', $user['id'])->update([
          'nickname' => $encodedNickname,
          'update_time' => date('Y-m-d H:i:s')
        ]);
        if ($roleDuplicate) {
          Db::name('tb_role')->where('id', '=', (int)$roleDuplicate['id'])->update(['name' => $encodedNickname]);
        } else {
          $oldRole = Db::name('tb_role')->where('name', '=', $currentEncodedNickname)->find();
          if ($oldRole) {
            Db::name('tb_role')->where('id', '=', (int)$oldRole['id'])->update(['name' => $encodedNickname]);
          } else {
            Db::name('tb_role')->insert([
              'sid' => 0,
              'name' => $encodedNickname,
              'password' => $this->hashPassword('000000'),
              'role' => 2,
              'role_auth' => 2,
              'is_show' => 1
            ]);
            $accountCreated = true;
          }
        }
        $id = (int)$user['id'];
      } else {
        $id = (int)Db::name('tb_front_user')->insert([
          'identity_token' => $tokenHash,
          'nickname' => $encodedNickname,
          'create_time' => date('Y-m-d H:i:s'),
          'update_time' => date('Y-m-d H:i:s')
        ]);
        Db::name('tb_role')->insert([
          'sid' => 0,
          'name' => $encodedNickname,
          'password' => $this->hashPassword('000000'),
          'role' => 2,
          'role_auth' => 2,
          'is_show' => 1
        ]);
        $accountCreated = true;
      }
      Db::commit();
      $transactionStarted = false;
    } catch (\Exception $e) {
      if ($transactionStarted) Db::rollback();
      $this->json([], '该昵称已存在', 0);
      return;
    }
    $this->json([
      'id' => $id,
      'nickname' => $nickname,
      'accountCreated' => $accountCreated,
      'initialPassword' => $accountCreated ? '000000' : ''
    ], $accountCreated ? '账号创建成功，后台初始密码为000000' : '昵称保存成功', 1);
  }

  public function frontProfileClear(): void
  {
    $token = $this->validIdentityToken();
    if ($token === '') {
      $this->json([], '身份令牌无效', 0);
      return;
    }
    unset($_SESSION['front_token'], $_SESSION['admin_token']);
    if (session_status() === PHP_SESSION_ACTIVE) {
      $_SESSION = [];
      if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
      }
      session_destroy();
    }
    $this->json([], '已退出登录', 1);
  }

  /** 用有效后台会话恢复前台身份，保证从后台打开前端时保持登录。 */
  public function frontSessionSync(): void
  {
    $token = $this->validIdentityToken();
    if ($token === '' || !$this->validateToken()) {
      $this->json(['loggedIn' => false, 'id' => 0, 'nickname' => '']);
      return;
    }
    $roleId = (int)($_SESSION['admin_token']['id'] ?? 0);
    $name = trim(html_entity_decode((string)($_SESSION['admin_token']['name'] ?? ''), ENT_QUOTES));
    if ($roleId <= 0 || $name === '') {
      $this->json(['loggedIn' => false, 'id' => 0, 'nickname' => '']);
      return;
    }
    $frontUserId = $this->bindFrontUser(
      hash('sha256', $token),
      htmlspecialchars($name, ENT_QUOTES)
    );
    $this->createFrontSession($roleId, $name);
    $this->json([
      'loggedIn' => true,
      'id' => $frontUserId,
      'roleId' => $roleId,
      'nickname' => $this->normalizeFrontNickname($name)
    ]);
  }

  /**
   * 前台注册：账号 + 密码 + 确认密码 + 算术验证码。
   *
   * 账号写入 tb_role（与后台共用账号表，role=2 普通用户），
   * 并把当前浏览器的身份令牌绑定到该账号上，注册后即处于登录态。
   */
  public function frontRegister(): void
  {
    $token = $this->validIdentityToken();
    if ($token === '') {
      $this->json([], '身份令牌无效', 0);
      return;
    }
    if (!$this->verifyFrontCaptcha()) {
      $this->json([], '验证码错误', 0);
      return;
    }

    // 邮箱必填、格式校验、全站唯一。
    $email = EmailCode::normalizeEmail((string)$this->input('post.email/s', ''));
    if (!EmailCode::validEmail($email)) {
      $this->json([], '邮箱格式不正确', 0);
      return;
    }
    if (Db::name('tb_role')->where('email', '=', $email)->find()) {
      $this->json([], '该邮箱已被注册', 0);
      return;
    }
    // 邮箱验证码（注册场景）必须校验通过。
    $emailCode = trim((string)$this->input('post.email_code/s', ''));
    $verify = EmailCode::verify($email, EmailCode::SCENE_REGISTER, $emailCode);
    if (!$verify['status']) {
      $this->json([], $verify['msg'], 0);
      return;
    }

    $username = $this->normalizeFrontNickname((string)$this->input('post.username/s', ''));
    $password = (string)$this->input('post.password/s', '');
    $confirm = (string)$this->input('post.confirm/s', '');

    if (!$this->validFrontAccount($username)) {
      $this->json([], '账号为2-30位中文、字母、数字、下划线或短横线', 0);
      return;
    }
    if (!$this->validFrontPassword($password)) {
      $this->json([], '密码为6-20位非空白字符', 0);
      return;
    }
    if (!hash_equals($password, $confirm)) {
      $this->json([], '两次输入的密码不一致', 0);
      return;
    }

    $encodedName = htmlspecialchars($username, ENT_QUOTES);
    if (Db::name('tb_role')->where('name', '=', $encodedName)->find()) {
      $this->json([], '该账号已存在', 0);
      return;
    }
    if (Db::name('tb_front_user')->where('nickname', '=', $encodedName)->find()) {
      $this->json([], '该账号已存在', 0);
      return;
    }

    $transactionStarted = false;
    try {
      Db::beginTrans();
      $transactionStarted = true;
      Db::name('tb_role')->insert([
        'sid' => 0,
        'name' => $encodedName,
        'email' => $email,
        'password' => $this->hashPassword($password),
        'role' => 2,
        'role_auth' => 2,
        'is_show' => 1
      ]);
      $id = $this->bindFrontUser(hash('sha256', $token), $encodedName);
      Db::commit();
      $transactionStarted = false;
      // 注册成功后核销邮箱验证码。
      EmailCode::consume($verify['id']);
    } catch (\Exception $e) {
      if ($transactionStarted) Db::rollback();
      $this->json([], '注册失败，请稍后重试', 0);
      return;
    }

    $roleId = (int)(Db::name('tb_role')->where('name', '=', $encodedName)->value('id') ?? 0);
    $this->createFrontSession($roleId, $username);
    // 注册即进后台：与前台会话一并建立 admin_token（role=2 受限工作台），
    // 使「合并登录页」注册成功后可直接进入 /admin，无需二次登录。
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    session_regenerate_id(true);
    $authConfig = require __DIR__ . '/../../../config/auth.php';
    $loginExpireSeconds = max(1, (int)($authConfig['LOGIN_EXPIRE_DAYS'] ?? 7)) * 86400;
    $_SESSION['admin_token'] = [
      'id' => $roleId,
      'token' => bin2hex(random_bytes(32)),
      'name' => $username,
      'role' => '2',
      'role_auth' => 2,
      'expire' => time() + $loginExpireSeconds
    ];
    $this->json([
      'id' => $id,
      'role_id' => $roleId,
      'token' => $_SESSION['admin_token']['token'],
      'name' => $username,
      'role' => '2',
      'role_auth' => 2,
      'nickname' => $username
    ], '注册成功', 1);
  }

  /**
   * 前台登录：账号 + 密码 + 算术验证码。
   *
   * 校验 tb_role 账号，通过后把当前浏览器的身份令牌绑定到该账号，
   * 使本机处于登录态；不写 admin_token 会话，不会串进后台。
   */
  public function frontLogin(): void
  {
    $token = $this->validIdentityToken();
    if ($token === '') {
      $this->json([], '身份令牌无效', 0);
      return;
    }
    if (!$this->verifyFrontCaptcha()) {
      $this->json([], '验证码错误', 0);
      return;
    }

    $username = $this->normalizeFrontNickname((string)$this->input('post.username/s', ''));
    $password = (string)$this->input('post.password/s', '');
    if ($username === '' || $password === '') {
      $this->json([], '账号和密码不能为空', 0);
      return;
    }

    $rows = Db::name('tb_role')
      ->where('name', '=', htmlspecialchars($username, ENT_QUOTES))
      ->field(['id', 'name', 'password', 'is_show'])
      ->select();
    if (empty($rows)) {
      $this->json([], '账号不存在', 0);
      return;
    }
    $account = $rows[0];
    if (isset($account['is_show']) && (int)$account['is_show'] === 0) {
      $this->json([], '该账号已被禁用，请联系管理员', 0);
      return;
    }
    if (!$this->verifyPassword($password, (string)$account['password'])) {
      $this->json([], '账号或密码错误', 0);
      return;
    }

    $id = $this->bindFrontUser(hash('sha256', $token), (string)$account['name']);
    $this->createFrontSession((int)$account['id'], $username);
    $this->json([
      'id' => $id,
      'nickname' => $this->normalizeFrontNickname(html_entity_decode((string)$account['name'], ENT_QUOTES))
    ], '登录成功', 1);
  }

  /**
   * 前台绑定账号：把当前浏览器身份令牌绑定到指定 tb_role 账号。
   *
   * 与 frontLogin 的区别：不校验验证码，供个人中心「绑定账号」入口使用；
   * 校验账号密码通过后绑定身份并建立前台会话。
   */
  public function frontBind(): void
  {
    $token = $this->validIdentityToken();
    if ($token === '') {
      $this->json([], '身份令牌无效', 0);
      return;
    }

    $username = $this->normalizeFrontNickname((string)$this->input('post.username/s', ''));
    $password = (string)$this->input('post.password/s', '');
    if ($username === '' || $password === '') {
      $this->json([], '账号和密码不能为空', 0);
      return;
    }

    $rows = Db::name('tb_role')
      ->where('name', '=', htmlspecialchars($username, ENT_QUOTES))
      ->field(['id', 'name', 'password', 'is_show'])
      ->select();
    if (empty($rows)) {
      $this->json([], '账号不存在', 0);
      return;
    }
    $account = $rows[0];
    if (isset($account['is_show']) && (int)$account['is_show'] === 0) {
      $this->json([], '该账号已被禁用，请联系管理员', 0);
      return;
    }
    if (!$this->verifyPassword($password, (string)$account['password'])) {
      $this->json([], '账号或密码错误', 0);
      return;
    }

    $id = $this->bindFrontUser(hash('sha256', $token), (string)$account['name']);
    $this->createFrontSession((int)$account['id'], $username);
    $this->json([
      'id' => $id,
      'nickname' => $this->normalizeFrontNickname(html_entity_decode((string)$account['name'], ENT_QUOTES))
    ], '绑定成功', 1);
  }

  /**
   * 发送邮箱验证码（注册 / 找回密码共用）。
   *
   * 注册场景：邮箱尚未注册才允许发码；找回密码场景：邮箱必须已注册。
   * 频率与水限制由 EmailCode 统一管控，验证码仅入库摘要、明文只出现在邮件正文。
   */
  public function emailCode(): void
  {
    $email = EmailCode::normalizeEmail((string)$this->input('post.email/s', ''));
    $scene = strtolower(trim((string)$this->input('post.scene/s', '')));

    if (!EmailCode::validEmail($email)) {
      $this->json([], '邮箱格式不正确', 0);
      return;
    }
    if (!EmailCode::validScene($scene)) {
      $this->json([], '操作类型无效', 0);
      return;
    }

    if ($scene === EmailCode::SCENE_REGISTER) {
      if (Db::name('tb_role')->where('email', '=', $email)->find()) {
        $this->json([], '该邮箱已被注册', 0);
        return;
      }
    } else {
      if (!Db::name('tb_role')->where('email', '=', $email)->find()) {
        $this->json([], '该邮箱尚未注册账号', 0);
        return;
      }
    }

    $result = EmailCode::issue($email, $scene);
    if (!$result['status']) {
      $this->json([], $result['msg'], 0);
      return;
    }
    // dev=true 表示服务端未配置 SMTP（Mailer 走了日志兜底），邮件并未真正发出，
    // 必须给前端一个区别于「已发送」的提示，避免用户一直等一封不存在的邮件。
    $tip = $result['dev']
      ? '开发模式未配置 SMTP，邮件未实际发送（验证码仅写入服务端日志）'
      : '验证码已发送，请查收邮箱';
    $this->json([
      'expire' => $result['expire'],
      'interval' => (int)(EmailCode::config()['CODE_INTERVAL'] ?? 60),
      'dev' => $result['dev']
    ], $tip, 1);
  }

  /**
   * 邮箱验证码找回密码：校验验证码后直接重置账号密码，无需原密码。
   *
   * 按邮箱定位 tb_role 账号，验证通过即更新密码哈希，并核销验证码。
   */
  public function passwordReset(): void
  {
    $email = EmailCode::normalizeEmail((string)$this->input('post.email/s', ''));
    $code = trim((string)$this->input('post.code/s', ''));
    $password = (string)$this->input('post.password/s', '');
    $confirm = (string)$this->input('post.confirm/s', '');

    if (!EmailCode::validEmail($email)) {
      $this->json([], '邮箱格式不正确', 0);
      return;
    }
    if (!$this->validFrontPassword($password)) {
      $this->json([], '密码为6-20位非空白字符', 0);
      return;
    }
    if (!hash_equals($password, $confirm)) {
      $this->json([], '两次输入的密码不一致', 0);
      return;
    }

    $account = Db::name('tb_role')->where('email', '=', $email)->field(['id', 'is_show'])->find();
    if (!$account) {
      $this->json([], '该邮箱尚未注册账号', 0);
      return;
    }
    if (isset($account['is_show']) && (int)$account['is_show'] === 0) {
      $this->json([], '该账号已被禁用，请联系管理员', 0);
      return;
    }

    $verify = EmailCode::verify($email, EmailCode::SCENE_RESET, $code);
    if (!$verify['status']) {
      $this->json([], $verify['msg'], 0);
      return;
    }

    try {
      Db::name('tb_role')->where('id', '=', (int)$account['id'])->update(['password' => $this->hashPassword($password)]);
      EmailCode::consume($verify['id']);
      $this->json([], '密码重置成功，请使用新密码登录', 1);
    } catch (\Exception $e) {
      $this->json([], '密码重置失败，请稍后重试', 0);
    }
  }

  /**
   * 建立前台登录会话（front_token）。
   *
   * 与后台 admin_token 完全独立，不会串进后台鉴权；存 tb_role 账号 id 与昵称。
   */
  private function createFrontSession(int $userId, string $name): void
  {
    if (session_status() === PHP_SESSION_NONE) {
      session_start();
    }
    $_SESSION['front_token'] = [
      'id' => $userId,
      'name' => $name,
      'expire' => time() + 86400 * 7
    ];
  }

  /**
   * 校验并消费前台算术验证码（一次一验，用过即失效）。
   */
  private function verifyFrontCaptcha(): bool
  {
    return $this->verifyArithmeticCaptcha();
  }

  /**
   * 把当前浏览器身份令牌绑定到指定账号上。
   *
   * tb_front_user 以 identity_token 唯一，一个账号同一时刻只绑一个设备；
   * 换设备登录时身份行随之迁移，旧设备的匿名身份行会被回收。
   */
  private function bindFrontUser(string $tokenHash, string $encodedName): int
  {
    $now = date('Y-m-d H:i:s');
    $accountRow = Db::name('tb_front_user')->where('nickname', '=', $encodedName)->find();
    $tokenRow = Db::name('tb_front_user')->where('identity_token', '=', $tokenHash)->find();
    // 关联 tb_role 账号 id，供 getAbout 等按账号读取本人数据。
    $roleId = (int)(Db::name('tb_role')->where('name', '=', $encodedName)->value('id') ?? 0);

    if ($accountRow) {
      if ($tokenRow && (int)$tokenRow['id'] !== (int)$accountRow['id']) {
        Db::name('tb_front_user')->where('id', '=', (int)$tokenRow['id'])->delete();
      }
      $updateData = ['identity_token' => $tokenHash, 'update_time' => $now];
      if ($roleId > 0) $updateData['role_id'] = $roleId;
      Db::name('tb_front_user')->where('id', '=', (int)$accountRow['id'])->update($updateData);
      return (int)$accountRow['id'];
    }
    if ($tokenRow) {
      $updateData = ['nickname' => $encodedName, 'update_time' => $now];
      if ($roleId > 0) $updateData['role_id'] = $roleId;
      Db::name('tb_front_user')->where('id', '=', (int)$tokenRow['id'])->update($updateData);
      return (int)$tokenRow['id'];
    }
    return (int)Db::name('tb_front_user')->insert([
      'identity_token' => $tokenHash,
      'nickname' => $encodedName,
      'role_id' => $roleId,
      'create_time' => $now,
      'update_time' => $now
    ]);
  }

  private function validFrontAccount(string $account): bool
  {
    return preg_match('/^[\x{4e00}-\x{9fa5}A-Za-z0-9_-]{2,30}$/u', $account) === 1;
  }

  private function validFrontPassword(string $password): bool
  {
    return preg_match('/^\S{6,20}$/', $password) === 1;
  }
}
