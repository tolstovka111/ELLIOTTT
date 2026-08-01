<?php

declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

admin_session_start();

header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

function csrf_valid(): bool
{
    $sent = (string) ($_POST['csrf'] ?? '');

    return $sent !== '' && hash_equals((string) $_SESSION['csrf'], $sent);
}

function throttle_path(): string
{
    $dir = data_dir();

    return $dir === '' ? '' : $dir . '/logins.json';
}

function throttle_read(): array
{
    $path = throttle_path();

    if ($path === '' || !is_file($path)) {
        return [];
    }

    $raw = @file_get_contents($path);
    $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : null;

    return is_array($data) ? $data : [];
}

function throttle_key(): string
{
    return secret_hash('login', client_ip());
}

function throttle_blocked_for(): int
{
    $data = throttle_read();
    $key = throttle_key();

    if (!isset($data[$key]['until'])) {
        return 0;
    }

    return max(0, (int) $data[$key]['until'] - time());
}

function throttle_fail(): void
{
    $path = throttle_path();

    if ($path === '') {
        return;
    }

    $data = throttle_read();
    $key = throttle_key();
    $now = time();
    $previous = isset($data[$key]) && is_array($data[$key]) ? $data[$key] : [];
    $until = (int) ($previous['until'] ?? 0);
    $fails = (int) ($previous['fails'] ?? 0);

    if ($until > 0 && $until <= $now) {
        $fails = 0;
    }

    $fails++;
    $entry = ['fails' => $fails, 'until' => 0, 'seen' => $now];

    if ($fails >= LOGIN_MAX_ATTEMPTS) {
        $entry = ['fails' => 0, 'until' => $now + LOGIN_LOCK_SECONDS, 'seen' => $now];
    }

    $data[$key] = $entry;

    foreach ($data as $k => $row) {
        if (($now - (int) ($row['seen'] ?? 0)) > 86400) {
            unset($data[$k]);
        }
    }

    @file_put_contents($path, (string) json_encode($data), LOCK_EX);
}

function throttle_clear(): void
{
    $path = throttle_path();

    if ($path === '') {
        return;
    }

    $data = throttle_read();
    unset($data[throttle_key()]);
    @file_put_contents($path, (string) json_encode($data), LOCK_EX);
}

function go(string $url): void
{
    header('Location: ' . $url);
    exit;
}

function flash(string $message): void
{
    $_SESSION['flash'] = ['message' => $message];
}

$config = load_config();
$provided = (string) ($_GET['k'] ?? $_POST['k'] ?? '');
$authed = !empty($_SESSION['admin']) && $config !== null;
$keyOk = $config !== null
    && $provided !== ''
    && hash_equals((string) $config['key_hash'], secret_hash('key', $provided));

unset($_SESSION['gate']);

if ($config !== null && !$keyOk && !$authed) {
    require __DIR__ . '/404.php';
    exit;
}

$action = (string) ($_POST['action'] ?? '');
$errors = [];

if ($action !== '' && !csrf_valid()) {
    $errors[] = 'Session expired. Try again.';
    $action = '';
}

if ($action === 'setup' && $config === null) {
    $user = trim((string) ($_POST['user'] ?? ''));
    $pass = (string) ($_POST['pass'] ?? '');
    $pass2 = (string) ($_POST['pass2'] ?? '');
    $key = trim((string) ($_POST['key'] ?? ''));

    if (preg_match('/^[A-Za-z0-9_.-]{3,32}$/', $user) !== 1) {
        $errors[] = 'Login must be 3-32 characters: letters, digits, dot, dash, underscore.';
    }

    if (strlen($pass) < 8) {
        $errors[] = 'Password must be at least 8 characters.';
    }

    if ($pass !== $pass2) {
        $errors[] = 'Passwords do not match.';
    }

    if (preg_match('/^[A-Za-z0-9_-]{16,64}$/', $key) !== 1) {
        $errors[] = 'Secret key must be 16-64 characters: letters, digits, dash, underscore.';
    }

    if ($errors === []) {
        $written = save_config(
            secret_hash('user', $user),
            password_hash($pass, PASSWORD_DEFAULT),
            secret_hash('key', $key)
        );

        if (!$written) {
            $errors[] = 'Could not write api/config.php. Check permissions.';
        } else {
            flash('Account created. Save this link, it is the only way in: admin.php?k=' . $key);
            go('admin.php?k=' . urlencode($key));
        }
    }
}

if ($action === 'login' && $config !== null) {
    $wait = throttle_blocked_for();

    if ($wait > 0) {
        $errors[] = 'Too many attempts. Try again in ' . (int) ceil($wait / 60) . ' min.';
    } else {
        $user = trim((string) ($_POST['user'] ?? ''));
        $pass = (string) ($_POST['pass'] ?? '');
        $userOk = hash_equals((string) $config['user_hash'], secret_hash('user', $user));

        if ($userOk && password_verify($pass, (string) $config['pass_hash'])) {
            throttle_clear();
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            go('/home');
        }

        throttle_fail();
        $errors[] = 'Wrong login or password.';
    }
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    go('/home');
}

if ($action === 'create' && $authed) {
    $text = trim((string) ($_POST['text'] ?? ''));

    if (mb_strlen($text) > MAX_TEXT) {
        $text = mb_substr($text, 0, MAX_TEXT);
    }

    $background = (string) ($_POST['bg'] ?? 'default');

    if (!in_array($background, post_backgrounds(), true)) {
        $background = 'default';
    }

    $pictures = image_types();
    $movies = video_types();
    $dir = uploads_dir();
    $links = (array) ($_POST['link'] ?? []);
    $media = [];
    $saved = [];

    if ($dir === '') {
        $errors[] = 'Upload folder assets/blog is not writable.';
    }

    for ($i = 0; $i < MAX_IMAGES && $errors === []; $i++) {
        $error = (int) ($_FILES['image']['error'][$i] ?? UPLOAD_ERR_NO_FILE);

        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        if ($error !== UPLOAD_ERR_OK) {
            $errors[] = 'File ' . ($i + 1) . ' failed to upload.';
            break;
        }

        $tmp = (string) ($_FILES['image']['tmp_name'][$i] ?? '');

        if (!is_uploaded_file($tmp)) {
            $errors[] = 'File ' . ($i + 1) . ' is not a valid upload.';
            break;
        }

        $size = (int) ($_FILES['image']['size'][$i] ?? 0);
        $info = @getimagesize($tmp);
        $kind = '';
        $extension = '';

        if ($info !== false && isset($pictures[$info[2]])) {
            $kind = 'image';
            $extension = $pictures[$info[2]];

            if ($size > MAX_UPLOAD_BYTES) {
                $errors[] = 'Picture ' . ($i + 1) . ' is larger than 5 MB.';
                break;
            }
        } else {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = $finfo === false ? '' : strtolower((string) finfo_file($finfo, $tmp));

            if ($finfo !== false) {
                finfo_close($finfo);
            }

            if (!isset($movies[$mime])) {
                $errors[] = 'File ' . ($i + 1) . ' must be JPG, PNG, GIF, WEBP or MP4.';
                break;
            }

            $kind = 'video';
            $extension = $movies[$mime];

            if ($size > MAX_VIDEO_BYTES) {
                $errors[] = 'Video ' . ($i + 1) . ' is larger than 15 MB.';
                break;
            }
        }

        $link = $kind === 'image' ? trim((string) ($links[$i] ?? '')) : '';

        if ($link !== '') {
            $scheme = strtolower((string) parse_url($link, PHP_URL_SCHEME));

            if (filter_var($link, FILTER_VALIDATE_URL) === false || !in_array($scheme, ['http', 'https'], true)) {
                $errors[] = 'Link ' . ($i + 1) . ' must start with http:// or https://';
                break;
            }
        }

        $name = bin2hex(random_bytes(8)) . $extension;

        if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
            $errors[] = 'Could not save file ' . ($i + 1) . '.';
            break;
        }

        @chmod($dir . '/' . $name, 0644);
        $saved[] = $dir . '/' . $name;
        $media[] = ['file' => $name, 'link' => $link, 'type' => $kind];
    }

    if ($errors === [] && $text === '' && $media === []) {
        $errors[] = 'Add some text, a picture or a video.';
    }

    if ($errors !== []) {
        foreach ($saved as $file) {
            @unlink($file);
        }

        $_SESSION['form_errors'] = $errors;
        go('/admintools.php');
    }

    $posts = live_posts();
    array_unshift($posts, [
        'id' => bin2hex(random_bytes(8)),
        'created' => time(),
        'text' => $text,
        'images' => $media,
        'bg' => $background,
    ]);

    if (!write_store(['posts' => $posts])) {
        foreach ($saved as $file) {
            @unlink($file);
        }

        $_SESSION['form_errors'] = ['Could not write api/data/posts.json. Check permissions.'];
        go('/admintools.php');
    }

    flash('Posted.');
    go('/admintools.php');
}

if ($action === 'delete' && $authed) {
    $id = (string) ($_POST['id'] ?? '');
    $kept = [];

    foreach (live_posts() as $post) {
        if ((string) ($post['id'] ?? '') === $id) {
            drop_files($post);
            continue;
        }

        $kept[] = $post;
    }

    write_store(['posts' => $kept]);
    flash('Post deleted.');
    go('/admintools.php');
}

if ($authed) {
    go('/admintools.php');
}

$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
$csrf = (string) $_SESSION['csrf'];
$suggestedKey = $config === null ? bin2hex(random_bytes(12)) : '';

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin - 4real</title>
<link rel="icon" href="/assets/4real-logo.png">
<link rel="stylesheet" href="/style.css">
</head>
<body>

<div class="logo">
	<a href="/home"><img src="/assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="nav">[<a href="/home">Return to Home</a>]</div>

<?php if ($flash !== null): ?>
	<div class="box">
		<div class="box-body notice"><?= e((string) $flash['message']) ?></div>
	</div>
<?php endif; ?>

<?php if ($errors !== []): ?>
	<div class="box">
		<div class="box-body error">
<?php foreach ($errors as $message): ?>
			<div><?= e($message) ?></div>
<?php endforeach; ?>
		</div>
	</div>
<?php endif; ?>

<?php if ($config === null): ?>

	<div class="box">
		<div class="box-title">Create admin account</div>
		<div class="box-body">
			<p>This runs once. Login, password and secret key are stored only as hashes in
			<code>api/config.php</code>. After that this page answers 404 to everyone who opens it without
			<code>admin.php?k=&lt;secret key&gt;</code>.</p>
			<form method="post" class="adminform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="setup">
				<label>Login<input type="text" name="user" autocomplete="username" required></label>
				<label>Password<input type="password" name="pass" autocomplete="new-password" required></label>
				<label>Repeat password<input type="password" name="pass2" autocomplete="new-password" required></label>
				<label>Secret key for the link<input type="text" name="key" value="<?= e($suggestedKey) ?>" required></label>
				<button type="submit">Create</button>
			</form>
		</div>
	</div>

<?php else: ?>

	<div class="box">
		<div class="box-title">Sign in</div>
		<div class="box-body">
			<form method="post" class="adminform">
				<input type="hidden" name="csrf" value="<?= e($csrf) ?>">
				<input type="hidden" name="action" value="login">
				<input type="hidden" name="k" value="<?= e($provided) ?>">
				<label>Login<input type="text" name="user" autocomplete="username" required></label>
				<label>Password<input type="password" name="pass" autocomplete="current-password" required></label>
				<button type="submit">Sign in</button>
			</form>
		</div>
	</div>

<?php endif; ?>

	<div class="pagelinks">
		<a href="/home">Home</a>
		<span class="dot">&#9679;</span>
		<a href="/faq">FAQ</a>
		<span class="dot">&#9679;</span>
		<a href="/rules">Rules</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

</div>

</body>
</html>
