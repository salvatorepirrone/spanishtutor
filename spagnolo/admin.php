<?php
// Gestione accessi del tutor (solo admin): inviti, ruoli, limiti, disattivazione ed eliminazione.
require_once __DIR__ . '/access.php';
$me = spa_session_user();
if (!$me) { header('Location: /spagnolo/login.php?next=' . rawurlencode('/spagnolo/admin.php')); exit; }
$meRec = spa_user($me);
if (($meRec['role'] ?? '') !== 'admin') { http_response_code(403); spa_page('Non autorizzato', spa_back_link() . '<div class="card"><p>Questa pagina è riservata agli amministratori.</p></div>'); }

$flash = '';
$link = '';
$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    spa_csrf_check();
    $do = (string)($_POST['do'] ?? '');
    $target = strtolower(trim((string)($_POST['user'] ?? '')));
    $users = spa_read('users');
    try {
        if ($do === 'invite') {
            if (isset($users[$target]) && empty($users[$target]['pending'])) throw new InvalidArgumentException('Esiste già un utente con questo nome.');
            $role = in_array($_POST['role'] ?? '', SPA_ROLES, true) ? $_POST['role'] : 'user';
            $limit = ($_POST['limit'] ?? '') === '' ? null : max(0, (int)$_POST['limit']);
            $link = spa_invite($target, $role, $limit);
            $flash = 'Invito creato per ' . $target . '. Copia il link e mandalo alla persona: vale 7 giorni e non si rivede più.';
        } elseif (!isset($users[$target])) {
            throw new InvalidArgumentException('Utente non trovato.');
        } elseif ($do === 'link') {
            $link = spa_invite($target, (string)($users[$target]['role'] ?? 'user'));
            $flash = 'Nuovo link per ' . $target . ' (vale 7 giorni; la password attuale resta valida finché non lo usa).';
        } elseif (in_array($do, ['disable', 'enable', 'delete', 'role'], true)) {
            $isAdmin = ($users[$target]['role'] ?? '') === 'admin' && empty($users[$target]['disabled']) && empty($users[$target]['pending']);
            $newRole = in_array($_POST['role'] ?? '', SPA_ROLES, true) ? $_POST['role'] : ($users[$target]['role'] ?? 'user');
            $removesAdmin = $isAdmin && ($do === 'disable' || $do === 'delete' || ($do === 'role' && $newRole !== 'admin'));
            if ($removesAdmin && spa_admin_count($users) <= 1) throw new InvalidArgumentException('Deve restare almeno un amministratore attivo.');
            if ($target === $me && in_array($do, ['disable', 'delete'], true)) throw new InvalidArgumentException('Non puoi disattivare o eliminare te stesso.');
            spa_update('users', function ($all) use ($do, $target, $newRole) {
                if (!isset($all[$target])) return $all;
                if ($do === 'delete') unset($all[$target]);
                elseif ($do === 'disable') $all[$target]['disabled'] = true;
                elseif ($do === 'enable') unset($all[$target]['disabled']);
                else $all[$target]['role'] = $newRole;
                return $all;
            });
            if ($do === 'delete') {
                spa_update('tokens', function ($t) use ($target) { foreach ($t as $k => $v) if (($v['user'] ?? '') === $target) unset($t[$k]); return $t; });
                spa_update('usage', function ($u) use ($target) { unset($u[$target]); return $u; });
                @unlink(spa_dir('data') . '/' . $target . '.json');
            }
            $flash = ['disable' => 'Utente disattivato: le sue sessioni non valgono più.', 'enable' => 'Utente riattivato.',
                      'delete' => 'Utente eliminato, con i suoi dati di studio.', 'role' => 'Ruolo aggiornato.'][$do];
        } elseif ($do === 'limit') {
            $n = max(0, min(5000, (int)($_POST['limit'] ?? 0)));
            spa_update('users', function ($all) use ($target, $n) { if (isset($all[$target])) $all[$target]['limit'] = $n; return $all; });
            $flash = 'Limite giornaliero di ' . $target . ': ' . ($n > 0 ? $n . ' richieste' : 'nessun limite') . '.';
        } else {
            throw new InvalidArgumentException('Azione sconosciuta.');
        }
    } catch (InvalidArgumentException $e) {
        $error = $e->getMessage();
    }
}

$csrf = spa_csrf();
$users = spa_read('users');
ksort($users);
$usage = spa_read('usage');
$today = date('Y-m-d');

function adm_btn(string $csrf, string $do, string $user, string $label, array $extra = [], string $cls = 'small'): string {
    $h = '<form method="post" class="inline"><input type="hidden" name="csrf" value="' . spa_h($csrf) . '"><input type="hidden" name="do" value="' . spa_h($do) . '"><input type="hidden" name="user" value="' . spa_h($user) . '">';
    foreach ($extra as $k => $v) $h .= '<input type="hidden" name="' . spa_h($k) . '" value="' . spa_h($v) . '">';
    return $h . '<button class="' . $cls . '" type="submit"' . ($do === 'delete' ? ' onclick="return confirm(\'Eliminare ' . spa_h($user) . ' e i suoi dati?\')"' : '') . '>' . spa_h($label) . '</button></form>';
}

$rows = '';
foreach ($users as $name => $u) {
    $status = !empty($u['disabled']) ? 'disattivato' : (!empty($u['pending']) ? 'in attesa di invito' : 'attivo');
    $last = !empty($u['last_login']) ? date('d/m/Y H:i', (int)$u['last_login']) : '—';
    $used = (int)(($usage[$name] ?? [])[$today] ?? 0);
    $lim = (int)($u['limit'] ?? SPA_DEFAULT_LIMIT);
    $role = (string)($u['role'] ?? 'user');
    $rows .= '<tr><td><b>' . spa_h((string)$name) . '</b>' . ($name === $me ? ' <span class="muted">(tu)</span>' : '') . '<div class="muted">' . spa_h($status) . ' · ultimo accesso ' . spa_h($last) . '</div></td>'
        . '<td><form method="post" class="inline"><input type="hidden" name="csrf" value="' . spa_h($csrf) . '"><input type="hidden" name="do" value="role"><input type="hidden" name="user" value="' . spa_h((string)$name) . '">'
        . '<select name="role" onchange="this.form.submit()" aria-label="Ruolo">';
    foreach (SPA_ROLES as $r) $rows .= '<option value="' . $r . '"' . ($r === $role ? ' selected' : '') . '>' . $r . '</option>';
    $rows .= '</select></form></td>'
        . '<td><form method="post" class="inline"><input type="hidden" name="csrf" value="' . spa_h($csrf) . '"><input type="hidden" name="do" value="limit"><input type="hidden" name="user" value="' . spa_h((string)$name) . '">'
        . '<input class="num" type="text" inputmode="numeric" name="limit" value="' . $lim . '" aria-label="Limite giornaliero"><button class="small" type="submit">Ok</button></form>'
        . '<div class="muted">oggi: ' . $used . '</div></td><td class="acts">'
        . adm_btn($csrf, 'link', (string)$name, 'Nuovo link')
        . (!empty($u['disabled']) ? adm_btn($csrf, 'enable', (string)$name, 'Riattiva') : ($name === $me ? '' : adm_btn($csrf, 'disable', (string)$name, 'Disattiva')))
        . ($name === $me ? '' : adm_btn($csrf, 'delete', (string)$name, 'Elimina'))
        . '</td></tr>';
}

$body = spa_back_link() . '<h2>Accessi</h2>'
    . ($error !== '' ? '<p class="verdict ko" role="alert">' . spa_h($error) . '</p>' : '')
    . ($flash !== '' ? '<p class="verdict ok">' . spa_h($flash) . '</p>' : '')
    . ($link !== '' ? '<div class="card"><b>Link da inviare</b><p><input type="text" readonly value="' . spa_h($link) . '" onclick="this.select()" style="width:100%"></p></div>' : '')
    . '<div class="card"><h3>Invita una persona</h3><form method="post" class="row"><input type="hidden" name="csrf" value="' . spa_h($csrf) . '"><input type="hidden" name="do" value="invite">'
    . '<input type="text" name="user" placeholder="nome utente" autocapitalize="off" spellcheck="false" required>'
    . '<select name="role" aria-label="Ruolo"><option value="user">user</option><option value="guest">guest (limite basso)</option><option value="admin">admin</option></select>'
    . '<input class="num" type="text" inputmode="numeric" name="limit" placeholder="limite/giorno" aria-label="Limite giornaliero">'
    . '<button class="primary" type="submit">Crea invito</button></form>'
    . '<p class="muted">Il limite conta le richieste a Claude per persona (0 = nessun limite). Predefinito: ' . SPA_DEFAULT_LIMIT . ' per user, ' . SPA_GUEST_LIMIT . ' per guest.</p></div>'
    . '<div class="card"><h3>Utenti</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>Utente</th><th>Ruolo</th><th>Limite</th><th></th></tr></thead><tbody>' . $rows . '</tbody></table></div></div>';
spa_page('Accessi', $body, 'wide');
