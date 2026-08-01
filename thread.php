<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$errors = [];

function comment_upload(array &$errors): string
{
    $error = (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        return '';
    }

    $dir = comments_dir();

    if ($dir === '') {
        $errors[] = 'Upload folder assets/comments is not writable.';

        return '';
    }

    $tmp = (string) ($_FILES['file']['tmp_name'] ?? '');

    if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
        $errors[] = 'The attachment failed to upload.';

        return '';
    }

    if ((int) ($_FILES['file']['size'] ?? 0) > CHAT_UPLOAD_BYTES) {
        $errors[] = 'The attachment is larger than 3 MB.';

        return '';
    }

    $info = @getimagesize($tmp);
    $allowed = [IMAGETYPE_JPEG => '.jpg', IMAGETYPE_PNG => '.png', IMAGETYPE_GIF => '.gif'];

    if ($info === false || !isset($allowed[$info[2]])) {
        $errors[] = 'The attachment must be PNG, JPG or GIF.';

        return '';
    }

    $name = bin2hex(random_bytes(8)) . $allowed[$info[2]];

    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        $errors[] = 'Could not save the attachment.';

        return '';
    }

    @chmod($dir . '/' . $name, 0644);

    return $name;
}

function comment_drop_file(array $comment): void
{
    $dir = comments_dir();
    $name = (string) ($comment['file'] ?? '');
    $file = $name === '' ? '' : basename($name);

    if ($dir !== '' && $file !== '' && is_file($dir . '/' . $file)) {
        @unlink($dir . '/' . $file);
    }
}

$action = (string) ($_POST['action'] ?? '');

if ($action !== '' && !public_token_valid((string) ($_POST['token'] ?? ''))) {
    $errors[] = 'The page went stale. Reload and try again.';
    $action = '';
}

if ($action === 'comment' || $action === 'answer') {
    $postId = (string) ($_POST['post'] ?? '');
    $text = mb_substr(trim((string) ($_POST['text'] ?? '')), 0, MAX_CHAT_TEXT);
    $name = $authed ? 'nysha4real' : clean_name((string) ($_POST['name'] ?? ''));

    if ($name === '') {
        $name = 'Anonymous';
    }

    $file = $action === 'comment' ? comment_upload($errors) : '';

    if ($errors === [] && $text === '' && $file === '') {
        $errors[] = 'Write something first.';
    }

    if ($errors === []) {
        $store = read_store();
        $me = visitor_hash();
        $done = false;

        foreach ($store['posts'] as $index => $post) {
            if ((string) ($post['id'] ?? '') !== $postId) {
                continue;
            }

            if ($action === 'comment') {
                $store['posts'][$index]['comments'][] = [
                    'id' => bin2hex(random_bytes(8)),
                    'created' => time(),
                    'name' => $name,
                    'text' => $text,
                    'file' => $file,
                    'ip' => $me,
                    'admin' => $authed,
                    'answers' => [],
                ];
                $done = true;
                break;
            }

            $target = (string) ($_POST['comment'] ?? '');

            foreach ((array) ($post['comments'] ?? []) as $spot => $comment) {
                if ((string) ($comment['id'] ?? '') !== $target) {
                    continue;
                }

                if (!$authed && hash_equals((string) ($comment['ip'] ?? ''), $me)) {
                    $errors[] = 'You cannot answer your own comment.';
                    break;
                }

                $store['posts'][$index]['comments'][$spot]['answers'][] = [
                    'id' => bin2hex(random_bytes(8)),
                    'created' => time(),
                    'name' => $name,
                    'text' => $text,
                    'ip' => $me,
                    'admin' => $authed,
                ];
                $done = true;
                break;
            }

            break;
        }

        if ($done && $errors === []) {
            write_store($store);
            header('Location: /thr/#p' . preg_replace('/[^a-f0-9]/', '', $postId));
            exit;
        }

        if ($errors === []) {
            $errors[] = 'That post is gone.';
        }
    }

    if ($errors !== [] && $file !== '') {
        comment_drop_file(['file' => $file]);
    }
}

if ($action === 'uncomment') {
    $postId = (string) ($_POST['post'] ?? '');
    $target = (string) ($_POST['comment'] ?? '');
    $answer = (string) ($_POST['answer'] ?? '');
    $store = read_store();
    $me = visitor_hash();

    foreach ($store['posts'] as $index => $post) {
        if ((string) ($post['id'] ?? '') !== $postId) {
            continue;
        }

        $kept = [];

        foreach ((array) ($post['comments'] ?? []) as $comment) {
            $mine = hash_equals((string) ($comment['ip'] ?? ''), $me);

            if ($answer === '' && (string) ($comment['id'] ?? '') === $target) {
                if ($authed || $mine) {
                    comment_drop_file($comment);
                    continue;
                }
            }

            if ($answer !== '' && (string) ($comment['id'] ?? '') === $target) {
                $keptAnswers = [];

                foreach ((array) ($comment['answers'] ?? []) as $item) {
                    $ownAnswer = hash_equals((string) ($item['ip'] ?? ''), $me);

                    if ((string) ($item['id'] ?? '') === $answer && ($authed || $ownAnswer)) {
                        continue;
                    }

                    $keptAnswers[] = $item;
                }

                $comment['answers'] = $keptAnswers;
            }

            $kept[] = $comment;
        }

        $store['posts'][$index]['comments'] = $kept;
        break;
    }

    write_store($store);
    header('Location: /thr/#p' . preg_replace('/[^a-f0-9]/', '', $postId));
    exit;
}

$posts = all_posts();
$me = visitor_hash();
$now = time();
$token = public_token();

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>/thr/ - Blog - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=3">
</head>
<body>

<div class="logo">
	<a href="/home"><img src="/assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="nav">[<a href="/home">Return to Home</a>]</div>

	<div class="box">
		<div class="box-title">/thr/ - Blog</div>

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
$total = count($comments);
$recent = array_slice($comments, -COMMENTS_OPEN);
?>
		<div class="thread-post" id="p<?= e((string) $post['id']) ?>">
			<div class="post bg-<?= e($background) ?>">
<?php if (($post['images'] ?? []) !== []): ?>
				<div class="post-images">
<?php foreach ((array) $post['images'] as $media): ?>
<?php $src = '/assets/blog/' . basename((string) $media['file']); ?>
<?php if ((string) ($media['type'] ?? 'image') === 'video'): ?>
					<span class="post-image"><video src="<?= e($src) ?>" controls preload="metadata"></video></span>
<?php elseif ((string) ($media['link'] ?? '') !== ''): ?>
					<a class="post-image linked" href="<?= e((string) $media['link']) ?>" target="_blank" rel="noopener noreferrer"><img src="<?= e($src) ?>" alt=""><span class="click">Click</span></a>
<?php else: ?>
					<span class="post-image"><img src="<?= e($src) ?>" alt=""></span>
<?php endif; ?>
<?php endforeach; ?>
				</div>
<?php endif; ?>
<?php if ((string) $post['text'] !== ''): ?>
				<p class="post-text"><?= render_post_text((string) $post['text']) ?></p>
<?php endif; ?>
				<div class="date"><?= e(chat_age($now - (int) $post['created'])) ?></div>
			</div>

			<div class="comments" data-total="<?= $total ?>">
				<div class="comments-bar">
					<span class="comments-toggle">Comments (<?= $total ?>)</span>
				</div>

				<div class="comments-body" hidden>
<?php foreach ($comments as $index => $comment): ?>
<?php
$mine = hash_equals((string) ($comment['ip'] ?? ''), $me);
$hidden = $total > COMMENTS_OPEN && $index < $total - COMMENTS_OPEN;
?>
					<div class="comment<?= $hidden ? ' folded' : '' ?>">
						<div class="msg-name"><?= e((string) $comment['name']) ?><?= !empty($comment['admin']) ? ' &mdash; <span class="msg-admin">Admin</span>' : '' ?></div>
<?php if ((string) $comment['text'] !== ''): ?>
						<div class="msg-text"><?= render_post_text((string) $comment['text']) ?></div>
<?php endif; ?>
<?php if ((string) ($comment['file'] ?? '') !== ''): ?>
<?php $csrc = '/assets/comments/' . basename((string) $comment['file']); ?>
						<div class="comment-media"><img src="<?= e($csrc) ?>" alt="" data-full="<?= e($csrc) ?>" data-kind="image"></div>
<?php endif; ?>
						<div class="msg-date"><?= e(chat_age($now - (int) $comment['created'])) ?></div>
						<div class="msg-actions">
<?php if ($authed || !$mine): ?>
							<span class="msg-reply" data-target="<?= e((string) $comment['id']) ?>">Reply</span>
<?php endif; ?>
<?php if ($authed || $mine): ?>
							<form method="post" action="/thr/" class="msg-remove">
								<input type="hidden" name="token" value="<?= e($token) ?>">
								<input type="hidden" name="action" value="uncomment">
								<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
								<input type="hidden" name="comment" value="<?= e((string) $comment['id']) ?>">
								<button type="submit">Delete</button>
							</form>
<?php endif; ?>
						</div>
<?php if ($authed || !$mine): ?>
						<form method="post" action="/thr/" class="replyform" id="r<?= e((string) $comment['id']) ?>">
							<input type="hidden" name="token" value="<?= e($token) ?>">
							<input type="hidden" name="action" value="answer">
							<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
							<input type="hidden" name="comment" value="<?= e((string) $comment['id']) ?>">
<?php if ($authed): ?>
							<span class="replyname">nysha4real &mdash; <span class="msg-admin">Admin</span></span>
<?php else: ?>
							<input type="text" name="name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous">
<?php endif; ?>
							<input type="text" name="text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Write an answer&hellip;" required>
							<button type="submit">Answer</button>
						</form>
<?php endif; ?>
<?php foreach ((array) ($comment['answers'] ?? []) as $answer): ?>
<?php $ownAnswer = hash_equals((string) ($answer['ip'] ?? ''), $me); ?>
						<div class="reply">
							<div class="msg-name"><?= e((string) $answer['name']) ?><?= !empty($answer['admin']) ? ' &mdash; <span class="msg-admin">Admin</span>' : '' ?></div>
							<div class="msg-text"><?= render_post_text((string) $answer['text']) ?></div>
							<div class="msg-date"><?= e(chat_age($now - (int) $answer['created'])) ?></div>
<?php if ($authed || $ownAnswer): ?>
							<form method="post" action="/thr/" class="msg-remove">
								<input type="hidden" name="token" value="<?= e($token) ?>">
								<input type="hidden" name="action" value="uncomment">
								<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
								<input type="hidden" name="comment" value="<?= e((string) $comment['id']) ?>">
								<input type="hidden" name="answer" value="<?= e((string) $answer['id']) ?>">
								<button type="submit">Delete</button>
							</form>
<?php endif; ?>
						</div>
<?php endforeach; ?>
					</div>
<?php endforeach; ?>

<?php if ($total > COMMENTS_OPEN): ?>
					<div class="comments-more"><span class="comments-all">Load all <?= $total ?> comments</span></div>
<?php endif; ?>

					<form method="post" action="/thr/" enctype="multipart/form-data" class="commentform">
						<input type="hidden" name="token" value="<?= e($token) ?>">
						<input type="hidden" name="action" value="comment">
						<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
<?php if ($authed): ?>
						<span class="replyname">nysha4real &mdash; <span class="msg-admin">Admin</span></span>
<?php else: ?>
						<input type="text" name="name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous">
<?php endif; ?>
						<input type="text" name="text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Write a comment&hellip;">
						<label class="say-clip" title="Attach PNG / JPG / GIF, up to 3 MB">
							<input type="file" name="file" accept="image/png,image/jpeg,image/gif">
							<img class="clip-icon" src="/assets/clip.png" alt="Attach">
							<span class="clip-name"></span>
						</label>
						<button type="submit">Send</button>
					</form>

					<div class="comments-bar"><span class="comments-hide">Hide comments</span></div>
				</div>
			</div>
		</div>
<?php endforeach; ?>
	</div>

	<div class="pagelinks">
		<a href="/home">Home</a>
		<span class="dot">&#9679;</span>
		<a href="/faq">FAQ</a>
		<span class="dot">&#9679;</span>
		<a href="/rules">Rules</a>
<?php if ($authed): ?>
		<span class="dot">&#9679;</span>
		<a href="/admintools.php">Admin Tools</a>
<?php endif; ?>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

	<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>

</div>

<div class="lightbox" id="lightbox" hidden>
	<span class="lightbox-close" id="lightbox-close" title="Close">&#10005;</span>
	<div class="lightbox-stage" id="lightbox-stage"></div>
	<a class="lightbox-download" id="lightbox-download" download>Download</a>
</div>

<script src="/script.js?v=3"></script>
</body>
</html>
