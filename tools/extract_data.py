#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extrator: material GUA (PDF extraído) → /data/*.json (fonte única da verdade).
Uso: python3 tools/extract_data.py <book_text.txt> <outdir>
Não inventa valores: tudo vem do texto; lacunas ficam marcadas como "REGRA NÃO DEFINIDA".
"""
import re, sys, json, os

src = open(sys.argv[1], encoding='utf-8').read()
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)

pages = re.split(r'===== PÁGINA (\d+) =====', src)
P = {int(pages[i]): pages[i+1] for i in range(1, len(pages), 2)}

def condense(text, limit=420):
    t = re.sub(r'\s+', ' ', text).strip()
    sents = re.split(r'(?<=[.!?]) ', t)
    out = ''
    for s in sents:
        if len(out) + len(s) + 1 > limit and out:
            break
        out = (out + ' ' + s).strip()
    return out

def page_lines(a, b):
    for p in range(a, b + 1):
        for ln in P.get(p, '').split('\n'):
            yield p, ln.rstrip()

# ---------------------------------------------------------------- PERÍCIAS
skill_head = re.compile(r'^([A-ZÀ-Ü][^()]{1,60}?)\s*\((Física|Físico|Mental)/(Fácil|Média|Difícil|Muito Difícil)\)\s*(.*)$')
default_line = re.compile(r'^\s*(Pr[ée]-definid[oa][^:]*?|Sem n[íi]vel pr[ée]-definido)\s*[:：]?\s*(.*)$', re.I)
prereq_line = re.compile(r'^\s*Pr[ée]-requisitos?\s*[:：]\s*(.+)$', re.I)
GROUPS = [
    ('Perícias com Animais', 111, 114), ('Perícias Artísticas', 114, 117),
    ('Perícias Atléticas', 117, 120), ('Perícias de Combate', 120, 132),
    ('Perícias de Ofício (Criação e Manutenção)', 132, 137),
    ('Perícias de Influência e Comunicação', 137, 140),
    ('Perícias Médicas', 140, 142), ('Perícias de Sobrevivência/Natureza', 142, 146),
    ('Perícias de Conhecimento (Humanidades)', 146, 149),
    ('Perícias Científicas', 149, 158), ('Perícias Sociais', 158, 165),
    ('Perícias de Espionagem e Furtividade', 165, 175),
    ('Perícias com Veículos', 175, 181),
]
skills = []
cur = None
for p, ln in page_lines(105, 181):
    t = ln.strip()
    if not t:
        continue
    m = skill_head.match(t)
    if m:
        if cur: skills.append(cur)
        name = m.group(1).strip()
        typo = 'Física' if m.group(2).startswith('Fís') else 'Mental'
        diff = m.group(3)
        note = m.group(4).strip()
        tl = '/NT' in name or '/NT' in note
        name = name.replace('/NT', '').strip()
        cur = {
            'id': re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'),
            'nome': name, 'tipo': typo, 'dificuldade': diff,
            'nt': tl, 'pagina': p, 'categoria': 'Geral',
            'default': [], 'preRequisitos': [], 'descricao': '',
            'especializacao': 'obrigatória' if 'especializ' in note.lower() else ('opcional' if 'especializ' in (cur or {}).get('descraw','') else None),
        }
        if note: cur['notaCabecalho'] = note
        continue
    if cur is None:
        continue
    if default_line.match(t):
        d = default_line.match(t)
        val = (d.group(1) + (': ' + d.group(2) if d.group(2) else '')).strip()
        cur['default'].append(re.sub(r'\s+', ' ', val))
        continue
    if prereq_line.match(t):
        cur['preRequisitos'].append(re.sub(r'\s+', ' ', prereq_line.match(t).group(1)))
        continue
    if re.match(r'^Modificadores', t):
        cur['_mods_line'] = True
    cur.setdefault('descraw', '')
    cur['descraw'] += ' ' + t
for gname, ga, gb in GROUPS:
    for s in skills:
        if ga <= s['pagina'] <= gb:
            s['categoria'] = gname
for s in skills:
    raw = s.pop('descraw', '')
    s.pop('_mods_line', None)
    # especialização por texto
    if re.search(r'especializa[çc][ãa]o obrigat[óo]ria', raw, re.I):
        s['especializacao'] = 'obrigatória'
    elif re.search(r'especializa[çc][ãa]o opcional', raw, re.I):
        s['especializacao'] = 'opcional'
    s['descricao'] = condense(raw)
    if not s['default']:
        s['default'] = ['Sem nível pré-definido']
    s['_fonte'] = f'p. {s["pagina"]}'
    s.pop('notaCabecalho', None)

# ---------------------------------------------------------------- VANTAGENS / DESVANTAGENS / PECULIARIDADES
entry_head = re.compile(r'^([A-ZÀ-Ü“"][^()]{1,60}?)\s*\(([^()]*?)\)\s*$')
adv, dis, qrk = [], [], []
mode = None
cur = None
for p, ln in page_lines(17, 99):
    t = ln.strip()
    hm = re.match(r'^(VANTAGENS|NOVAS VANTAGENS|DESVANTAGENS|NOVAS DESVANTAGENS|PECULIARIDADES)\s*$', t)
    if hm:
        mode = {'VANTAGENS': 'adv', 'NOVAS VANTAGENS': 'adv',
                'DESVANTAGENS': 'dis', 'NOVAS DESVANTAGENS': 'dis',
                'PECULIARIDADES': 'qrk'}[hm.group(1)]
        continue
    if p >= 88 and mode != 'qrk' and 'PECULIARIDADES' not in P.get(88, ''):
        pass
    if mode is None:
        continue
    m = entry_head.match(t)
    cost = m.group(2) if m else ''
    looks_cost = m and ('ponto' in cost.lower() or 'variável' in cost.lower() or re.match(r'^-?\d', cost))
    if looks_cost:
        name = m.group(1).strip().rstrip(':')
        if name[0].isupper() and not name.endswith(('.', ',', ';')):
            cur = {'id': re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-'),
                   'nome': name, 'custo': re.sub(r'\s+', ' ', cost),
                   'pagina': p, 'descricao': '', '_fonte': f'p. {p}'}
            (adv if mode == 'adv' else dis if mode == 'dis' else qrk).append(cur)
            continue
    if cur is not None and t and not t.startswith('Impio'):
        cur['descricao'] += ' ' + t
for lst in (adv, dis, qrk):
    for e in lst:
        e['descricao'] = condense(e.pop('descricao', '')) if '_f' not in e else e['descricao']
        if isinstance(e['descricao'], str):
            e['descricao'] = re.sub(r'\s+', ' ', e['descricao']).strip()[:480]
# peculiaridades: transformar entradas com custo "-1 ponto"-like em lista de exemplos
json.dump(skills, open(f'{outdir}/skills.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(adv, open(f'{outdir}/advantages.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(dis, open(f'{outdir}/disadvantages.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(qrk, open(f'{outdir}/quirks.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'skills: {len(skills)} | vantagens: {len(adv)} | desvantagens: {len(dis)} | peculiaridades(entradas): {len(qrk)}')
