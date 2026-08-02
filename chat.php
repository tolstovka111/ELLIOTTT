<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';
require_once __DIR__ . '/api/ui.php';

if (isset($_COOKIE['realadmin'])) {
    admin_session_start();
}

$authed = !empty($_SESSION['admin']);
$errors = [];
$fragment = isset($_GET['list']);

function chat_store_upload(array &$errors): array
{
    $error = (int) ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($error === UPLOAD_ERR_NO_FILE) {
        return [];
    }

    $dir = chat_dir();

    if ($dir === '') {
        $errors[] = 'Upload folder assets/chat is not writable.';

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
    $pictures = image_types();

    if ($info === false || !isset($pictures[$info[2]])) {
        $errors[] = 'The attachment must be PNG, JPG, GIF or WEBP.';

        return [];
    }

    $name = bin2hex(random_bytes(8)) . $pictures[$info[2]];

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

$action = $fragment ? '' : (string) ($_POST['action'] ?? '');

if ($action !== '' && !public_token_valid((string) ($_POST['token'] ?? ''))) {
    $errors[] = 'The page went stale. Reload and try again.';
    $action = '';
}

if ($action === 'say') {
    $left = $authed ? 0 : chat_cooldown_left();

    if ($left > 0) {
        $errors[] = 'One message per minute. Wait ' . $left . ' s.';
    } else {
        $text = mb_substr(trim((string) ($_POST['text'] ?? '')), 0, MAX_CHAT_TEXT);
        $adminName = admin_name();
        $asAdmin = $authed && (string) ($_POST['asadmin'] ?? '') === '1';
        $name = $asAdmin ? $adminName : clean_name((string) ($_POST['name'] ?? ''));

        if ($name === '') {
            $name = 'Anonymous';
        }

        if (!$asAdmin && strcasecmp($name, $adminName) === 0) {
            $name = 'Anonymous';
        }

        $upload = chat_store_upload($errors);

        if ($errors === [] && $text === '' && $upload === []) {
            $errors[] = 'Write something first.';
        }

        if ($errors !== []) {
            if ($upload !== []) {
                chat_drop_file($upload);
            }
        } else {
            migrate_numbers();
            $store = chat_read();

            $entry = array_merge([
                'id' => bin2hex(random_bytes(8)),
                'no' => next_no(),
                'to' => max(0, (int) ($_POST['to'] ?? 0)),
                'created' => time(),
                'name' => $name,
                'text' => $text,
                'ip' => visitor_hash(),
                'country' => visitor_country(),
                'admin' => $asAdmin,
            ], $upload);

            array_unshift($store['messages'], $entry);

            if (!chat_write($store)) {
                if ($upload !== []) {
                    chat_drop_file($upload);
                }

                $errors[] = 'Could not save the message: the server cannot write to api/data. Check the folder permissions.';
            } else {
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
    $store = chat_read();
    $me = visitor_hash();
    $kept = [];

    foreach ($store['messages'] as $message) {
        $mine = hash_equals((string) ($message['ip'] ?? ''), $me);

        if ((string) ($message['id'] ?? '') === $target) {
            if ($authed || $mine) {
                chat_drop_file($message);
                continue;
            }

            $errors[] = 'You can only delete your own messages.';
        }

        $kept[] = $message;
    }

    if ($errors === []) {
        $store['messages'] = $kept;

        if (!chat_write($store)) {
            $errors[] = 'Could not save: the server cannot write to api/data.';
        } else {
            header('Location: /c/');
            exit;
        }
    }
}

$store = chat_read();
$messages = $store['messages'];
$me = visitor_hash();
$token = public_token();
$cooldown = $authed ? 0 : chat_cooldown_left();

function stamp(array $item): string
{
    return '<span class="msg-date" data-ts="' . (int) $item['created'] . '">'
        . e(gmdate('m/d/y(D)H:i:s', (int) $item['created'])) . '</span>';
}

function poster(array $item): string
{
    $line = poster_name_html((string) $item['name'], !empty($item['admin']));
    $flag = country_flag_html((string) ($item['country'] ?? ''));

    if ($flag !== '') {
        $line .= ' ' . $flag;
    }

    return $line . ' ' . stamp($item) . ' <span class="msg-no">No.' . (int) ($item['no'] ?? 0) . '</span>';
}

/**
 * The bracketed [reply] and [delete] links that follow the timestamp.
 */
function chat_actions(array $item, bool $canDelete, string $token): string
{
    $out = ' <span class="msg-act">[<span class="msg-reply" data-no="' . (int) ($item['no'] ?? 0)
        . '">reply</span>]</span>';

    if ($canDelete) {
        $out .= ' <span class="msg-act">[<form method="post" action="/c/" class="msg-remove">'
            . '<input type="hidden" name="token" value="' . e($token) . '">'
            . '<input type="hidden" name="action" value="remove">'
            . '<input type="hidden" name="id" value="' . e((string) $item['id']) . '">'
            . '<button type="submit">delete</button></form>]</span>';
    }

    return $out;
}

function chat_file_line(array $message): string
{
    $file = (string) ($message['file'] ?? '');

    if ($file === '') {
        return '';
    }

    $src = '/assets/chat/' . basename($file);
    $meta = format_size((int) ($message['fsize'] ?? 0)) . ', ' . (int) ($message['fw'] ?? 0) . 'x' . (int) ($message['fh'] ?? 0);

    return '<div class="msg-file">File: <a href="' . e($src) . '" target="_blank" rel="noopener">'
        . e((string) ($message['fname'] ?? 'file')) . '</a> (' . e($meta) . ')</div>'
        . '<div class="msg-media"><img src="' . e($src) . '" alt="" data-full="' . e($src) . '" data-kind="image"></div>';
}

ob_start();
?>
<?php if ($messages === []): ?>
		<div class="empty">No messages yet. Say something.</div>
<?php endif; ?>
<?php foreach ($messages as $message): ?>
<?php $mine = hash_equals((string) ($message['ip'] ?? ''), $me); ?>
		<div class="msg" id="p<?= (int) ($message['no'] ?? 0) ?>">
			<div class="msg-head"><?= poster($message) ?><?= chat_actions($message, $authed || $mine, $token) ?></div>
<?= chat_file_line($message) ?>
<?= quote_html($message) ?>
<?php if ((string) $message['text'] !== ''): ?>
			<div class="msg-text"><?= render_post_text((string) $message['text']) ?></div>
<?php endif; ?>
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
<title>/c/ - chat - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css?v=11">
</head>
<body class="blue">

<?= board_nav('c') ?>

<div class="page wide">

<?= board_header('/c/ - chat', 'Write message', '#sayform') ?>

	<div class="board">

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
			<input type="hidden" name="to" value="" class="reply-to">

			<div class="say-fields">
<?php if ($authed): ?>
				<div class="say-admin">
					<label class="adminswitch"><input type="checkbox" name="asadmin" value="1" checked><span>Post as admin</span></label>
					<span class="say-name-fixed"><?= poster_name_html(admin_name(), true) ?></span>
				</div>
<?php endif; ?>
				<input type="text" name="name" class="say-name" maxlength="<?= MAX_NAME ?>" placeholder="Anonymous" autocomplete="off"<?= $authed ? ' hidden' : '' ?>>
				<span class="reply-note" hidden>replying to <span class="reply-note-no"></span> <span class="reply-clear">[x]</span></span>
				<div class="say-line">
					<input type="text" name="text" class="say-text" maxlength="<?= MAX_CHAT_TEXT ?>" placeholder="Type text here" autocomplete="off">

					<label class="say-clip" title="Attach PNG / JPG / GIF / WEBP, up to 3 MB">
						<input type="file" name="file" accept="image/png,image/jpeg,image/gif,image/webp">
						<img class="clip-icon" src="/assets/clip.png" alt="Attach">
						<span class="clip-name"></span>
					</label>

					<button type="submit" class="say-send" id="say-send">Send</button>
					<span class="say-timer" id="say-timer" hidden>60</span>
				</div>
			</div>
		</form>

		<div class="boardline"></div>

		<div id="chat-list"><?= $list ?></div>
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
