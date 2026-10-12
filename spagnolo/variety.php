<?php
// Varietà: argomenti, "mosse" della conversazione e contesti per gli esercizi, con memoria di ciò che è già uscito.
// Si usa solo da api.php (tramite lib.php).
if (!defined('SP_API')) { http_response_code(404); exit; }

function sp_pick_n(array $pool, int $n): array {
    if (!$pool) return [];
    $keys = (array)array_rand($pool, min($n, count($pool)));
    shuffle($keys);
    return array_map(function ($k) use ($pool) { return $pool[$k]; }, $keys);
}

function sp_pick_one(array $pool) { return $pool ? $pool[array_rand($pool)] : ''; }

// Argomenti di apertura per la chiacchierata libera (e contesto per quiz e ripasso).
function sp_topics(): array {
    return [
        'il tuo weekend ideale', 'un viaggio che sogni di fare', 'il tuo piatto preferito e come si prepara', 'la tua città: pregi e difetti',
        'un film o una serie che hai visto di recente', 'la musica che ascolti', 'come sei cambiato negli ultimi cinque anni', 'il tuo lavoro o i tuoi studi',
        'un ricordo d\'infanzia', 'gli animali domestici', 'lo sport e il movimento', 'una giornata di pioggia: cosa fai',
        'le feste e le tradizioni della tua famiglia', 'il tuo quartiere e i vicini', 'le vacanze al mare o in montagna', 'la tecnologia nella vita di tutti i giorni',
        'un libro che ti è piaciuto', 'i social network: pro e contro', 'il caffè, la colazione e le abitudini del mattino', 'un acquisto recente',
        'una persona che ammiri', 'il tempo libero e gli hobby', 'una brutta figura che ricordi con un sorriso', 'il tuo posto preferito della casa',
        'cosa faresti se vincessi alla lotteria', 'imparare le lingue: cosa ti riesce e cosa no', 'una cena con amici', 'i trasporti e gli spostamenti in città',
        'la salute e il benessere', 'i progetti per il prossimo anno', 'un viaggio finito male', 'la spesa e il mercato',
        'la vita in città o in campagna', 'una tradizione italiana da spiegare a uno straniero', 'il tuo sport o la tua passione del momento', 'come passi le serate',
        'un regalo che hai fatto o ricevuto', 'il lavoro da casa o in ufficio', 'cosa ti fa arrabbiare e cosa ti rilassa', 'la cucina spagnola e quella italiana',
        'un evento a cui hai partecipato (concerto, matrimonio, partita)', 'il futuro delle città', 'le abitudini che vorresti cambiare', 'una giornata perfetta',
        'l\'amicizia: com\'è nata una tua amicizia', 'il primo giorno in un posto nuovo', 'i vestiti e la moda', 'l\'ambiente e le piccole scelte quotidiane',
        'un sogno strano che ricordi', 'un\'esperienza che ti ha insegnato qualcosa',
    ];
}

// Piccole variazioni per i giochi di ruolo: ogni sessione cambia situazione.
function sp_twists(): array {
    return [
        'ristorante' => ['è il compleanno di un amico e volete una torta', 'il cliente è vegetariano e ha un\'allergia', 'il locale è pieno e c\'è da aspettare', 'il conto è sbagliato', 'il cliente ordina per sé e per un gruppo di amici', 'è la prima volta in un locale tipico spagnolo e il cliente non conosce i piatti'],
        'viaggio' => ['il viaggio è a Siviglia in primavera', 'si viaggia con un budget molto basso', 'il volo è stato cancellato', 'ci si sposta in treno tra Madrid e Barcellona', 'si cerca un alloggio con la famiglia', 'si vuole un viaggio tranquillo e poco turistico'],
        'lavoro' => ['il posto è in un\'azienda di tecnologia', 'il posto è in un ristorante', 'il candidato ha poca esperienza', 'il candidato cambia settore', 'si discute di orari e stipendio', 'è un colloquio per un tirocinio'],
        'medico' => ['il paziente ha il mal di gola e la febbre', 'il paziente si è fatto male giocando a calcio', 'il paziente dorme male da giorni', 'il paziente ha dolore alla schiena per il lavoro', 'è una visita di controllo', 'il paziente è allergico a un farmaco'],
        'passato' => ['si parla di una vacanza d\'infanzia', 'si parla della scuola', 'si parla del primo lavoro', 'si parla di un trasloco', 'si parla di una festa memorabile', 'si parla di un viaggio con amici'],
        'opinioni' => ['il tema è lavorare da casa', 'il tema è i social network', 'il tema è l\'uso dell\'auto in città', 'il tema è imparare le lingue con le app', 'il tema è la vita in una grande città', 'il tema è la settimana lavorativa di quattro giorni'],
    ];
}

// "Mosse": come costruire la domanda del tutor in un dato turno, per non fare sempre lo stesso tipo di domanda.
function sp_moves(): array {
    return [
        'racconta in una frase qualcosa di tuo (inventato ma plausibile) e poi chiedi allo studente un\'esperienza simile',
        'proponi una scelta tra due opzioni e chiedi di motivare la preferenza',
        'fai una domanda ipotetica ("¿qué harías si...?")',
        'chiedi un consiglio per un tuo problema piccolo e inventato',
        'chiedi di raccontare una storia o un ricordo legato a quanto detto',
        'fai una domanda concreta su un dettaglio (chi, quando, dove, come) di ciò che lo studente ha appena detto',
        'esprimi una tua opinione leggermente provocatoria e chiedi se è d\'accordo',
        'proponi un mini gioco: due verità e una bugia, o "descrivi senza dire la parola"',
        'chiedi di confrontare due cose (prima/adesso, qui/in Spagna)',
        'chiedi un progetto o un piano per il futuro prossimo',
        'chiedi di spiegare come si fa qualcosa, passo per passo',
        'fai una domanda sulle emozioni ("¿cómo te sentiste?", "¿qué te preocupa?")',
    ];
}

// Contesti per le frasi degli esercizi: alternarli evita le solite frasi su "cine" e "amigos".
function sp_contexts(): array {
    return [
        'in aeroporto', 'al supermercato', 'in ufficio', 'a scuola o all\'università', 'in palestra', 'in farmacia', 'in vacanza al mare', 'in montagna',
        'a una festa', 'in cucina', 'in treno', 'al telefono con un amico', 'in un negozio di vestiti', 'dal parrucchiere', 'in un hotel', 'al cinema o a teatro',
        'sul lavoro (una riunione)', 'in famiglia, a tavola', 'in città, chiedendo indicazioni', 'al mercato', 'in biblioteca', 'in banca o alla posta',
        'in una gita scolastica', 'a casa di amici', 'in un bar', 'durante un trasloco', 'al parco', 'in un museo', 'a un colloquio', 'allo stadio',
        'in un taxi o in autobus', 'online, a fare un acquisto', 'in ospedale (visita)', 'in un concerto', 'nel giardino di casa', 'in un ristorante',
    ];
}

function sp_norm_stem(string $s): string {
    $s = mb_strtolower($s);
    $s = preg_replace('/[^\p{L}\p{N} ]+/u', ' ', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}

// Ricorda gli argomenti e le frasi già proposte, per non ripeterle (liste limitate).
function sp_recent(array $d): array {
    $r = is_array($d['recent'] ?? null) ? $d['recent'] : [];
    return ['topics' => array_values($r['topics'] ?? []), 'items' => array_values($r['items'] ?? [])];
}

function sp_remember(string $user, array $topics = [], array $stems = []): void {
    if (!$topics && !$stems) return;
    sp_update($user, function ($d) use ($topics, $stems) {
        $r = sp_recent($d);
        $r['topics'] = array_slice(array_merge($r['topics'], $topics), -20);
        $r['items'] = array_slice(array_merge($r['items'], array_map('sp_norm_stem', $stems)), -150);
        $d['recent'] = $r;
        return $d;
    });
}

// Toglie gli esercizi quasi identici a frasi già proposte (stessa frase o stesse parole in ordine diverso).
function sp_drop_repeats(array $items, array $recentStems): array {
    $seen = [];
    foreach ($recentStems as $stem) {
        $bag = explode(' ', (string)$stem);
        sort($bag);
        $seen[$stem] = true;
        $seen['~' . implode(' ', $bag)] = true;
    }
    $out = [];
    foreach ($items as $it) {
        $k = sp_norm_stem((string)($it['q'] ?? ''));
        $bag = explode(' ', $k);
        sort($bag);
        $kb = implode(' ', $bag);
        if (isset($seen[$k]) || isset($seen['~' . $kb])) continue;
        $seen[$k] = true;
        $seen['~' . $kb] = true;
        $out[] = $it;
    }
    return $out;
}

// Argomento (o variazione di scenario) per una nuova sessione di conversazione, evitando quelli recenti.
function sp_pick_topic(array $d, string $mode, string $scenario): string {
    $tw = sp_twists();
    if ($mode === 'conversazione' && isset($tw[$scenario])) $pool = $tw[$scenario];
    elseif ($mode === 'conversazione') $pool = sp_topics();
    else $pool = sp_contexts();
    $recent = sp_recent($d)['topics'];
    $fresh = array_values(array_filter($pool, function ($t) use ($recent) { return !in_array($t, $recent, true); }));
    return (string)sp_pick_one($fresh ?: $pool);
}
