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

$key = (string) ($_GET['b'] ?? '');
$known = board_list() + page_list();

if (!isset($known[$key]) || $key === 'c' || $key === 'n') {
    require __DIR__ . '/404.php';
    exit;
}

$board = $known[$key];
$url = (string) $board['url'];
$action = (string) ($_POST['action'] ?? '');

if ($action !== '' && !public_token_valid((string) ($_POST['token'] ?? ''))) {
    $errors[] = 'The page went stale. Reload and try again.';
    $action = '';
}

if ($action === 'comment') {
    $author = comment_author($authed);
    $text = mb_substr(trim((string) ($_POST['text'] ?? '')), 0, MAX_CHAT_TEXT);
    $upload = comment_upload($errors);

    if ($errors === [] && $text === '' && $upload === []) {
        $errors[] = 'Write something first.';
    }

    if ($errors === []) {
        migrate_numbers();
        $store = page_store_read();
        $store[$key] = apply_comment((array) ($store[$key] ?? []), [
            'name' => $author['name'],
            'text' => $text,
            'admin' => $author['admin'],
            'upload' => $upload,
            'to' => (int) ($_POST['to'] ?? 0),
        ]);

        if (!page_store_write($store)) {
            $errors[] = 'Could not save the comment: the server cannot write to api/data. Check the folder permissions.';
        } else {
            header('Location: ' . $url . '#comments');
            exit;
        }
    }

    if ($errors !== [] && $upload !== []) {
        comment_drop_file($upload);
    }
}

if ($action === 'uncomment') {
    $store = page_store_read();
    $store[$key] = remove_comment(
        (array) ($store[$key] ?? []),
        (string) ($_POST['comment'] ?? ''),
        $authed
    );
    page_store_write($store);
    header('Location: ' . $url . '#comments');
    exit;
}

$comments = (array) (page_store_read()[$key] ?? []);
$token = public_token();
$me = visitor_hash();
$fragment = project_root() . '/pages/' . $key . '.html';

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e((string) $board['title']) ?> - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=11">
</head>
<body class="blue">

<?= board_nav($key) ?>

<div class="page wide">

<?= board_header((string) $board['title'], 'Go to the comments', '#comments') ?>

	<div class="board">

		<div class="pagebody">
<?php if (is_file($fragment)): ?>
<?php require $fragment; ?>
<?php else: ?>
			<div class="empty">Nothing here yet.</div>
<?php endif; ?>
		</div>

		<hr class="boardrule">

		<div class="pagecomments" id="comments">
<?php if ($errors !== []): ?>
			<div class="box-body error">
<?php foreach ($errors as $message): ?>
				<div><?= e($message) ?></div>
<?php endforeach; ?>
			</div>
<?php endif; ?>
<?= render_comments($comments, [
    'authed' => $authed,
    'me' => $me,
    'token' => $token,
    'admin_name' => admin_name(),
    'form' => $url,
    'keys' => [],
    'action_add' => 'comment',
    'action_delete' => 'uncomment',
]) ?>
		</div>

	</div>

<?= page_footer($authed) ?>

</div>

<div class="lightbox" id="lightbox" hidden>
	<span class="lightbox-close" id="lightbox-close" title="Close">&#10005;</span>
	<div class="lightbox-stage" id="lightbox-stage"></div>
	<a class="lightbox-download" id="lightbox-download" download>Download</a>
</div>

<script src="/script.js?v=11"></script>
</body>
</html>
