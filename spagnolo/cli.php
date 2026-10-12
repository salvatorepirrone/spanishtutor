<?php
// Gestione accessi da terminale, sul NAS:
//   php cli.php list
//   php cli.php invite <utente> [admin|user|guest]     crea l'utente e stampa il link di invito
//   php cli.php set-password <utente> [--allow-weak]   chiede la password nel terminale (non compare né nella cronologia né nei log)
//   php cli.php disable|enable <utente>
// La password non si passa mai come argomento: si digita quando richiesta.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/access.php';

function cli_fail(string $m): void { fwrite(STDERR, $m . "\n"); exit(1); }

function cli_read_password(string $prompt): string {
    fwrite(STDERR, $prompt);
    $hidden = false;
    if (function_exists('posix_isatty') && posix_isatty(STDIN)) { shell_exec('stty -echo'); $hidden = true; }
    $pw = rtrim((string)fgets(STDIN), "\r\n");
    if ($hidden) { shell_exec('stty echo'); fwrite(STDERR, "\n"); }
    return $pw;
}

$cmd = $argv[1] ?? '';
$user = strtolower($argv[2] ?? '');
$flags = array_slice($argv, 3);

switch ($cmd) {
    case 'list':
        foreach (spa_read('users') as $n => $u) {
            printf("%-20s %-6s %s limite=%s ultimo=%s\n", $n, $u['role'] ?? 'user',
                !empty($u['disabled']) ? 'disattivato' : (!empty($u['pending']) ? 'in-attesa' : 'attivo'),
                $u['limit'] ?? '-', !empty($u['last_login']) ? date('Y-m-d H:i', (int)$u['last_login']) : '-');
        }
        break;

    case 'invite':
        $role = $argv[3] ?? 'user';
        try { echo spa_invite($user, $role) . "\n"; } catch (InvalidArgumentException $e) { cli_fail($e->getMessage()); }
        break;

    case 'set-password':
        if (!spa_user($user)) cli_fail("Utente '$user' non trovato: crealo prima con invite.");
        $pw = cli_read_password('Nuova password per ' . $user . ': ');
        $pw2 = cli_read_password('Ripetila: ');
        if ($pw !== $pw2) cli_fail('Le due password non coincidono.');
        $problems = spa_password_problems($pw, $user);
        if ($problems && !in_array('--allow-weak', $flags, true)) {
            cli_fail('Password rifiutata: ' . implode('; ', $problems) . ". Con --allow-weak la accetto comunque (sconsigliato: il tutor è raggiungibile da internet).");
        }
        if (strlen($pw) < 6) cli_fail('Almeno 6 caratteri.');
        spa_set_password($user, $pw);
        echo "Password impostata per $user.\n";
        break;

    case 'disable':
    case 'enable':
        if (!spa_user($user)) cli_fail("Utente '$user' non trovato.");
        $dis = $cmd === 'disable';
        spa_update('users', function ($all) use ($user, $dis) {
            if ($dis) $all[$user]['disabled'] = true; else unset($all[$user]['disabled']);
            return $all;
        });
        echo "$user: " . ($dis ? 'disattivato' : 'riattivato') . ".\n";
        break;

    default:
        echo "Uso: php cli.php list | invite <utente> [admin|user|guest] | set-password <utente> [--allow-weak] | disable|enable <utente>\n";
}
