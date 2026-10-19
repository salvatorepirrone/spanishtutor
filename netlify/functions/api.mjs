// Funzione Netlify: tutta l'API del tutor passa da qui (/api e /api/*). La logica sta in netlify/lib/.
import { getStore } from '@netlify/blobs';
import { handle } from '../lib/router.mjs';

// Le variabili si impostano nelle impostazioni del sito su Netlify (mai nel repository).
const VARS = ['ANTHROPIC_API_KEY', 'SESSION_SECRET', 'SETUP_TOKEN', 'PUBLIC_URL'];
const readEnv = () => Object.fromEntries(VARS.map((k) => [k, Netlify.env.get(k) || '']));

export default async (req, context) => {
  // Archivio dei dati (utenti, progressi, lezioni in cache). Su Netlify si configura da solo.
  const blobs = getStore({ name: 'spagnolo', consistency: 'strong' });
  return handle(req, { blobs, env: readEnv(), ip: context.ip });
};

export const config = { path: ['/api', '/api/*'] };
