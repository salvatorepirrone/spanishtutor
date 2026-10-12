<?php
// Libreria del tutor di spagnolo: cataloghi, dati per utente, chiamata a Claude. Si usa solo da api.php.
if (!defined('SP_API')) { http_response_code(404); exit; }

require_once __DIR__ . '/access.php';

const SP_MODEL = 'claude-sonnet-5-5';
const SP_DEADLINE = '2026-12-02';
const SP_START = '2026-10-12';
const SP_MAX_MESSAGES = 24;
const SP_MAX_CHARS = 800;
const SP_SRS_DAYS = [1, 3, 7, 16, 35];

function sp_fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function sp_today(): string {
    return (new DateTime('now', new DateTimeZone('Europe/Rome')))->format('Y-m-d');
}

function sp_str($v, int $max): string {
    return trim(mb_substr(is_scalar($v) ? (string)$v : '', 0, $max));
}

// ---------------------------------------------------------------- cataloghi

function sp_plan(): array {
    return [
        ['from' => '2026-10-12', 'title' => 'Presente e irregolari', 'focus' => 'presente indicativo, verbi irregolari e con dittongo (e>ie, o>ue), ser/estar, descrivere sé stessi, routine quotidiana'],
        ['from' => '2026-10-19', 'title' => 'Passato: indefinido e imperfecto', 'focus' => 'pretérito indefinido (regolari e irregolari) contro imperfecto, raccontare cosa è successo, marcatori temporali'],
        ['from' => '2026-10-26', 'title' => 'Perfecto e narrazione', 'focus' => 'pretérito perfecto, pluscuamperfecto, connettori per raccontare (primero, después, mientras, de repente), esperienze di vita'],
        ['from' => '2026-11-02', 'title' => 'Futuro, condizionale, por/para', 'focus' => 'futuro, condizionale, piani e ipotesi semplici, por contro para, comparativi'],
        ['from' => '2026-11-09', 'title' => 'Subjuntivo (1)', 'focus' => 'presente de subjuntivo: desideri, consigli, dubbi, emozioni (quiero que, espero que, es importante que)'],
        ['from' => '2026-11-16', 'title' => 'Imperativo e pronomi', 'focus' => 'imperativo affermativo e negativo, pronomi diretti e indiretti, doppi pronomi (se lo), verbi come gustar'],
        ['from' => '2026-11-23', 'title' => 'Opinioni e ipotesi', 'focus' => 'esprimere opinioni e argomentare, si + presente, subjuntivo con cuando, relative, connettori (sin embargo, aunque, por eso)'],
        ['from' => '2026-11-30', 'title' => 'Simulazione finale', 'focus' => 'ripasso generale e conversazione libera di 10-15 minuti su temi vari, come in un esame B1+'],
    ];
}

function sp_week_index(): int {
    $today = sp_today();
    $idx = 0;
    foreach (sp_plan() as $i => $w) if ($today >= $w['from']) $idx = $i;
    return $idx;
}

function sp_scenarios(): array {
    return [
        'libero'    => ['label' => 'Chiacchierata libera', 'desc' => 'Conversazione libera su cose di tutti i giorni: scegli tu un argomento semplice per cominciare e poi seguilo.'],
        'ristorante' => ['label' => 'Al ristorante', 'desc' => 'Gioco di ruolo: tu sei il cameriere di un ristorante a Madrid, lo studente è il cliente.'],
        'viaggio'   => ['label' => 'Organizzare un viaggio', 'desc' => 'Gioco di ruolo: tu sei un amico spagnolo che aiuta lo studente a organizzare un viaggio in Spagna (trasporti, alloggio, cosa vedere).'],
        'lavoro'    => ['label' => 'Colloquio di lavoro', 'desc' => 'Gioco di ruolo: tu sei il selezionatore in un colloquio di lavoro informale, lo studente è il candidato.'],
        'medico'    => ['label' => 'Dal medico', 'desc' => 'Gioco di ruolo: tu sei il medico, lo studente è il paziente con un problema comune (mal di schiena, influenza).'],
        'passato'   => ['label' => 'Racconta il tuo passato', 'desc' => 'Fai domande per far raccontare allo studente episodi del passato (vacanze, infanzia, ieri), per allenare i tempi del passato.'],
        'opinioni'  => ['label' => 'Dibattito leggero', 'desc' => 'Proponi un tema di attualità non polemico e chiedi opinioni motivate, con obiezioni gentili, per allenare argomentazione e subjuntivo.'],
    ];
}

// Sezioni della grammatica: ogni argomento ha un id stabile (serve per cache, esercizi e collegamenti).
function sp_grammar(): array {
    $t = function ($id, $title) { return ['id' => $id, 'title' => $title]; };
    return [
        ['id' => 'pronomi', 'title' => 'Pronomi', 'topics' => [
            $t('pron-soggetto', 'Pronomi soggetto e quando ometterli'),
            $t('pron-diretti', 'Pronomi complemento diretto (lo, la, los, las)'),
            $t('pron-indiretti', 'Pronomi complemento indiretto (le, les) e le/se'),
            $t('pron-doppi', 'Doppi pronomi (se lo doy, me lo dijo) e posizione dei pronomi'),
            $t('pron-riflessivi', 'Pronomi riflessivi e verbi pronominali'),
            $t('pron-preposizione', 'Pronomi dopo preposizione (mí, ti, conmigo, contigo)'),
            $t('possessivi', 'Possessivi (mi/mío, tu/tuyo...)'),
            $t('dimostrativi', 'Dimostrativi (este, ese, aquel) e avverbi di luogo (aquí, ahí, allí)'),
            $t('indefiniti', 'Indefiniti e negativi (algo, nada, alguien, nadie, alguno, ninguno)'),
        ]],
        ['id' => 'avverbi', 'title' => 'Avverbi', 'topics' => [
            $t('avv-mente', 'Avverbi in -mente'),
            $t('avv-tempo', 'Avverbi di tempo (ya, todavía, aún, ya no, todavía no, siempre, nunca)'),
            $t('avv-modo', 'Avverbi di modo e bien/mal, mejor/peor'),
            $t('avv-quantita', 'Avverbi di quantità (muy, mucho, bastante, demasiado, poco)'),
            $t('avv-affermazione', 'Affermazione, negazione e accordo (también, tampoco, sí, no, claro)'),
        ]],
        ['id' => 'tempi', 'title' => 'Tempi verbali', 'topics' => [
            $t('pres-regolare', 'Presente indicativo: verbi regolari'),
            $t('pres-irregolare', 'Presente indicativo: irregolari (dittongo, e>i, prima persona)'),
            $t('indefinido', 'Pretérito indefinido: regolari e irregolari'),
            $t('imperfecto', 'Pretérito imperfecto'),
            $t('indef-vs-imperf', 'Indefinido contro imperfecto'),
            $t('perfecto', 'Pretérito perfecto (he hablado) e quando usarlo'),
            $t('pluscuamperfecto', 'Pluscuamperfecto (había hablado)'),
            $t('futuro', 'Futuro semplice e ir a + infinito'),
            $t('condicional', 'Condizionale (hablaría) e usi: cortesia, consigli, ipotesi'),
            $t('subj-presente', 'Presente de subjuntivo: forme'),
            $t('subj-usi', 'Subjuntivo: quando si usa (desideri, dubbi, emozioni, cuando, para que)'),
            $t('imperativo', 'Imperativo affermativo e negativo'),
            $t('gerundio', 'Gerundio e estar + gerundio'),
            $t('perifrasi', 'Perifrasi verbali (tener que, hay que, acabar de, volver a, seguir)'),
            $t('participio', 'Participio e forme irregolari (hecho, dicho, visto...)'),
        ]],
        ['id' => 'verbi', 'title' => 'Verbi particolari', 'topics' => [
            $t('ser-estar', 'Ser contro estar'),
            $t('haber-tener', 'Haber contro tener, hay contro está'),
            $t('gustar', 'Gustar e verbi simili (encantar, interesar, molestar, parecer)'),
            $t('saber-conocer', 'Saber contro conocer'),
            $t('pedir-preguntar', 'Pedir contro preguntar, llevar contro traer, ir contro venir'),
            $t('cambio', 'Verbi di cambiamento (ponerse, volverse, hacerse, quedarse, convertirse)'),
            $t('impersonali', 'Forme impersonali e passive (se dice, se vende, uno)'),
        ]],
        ['id' => 'nomi', 'title' => 'Nomi, articoli e aggettivi', 'topics' => [
            $t('genere-numero', 'Genere e numero dei nomi (el problema, la mano, plurali)'),
            $t('articoli', 'Articolo determinativo e indeterminativo, lo, assenza di articolo'),
            $t('aggettivi', 'Aggettivi: accordo, posizione e apocope (buen, gran, mal)'),
            $t('comparativi', 'Comparativi e superlativi'),
            $t('quantificatori', 'Quantificatori e numeri (todo, cada, otro, mismo, ordinali)'),
        ]],
        ['id' => 'preposizioni', 'title' => 'Preposizioni', 'topics' => [
            $t('por-para', 'Por contro para'),
            $t('a-en-de', 'A, en, de, desde, hasta: moto, luogo, tempo'),
            $t('a-personal', 'La "a" personale e verbi con preposizione fissa (pensar en, soñar con, depender de)'),
        ]],
        ['id' => 'frase', 'title' => 'Frase e connettori', 'topics' => [
            $t('connettori', 'Connettori (porque, como, aunque, sin embargo, por eso, así que, mientras)'),
            $t('relative', 'Frasi relative (que, quien, el que, donde, lo que)'),
            $t('ipotetiche', 'Periodo ipotetico (si + presente, si + imperfecto di subjuntivo)'),
            $t('interrogativi', 'Interrogativi ed esclamativi (qué, cuál, cuánto, por qué, porque)'),
            $t('stile-indiretto', 'Discorso indiretto (dijo que..., me preguntó si...)'),
        ]],
    ];
}

function sp_topic(string $id): ?array {
    foreach (sp_grammar() as $s) foreach ($s['topics'] as $t) {
        if ($t['id'] === $id) return $t + ['section' => $s['title'], 'sectionId' => $s['id']];
    }
    return null;
}

function sp_vocab_themes(): array {
    $t = function ($id, $title, $hint) { return ['id' => $id, 'title' => $title, 'hint' => $hint]; };
    return [
        $t('famiglia', 'Famiglia e relazioni', 'famiglia, amici, relazioni, stato civile, descrivere le persone'),
        $t('casa', 'Casa e vita quotidiana', 'stanze, mobili, faccende domestiche, routine, vicinato'),
        $t('cibo', 'Cibo e ristorante', 'ingredienti, piatti, cucinare, ordinare, bevande, tapas'),
        $t('viaggi', 'Viaggi e trasporti', 'aeroporto, treno, albergo, indicazioni, prenotazioni, turismo'),
        $t('citta', 'Città e luoghi', 'negozi, servizi, edifici, indicazioni stradali, quartiere'),
        $t('lavoro', 'Lavoro e studio', 'professioni, ufficio, colloquio, riunioni, corsi, esami'),
        $t('salute', 'Salute e corpo', 'parti del corpo, malattie, sintomi, farmacia, medico, sport'),
        $t('emozioni', 'Emozioni e carattere', 'stati d\'animo, carattere, opinioni, sentimenti'),
        $t('tempo-libero', 'Tempo libero e hobby', 'sport, musica, cinema, libri, uscite, feste'),
        $t('tecnologia', 'Tecnologia e media', 'telefono, internet, social, computer, notizie'),
        $t('natura-meteo', 'Natura e meteo', 'tempo atmosferico, stagioni, animali, ambiente, paesaggio'),
        $t('shopping', 'Shopping e vestiti', 'abbigliamento, taglie, prezzi, negozi, pagare, restituire'),
        $t('verbi-frequenti', 'Verbi molto frequenti', 'i verbi più utili del B1 non ancora banali (aprovechar, conseguir, dejar, echar, llevar...)'),
        $t('espressioni', 'Espressioni e modi di dire', 'espressioni colloquiali spagnole molto comuni, modi di dire, intercalari'),
        $t('falsos-amigos', 'Falsi amici', 'parole che sembrano italiane ma significano altro (embarazada, burro, salir, rato, ropa, etc.)'),
        $t('connettori-lessico', 'Parole di collegamento', 'connettori e locuzioni per organizzare un discorso (en cambio, de hecho, por lo tanto, es decir...)'),
    ];
}

function sp_vocab_theme(string $id): ?array {
    foreach (sp_vocab_themes() as $t) if ($t['id'] === $id) return $t;
    return null;
}

function sp_writing_prompts(): array {
    return [
        'Descrivi una giornata tipica della tua settimana: cosa fai, a che ora, con chi (5-6 frasi).',
        'Racconta un viaggio o una vacanza che hai fatto: dove sei andato, cosa hai visto, cosa ti è piaciuto (5-6 frasi).',
        'Scrivi un messaggio a un amico spagnolo per invitarlo a cena a casa tua: quando, cosa cucinerai, come arrivare (5-6 frasi).',
        'Racconta cosa hai fatto ieri e cosa farai domani (5-6 frasi).',
        'Esprimi la tua opinione sull\'importanza di imparare le lingue straniere, con almeno due ragioni (5-6 frasi).',
        'Descrivi la tua città o il tuo quartiere: cosa ti piace, cosa cambieresti (5-6 frasi).',
        'Racconta un ricordo della tua infanzia usando i tempi del passato (5-6 frasi).',
    ];
}

// ---------------------------------------------------------------- dati per utente

function sp_file(string $user): string {
    if (!spa_valid_username($user)) throw new RuntimeException('Utente non valido');
    return spa_dir('data') . '/' . $user . '.json';
}

function sp_defaults(array $d): array {
    return $d + ['days' => [], 'errors' => [], 'vocab' => [], 'deck' => [], 'ex' => [], 'tests' => []];
}

function sp_load(string $user): array {
    $f = sp_file($user);
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return sp_defaults(is_array($d) ? $d : []);
}

// Legge, modifica e salva i dati dell'utente sotto lock; $fn(array $d): array. Restituisce i dati salvati.
function sp_update(string $user, callable $fn): array {
    $f = sp_file($user);
    $lock = fopen($f . '.lock', 'c');
    @chmod($f . '.lock', 0666);
    flock($lock, LOCK_EX);
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    $d = $fn(sp_defaults(is_array($d) ? $d : []));
    $tmp = $f . '.tmp';
    file_put_contents($tmp, json_encode($d, JSON_UNESCAPED_UNICODE));
    @chmod($tmp, 0666);
    rename($tmp, $f);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $d;
}

function sp_log_activity(array $d, int $n = 1): array {
    $day = sp_today();
    $d['days'][$day] = (int)($d['days'][$day] ?? 0) + $n;
    return $d;
}

function sp_add_errors(array $d, array $errors): array {
    $day = sp_today();
    foreach ($errors as $e) {
        $d['errors'][] = ['t' => $day, 'cat' => $e['cat'], 'orig' => $e['orig'], 'corr' => $e['corr'], 'note' => $e['note'] ?? ''];
    }
    $d['errors'] = array_slice($d['errors'], -300);
    return $d;
}

function sp_deck_add(array $d, string $es, string $it, string $ex, string $theme): array {
    $key = mb_strtolower($es);
    if ($key === '' || $it === '' || isset($d['deck'][$key])) return $d;
    $d['deck'][$key] = ['es' => $es, 'it' => $it, 'ex' => $ex, 'theme' => $theme, 'box' => 0, 'due' => sp_today(), 'seen' => 0];
    if (count($d['deck']) > 1500) array_shift($d['deck']);
    return $d;
}

function sp_stats(array $d): array {
    $today = new DateTime('now', new DateTimeZone('Europe/Rome'));
    $streak = 0;
    $cursor = clone $today;
    if (empty($d['days'][$cursor->format('Y-m-d')])) $cursor->modify('-1 day');
    while (!empty($d['days'][$cursor->format('Y-m-d')])) { $streak++; $cursor->modify('-1 day'); }
    $cats = [];
    foreach (array_slice($d['errors'], -150) as $e) {
        $c = $e['cat'] ?? 'altro';
        $cats[$c] = ($cats[$c] ?? 0) + 1;
    }
    arsort($cats);
    $deadline = new DateTime(SP_DEADLINE, new DateTimeZone('Europe/Rome'));
    $dueNow = 0;
    $t = sp_today();
    foreach ($d['deck'] as $c) if (($c['due'] ?? $t) <= $t) $dueNow++;
    $tests = array_slice($d['tests'], -10);
    return [
        'streak' => $streak,
        'todayTurns' => (int)($d['days'][$today->format('Y-m-d')] ?? 0),
        'totalDays' => count($d['days']),
        'topErrors' => array_slice($cats, 0, 6, true),
        'recentErrors' => array_slice(array_reverse($d['errors']), 0, 8),
        'vocabCount' => count($d['deck']),
        'deckDue' => $dueNow,
        'recentVocab' => array_slice($d['vocab'], -12),
        'exProgress' => (object)$d['ex'],
        'tests' => $tests,
        'daysLeft' => max(0, (int)$today->setTime(0, 0)->diff($deadline)->format('%r%a')),
    ];
}

// ---------------------------------------------------------------- Claude e cache

function sp_api_key(): string {
    $keyFile = dirname(SPA_DATA) . '/anthropic.key';
    $key = is_file($keyFile) ? trim((string)file_get_contents($keyFile)) : '';
    if ($key === '') sp_fail(500, 'La chiave API di Claude non è configurata sul server.');
    return $key;
}

// Una chiamata a Claude; restituisce il testo della risposta.
function sp_claude(string $system, array $messages, int $maxTokens = 900, int $timeout = 90): string {
    // Ogni richiesta a Claude conta nel limite giornaliero della persona (protegge la chiave API).
    $who = $GLOBALS['SP_USER'] ?? '';
    if ($who !== '' && !spa_quota_hit($who)) {
        sp_fail(429, 'Hai raggiunto il limite giornaliero di richieste al tutor (' . spa_limit_of($who) . '). Riprova domani.');
    }
    // Il modello ragiona per default e il ragionamento consuma max_tokens (JSON troncato, risposte lente): 'between_tools' lo spegne.
    $payload = ['model' => SP_MODEL, 'max_tokens' => $maxTokens, 'thinking' => ['type' => 'between_tools'], 'system' => $system, 'messages' => $messages];
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['content-type: application/json', 'x-api-key: ' . sp_api_key(), 'anthropic-version: 2023-06-01'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($body === false) sp_fail(502, 'Servizio non raggiungibile: ' . $err);
    $res = json_decode($body, true);
    if ($status !== 200) {
        $msg = is_array($res) ? ($res['error']['message'] ?? '') : '';
        sp_fail(502, 'Errore del servizio (' . $status . ')' . ($msg ? ': ' . $msg : ''));
    }
    $text = '';
    foreach (($res['content'] ?? []) as $part) if (($part['type'] ?? '') === 'text') $text .= $part['text'];
    return $text;
}

function sp_json_from(string $text): ?array {
    $a = strpos($text, '{');
    $b = strrpos($text, '}');
    if ($a === false || $b === false || $b <= $a) return null;
    $j = json_decode(substr($text, $a, $b - $a + 1), true);
    return is_array($j) ? $j : null;
}

// Chiama Claude e pretende un oggetto JSON; ritenta una volta se la risposta non è utilizzabile.
function sp_claude_json(string $system, string $userText, int $maxTokens, int $timeout = 120): array {
    for ($try = 0; $try < 2; $try++) {
        $j = sp_json_from(sp_claude($system, [['role' => 'user', 'content' => $userText]], $maxTokens, $timeout));
        if ($j) return $j;
    }
    sp_fail(502, 'Risposta del tutor non utilizzabile, riprova.');
}

function sp_cache_dir(): string {
    return spa_dir('cache');
}

function sp_cache_get(string $key): ?array {
    $f = sp_cache_dir() . '/' . preg_replace('/[^a-z0-9-]/', '', $key) . '.json';
    $d = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($d) ? $d : null;
}

function sp_cache_put(string $key, array $data): void {
    $f = sp_cache_dir() . '/' . preg_replace('/[^a-z0-9-]/', '', $key) . '.json';
    file_put_contents($f . '.tmp', json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
    @rename($f . '.tmp', $f);
}

const SP_BASE_RULES = "Sei un insegnante di spagnolo (variante della Spagna) per studenti italiani adulti di livello A2-B1. Spiegazioni e consegne in italiano; frasi di esempio e contenuti da imparare in spagnolo, naturali e corretti. Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice.";
