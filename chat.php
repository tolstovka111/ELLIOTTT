<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$errors = [];
$fragment = isset($_GET['list']);

function chat_token(): string
{
    return hash_hmac('sha256', 'chat|' . gmdate('YmdH'), install_salt() . '|' . client_ip());
}

function chat_token_valid(string $sent): bool
{
    if ($sent === '') {
        return false;
    }

    if (hash_equals(chat_token(), $sent)) {
        return true;
    }

    $previous = hash_hmac('sha256', 'chat|' . gmdate('YmdH', time() - 3600), install_salt() . '|' . client_ip());

    return hash_equals($previous, $sent);
}

function chat_store_upload(string $field, bool $allowVideo, array &$errors): string
{
    $error = (int) ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        return '';
    }

    $dir = chat_dir();

    if ($dir === '') {
        $errors[] = 'Upload folder assets/chat is not writable.';

        return '';
    }

    $tmp = (string) ($_FILES[$field]['tmp_name'] ?? '');

    if ($error !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
        $errors[] = 'The attachment failed to upload.';

        return '';
    }

    if ((int) ($_FILES[$field]['size'] ?? 0) > CHAT_UPLOAD_BYTES) {
        $errors[] = 'The attachment is larger than 3 MB.';

        return '';
    }

    $info = @getimagesize($tmp);
    $pictures = image_types();

    if ($info !== false && isset($pictures[$info[2]])) {
        $name = bin2hex(random_bytes(8)) . $pictures[$info[2]];
    } elseif ($allowVideo) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo === false ? '' : strtolower((string) finfo_file($finfo, $tmp));

        if ($finfo !== false) {
            finfo_close($finfo);
        }

        $movies = video_types();

        if (!isset($movies[$mime])) {
            $errors[] = 'The attachment must be PNG, WEBP, JPG, GIF or MP4.';

            return '';
        }

        $name = bin2hex(random_bytes(8)) . $movies[$mime];
    } else {
        $errors[] = 'The avatar must be PNG, WEBP, JPG or GIF.';

        return '';
    }

    if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
        $errors[] = 'Could not save the attachment.';

        return '';
    }

    @chmod($dir . '/' . $name, 0644);

    return $name;
}

$action = $fragment ? '' : (string) ($_POST['action'] ?? '');

if ($action !== '' && !chat_token_valid((string) ($_POST['token'] ?? ''))) {
    $errors[] = 'The page went stale. Reload and try again.';
    $action = '';
}

if ($action === 'say' || $action === 'reply') {
    $left = $authed ? 0 : chat_cooldown_left();

    if ($left > 0) {
        $errors[] = 'One message per minute. Wait ' . $left . ' s.';
    } else {
        $text = trim((string) ($_POST['text'] ?? ''));
        $text = mb_substr($text, 0, MAX_CHAT_TEXT);
        $name = $authed ? 'nysha4real' : clean_name((string) ($_POST['name'] ?? ''));

        if ($name === '') {
            $name = 'Anonymous';
        }

        $avatar = '';
        $file = '';

        if ($action === 'say') {
            $avatar = $authed ? '' : chat_store_upload('avatar', false, $errors);
            $file = $errors === [] ? chat_store_upload('file', true, $errors) : '';
        }

        if ($errors === [] && $text === '' && $file === '') {
            $errors[] = 'Write something first.';
        }

        if ($errors !== []) {
            foreach ([$avatar, $file] as $leftover) {
                if ($leftover !== '') {
                    chat_drop_file(['file' => $leftover]);
                }
            }
        } else {
            $store = chat_read();

            if ($action === 'say') {
                array_unshift($store['messages'], [
                    'id' => bin2hex(random_bytes(8)),
                    'created' => time(),
                    'name' => $name,
                    'avatar' => $avatar,
                    'text' => $text,
                    'file' => $file,
                    'ftype' => $file !== '' && strtolower((string) pathinfo($file, PATHINFO_EXTENSION)) === 'mp4' ? 'video' : 'image',
                    'ip' => visitor_hash(),
                    'admin' => $authed,
                    'replies' => [],
                ]);
            } else {
                $target = (string) ($_POST['id'] ?? '');
                $found = false;

                foreach ($store['messages'] as $index => $message) {
                    if ((string) ($message['id'] ?? '') === $target) {
                        $store['messages'][$index]['replies'][] = [
                            'id' => bin2hex(random_bytes(8)),
                            'created' => time(),
                            'name' => $name,
                            'text' => $text,
                            'ip' => visitor_hash(),
                            'admin' => $authed,
                        ];
                        $found = true;
                        break;
                    }
                }

                if (!$found) {
                    $errors[] = 'That message is gone.';
                }
            }

            if ($errors === []) {
                chat_write($store);

                if (!$authed) {
                    chat_touch_cooldown();
                }
                header('Location: /c/');
                exit;
            }
        }
    }
}

if ($action === 'remove') {
    $target = (string) ($_POST['id'] ?? '');
    $reply = (string) ($_POST['reply'] ?? '');
    $store = chat_read();
    $me = visitor_hash();
    $kept = [];

    foreach ($store['messages'] as $message) {
        $mine = hash_equals((string) ($message['ip'] ?? ''), $me);

        if ($reply === '' && (string) ($message['id'] ?? '') === $target) {
            if ($authed || $mine) {
                chat_drop_file($message);
                continue;
            }

            $errors[] = 'You can only delete your own messages.';
        }

        if ($reply !== '' && (string) ($message['id'] ?? '') === $target) {
            $keptReplies = [];

            foreach ((array) ($message['replies'] ?? []) as $item) {
                $ownReply = hash_equals((string) ($item['ip'] ?? ''), $me);

                if ((string) ($item['id'] ?? '') === $reply && ($authed || $ownReply)) {
                    continue;
                }

                $keptReplies[] = $item;
            }

            $message['replies'] = $keptReplies;
        }

        $kept[] = $message;
    }

    if ($errors === []) {
        chat_write(['messages' => $kept]);
        header('Location: /c/');
        exit;
    }
}

$store = chat_read();
$messages = $store['messages'];
$me = visitor_hash();
$now = time();
$token = chat_token();
$cooldown = $authed ? 0 : chat_cooldown_left();

function chat_media(array $message): string
{
    $file = (string) ($message['file'] ?? '');

    if ($file === '') {
        return '';
    }

    $src = '/assets/chat/' . basename($file);

    if ((string) ($message['ftype'] ?? 'image') === 'video') {
        return '<div class="msg-media"><video src="' . e($src) . '" preload="metadata" muted data-full="' . e($src) . '" data-kind="video"></video></div>';
    }

    return '<div class="msg-media"><img src="' . e($src) . '" alt="" data-full="' . e($src) . '" data-kind="image"></div>';
}

ob_start();
?>
<?php if ($messages === []): ?>
		<div class="empty">No messages yet. Say something.</div>
<?php endif; ?>
<?php foreach ($messages as $message): ?>
<?php $mine = hash_equals((string) ($message['ip'] ?? ''), $me); ?>
		<div class="msg" id="m<?= e((string) $message['id']) ?>">
			<div class="msg-main">
				<div class="msg-avatar">
<?php if (!empty($message['admin'])): ?>
					<img src="/assets/avatar-admin.png" alt="">
<?php elseif ((string) ($message['avatar'] ?? '') !== ''): ?>
					<img src="/assets/chat/<?= e(basename((string) $message['avatar'])) ?>" alt="">
<?php else: ?>
					<img src="/assets/avatar-anon.jpg" alt="">
<?php endif; ?>
				</div>
				<div class="msg-body">
					<div class="msg-name"><?= e((string) $message['name']) ?><?= !empty($message['admin']) ? ' &mdash; <span class="msg-admin">Admin</span>' : '' ?></div>
<?php if ((string) $message['text'] !== ''): ?>
					<div class="msg-text"><?= render_post_text((string) $message['text']) ?></div>
<?php endif; ?>
					<div class="msg-date"><?= e(chat_age($now - (int) $message['created'])) ?></div>
					<div class="msg-actions">
						<span class="msg-reply" data-target="<?= e((string) $message['id']) ?>">Reply</span>
<?php if ($authed || $mine): ?>
						<form method="post" action="/c/" class="msg-remove">
							<input type="hidden" name="token" value="<?= e($token) ?>">
							<input type="hidden" name="action" value="remove">
							<input type="hidden" name="id" value="<?= e((string) $message['id']) ?>">
							<button type="submit">Delete</button>
						</form>
<?php endif; ?>
					</div>
					<form method="post" action="/c/" class="replyform" id="r<?= e((string) $message['id']) ?>">
						<input type="hidden" name="token" value="<?= e($token) ?>">
						<input type="hidden" name="action" value="reply">
						<input type="hidden" name="id" value="<?= e((string) $message['id']) ?>">
<?php if ($authed): ?>
						<span class="replyname">nysha4real &mdash; <span class="msg-admin">Admin</span></span>
<?php else: ?>
						<input type="text" name="name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous">
<?php endif; ?>
						<input type="text" name="text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Write a reply&hellip;" required>
						<button type="submit">Reply</button>
					</form>
<?php foreach ((array) ($message['replies'] ?? []) as $reply): ?>
<?php $ownReply = hash_equals((string) ($reply['ip'] ?? ''), $me); ?>
					<div class="reply">
						<div class="msg-name"><?= e((string) $reply['name']) ?><?= !empty($reply['admin']) ? ' &mdash; <span class="msg-admin">Admin</span>' : '' ?></div>
						<div class="msg-text"><?= render_post_text((string) $reply['text']) ?></div>
						<div class="msg-date"><?= e(chat_age($now - (int) $reply['created'])) ?></div>
<?php if ($authed || $ownReply): ?>
						<form method="post" action="/c/" class="msg-remove">
							<input type="hidden" name="token" value="<?= e($token) ?>">
							<input type="hidden" name="action" value="remove">
							<input type="hidden" name="id" value="<?= e((string) $message['id']) ?>">
							<input type="hidden" name="reply" value="<?= e((string) $reply['id']) ?>">
							<button type="submit">Delete</button>
						</form>
<?php endif; ?>
					</div>
<?php endforeach; ?>
				</div>
<?= chat_media($message) ?>
			</div>
		</div>
<?php endforeach; ?>
<?php
$list = (string) ob_get_clean();

if ($fragment) {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $list;
    exit;
}

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>/c/ - Chat - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css">
</head>
<body>

<div class="logo">
	<a href="/home"><img src="/assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="nav">[<a href="/home">Return to Home</a>]</div>

	<div class="box">
		<div class="box-title">/c/ - Chat</div>

<?php if ($errors !== []): ?>
		<div class="box-body error">
<?php foreach ($errors as $message): ?>
			<div><?= e($message) ?></div>
<?php endforeach; ?>
		</div>
<?php endif; ?>

		<form method="post" action="/c/" enctype="multipart/form-data" class="sayform" id="sayform" data-cooldown="<?= (int) $cooldown ?>">
			<input type="hidden" name="token" value="<?= e($token) ?>">
			<input type="hidden" name="action" value="say">

			<label class="say-avatar" title="Pick an avatar">
				<input type="file" name="avatar" accept="image/png,image/webp,image/jpeg,image/gif" id="avatar-input"<?= $authed ? ' disabled' : '' ?>>
				<img src="<?= $authed ? '/assets/avatar-admin.png' : '/assets/avatar-anon.jpg' ?>" alt="Avatar" id="avatar-preview">
			</label>

			<div class="say-fields">
<?php if ($authed): ?>
				<div class="say-name-fixed">nysha4real &mdash; <span class="msg-admin">Admin</span></div>
<?php else: ?>
				<input type="text" name="name" class="say-name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous" autocomplete="off">
<?php endif; ?>
				<div class="say-line">
					<input type="text" name="text" class="say-text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Type text here" autocomplete="off">

					<label class="say-clip" title="Attach PNG / WEBP / JPG / GIF / MP4, up to 3 MB">
						<input type="file" name="file" accept="image/png,image/webp,image/jpeg,image/gif,video/mp4" id="clip-input">
						<img class="clip-icon" src="/assets/clip.png" alt="Attach">
						<span class="clip-name" id="clip-name"></span>
					</label>

					<button type="submit" class="say-send" id="say-send">Send</button>
					<span class="say-timer" id="say-timer" hidden>60</span>
				</div>
			</div>
		</form>

		<div class="rgbline"></div>

		<div id="chat-list"><?= $list ?></div>
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

	<div class="madeby">created by tolstovka (@nysha4real in telegram)</div>

</div>

<div class="lightbox" id="lightbox" hidden>
	<span class="lightbox-close" id="lightbox-close" title="Close">&#10005;</span>
	<div class="lightbox-stage" id="lightbox-stage"></div>
	<a class="lightbox-download" id="lightbox-download" download>Download</a>
</div>

<script src="/script.js"></script>
</body>
</html>
