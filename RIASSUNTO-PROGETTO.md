# Riassunto del progetto (da dare a una nuova chat con Claude)

Ultimo aggiornamento: 24 ottobre 2026. Scritto per riprendere il lavoro senza la cronologia delle chat precedenti.

## Cos'è

Tutor web per esercitare lo spagnolo. L'utente è italiano, livello appena sotto il B1, e vuole migliorare entro il 2 dicembre.
Esiste una "fotocopia" per il **portoghese del Brasile** con la stessa struttura.

| | Spagnolo | Portoghese |
| --- | --- | --- |
| Cartella | `C:\Users\salva\SpanishTutor` | `C:\Users\salva\PortugueseTutor` |
| Ramo di lavoro | `dev` (push su `origin/dev`; per pubblicare si unisce in `main`) | `main` (nessun merge necessario) |
| Netlify | sito già attivo, ma **non si fa deploy per ora** (deploy automatici fermati) | collegato, ma deploy automatici fermati: si pubblica solo a mano |

Esiste anche una vecchia versione PHP per NAS nella cartella `spagnolo/`: non è più sviluppata e ha bug noti, non si tocca.

## Regole di lavoro stabilite dall'utente

- **Nessun deploy su Netlify** per lo spagnolo finché l'utente non lo decide. Il piano gratuito ha 300 crediti e ogni deploy ne costa 15. Quando sarà il momento: unire `dev` in `main` e fare **un solo deploy manuale**. I deploy automatici sono già fermati.
- Il portoghese è collegato a Netlify ma con deploy automatici fermati: il push su GitHub non pubblica nulla. Quando si pubblicherà, verificare **prima** le variabili d'ambiente per non sprecare deploy (i passaggi sono nel README).
- L'utente chiede quasi sempre commit e push dopo ogni modifica: spagnolo su `dev`, portoghese su `main`. Ogni modifica va fatta in entrambe le versioni, adattando la lingua.
- I messaggi di commit sono in italiano (in portoghese per la copia PT) e finiscono con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Si risponde in italiano. L'utente è sbrigativo: preferisce risultati verificati e un riepilogo onesto di limiti e cose non provate.
- Non creo account né password per conto dell'utente (ho rifiutato la richiesta di un utente guest con password data in chat; gli ho dato i comandi per farlo da solo).

## Architettura

- **Frontend** `public/`: sito statico senza framework. `common.js` espone l'oggetto globale `SP` (`SP.call`, `SP.compare`, `SP.say`, `SP.loading`, router con hash). Ogni sezione si registra come `SP.sections.<nome>`. Il motore dei verbi è il globale `SPV` (`coniugatore.js`).
- **Backend** `netlify/`:
  - `functions/api.mjs`: entrata (Functions v2).
  - `lib/router.mjs`, `lib/auth.mjs`, `lib/core.mjs`, `lib/data.mjs`: routing, accessi, archivio, dati statici.
  - `lib/actions.mjs`: tutte le azioni. La mappa `ACTIONS` è in fondo al file.
- **Archivio**: Netlify Blobs (utenti, progressi, lezioni e liste in cache).
- **Accessi**: solo su invito (link a uso singolo), ruoli admin, user e guest.
  - Hash della password con PBKDF2 (WebCrypto), cookie di sessione firmato e intestazione `X-Requested-With` come difesa CSRF.
  - Blocco dopo 5 password errate.
  - Limite giornaliero di richieste a Claude per persona (150, guest 30).
- **Claude**: chiamato solo dal server, modello `claude-sonnet-5-5`, `thinking: {type:'between_tools'}` per disattivare il ragionamento. I prompt chiedono JSON (`CFG.BASE_RULES`). `claudeJson` ritenta una volta. Ogni chiamata conta nel limite giornaliero (`callClaude`). Le funzioni sincrone Netlify durano al massimo 60 secondi.
- **Variabili d'ambiente**: `ANTHROPIC_API_KEY`, `SESSION_SECRET` (almeno 32 caratteri), `SETUP_TOKEN` (solo per creare il primo admin), `PUBLIC_URL` (facoltativa). Il file `.env` è ignorato da git; l'esempio è in `.env.example`.

Azioni principali: `chat, hint, grammar, exercises, grade, record_exercise, vocab, deck_add, deck, deck_review, deck_review_many, grade_vocab, verb_check, verb_italian, profile_set, test, writing, test_result`.

## Come provare senza deploy

- **Demo immediata** (serve solo Python): `py tools/demo.py`, poi aprire `http://127.0.0.1:18080/`. Il backend vero gira nel browser con un **Claude simulato** (`fakeClaude` in `netlify/test/backend.test.mjs`, memoria in `netlify/test/shim.mjs`). Si entra già come utente `demo`. Le risposte del tutor sono di prova, le forme italiane dei verbi sono coniugate in modo regolare e quindi sbagliate per gli irregolari.
- **Con il vero Claude**: servono Node.js 22+, `npm install`, `npx netlify-cli dev` e un `.env` compilato. Sito su `http://localhost:8888`. **Non l'ho mai provato**, perché sul computer non c'è Node.
- **Prove automatiche**: servire il repository (la demo lo fa) e, da una pagina del browser, eseguire `const m = await import('/netlify/test/backend.test.mjs?x='+Date.now()); await m.run()`. Risultato atteso: `failures: 0`, **86 prove** nello spagnolo. Dopo modifiche ai file, ricaricare la pagina (il browser tiene i moduli in cache).
- Il browser integrato dell'app Claude può caricare la demo e leggere il testo delle pagine.

## Cosa è stato fatto (in ordine)

1. App iniziale per NAS (PHP), poi con sezioni, accessi autonomi su invito, test di livello con piano di 8 settimane, home page, conversazione migliorata (variata, con stop, suggerimenti in spagnolo).
2. Migrazione su Netlify + GitHub (sito attivo, setup fatto).
3. Copia per il portoghese brasiliano su GitHub.
4. Modifiche allo spagnolo su `dev`:
   - **Vocabolario come test di scrittura** nei due versi (si legge la parola italiana e si scrive la spagnola, o viceversa), con sinonimi accettati (valutati da Claude). Parole vere nella demo. *Non riportato nella copia portoghese.*
   - **Verbi**: corretto "ir" (parse a partire da 2 lettere). Un verbo non in elenco non si coniuga più alla cieca: si propongono verbi simili e il tutor controlla se esiste e se è regolare (`verb_check`, risultato in cache per tutti). La pagina iniziale mostra i verbi irregolari importanti in ordine alfabetico e i sei tempi principali dei tre modelli regolari (hablar, comer, vivir).
   - **Allenamento verbi**: accanto al tempo compare il nome italiano (es. «Pretérito indefinido (passato remoto)»), poi la forma italiana della persona e del tempo (es. «tu ci entrasti»), chiesta al tutor una volta per serie (`verb_italian`, in cache).
   - **Esercizi**: una casella per ogni spazio nei "completa"; niente glosse italiane tra parentesi nelle frasi (filtro `suspiciousHint`); le traduzioni libere hanno **punteggio da 0 a 1 a passi di 0,25** (riquadro giallo per i parziali, totale con decimali).

## Limiti noti (da dire onestamente)

- Il vero Claude non è stato provato in locale (no Node): non so ancora quanto saranno naturali forme italiane, punteggi parziali e controllo dei verbi.
- Un verbo non in elenco non è per forza inesistente: lo decide Claude, che può sbagliare su verbi rari.
- Il filtro `suspiciousHint` può scartare qualche suggerimento legittimo di una sola parola, ad esempio "(bonito)".
- Nella demo il tutor simulato accetta come sinonimo ogni risposta che comincia per «sin». Il riquadro giallo dei punteggi parziali non l'ho visto in funzione nella demo, solo testato lato server.
- Le lezioni, le liste e gli esercizi sono generati da Claude e non sono riletti da un insegnante.

## Trucchi tecnici utili

- Sulla macchina c'è Windows con Git Bash e PowerShell, ma **non c'è Node**: i test girano nel browser.
- Per modifiche lunghe ai file conviene scrivere uno script Python con lo strumento Write e lanciarlo con `py -I script.py` (le heredoc nel tool Bash sono fragili). Usare cartelle temporanee corte, per via dei percorsi lunghi di Windows.
- I file usano fine riga LF; dopo gli script controllare `git diff --stat` per evitare diff enormi.
- `fakeClaude` sceglie la risposta in base a frammenti del prompt di sistema (`'ha cercato un verbo'`, `'forme coniugate del verbo'`, `'Valuta traduzioni'`, …): un nuovo prompt deve usare un frammento che non collida con questi e va aggiunto anche al finto Claude.
- Nel codice, la copia portoghese cambia i nomi dei tempi (`perfeito`, `imperfeito`, …) e le regole sui verbi; verificare sempre i nomi delle chiavi prima di copiare una modifica.

## Prossimi passi possibili

- Riportare nel portoghese il vocabolario come test di scrittura.
- Provare tutto con il vero Claude (`netlify dev`), quando Node sarà disponibile.
- Quando l'utente decide: unire `dev` in `main` e fare un solo deploy dello spagnolo; poi, più avanti, pubblicare il portoghese.
