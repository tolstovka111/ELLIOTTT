<?php

declare(strict_types=1);

require __DIR__ . '/api/lib.php';

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

if ($config !== null) {
    $provided = (string) ($_GET['k'] ?? '');

    if ($provided !== '' && hash_equals((string) $config['key_hash'], secret_hash('key', $provided))) {
        $_SESSION['gate'] = true;
        go('admin.php');
    }

    if (empty($_SESSION['gate'])) {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        echo "<!DOCTYPE html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\"><title>404 Not Found</title></head>\n<body><h1>Not Found</h1></body>\n</html>\n";
        exit;
    }
}

$authed = !empty($_SESSION['admin']) && $config !== null;
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
            $_SESSION['gate'] = true;
            flash('Account created. Your admin link is admin.php?k=' . $key);
            go('admin.php');
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
            $_SESSION['gate'] = true;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            go('index.php');
        }

        throttle_fail();
        $errors[] = 'Wrong login or password.';
    }
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    go('index.php');
}

if ($action === 'create' && $authed) {
    $text = trim((string) ($_POST['text'] ?? ''));

    if (mb_strlen($text) > MAX_TEXT) {
        $text = mb_substr($text, 0, MAX_TEXT);
    }

    $allowed = [
        IMAGETYPE_JPEG => '.jpg',
        IMAGETYPE_PNG => '.png',
        IMAGETYPE_GIF => '.gif',
        IMAGETYPE_WEBP => '.webp',
    ];

    $dir = uploads_dir();
    $links = (array) ($_POST['link'] ?? []);
    $images = [];
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
            $errors[] = 'Image ' . ($i + 1) . ' failed to upload.';
            break;
        }

        $tmp = (string) ($_FILES['image']['tmp_name'][$i] ?? '');

        if (!is_uploaded_file($tmp)) {
            $errors[] = 'Image ' . ($i + 1) . ' is not a valid upload.';
            break;
        }

        if ((int) ($_FILES['image']['size'][$i] ?? 0) > MAX_UPLOAD_BYTES) {
            $errors[] = 'Image ' . ($i + 1) . ' is larger than 5 MB.';
            break;
        }

        $info = @getimagesize($tmp);

        if ($info === false || !isset($allowed[$info[2]])) {
            $errors[] = 'Image ' . ($i + 1) . ' must be JPG, PNG, GIF or WEBP.';
            break;
        }

        $link = trim((string) ($links[$i] ?? ''));

        if ($link !== '') {
            $scheme = strtolower((string) parse_url($link, PHP_URL_SCHEME));

            if (filter_var($link, FILTER_VALIDATE_URL) === false || !in_array($scheme, ['http', 'https'], true)) {
                $errors[] = 'Link ' . ($i + 1) . ' must start with http:// or https://';
                break;
            }
        }

        $name = bin2hex(random_bytes(8)) . $allowed[$info[2]];

        if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
            $errors[] = 'Could not save image ' . ($i + 1) . '.';
            break;
        }

        @chmod($dir . '/' . $name, 0644);
        $saved[] = $dir . '/' . $name;
        $images[] = ['file' => $name, 'link' => $link];
    }

    $audio = null;
    $audioError = (int) ($_FILES['audio']['error'] ?? UPLOAD_ERR_NO_FILE);

    if ($errors === [] && $audioError !== UPLOAD_ERR_NO_FILE) {
        $tmp = (string) ($_FILES['audio']['tmp_name'] ?? '');
        $types = audio_types();
        $mime = '';

        if ($audioError !== UPLOAD_ERR_OK || !is_uploaded_file($tmp)) {
            $errors[] = 'Audio failed to upload.';
        } elseif ((int) ($_FILES['audio']['size'] ?? 0) > MAX_AUDIO_BYTES) {
            $errors[] = 'Audio is larger than 20 MB.';
        } else {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $mime = $finfo === false ? '' : strtolower((string) finfo_file($finfo, $tmp));

            if ($finfo !== false) {
                finfo_close($finfo);
            }

            if (!isset($types[$mime])) {
                $errors[] = 'Audio must be MP3, OGG, WAV, M4A or FLAC.';
            }
        }

        if ($errors === []) {
            $tags = id3_read($tmp);
            $title = trim((string) ($_POST['audio_title'] ?? ''));
            $author = trim((string) ($_POST['audio_author'] ?? ''));

            if ($title === '') {
                $title = (string) ($tags['title'] ?? '');
            }

            if ($title === '') {
                $title = (string) pathinfo((string) ($_FILES['audio']['name'] ?? ''), PATHINFO_FILENAME);
            }

            if ($author === '') {
                $author = (string) ($tags['author'] ?? '');
            }

            $title = mb_substr($title === '' ? 'Untitled' : $title, 0, MAX_META);
            $author = mb_substr($author === '' ? 'Unknown artist' : $author, 0, MAX_META);
            $name = bin2hex(random_bytes(8)) . $types[$mime];

            if (!move_uploaded_file($tmp, $dir . '/' . $name)) {
                $errors[] = 'Could not save the audio file.';
            } else {
                @chmod($dir . '/' . $name, 0644);
                $saved[] = $dir . '/' . $name;
                $cover = '';
                $coverError = (int) ($_FILES['cover']['error'] ?? UPLOAD_ERR_NO_FILE);

                if ($coverError === UPLOAD_ERR_OK && is_uploaded_file((string) $_FILES['cover']['tmp_name'])) {
                    $coverTmp = (string) $_FILES['cover']['tmp_name'];
                    $info = @getimagesize($coverTmp);

                    if ($info !== false && isset($allowed[$info[2]]) && (int) $_FILES['cover']['size'] <= MAX_UPLOAD_BYTES) {
                        $cover = bin2hex(random_bytes(8)) . $allowed[$info[2]];

                        if (move_uploaded_file($coverTmp, $dir . '/' . $cover)) {
                            @chmod($dir . '/' . $cover, 0644);
                            $saved[] = $dir . '/' . $cover;
                        } else {
                            $cover = '';
                        }
                    } else {
                        $errors[] = 'Cover must be a JPG, PNG, GIF or WEBP under 5 MB.';
                    }
                }

                if ($errors === [] && $cover === '' && isset($tags['cover']['data'])) {
                    $embedded = ['image/jpeg' => '.jpg', 'image/jpg' => '.jpg', 'image/png' => '.png', 'image/gif' => '.gif', 'image/webp' => '.webp'];
                    $coverMime = (string) $tags['cover']['mime'];

                    if (isset($embedded[$coverMime])) {
                        $cover = bin2hex(random_bytes(8)) . $embedded[$coverMime];

                        if (@file_put_contents($dir . '/' . $cover, (string) $tags['cover']['data']) !== false) {
                            @chmod($dir . '/' . $cover, 0644);
                            $saved[] = $dir . '/' . $cover;
                        } else {
                            $cover = '';
                        }
                    }
                }

                $audio = ['file' => $name, 'title' => $title, 'author' => $author, 'cover' => $cover];
            }
        }
    }

    if ($errors === [] && $text === '' && $images === [] && $audio === null) {
        $errors[] = 'Add some text, an image or an audio file.';
    }

    if ($errors !== []) {
        foreach ($saved as $file) {
            @unlink($file);
        }

        $_SESSION['form_errors'] = $errors;
        go('index.php#blog-editor');
    }

    $posts = live_posts();
    array_unshift($posts, [
        'id' => bin2hex(random_bytes(8)),
        'created' => time(),
        'text' => $text,
        'images' => $images,
        'audio' => $audio,
    ]);

    if (!write_store(['posts' => $posts])) {
        foreach ($saved as $file) {
            @unlink($file);
        }

        $_SESSION['form_errors'] = ['Could not write api/data/posts.json. Check permissions.'];
        go('index.php#blog-editor');
    }

    flash('Posted.');
    go('index.php#blog-editor');
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
    go('index.php#blog-editor');
}

if ($authed) {
    go('index.php#blog-editor');
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
<link rel="icon" href="assets/4real-logo.png">
<link rel="stylesheet" href="style.css">
</head>
<body>

<div class="logo">
	<a href="index.php"><img src="assets/4real-logo.png" alt="4real"></a>
</div>

<div class="page">

	<div class="nav">[<a href="index.php">Return to Home</a>]</div>

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
				<label>Login<input type="text" name="user" autocomplete="username" required></label>
				<label>Password<input type="password" name="pass" autocomplete="current-password" required></label>
				<button type="submit">Sign in</button>
			</form>
		</div>
	</div>

<?php endif; ?>

	<div class="pagelinks">
		<a href="index.php">Home</a>
		<a href="faq.html">FAQ</a>
		<a href="rules.html">Rules</a>
	</div>

	<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>

</div>

</body>
</html>
