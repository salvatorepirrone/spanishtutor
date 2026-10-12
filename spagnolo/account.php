<?php
// Il mio account: cambio password e consumo giornaliero.
require_once __DIR__ . '/access.php';
$user = spa_session_user();
if (!$user) { header('Location: /spagnolo/login.php'); exit; }

$msg = '';
$problems = [];
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    spa_csrf_check();
    $u = spa_user($user);
    if (!password_verify((string)($_POST['old'] ?? ''), (string)$u['hash'])) $problems[] = 'la password attuale non è corretta';
    $pw = (string)($_POST['password'] ?? '');
    $problems = array_merge($problems, spa_password_problems($pw, $user));
    if ($pw !== (string)($_POST['password2'] ?? '')) $problems[] = 'le due password nuove non coincidono';
    if (!$problems) {
        spa_set_password($user, $pw);
        spa_login_session($user);   // questa sessione resta valida con la nuova impronta; le altre decadono
        $msg = 'Password cambiata. Le altre sessioni aperte sono state chiuse.';
    }
}

$limit = spa_limit_of($user);
$list = '';
foreach ($problems as $p) $list .= '<li>' . spa_h($p) . '</li>';
$body = spa_back_link() . '<div class="card"><h2>Il mio account</h2>'
    . '<p>Utente: <b>' . spa_h($user) . '</b></p>'
    . '<p class="muted">Richieste al tutor oggi: ' . spa_usage_today($user) . ($limit > 0 ? ' su ' . $limit : ' (nessun limite)') . '.</p></div>'
    . '<div class="card"><h3>Cambia password</h3>'
    . ($msg !== '' ? '<p class="verdict ok">' . spa_h($msg) . '</p>' : '')
    . ($list !== '' ? '<div class="err" role="alert"><ul>' . $list . '</ul></div>' : '')
    . '<form method="post" autocomplete="off"><input type="hidden" name="csrf" value="' . spa_h(spa_csrf()) . '">'
    . '<label class="f" for="o">Password attuale</label><input id="o" name="old" type="password" autocomplete="current-password" required>'
    . '<label class="f" for="n1">Nuova password</label><input id="n1" name="password" type="password" autocomplete="new-password" required>'
    . '<label class="f" for="n2">Ripeti la nuova</label><input id="n2" name="password2" type="password" autocomplete="new-password" required>'
    . '<p><button class="primary" type="submit">Cambia password</button></p></form></div>'
    . '<form method="post" action="/spagnolo/logout.php"><input type="hidden" name="csrf" value="' . spa_h(spa_csrf()) . '"><button type="submit">Esci</button></form>';
spa_page('Il mio account', $body);
