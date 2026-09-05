/* Aba CONFIGURAÇÕES — personagens, cenário, backup e regras não definidas. */
import { el, toast, modal, confirmar, baixar } from '../ui.js';
import { store } from '../store.js';

export function renderConfig(main, { db }) {
  const pc = store.atual;

  /* ------------------------------------------------ personagens */
  const lista = el('div', { class: 'list' });
  function desenharChars() {
    lista.innerHTML = '';
    for (const p of store.personagens) {
      lista.append(el('div', { class: 'row' },
        el('span', { class: 'grow' },
          el('span', { class: 'name' }, p.nome || 'Sem nome'), ' ',
          p.id === store.atual?.id ? el('span', { class: 'pill ok' }, 'atual') : '',
          el('div', { class: 'meta' }, `criado ${new Date(p.criadoEm).toLocaleDateString('pt-BR')} · ${p.pontos.total} pts`)),
        el('button', { class: 'btn small', onclick: () => store.selecionar(p.id) }, 'Usar'),
        el('button', { class: 'btn small', onclick: () => { store.duplicar(p.id); toast('Cópia criada.', 'ok'); } }, 'Duplicar'),
        el('button', { class: 'btn small danger', onclick: () => confirmar('Excluir personagem', `Excluir "${p.nome}" definitivamente deste dispositivo?`, () => store.excluir(p.id)) }, 'Excluir'),
      ));
    }
  }
  const novoNome = el('input', { type: 'text', placeholder: 'Nome do novo personagem', style: 'flex:1' });
  const novoPts = el('input', { type: 'number', min: 25, step: 25, value: 100, style: 'width:90px', title: 'Pontos totais da criação' });
  const chars = el('div', { class: 'panel' },
    el('h3', {}, 'Personagens (neste dispositivo)'),
    lista,
    el('div', { class: 'btn-row' },
      novoNome, el('span', { class: 'label' }, 'pts'), novoPts,
      el('button', { class: 'btn primary', onclick: () => {
        const nome = novoNome.value.trim() || 'Novo Personagem';
        store.criar(nome, Math.max(25, parseInt(novoPts.value, 10) || 100));
        novoNome.value = '';
        toast(`"${nome}" criado.`, 'ok');
      } }, '＋ Criar')),
    el('p', { class: 'fonte' }, 'Tudo fica no localStorage do navegador — nenhum dado de jogador sai do dispositivo. Use Exportar/Importar para backup.'),
  );

  /* ------------------------------------------------ cenário */
  const media = el('input', { type: 'number', min: 0, step: 50, value: pc.riqueza?.recursosBase ?? 1000, style: 'width:110px' });
  const fator = el('input', { type: 'number', min: 0, max: 1, step: 0.05, value: pc.config?.fatorVenda ?? 1, style: 'width:80px' });
  const totalPts = el('input', { type: 'number', min: 25, step: 25, value: pc.pontos.total, style: 'width:90px' });
  const cenario = el('div', { class: 'panel' },
    el('h3', {}, `Cenário — ${pc.nome || ''}`),
    el('div', { class: 'list' },
      el('div', { class: 'row' }, el('span', { class: 'grow' }, 'Riqueza média do cenário ($)', el('div', { class: 'meta' }, 'multiplicada pelo nível de Riqueza p/ recursos iniciais — p. 12')), media),
      el('div', { class: 'row' }, el('span', { class: 'grow' }, 'Fator de venda (0–1)', el('div', { class: 'meta' }, 'REGRA NÃO DEFINIDA no material; 1 = valor integral')), fator),
      el('div', { class: 'row' }, el('span', { class: 'grow' }, 'Pontos totais da criação'), totalPts),
      el('label', { class: 'row', style: 'cursor:pointer' }, el('span', { class: 'grow' }, 'Em criação', el('div', { class: 'meta' }, 'limita perícias a 2× idade (p. 105)')),
        el('input', { type: 'checkbox', checked: !!pc.config?.emCriacao, onchange: e => store.update(p => p.config.emCriacao = e.target.checked) })),
      el('div', { class: 'row' }, el('span', { class: 'grow' }, 'Destro/canhoto', el('div', { class: 'meta' }, 'penalidade de mão inábil aplica ao lado oposto — p. 100')),
        el('select', { onchange: e => store.update(p => p.mano = e.target.value) },
          ['destro', 'canhoto'].map(m => el('option', { value: m, selected: pc.mano === m }, m)))),
    ),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn primary', onclick: () => {
        store.update(p => {
          p.riqueza.recursosBase = parseFloat(media.value) || 1000;
          p.config.fatorVenda = Math.max(0, Math.min(1, parseFloat(fator.value) ?? 1));
          p.pontos.total = Math.max(25, parseInt(totalPts.value, 10) || 100);
        });
        toast('Configuração salva.', 'ok');
      } }, '💾 Salvar cenário'),
    ),
  );

  /* ------------------------------------------------ sistema de resolução G.A.U. */
  const cfg = pc.config || {};
  const escolher = (chave, opcoes, rotulo, meta) => el('div', { class: 'row' },
    el('span', { class: 'grow' }, rotulo, el('div', { class: 'meta' }, meta)),
    el('select', { onchange: e => store.update(p => { p.config[chave] = e.target.value === 'padrao' ? null : e.target.value; }) },
      ...opcoes.map(([valor, texto]) => el('option', { value: valor, selected: String(cfg[chave] ?? 'padrao') === valor }, texto))));

  const sistema = el('div', { class: 'panel' },
    el('h3', {}, 'Sistema de resolução'),
    el('div', { class: 'list' },
      escolher('modoCombate', [['gau', 'G.A.U. (d20 + Grau de Dano)'], ['legado', 'Legado (3d6 + dano por dado)']],
        'Modo de combate', 'G.A.U.: d20, margem de sucesso e GD1/GD2/GD3. Legado: 3d6 e dano por arma.'),
      escolher('resolucaoMagia', [['padrao', 'Padrão do modo de combate'], ['d20', 'Sempre d20'], ['3d', 'Sempre 3d6']],
        'Resolução de mágicas', 'O material de MAGIA cita 3 dados e o de TESTES cita d20 — os dois estão publicados em rules.conflitos.'),
      escolher('modoEscala', [['melhor', 'Melhor dado'], ['cada-dado', 'Cada dado avaliado separadamente'], ['soma', 'Soma dos dados (hipótese)']],
        'Testes de categoria com vários d20', 'A agregação de múltiplos dados não foi publicada — "soma" é marcada como HIPÓTESE no motor.'),
      escolher('criterioDisputa', [['proximidade-do-critico', 'Mais próximo do crítico'], ['maior-margem', 'Maior margem de sucesso']],
        'Critério de vitória em disputas', 'Disputa rápida: vence quem chegar mais perto do próprio valor crítico.'),
      el('div', { class: 'row' },
        el('span', { class: 'grow' }, 'Limite de pontos em desvantagens', el('div', { class: 'meta' }, 'vazio = sem limite; usado pela validação de criação')),
        el('input', {
          type: 'number', min: 0, step: 5, value: cfg.limiteDesvantagens ?? '', style: 'width:90px', placeholder: '—',
          onchange: e => store.update(p => { p.config.limiteDesvantagens = e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0); }),
        })),
    ),
    el('p', { class: 'fonte' }, 'Cada escolha altera apenas como o motor resolve as jogadas — nenhum valor do material é reescrito.'),
  );

  /* ------------------------------------------------ backup */
  const backup = el('div', { class: 'panel' },
    el('h3', {}, 'Backup de todos os personagens'),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', onclick: () => {
        baixar(`gua-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.personagens, null, 2), 'application/json');
        store.historico('export', 'Backup completo exportado.');
      } }, '⬇ Exportar tudo'),
      el('button', { class: 'btn', onclick: importarTudo }, '⬆ Importar backup'),
      el('button', { class: 'btn danger', onclick: () => confirmar('Apagar tudo', 'Remover TODOS os personagens deste dispositivo? Essa ação não pode ser desfeita.', () => {
        for (const p of [...store.personagens]) store.excluir(p.id);
        if (!store.personagens.length) store.criar('Aventureiro Iniciante', 100);
        toast('Dados apagados.', 'ok');
      }) }, '🗑 Apagar tudo'),
    ),
  );

  function importarTudo() {
    const input = el('input', { type: 'file', accept: '.json' });
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const arr = JSON.parse(String(r.result));
          if (!Array.isArray(arr)) throw new Error('backup deve ser uma lista de personagens');
          for (const p of arr) store.importar(JSON.stringify(p));
          toast(`${arr.length} personagem(ns) importado(s).`, 'ok');
          document.querySelector('.modal-back')?.remove();
        } catch (e) { toast('Falha: ' + e.message, 'bad'); }
      };
      r.readAsText(f);
    };
    modal('Importar backup', el('div', {}, el('p', {}, 'Todos os personagens do arquivo serão adicionados (nada é sobrescrito).'), input));
  }

  /* ------------------------------------------------ regras não definidas */
  const nd = el('div', { class: 'panel' },
    el('h3', {}, 'Regras não definidas no material'),
    el('p', {}, 'Por decisão de projeto, nada foi inventado. Estes pontos estão marcados e a arquitetura aceita a regra quando for publicada:'),
    el('ul', { style: 'padding-left:1.2rem;line-height:1.7' },
      ...(db.rules?.naoDefinidas || []).map(t => el('li', {}, t))),
    el('p', { class: 'fonte' }, 'Base: ' + (db.tables._fonte || '')),
  );

  /* ------------------------------------------------ sobre */
  const sobre = el('div', { class: 'panel' },
    el('h3', {}, 'Sobre'),
    el('p', {}, el('b', {}, 'GUA — Ecossistema Digital'), '. Ficha automatizada + livro digital sobre a mesma base de regras (data/*.json = fonte única da verdade). Todos os cálculos centralizados no Rule Engine — a interface não contém fórmulas.'),
    el('p', { class: 'fonte' }, 'Material base: GURPS® Basic Set 3ª ed. (PT-BR, 370 pp.) — transcrição fiel de nomes, tabelas e fórmulas. GURPS® é marca de seus detentores; este projeto é uma ferramenta de mesa, sem afiliação.'),
  );

  main.append(
    el('h1', { class: 'page-title' }, '⚙️ Configurações'),
    el('div', { class: 'grid cols-2' }, chars, cenario),
    el('div', { class: 'grid cols-2', style: 'margin-top:.9rem' }, sistema, backup),
    el('div', { class: 'grid cols-2', style: 'margin-top:.9rem' }, sobre, nd),
  );
  desenharChars();
}
