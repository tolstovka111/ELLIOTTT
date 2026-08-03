<?php

// A real folder, so the short URL works even where mod_rewrite does not.
$_GET['b'] = 'm';
require __DIR__ . '/../board.php';
