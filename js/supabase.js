/* GAU — Supabase Backend (opcional, com fallback localStorage)
   Usa CDN @supabase/supabase-js@2 via ESM
   Tabelas: personagens (id, owner_id, nome, conceito, dados JSONB, pontos_totais, criado_em, atualizado_em)
*/

const SUPABASE_URL = 'https://ebjjxncnlddzfgkqegpa.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViamp4bmNubGRkemZna3FlZ3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTY0ODksImV4cCI6MjA4NzAzMjQ4OX0.yIeY5iENc9-txdLYKQELP3VhA6gsWtg8azdt_KOhsaw';

let supabaseClient = null;
let initPromise = null;
let status = 'idle'; // idle, loading, ok, error, offline

function getLocalUserId() {
  let uid = localStorage.getItem('gau_user_id');
  if (!uid) {
    uid = 'user_' + Date.now() + '_' + Math.random().toString(36).slice(2,9);
    localStorage.setItem('gau_user_id', uid);
  }
  return uid;
}

async function initSupabase() {
  if (supabaseClient) return supabaseClient;
  if (initPromise) return initPromise;
  status = 'loading';
  initPromise = (async () => {
    try {
      // Dynamic import ESM
      const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      const { createClient } = mod;
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'x-client-info': 'gau-web' } }
      });
      // Test connection
      const { error } = await supabaseClient.from('personagens').select('id').limit(1);
      if (error) {
        // If table doesn't exist, we consider offline but still have client
        console.warn('Supabase tabela personagens não existe ou erro:', error.message);
        if (error.message.includes('does not exist') || error.code === '42P01') {
          status = 'no-table';
        } else {
          status = 'ok'; // ainda ok, pode ser RLS vazio
        }
      } else {
        status = 'ok';
      }
      console.log('Supabase inicializado status:', status);
      return supabaseClient;
    } catch (e) {
      console.warn('Falha ao init Supabase, modo offline:', e);
      status = 'offline';
      return null;
    }
  })();
  return initPromise;
}

function getStatus() { return status; }
function isOnline() { return status === 'ok' || status === 'no-table'; }

async function salvarPersonagemSupabase(char) {
  const client = await initSupabase();
  if (!client || status === 'offline') return { ok: false, offline: true };
  try {
    const owner = getLocalUserId();
    const payload = {
      id: char.id,
      owner_id: owner,
      nome: char.nome || 'Sem nome',
      conceito: char.conceito || '',
      pontos_totais: char.pontosTotais || 150,
      dados: char,
      atualizado_em: new Date().toISOString()
    };
    // upsert
    const { data, error } = await client.from('personagens').upsert(payload, { onConflict: 'id' }).select();
    if (error) throw error;
    return { ok: true, data };
  } catch (e) {
    console.warn('Supabase salvar erro:', e.message);
    return { ok: false, error: e.message };
  }
}

async function carregarPersonagensSupabase() {
  const client = await initSupabase();
  if (!client) return { ok: false, offline: true, data: [] };
  try {
    const owner = getLocalUserId();
    const { data, error } = await client.from('personagens').select('*').eq('owner_id', owner).order('atualizado_em', { ascending: false });
    if (error) throw error;
    const chars = (data || []).map(row => row.dados || { id: row.id, nome: row.nome, ...row });
    return { ok: true, data: chars };
  } catch (e) {
    console.warn('Supabase carregar erro:', e.message);
    return { ok: false, error: e.message, data: [] };
  }
}

async function excluirPersonagemSupabase(id) {
  const client = await initSupabase();
  if (!client) return { ok: false };
  try {
    const { error } = await client.from('personagens').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function criarTabelasSeNecessario() {
  // Não podemos criar tabela via anon key, mas fornecemos SQL para o usuário rodar no dashboard
  return false;
}

export const supabaseService = {
  init: initSupabase,
  getStatus,
  isOnline,
  getLocalUserId,
  salvar: salvarPersonagemSupabase,
  carregar: carregarPersonagensSupabase,
  excluir: excluirPersonagemSupabase,
  url: SUPABASE_URL
};

// Auto init
initSupabase();
