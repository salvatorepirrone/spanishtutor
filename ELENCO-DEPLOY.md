# Elenco di controllo prima di un deploy su Netlify

Ogni deploy costa 15 crediti (piano gratuito: 300 al mese). Spagnolo e portoghese sono due progetti separati: pubblicarli entrambi costa 30.
Si lavora direttamente su `main`: commit e push non costano nulla perché i deploy automatici sono fermi. Si pubblica solo a mano, dalla console Netlify.

## 1. Prima di decidere di pubblicare

- [ ] Ho raccolto tutte le modifiche che voglio mettere online? Meglio un deploy con molte cose che tre deploy con poche.
- [ ] Ho provato in locale con la demo (`py tools/demo.py`, poi `http://127.0.0.1:18080/`)?
- [ ] Le prove del backend passano? Nel browser, sulla pagina della demo:
  `const m = await import('/netlify/test/backend.test.mjs?x='+Date.now()); (await m.run()).failures` deve dare `0`.
- [ ] Se possibile, ho provato con il vero Claude (`npx netlify-cli dev`, serve Node.js 22+)? Finora non è mai stato fatto.
- [ ] I crediti rimasti bastano? (Netlify → Team → Usage). Con 75 crediti restano 5 deploy in tutto.

## 2. Solo la prima volta (progetto portoghese)

- [ ] Variabili d'ambiente impostate **prima** del deploy, altrimenti ne serve un secondo: `ANTHROPIC_API_KEY`, `SESSION_SECRET` (almeno 32 caratteri), `SETUP_TOKEN`; facoltativa `PUBLIC_URL`.
- [ ] Dopo il deploy: aprire `/setup.html` con il `SETUP_TOKEN` per creare l'amministratore, poi togliere il token.

## 3. Codice su GitHub

- [ ] Commit e push fatti su `main` (`git status` pulito, `git log origin/main -1` mostra l'ultima modifica).
- [ ] Il push su `main` **non** deve avviare un deploy (i deploy automatici sono fermi). Se su Netlify compare un deploy che non hai lanciato tu, ferma i deploy automatici nelle impostazioni di build.

## 4. Il deploy

- [ ] Netlify → progetto giusto (spagnolo o portoghese, non l'altro) → **Deploys → Trigger deploy → Deploy site**.
- [ ] Aspettare "Published". Se fallisce, leggere il log prima di riprovare: ogni tentativo costa crediti.

## 5. Dopo il deploy

- [ ] Aprire il sito e fare l'accesso.
- [ ] Provare una conversazione e un esercizio (usano il vero Claude).
- [ ] Provare la sezione Verbi: cercare un verbo in elenco e uno che non c'è.
- [ ] Controllare nella pagina Deploys che non ci siano deploy extra.
- [ ] Annotare i crediti rimasti.

## Cose che consumano crediti senza volerlo

- Deploy automatici da push su `main`: tenerli fermi.
- Deploy di anteprima per rami e Pull Request: controllare nelle impostazioni di build che siano disattivati, se l'opzione esiste per il tuo piano.
- Rilanciare un deploy per aggiungere una variabile d'ambiente dimenticata.
