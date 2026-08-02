<?php

declare(strict_types=1);

require_once __DIR__ . '/lib.php';

/**
 * Every page that carries the board navigation, in the order it is shown.
 */
function board_list(): array
{
    return [
        'o' => ['url' => '/o/', 'label' => 'o', 'title' => '/o/ - Roblox'],
        'm' => ['url' => '/m/', 'label' => 'm', 'title' => '/m/ - Minecraft'],
        'a' => ['url' => '/a/', 'label' => 'a', 'title' => '/a/ - Anime'],
        'i' => ['url' => '/i/', 'label' => 'i', 'title' => '/i/ - Internet'],
        'b' => ['url' => '/b/', 'label' => 'b', 'title' => '/b/ - Random Pictures'],
        'c' => ['url' => '/c/', 'label' => 'c', 'title' => '/c/ - Chat'],
        'n' => ['url' => '/n/', 'label' => 'n', 'title' => '/n/ - Blog'],
    ];
}

function page_list(): array
{
    return [
        'faq' => ['url' => '/faq', 'label' => 'faq', 'title' => '/faq/ - FAQ'],
        'rules' => ['url' => '/rules', 'label' => 'rules', 'title' => '/rules/ - Rules'],
    ];
}

function board_nav(string $current = ''): string
{
    $parts = [];

    foreach (board_list() as $key => $board) {
        $label = e((string) $board['label']);
        $parts[] = $key === $current
            ? '<strong>' . $label . '</strong>'
            : '<a href="' . e((string) $board['url']) . '">' . $label . '</a>';
    }

    $extra = [];

    foreach (page_list() as $key => $page) {
        $label = e((string) $page['label']);
        $extra[] = $key === $current
            ? '<strong>' . $label . '</strong>'
            : '<a href="' . e((string) $page['url']) . '">' . $label . '</a>';
    }

    return '<div class="boardnav">'
        . '<span class="boardnav-list">[' . implode(' / ', $parts) . ']'
        . ' [' . implode(' / ', $extra) . ']</span>'
        . '<span class="boardnav-home">[<a href="/home">Home</a>]</span>'
        . '</div>';
}

/**
 * The banner, the board title, the jump link and the random ad banner.
 */
function board_header(string $title, string $goLabel, string $goTarget): string
{
    $banner = random_asset('banners', ['png', 'jpg', 'jpeg', 'gif', 'webp']);
    $ad = random_ad_banner();
    $out = '<div class="boardhead">';

    if ($banner !== '') {
        $out .= '<a href="/home"><img class="boardbanner" src="' . e($banner) . '" alt="4real"></a>';
    }

    $out .= '<h1 class="boardtitle">' . e($title) . '</h1></div>'
        . '<hr class="boardrule">'
        . '<div class="boardgo">[<a href="' . e($goTarget) . '" class="goposts">' . e($goLabel) . '</a>]</div>'
        . '<hr class="boardrule thin">';

    if ($ad !== []) {
        $out .= '<div class="adbanner"><a href="' . e((string) $ad['href']) . '">'
            . '<img src="' . e((string) $ad['src']) . '" alt="banner"></a></div>'
            . '<hr class="boardrule">';
    }

    return $out;
}

function site_logo(bool $linkTo404): string
{
    $href = $linkTo404 ? '/404.php' : '/home';

    return '<div class="logo"><a href="' . $href . '"><img src="/assets/4real-logo.png" alt="4real"></a></div>';
}

function page_footer(bool $authed): string
{
    $out = '<div class="pagelinks"><a href="/home">Home</a>'
        . '<span class="dot">&#9679;</span><a href="/faq">FAQ</a>'
        . '<span class="dot">&#9679;</span><a href="/rules">Rules</a>';

    if ($authed) {
        $out .= '<span class="dot">&#9679;</span><a href="/admintools.php">Admin Tools</a>';
    }

    return $out . '</div>'
        . '<div class="copyright">Copyright &copy; 2025-2026 4real community support. All rights reserved</div>'
        . '<div class="madeby">created by tolstovka (<a href="https://t.me/nysh4real" target="_blank" rel="noopener">@nysh4real</a> in telegram)</div>';
}
