#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera /data/*.json a partir da extração + tabelas estruturadas transcritas do material.
Tudo citado por página. Lacunas marcadas "REGRA NÃO DEFINIDA"."""
import json, re, os, unicodedata

def slug(nome):
    n = unicodedata.normalize('NFKD', nome).encode('ascii', 'ignore').decode('ascii').lower()
    return re.sub(r'[^a-z0-9]+', '-', n).strip('-')

OUT = '/home/user/gua/data'
os.makedirs(OUT, exist_ok=True)
dis = json.load(open('/home/user/analysis/outdata/disadvantages.json', encoding='utf-8'))
spells_raw = json.load(open('/home/user/analysis/outdata/spells_raw.json', encoding='utf-8'))

# ------------------------------------------------------------------ skills.json (G.A.U.) + pericias.json
# data/skills.json e data/pericias.json NÃO são gerados aqui: o catálogo passou a vir da publicação
# oficial de PERÍCIAS do sistema G.A.U. (canal #『📕』perícias — Impio, 02/08/2026 09:19 e adendo de
# 05/08/2026), transcrito em 176 entradas com custo em pontos, níveis pré-definidos estruturados,
# modificadores publicados, especializações, pré-requisitos e NT mínimo — consumidos por
# app/engine/skills.js (modelo G.A.U.) e pelo capítulo IV do livro. Gerar de novo a partir da
# extração do PDF legado sobrescreveria esse catálogo (inclusive os campos `defaults`/`dificuldade`
# preservados para o modelo legado), por isso este script apenas confere os arquivos.
skills = json.load(open(f'{OUT}/skills.json', encoding='utf-8'))
pericias_cap = json.load(open(f'{OUT}/pericias.json', encoding='utf-8'))
assert len(skills) >= 170 and len(pericias_cap.get('grupos', [])) >= 16, 'skills.json/pericias.json fora do padrão G.A.U.'

# ------------------------------------------------------------------ vantagens (G.A.U.) + desvantagens (legado)
# data/advantages.json e data/vantagens.json NÃO são mais gerados aqui: o catálogo passou a vir da
# publicação oficial de VANTAGENS do sistema G.A.U. (canal #『📕』vantagens — Impio, 26/07/2026 e
# NOVAS VANTAGENS, 16/08/2026), transcrita à mão com efeitos estruturados consumidos por
# app/engine/vantagens.js. Gerar de novo a partir do PDF legado sobrescreveria esse catálogo —
# por isso este script preserva os dois arquivos e registra apenas as desvantagens (ainda legado).
def limpa(lst, kind):
    out = []
    for e in lst:
        out.append({
            'id': e['id'], 'nome': e['nome'], 'custo': e['custo'],
            'descricao': e.get('descricao', ''), 'fonte': e.get('_fonte', ''),
        })
    return out

json.dump(limpa(dis, 'dis'), open(f'{OUT}/disadvantages.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ peculiaridades
QUIRK_EX = ['Alérgico(a) a mofo, sujeira', 'Ateu(á)', 'Gosta de argumentar em qualquer situação',
 'Senta-se em posições desconfortáveis', 'Má postura ao andar', 'Entediado(a) o tempo inteiro',
 'Mente aberta para tudo', 'Cínico(a)', 'Gosta de olhar vitrines, mercadorias em tendas, feiras…',
 'Desorganizado(a)!', 'Acha-se mais inteligente que os outros…', 'Começa todas as frases com "tipo…"',
 'Acha que tem excelente pontaria…', 'Gosta de pichar muros, veículos, placas…', 'Dentes sensíveis!',
 'Visão política: anarquista!', 'Não acredita em fadas (em mundos mágicos com NT baixo)!',
 'Acha que sabe cantar bem…', 'Acha que sabe dançar bem…', 'Acha que sabe pintar/desenhar bem…',
 'Não confia em computadores!', 'Frequenta boates, cabarés, bordéis…', 'Tem chulé!',
 'Diz "tchau!" quando dispara seu arco/rifle/revólver…', 'Sempre esquece os nomes das pessoas!',
 'Acredita ser um(a) grande estrategista…', 'Detesta dizer "não"!', 'Nunca dá as costas para janelas, portas, corredores…',
 'Sempre atrasado(a)!', 'Detesta ler/estudar!', 'Detesta escolhas!', 'Imprecações: "Maldição!", "Com mil demônios!"']
json.dump({'maximo': 5, 'custoCada': -1, 'regra': 'Máximo de 5 peculiaridades, cada uma vale -1 ponto; não contam no limite de desvantagens da campanha. Devem ser interpretadas ou o GM penaliza.',
           'fonte': 'p. 88–89', 'exemplos': QUIRK_EX},
          open(f'{OUT}/quirks.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ magias
# Fronteiras escola→página verificadas contra o material (ordem de página conferida).
# Escopo da extração: p. 331-370. Magias de Informação (p. 314+) = default p/ páginas anteriores.
ESCOLAS = [(331, 'Mágicas Sobre Animais'), (332, 'Mágicas para Comunicação e Empatia'),
           (334, 'Mágicas de Terra (Elementais)'), (337, 'Mágicas com Elementais'),
           (339, 'Mágicas do Ar'), (344, 'Mágicas do Fogo'), (347, 'Mágicas da Água'),
           (358, 'Mágicas de Cura'), (361, 'Mágicas de Reconhecimento'),
           (364, 'Mágicas de Luz e Trevas'), (368, 'Mágicas de Controle da Mente')]
spells = []
cur_school = 'Mágicas de Informação'
escola_idx = 0
for s in spells_raw:
    p = s['pagina']
    while escola_idx < len(ESCOLAS) and ESCOLAS[escola_idx][0] <= p:
        cur_school = ESCOLAS[escola_idx][1]
        escola_idx += 1
    c = s['campos']
    ent = {'id': slug(s['nome']),
           'nome': s['nome'], 'classes': s['classes'], 'escola': cur_school, 'fonte': f"p. {s['pagina']}",
           'descricao': re.sub(r'\s+', ' ', s.get('desc', '')).strip()[:420]}
    for k in ['Duração', 'Custo', 'Custo Básico', 'Tempo de Operação', 'Pré-requisitos', 'Objetos', 'Manutenção']:
        if k in c: ent[k] = re.sub(r'\s+', ' ', c[k]).strip()
    spells.append(ent)
json.dump(spells, open(f'{OUT}/spells.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ------------------------------------------------------------------ equipamento
equipment = {
    'moeda': '$', 'fonteTabelas': 'Cap. Equipamento e Carga (p. 181–200); Quadros e Tabelas NÃO FORNECIDO',
  'armaduras': [
    {'id':'roupa-verao','nome':'Roupa de verão','nt':'qualquer','dp':0,'rd':0,'custo':20,'peso':1,'fonte':'p. 186'},
    {'id':'roupa-inverno','nome':'Roupa de inverno','nt':'qualquer','dp':0,'rd':1,'custo':60,'peso':2.5,'fonte':'p. 186'},
    {'id':'laudel','nome':'Laudel','nt':'1-4','dp':1,'rd':1,'custo':180,'peso':7,'fonte':'p. 186'},
    {'id':'coura','nome':'Coura','nt':'1-4','dp':1,'rd':1,'custo':210,'peso':5,'fonte':'p. 186'},
    {'id':'loriga-couro','nome':'Loriga de couro','nt':'1-4','dp':2,'rd':2,'custo':350,'peso':10,'fonte':'p. 186'},
    {'id':'cota-malha','nome':'Cota de malha','nt':'3-4','dp':3,'rd':4,'custo':550,'peso':22.5,'notas':'DP 1 / RD 2 vs perfuração; sem laudel: DP 3, RD 1 vs perfurante','fonte':'p. 186'},
    {'id':'loriga-escamas','nome':'Loriga de escamas','nt':'2-4','dp':3,'rd':4,'custo':750,'peso':25,'fonte':'p. 186'},
    {'id':'armadura-mista','nome':'Armadura mista placa/cota','nt':'2-4','dp':4,'rd':5,'custo':2000,'peso':35,'notas':'Elmo: -1 NH armas, -3 Visão/Audição','fonte':'p. 186'},
    {'id':'armadura-placas','nome':'Armadura de placas','nt':'3-4','dp':4,'rd':6,'custo':4000,'peso':45,'notas':'Elmo: -1 NH armas, -3 Visão/Audição','fonte':'p. 186'},
    {'id':'armadura-placas-reforcada','nome':'Armadura de placas reforçada','nt':'3-4','dp':4,'rd':7,'custo':6000,'peso':55,'notas':'Elmo: -1 NH armas, -3 Visão/Audição','fonte':'p. 186'},
    {'id':'colete-campanha','nome':'Colete de campanha','nt':'6','dp':2,'rd':3,'custo':220,'peso':8.5,'notas':'Protege apenas o tronco','fonte':'p. 186'},
    {'id':'kevlar-leve','nome':'Kevlar (leve)','nt':'7','dp':2,'rd':4,'custo':220,'peso':2.5,'notas':'DP 1 / RD 2 vs perfuração; só tronco','fonte':'p. 186'},
    {'id':'kevlar-pesado','nome':'Kevlar (pesado)','nt':'7','dp':2,'rd':12,'custo':420,'peso':4.5,'notas':'DP 1 / RD 2 vs perfuração; só tronco','fonte':'p. 186'},
    {'id':'colete-prova-balas','nome':'Colete à prova de balas','nt':'7+','dp':4,'rd':15,'custo':270,'peso':11,'fonte':'p. 186'},
    {'id':'reflec','nome':'Reflec','nt':'8-9','dp':6,'rd':2,'custo':320,'peso':2,'notas':'Só contra lasers; DP 3/RD 0 vs sônicos; nada vs outros','fonte':'p. 186'},
    {'id':'blindagem-individual','nome':'Blindagem individual','nt':'8+','dp':6,'rd':25,'custo':1520,'peso':16,'fonte':'p. 186'},
    {'id':'armadura-combate-reforcada','nome':'Armadura de combate reforçada','nt':'9+','dp':6,'rd':50,'custo':2520,'peso':36,'fonte':'p. 186'},
  ],
  'escudos': [
    {'id':'escudo-improvisado','nome':'Escudo improvisado','dp':'1 ou 2','custo':None,'peso':'varia','fonte':'p. 195'},
    {'id':'broquel','nome':'Broquel','dp':1,'custo':25,'peso':1,'danoSuportado':'5/20','fonte':'p. 195'},
    {'id':'escudo-pequeno','nome':'Escudo pequeno','dp':2,'custo':40,'peso':4,'danoSuportado':'5/30','fonte':'p. 195'},
    {'id':'escudo-medio','nome':'Escudo médio','dp':3,'custo':60,'peso':7,'danoSuportado':'7/40','fonte':'p. 195'},
    {'id':'escudo-grande','nome':'Escudo grande','dp':4,'custo':90,'peso':12,'danoSuportado':'9/60','fonte':'p. 195'},
    {'id':'escudo-forca','nome':'Escudo de Força (NT 11+)','dp':4,'custo':1500,'peso':0.2,'notas':'Usado no pulso esquerdo','fonte':'p. 195'},
  ],
  'armasLongoAlcanceExemplos': [
    {'nome':'Faca Pequena','tr':11,'prec':0,'meioDano':'ST-5','max':'ST','fonte':'p. 257','notas':'dano/custo/peso: NÃO DEFINIDOS no material'},
    {'nome':'Pedra ou bola de Baseball','tr':12,'prec':0,'meioDano':'STx2','max':'STx3,5','fonte':'p. 257'},
    {'nome':'Lança','tr':11,'prec':2,'meioDano':'ST','max':'STx1,5','fonte':'p. 257'},
    {'nome':'Arco Longo','tr':15,'prec':3,'meioDano':'STx15','max':'STx20','fonte':'p. 257'},
    {'nome':'Besta','tr':12,'prec':4,'meioDano':'STx20','max':'STx25','fonte':'p. 257'},
    {'nome':'Pistola calibre .45','tr':10,'prec':2,'meioDano':175,'max':1700,'fonte':'p. 257'},
    {'nome':'Fuzil Laser','tr':15,'prec':13,'meioDano':900,'max':1200,'fonte':'p. 257'},
  ],
  'armasCorpoACorpo': 'REGRA NÃO DEFINIDA — Tabela de Armas (Quadros e Tabelas) não fornecida no material. Armas corpo-a-corpo genéricas poderão ser cadastradas pelo usuário com dano (ex.: Bal+1), alcance, custo, peso e ST mínima; o motor calcula NH, Aparar, dano e carga a partir desses dados.',
  'ataquesNaturais': [
    {'id':'soco','nome':'Soco (mãos limpas)','pericia':'DX (ou Briga/Caratê)','dano':'GDP-2 contusão','fonte':'p. 232','notas':'Soqueiras/manoplas +2; objeto pequeno +1; caneca +2'},
    {'id':'chute','nome':'Chute','pericia':'DX-2 (Briga-2/Caratê)','dano':'GDP contusão (GDP+1 com botas pesadas)','fonte':'p. 233','notas':'Falhar = teste para não cair'},
    {'id':'mordida','nome':'Mordida','pericia':'—','dano':'1D-4 contusão (humanos)','fonte':'p. 248'},
  ],
  'itensAvulsos': [
    {'nome':'Pé-de-cabra para besta','peso':1,'custo':50,'notas':'Engatilha bestas ST+3/+4 em 20 s','fonte':'p. 255'},
    {'nome':'Coldre sob medida','peso':None,'custo':200,'notas':'+2 Sacar Rápido','fonte':'p. 132 (Sacar Rápido)'},
    {'nome':'Coldre comum','peso':None,'custo':100,'notas':'+1 Sacar Rápido','fonte':'p. 132'},
    {'nome':'Coldre axilar razoável','peso':None,'custo':50,'notas':'Sem bônus','fonte':'p. 132'},
    {'nome':'Célula de energia tipo B','peso':0.5,'custo':30,'fonte':'p. 219'},
    {'nome':'Célula de energia tipo C','peso':0.25,'custo':100,'fonte':'p. 219'},
    {'nome':'Alcatrão Cáustico (veneno, dose)','custo':30,'fonte':'p. 293'},
    {'nome':'Acônito (veneno, dose)','custo':40,'fonte':'p. 293'},
    {'nome':'Veneno de Cobra (dose)','custo':100,'fonte':'p. 293'},
  ],
  'qualidade': [
    {'nome':'Barata','preco':'40% (armas de fogo ~60%)','efeito':'2/3 chance de quebrar ao aparar; -1 a -10 Prec (armas de fogo)'},
    {'nome':'Boa (padrão das tabelas)','preco':'100%','efeito':'1/3 chance de quebrar ao aparar arma muito pesada'},
    {'nome':'Superior','preco':'x4 (espadas; arcos/bestas: alcance +20%; machados/haste: x10; contusão: x3)','efeito':'+1 dano (corte/perfurante); nunca quebra (altíssima: x20, +2 dano)'},
    {'nome':'Altíssima','preco':'x20','efeito':'+2 dano; nunca quebra ao aparar'},
  ],
  'encantamentoCustoLento': {'nota': 'Encantamento "Lento e Seguro": $25 por ponto de energia + elementos', 'tabela': [
      {'potencia': 105, 'custo': 180}, {'potencia': 110, 'custo': 205}, {'potencia': 120, 'custo': 235},
      {'potencia': 130, 'custo': 320}, {'potencia': 140, 'custo': 435}, {'potencia': 150, 'custo': 505},
      {'potencia': 160, 'custo': 685}, {'potencia': 170, 'custo': 915}, {'potencia': 180, 'custo': 1055},
      {'potencia': 190, 'custo': 1385}, {'potencia': 200, 'custo': 1790}, {'potencia': 210, 'custo': 2065},
      {'potencia': 220, 'custo': 2615}, {'potencia': 230, 'custo': 3275}, {'potencia': 240, 'custo': 3650},
      {'potencia': 250, 'custo': 4510}, {'potencia': 260, 'custo': 5520},
      {'potencia': 270, 'custo': 6090}], 'fonte': 'p. 322–323'},
}
json.dump(equipment, open(f'{OUT}/equipment.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('data/*.json gerados')
print('skills', len(skills), '(preservado, catálogo G.A.U.) | dis', len(dis), '| spells', len(spells),
      '| advantages.json, vantagens.json, skills.json e pericias.json preservados (catálogos G.A.U., não gerados aqui)')
EOF = None
