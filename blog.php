<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$errors = [];

function comment_upload(array &$errors): array
{
    $error = (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        return [];
    }

    $dir = comments_dir();

    if ($dir === '') {
        $errors[] = 'Upload folder assets/comments is not writable.';

        return [];
    }

    $tmp = (string) ($_FILES['file']['tmp_name'] ?? '');

    if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
        $errors[] = 'The attachment failed to upload.';

        return [];
    }

    $size = (int) ($_FILES['file']['size'] ?? 0);

    if ($size > CHAT_UPLOAD_BYTES) {
        $errors[] = 'The attachment is larger than 3 MB.';

        return [];
    }

    $info = @getimagesize($tmp);
    $allowed = [IMAGETYPE_JPEG => '.jpg', IMAGETYPE_PNG => '.png', IMAGETYPE_GIF => '.gif'];

    if ($info === false || !isset($allowed[$info[2]])) {
        $errors[] = 'The attachment must be PNG, JPG or GIF.';

        return [];
    }

    $name = bin2hex(random_bytes(8)) . $allowed[$info[2]];

    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        $errors[] = 'Could not save the attachment.';

        return [];
    }

    @chmod($dir . '/' . $name, 0644);

    return [
        'file' => $name,
        'fname' => clean_filename((string) ($_FILES['file']['name'] ?? '')),
        'fsize' => $size,
        'fw' => (int) $info[0],
        'fh' => (int) $info[1],
    ];
}

function comment_stamp(array $item): string
{
    return '<span class="msg-date" data-ts="' . (int) $item['created'] . '">'
        . e(gmdate('m/d/y(D)H:i', (int) $item['created'])) . '</span>';
}

function comment_head(array $item): string
{
    $line = poster_name_html((string) $item['name'], !empty($item['admin']));
    $flag = country_flag_html((string) ($item['country'] ?? ''));

    if ($flag !== '') {
        $line .= ' ' . $flag;
    }

    return $line . ' ' . comment_stamp($item);
}

function comment_file_line(array $comment): string
{
    $file = (string) ($comment['file'] ?? '');

    if ($file === '') {
        return '';
    }

    $src = '/assets/comments/' . basename($file);
    $meta = format_size((int) ($comment['fsize'] ?? 0)) . ', ' . (int) ($comment['fw'] ?? 0) . 'x' . (int) ($comment['fh'] ?? 0);

    return '<div class="msg-file">File: <a href="' . e($src) . '" target="_blank" rel="noopener">'
        . e((string) ($comment['fname'] ?? 'file')) . '</a> (' . e($meta) . ')</div>'
        . '<div class="msg-media"><img src="' . e($src) . '" alt="" data-full="' . e($src) . '" data-kind="image"></div>';
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
    $text = mb_substr(trim((string) ($_POST['text'] ?? '')), 0, MAX_CHAT_TEXT);
    $name = clean_name((string) ($_POST['name'] ?? ''));
    $adminName = admin_name();

    if ($name === '') {
        $name = $authed ? $adminName : 'Anonymous';
    }

    $asAdmin = $authed && $name === $adminName;

    if (!$authed && strcasecmp($name, $adminName) === 0) {
        $name = 'Anonymous';
    }

    $upload = $action === 'comment' ? comment_upload($errors) : [];

    if ($errors === [] && $text === '' && $upload === []) {
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
                $store['posts'][$index]['comments'][] = array_merge([
                    'id' => bin2hex(random_bytes(8)),
                    'created' => time(),
                    'name' => $name,
                    'text' => $text,
                    'ip' => $me,
                    'country' => visitor_country(),
                    'admin' => $asAdmin,
                    'answers' => [],
                ], $upload);
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
                    'country' => visitor_country(),
                    'admin' => $asAdmin,
                ];
                $done = true;
                break;
            }

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
$boardTitle = '/n/ - posts by ' . $adminName;

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($boardTitle) ?> - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=8">
</head>
<body class="blue">

<div class="page wide">

	<div class="boardhead">
<?php if ($banner !== ''): ?>
		<a href="/404.php"><img class="boardbanner" src="<?= e($banner) ?>" alt="4real"></a>
<?php endif; ?>
		<h1 class="boardtitle"><?= e($boardTitle) ?></h1>
	</div>

	<hr class="boardrule">

	<div class="boardgo">[<a href="#posts" class="goposts">Go to the posts</a>]</div>

	<hr class="boardrule thin">

<?php if ($ad !== []): ?>
	<div class="adbanner">
		<a href="<?= e((string) $ad['href']) ?>"><img src="<?= e((string) $ad['src']) ?>" alt="banner"></a>
	</div>

	<hr class="boardrule">
<?php endif; ?>

	<div class="nav">[<a href="/home">Return to Home</a>]</div>

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
$total = count($comments);
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

			<div class="comments" id="c<?= e((string) $post['id']) ?>" data-total="<?= $total ?>">
				<div class="comments-body"<?= $total > 0 ? ' hidden' : '' ?>>
<?php foreach ($comments as $index => $comment): ?>
<?php
$mine = hash_equals((string) ($comment['ip'] ?? ''), $me);
$hidden = $total > BLOG_COMMENTS_OPEN && $index < $total - BLOG_COMMENTS_OPEN;
?>
					<div class="comment<?= $hidden ? ' folded' : '' ?>">
						<div class="msg-head"><?= comment_head($comment) ?></div>
<?= comment_file_line($comment) ?>
<?php if ((string) $comment['text'] !== ''): ?>
						<div class="msg-text"><?= render_post_text((string) $comment['text']) ?></div>
<?php endif; ?>
						<div class="msg-actions">
<?php if ($authed || !$mine): ?>
							<span class="msg-reply" data-target="<?= e((string) $comment['id']) ?>">Reply</span>
<?php endif; ?>
<?php if ($authed || $mine): ?>
							<form method="post" action="/blog/" class="msg-remove">
								<input type="hidden" name="token" value="<?= e($token) ?>">
								<input type="hidden" name="action" value="uncomment">
								<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
								<input type="hidden" name="comment" value="<?= e((string) $comment['id']) ?>">
								<button type="submit">Delete</button>
							</form>
<?php endif; ?>
						</div>
<?php if ($authed || !$mine): ?>
						<form method="post" action="/blog/" class="replyform" id="r<?= e((string) $comment['id']) ?>">
							<input type="hidden" name="token" value="<?= e($token) ?>">
							<input type="hidden" name="action" value="answer">
							<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
							<input type="hidden" name="comment" value="<?= e((string) $comment['id']) ?>">
							<input type="text" name="name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous"<?= $authed ? ' value="' . e($adminName) . '"' : '' ?>>
							<input type="text" name="text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Write an answer&hellip;" required>
							<button type="submit">Answer</button>
						</form>
<?php endif; ?>
<?php foreach ((array) ($comment['answers'] ?? []) as $answer): ?>
<?php $ownAnswer = hash_equals((string) ($answer['ip'] ?? ''), $me); ?>
						<div class="reply">
							<div class="msg-head"><?= comment_head($answer) ?></div>
							<div class="msg-text"><?= render_post_text((string) $answer['text']) ?></div>
<?php if ($authed || $ownAnswer): ?>
							<form method="post" action="/blog/" class="msg-remove">
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

					<form method="post" action="/blog/" enctype="multipart/form-data" class="commentform">
						<input type="hidden" name="token" value="<?= e($token) ?>">
						<input type="hidden" name="action" value="comment">
						<input type="hidden" name="post" value="<?= e((string) $post['id']) ?>">
						<input type="text" name="name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous"<?= $authed ? ' value="' . e($adminName) . '"' : '' ?>>
						<input type="text" name="text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Write a comment&hellip;">
						<label class="say-clip" title="Attach PNG / JPG / GIF, up to 3 MB">
							<input type="file" name="file" accept="image/png,image/jpeg,image/gif">
							<img class="clip-icon" src="/assets/clip.png" alt="Attach">
							<span class="clip-name"></span>
						</label>
						<button type="submit">Send</button>
					</form>
				</div>

<?php if ($total > 0): ?>
				<div class="comments-bar">
<?php if ($total > BLOG_COMMENTS_OPEN): ?>
					<span class="comments-all" hidden>Show all <?= $total ?> comments</span>
<?php endif; ?>
					<span class="comments-hide" hidden>Hide comments</span>
					<span class="comments-show">Show comments (<?= $total ?>)</span>
				</div>
<?php endif; ?>
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

<script src="/script.js?v=8"></script>
</body>
</html>
