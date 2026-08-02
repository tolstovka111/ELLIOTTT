<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';
require_once __DIR__ . '/api/ui.php';
require_once __DIR__ . '/api/comments.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$errors = [];






function post_file_line(array $post): string
{
    $parts = [];

    foreach ((array) ($post['images'] ?? []) as $media) {
        $file = basename((string) ($media['file'] ?? ''));

        if ($file === '') {
            continue;
        }

        $src = '/assets/blog/' . $file;
        $label = (string) ($media['fname'] ?? '');
        $label = $label === '' ? $file : $label;
        $info = media_info($file, 'blog');
        $meta = [];

        if (($info['size'] ?? 0) > 0) {
            $meta[] = format_size((int) $info['size']);
        }

        if (($info['w'] ?? 0) > 0 && ($info['h'] ?? 0) > 0) {
            $meta[] = (int) $info['w'] . 'x' . (int) $info['h'];
        }

        $line = '<a href="' . e($src) . '" target="_blank" rel="noopener">' . e($label) . '</a>';

        if ($meta !== []) {
            $line .= ' (' . e(implode(', ', $meta)) . ')';
        }

        $parts[] = $line;
    }

    if ($parts === []) {
        return '';
    }

    return '<div class="post-file">File: ' . implode(' &middot; ', $parts) . '</div>';
}

$action = (string) ($_POST['action'] ?? '');

if ($action !== '' && !public_token_valid((string) ($_POST['token'] ?? ''))) {
    $errors[] = 'The page went stale. Reload and try again.';
    $action = '';
}

if ($action === 'comment' || $action === 'answer') {
    $postId = (string) ($_POST['post'] ?? '');
    $author = comment_author($authed);
    $text = mb_substr(trim((string) ($_POST['text'] ?? '')), 0, MAX_CHAT_TEXT);
    $upload = $action === 'comment' ? comment_upload($errors) : [];

    if ($errors === [] && $text === '' && $upload === []) {
        $errors[] = 'Write something first.';
    }

    if ($errors === []) {
        $store = read_store();
        $done = false;

        foreach ($store['posts'] as $index => $post) {
            if ((string) ($post['id'] ?? '') !== $postId) {
                continue;
            }

            if (empty($post['comments_open'])) {
                $errors[] = 'Comments are closed on that post.';
                break;
            }

            $store['posts'][$index]['comments'] = apply_comment(
                (array) ($post['comments'] ?? []),
                $action === 'comment' ? 'add' : 'answer',
                [
                    'name' => $author['name'],
                    'text' => $text,
                    'admin' => $author['admin'],
                    'upload' => $upload,
                    'comment' => (string) ($_POST['comment'] ?? ''),
                    'authed' => $authed,
                ],
                $errors
            );
            $done = $errors === [];
            break;
        }

        if ($done && $errors === []) {
            if (!write_store($store)) {
                $errors[] = 'Could not save the comment: the server cannot write to api/data. Check the folder permissions.';
            } else {
                header('Location: /blog/#p' . preg_replace('/[^a-f0-9]/', '', $postId));
                exit;
            }
        }

        if ($errors === []) {
            $errors[] = 'That post is gone.';
        }
    }

    if ($errors !== [] && $upload !== []) {
        comment_drop_file($upload);
    }
}

if ($action === 'uncomment') {
    $postId = (string) ($_POST['post'] ?? '');
    $store = read_store();

    foreach ($store['posts'] as $index => $post) {
        if ((string) ($post['id'] ?? '') !== $postId) {
            continue;
        }

        $store['posts'][$index]['comments'] = remove_comment(
            (array) ($post['comments'] ?? []),
            (string) ($_POST['comment'] ?? ''),
            (string) ($_POST['answer'] ?? ''),
            $authed
        );
        break;
    }

    write_store($store);
    header('Location: /blog/#p' . preg_replace('/[^a-f0-9]/', '', $postId));
    exit;
}

$posts = all_posts();
$banner = random_asset('banners', ['png', 'jpg', 'jpeg', 'gif', 'webp']);
$ad = random_ad_banner();
$me = visitor_hash();
$now = time();
$token = public_token();
$adminName = admin_name();
$csrf = (string) ($_SESSION['csrf'] ?? '');
$boardTitle = '/n/ - posts by ' . $adminName;

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($boardTitle) ?> - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=9">
</head>
<body class="blue">

<?= board_nav('n') ?>

<div class="page wide">

<?= board_header($boardTitle, 'Go to the posts', '#posts') ?>

	<div class="board" id="posts">

<?php if ($errors !== []): ?>
		<div class="box-body error">
<?php foreach ($errors as $message): ?>
			<div><?= e($message) ?></div>
<?php endforeach; ?>
		</div>
<?php endif; ?>

<?php if ($posts === []): ?>
		<div class="empty">No Posts in my Blog yet.</div>
<?php endif; ?>

<?php foreach ($posts as $post): ?>
<?php
$background = in_array((string) ($post['bg'] ?? 'default'), post_backgrounds(), true)
    ? (string) ($post['bg'] ?? 'default')
    : 'default';
$comments = (array) ($post['comments'] ?? []);
$open = !empty($post['comments_open']);
?>
		<div class="thread-post" id="p<?= e((string) $post['id']) ?>">
			<div class="post bg-<?= e($background) ?>">
				<div class="post-head">
					<?= poster_name_html($adminName, true) ?>
<?php $flag = country_flag_html((string) ($post['country'] ?? '')); ?>
<?php if ($flag !== ''): ?>
					<?= $flag ?>
<?php endif; ?>
					<span class="post-date msg-date" data-ts="<?= (int) $post['created'] ?>"><?= e(gmdate('m/d/y(D)H:i:s', (int) $post['created'])) ?></span>
<?php if ((int) ($post['no'] ?? 0) > 0): ?>
					<span class="msg-no">No.<?= (int) $post['no'] ?></span>
<?php endif; ?>
					<a class="post-anchor" href="#p<?= e((string) $post['id']) ?>" title="Link to this post">&#9654;</a>
				</div>
<?= post_file_line($post) ?>
<?php if (($post['images'] ?? []) !== []): ?>
				<div class="post-media">
<?php foreach ((array) $post['images'] as $media): ?>
<?php $src = '/assets/blog/' . basename((string) $media['file']); ?>
<?php if ((string) ($media['type'] ?? 'image') === 'video'): ?>
					<span class="post-image"><video src="<?= e($src) ?>" controls preload="metadata"></video></span>
<?php elseif ((string) ($media['link'] ?? '') !== ''): ?>
					<a class="post-image linked" href="<?= e((string) $media['link']) ?>" target="_blank" rel="noopener noreferrer"><img src="<?= e($src) ?>" alt=""><span class="click">Click</span></a>
<?php else: ?>
					<span class="post-image"><img src="<?= e($src) ?>" alt="" data-full="<?= e($src) ?>" data-kind="image"></span>
<?php endif; ?>
<?php endforeach; ?>
				</div>
<?php endif; ?>
<?php if ((string) $post['text'] !== ''): ?>
				<div class="post-text"><?= render_post_text((string) $post['text']) ?></div>
<?php endif; ?>
			</div>

<?php if ($open || $authed): ?>
			<div class="commentctl">
<?php if ($authed): ?>
				<form method="post" action="/admin.php" class="commentctl-form">
					<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
					<input type="hidden" name="action" value="comments">
					<input type="hidden" name="id" value="<?= e((string) $post['id']) ?>">
					<input type="hidden" name="open" value="<?= $open ? '0' : '1' ?>">
					<button type="submit">[<?= $open ? 'Close comments' : 'Allow comments' ?>]</button>
				</form>
<?php endif; ?>
			</div>
<?php endif; ?>
<?php if ($open): ?>
<?= render_comments($comments, [
    'authed' => $authed,
    'me' => $me,
    'token' => $token,
    'admin_name' => $adminName,
    'form' => '/blog/',
    'keys' => ['post' => (string) $post['id']],
    'action_add' => 'comment',
    'action_answer' => 'answer',
    'action_delete' => 'uncomment',
]) ?>
<?php endif; ?>
		</div>
<?php endforeach; ?>
	</div>

<?= page_footer($authed) ?>

</div>

<div class="lightbox" id="lightbox" hidden>
	<span class="lightbox-close" id="lightbox-close" title="Close">&#10005;</span>
	<div class="lightbox-stage" id="lightbox-stage"></div>
	<a class="lightbox-download" id="lightbox-download" download>Download</a>
</div>

<script src="/script.js?v=9"></script>
</body>
</html>
