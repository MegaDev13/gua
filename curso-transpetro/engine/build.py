#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor de tipografia — Curso Transpetro 2026
Converte arquivos .md (subconjunto controlado) em PDF com fpdf2 2.7.x
Uso: python3 build.py livro.md [saida.pdf]

Marcação suportada:
  %title: / %subtitle: / %file_out: / %header_left:   (metadados)
  # Título de capítulo      (página nova)
  ## Seção
  ### Subseção
  parágrafo com **negrito**, *itálico* e `código`
  - item de lista
  1. item numerado
  > [TAG] texto da caixa   (DICA, ATENÇÃO, BANCA, EXEMPLO, RESUMO, ERRO, LEI, ESTRATEGIA)
  | tabela | markdown |
  ::q ... ::/q             (bloco de questão)
  ``` código ```
  --- (quebra decorativa)
"""
import sys, re, os, math
from fpdf import FPDF

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
SERIF = "DejaVuSerif"
SANS = "DejaVuSans"
MONO = "DejaVuSansMono"

C_NAVY = (8, 48, 86)
C_BLUE = (0, 92, 155)
C_LIGHTBLUE = (214, 230, 245)
C_GREY_BG = (240, 243, 246)
C_DARK = (33, 37, 41)
C_MID = (90, 98, 106)
C_ORANGE = (200, 90, 20)
C_ORANGE_BG = (255, 244, 230)
C_GREEN = (26, 100, 52)
C_GREEN_BG = (232, 245, 236)
C_RED = (160, 30, 30)
C_RED_BG = (252, 235, 235)
C_WHITE = (255, 255, 255)

BOX_STYLES = {
    "DICA": (C_BLUE, C_LIGHTBLUE, "DICA"),
    "ATENÇÃO": (C_ORANGE, C_ORANGE_BG, "ATENÇÃO"),
    "ATENCAO": (C_ORANGE, C_ORANGE_BG, "ATENÇÃO"),
    "BANCA": (C_GREEN, C_GREEN_BG, "PERFIL DA BANCA"),
    "EXEMPLO": (C_MID, C_GREY_BG, "EXEMPLO"),
    "RESUMO": (C_NAVY, (228, 236, 244), "RESUMO"),
    "ERRO": (C_RED, C_RED_BG, "CUIDADO COM O ERRO"),
    "GABARITO": (C_GREEN, C_GREEN_BG, "GABARITO"),
    "LEI": (C_NAVY, (228, 236, 244), "NA LETRA DA LEI"),
    "ESTRATEGIA": (C_ORANGE, C_ORANGE_BG, "ESTRATÉGIA"),
}

BODY_SIZE = 10.5
BODY_LH = 5.2
SMALL_SIZE = 9
SMALL_LH = 4.4


class BookPDF(FPDF):
    def __init__(self, meta, header_visible=True):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.meta = meta
        self.chapter_title = ""
        self.header_visible = header_visible
        self.toc_offset = 1
        self._no_header_page = False
        self._fonts_loaded = False
        self.set_auto_page_break(auto=True, margin=18)

    def _load_fonts(self):
        if self._fonts_loaded:
            return
        self.add_font(SERIF, "", f"{FONT_DIR}/DejaVuSerif.ttf")
        self.add_font(SERIF, "B", f"{FONT_DIR}/DejaVuSerif-Bold.ttf")
        self.add_font(SERIF, "I", f"{FONT_DIR}/DejaVuSerif-Italic.ttf")
        self.add_font(SERIF, "BI", f"{FONT_DIR}/DejaVuSerif-BoldItalic.ttf")
        self.add_font(SANS, "", f"{FONT_DIR}/DejaVuSans.ttf")
        self.add_font(SANS, "B", f"{FONT_DIR}/DejaVuSans-Bold.ttf")
        self.add_font(SANS, "I", f"{FONT_DIR}/DejaVuSans-Oblique.ttf")
        self.add_font(MONO, "", f"{FONT_DIR}/DejaVuSansMono.ttf")
        self.add_font(MONO, "B", f"{FONT_DIR}/DejaVuSansMono-Bold.ttf")
        self._fonts_loaded = True

    # ---------- layout helpers ----------
    def styled_tokens(self, txt):
        """Retorna lista de (style, text): 'B','I','M' ou ''."""
        toks = []
        pos = 0
        pattern = re.compile(r"(\*\*.+?\*\*|\*[^*\s][^*]*\*|`[^`]+`)")
        for m in pattern.finditer(txt):
            if m.start() > pos:
                toks.append(("", txt[pos:m.start()]))
            t = m.group(0)
            if t.startswith("**"):
                toks.append(("B", t[2:-2]))
            elif t.startswith("`"):
                toks.append(("M", t[1:-1]))
            else:
                toks.append(("I", t[1:-1]))
            pos = m.end()
        if pos < len(txt):
            toks.append(("", txt[pos:]))
        return toks

    def _width_of(self, style, text, size=None):
        f = SERIF if style != "M" else MONO
        st = "B" if style in ("B",) else ("" if style == "" else ("I" if style == "I" else ""))
        if style == "M":
            st = "B"
        if size is None:
            size = BODY_SIZE if style != "M" else 9.5
        self.set_font(f, st, size)
        return self.get_string_width(text)

    def styled_lines(self, txt, max_w):
        """Quebra o texto estilizado em linhas que cabem em max_w.
        Retorna lista de linhas; cada linha = lista de (style, chunk)."""
        tokens = self.styled_tokens(txt)
        # separa em palavras (mantém espaçamentos como tokens próprios)
        words = []  # (style, word)
        for style, text in tokens:
            parts = re.split(r"(\s+)", text)
            for p in parts:
                if p:
                    words.append((style, p))
        lines = []
        cur = []
        cur_w = 0.0
        for style, word in words:
            w = self._width_of(style, word)
            add = w
            if not cur:
                pass
            elif cur_w + add > max_w:
                # quebra de linha
                lines.append(cur)
                cur = []
                cur_w = 0.0
                # se a palavra começa com espaço, descarta
                if word.startswith(" "):
                    continue
            if word.startswith(" ") and not cur:
                continue
            cur.append((style, word))
            cur_w += add
        if cur:
            lines.append(cur)
        return lines

    def draw_styled_lines(self, lines, x0, y0, size=BODY_SIZE, lh=BODY_LH,
                          color=C_DARK, pagebreak=True):
        """Desenha linhas estilizadas. Retorna y final."""
        y = y0
        for ln in lines:
            if pagebreak and y + lh > 278:
                self.add_page()
                y = self.t_y()
            self.set_text_color(*color)
            self.set_xy(x0, y)
            for style, chunk in ln:
                if style == "B":
                    self.set_font(SERIF, "B", size)
                elif style == "I":
                    self.set_font(SERIF, "I", size)
                elif style == "M":
                    self.set_font(MONO, "B", size - 1)
                    self.set_fill_color(*C_GREY_BG)
                    w = self.get_string_width(chunk)
                    self.rect(self.get_x(), self.get_y() - size * 0.82, w, size * 1.06, "F")
                else:
                    self.set_font(SERIF, "", size)
                self.write(lh, chunk)
            y += lh
        return y

    def t_y(self):
        """y inicial após page break (abaixo do cabeçalho)."""
        return 22

    def header(self):
        if not self.header_visible or self.page_no() <= 1 or self._no_header_page:
            self._no_header_page = False
            return
        self._load_fonts()
        self.set_font(SANS, "B", 8)
        self.set_text_color(*C_MID)
        title = self.meta.get("header_left", self.meta.get("title", ""))
        chap = self.chapter_title
        self.set_xy(20, 9)
        self.cell(95, 5, title[:70], align="L", new_x="LMARGIN", new_y="NEXT")
        self.set_xy(115, 9)
        self.cell(75, 5, chap[:60], align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*C_BLUE)
        self.set_line_width(0.4)
        self.line(20, 15.5, 190, 15.5)

    def footer(self):
        if self.page_no() <= 1 or not self.header_visible:
            return
        self._load_fonts()
        self.set_y(-13)
        self.set_font(SANS, "", 8.5)
        self.set_text_color(*C_MID)
        num = self.page_no() - self.toc_offset
        if num >= 1:
            self.cell(0, 6, str(num), align="C")

    # ---------- blocos ----------
    def cover(self, vol_label):
        self._load_fonts()
        self.add_page()
        self.set_fill_color(*C_NAVY)
        self.rect(0, 0, self.w, self.h, "F")
        self.set_fill_color(*C_BLUE)
        self.rect(0, 96, self.w, 3, "F")
        self.set_text_color(*C_WHITE)
        self.set_font(SANS, "B", 14)
        self.set_xy(22, 30)
        self.multi_cell(self.w - 44, 8, "CURSO COMPLETO 2026  •  TRANSPETRO")
        self.ln(8)
        self.set_font(SANS, "B", 12)
        self.set_text_color(120, 165, 210)
        self.set_xy(22, 58)
        self.multi_cell(self.w - 44, 7, vol_label.upper())
        self.ln(2)
        self.set_font(SERIF, "B", 29)
        self.set_text_color(*C_WHITE)
        self.set_xy(22, 72)
        self.multi_cell(self.w - 44, 12, self.meta["title"])
        self.ln(4)
        if self.meta.get("subtitle"):
            self.set_font(SERIF, "I", 15)
            self.set_xy(22, self.get_y() + 2)
            self.multi_cell(self.w - 44, 7.5, self.meta["subtitle"])
        self.set_font(SANS, "", 11)
        self.set_text_color(*C_WHITE)
        self.set_xy(22, self.h - 66)
        self.multi_cell(self.w - 44, 6,
                        "Transpetro — Petrobras Transporte S.A.\n"
                        "Edital nº 03 - TRANSPETRO/PSP/TERRA/NÍVEL MÉDIO - 2026.3  |  Ênfase 1: Administração e Controle\n"
                        "Banca: Fundação Cesgranrio  |  Prova objetiva: 29 de novembro de 2026")
        self.set_font(SANS, "", 10)
        self.set_text_color(170, 195, 220)
        self.set_xy(22, self.h - 30)
        self.cell(0, 6, "Material de estudo autossuficiente  •  Setembro de 2026", align="L")

    def toc(self, entries):
        self.add_page()
        self._no_header_page = False
        self.set_text_color(*C_NAVY)
        self.set_font(SANS, "B", 22)
        self.set_xy(20, 22)
        self.cell(0, 12, "Sumário", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*C_BLUE)
        self.set_line_width(0.5)
        self.line(20, self.get_y() + 1, 190, self.get_y() + 1)
        self.set_y(self.get_y() + 8)
        for level, txt, page in entries:
            if self.get_y() > 268:
                self.add_page()
                self.set_y(22)
            if level == 1:
                self.set_y(self.get_y() + 3)
                self.set_font(SANS, "B", 12.5)
                self.set_text_color(*C_NAVY)
            elif level == 2:
                self.set_font(SANS, "", 10.5)
                self.set_text_color(*C_DARK)
            else:
                self.set_font(SERIF, "", 10)
                self.set_text_color(*C_MID)
            label = ("     " + txt) if level == 2 else txt
            x0 = 20
            y0 = self.get_y()
            self.set_x(x0)
            w_txt = self.get_string_width(label)
            self.cell(min(w_txt + 3, 158), 6.5 if level == 1 else 6, label,
                      new_x="RIGHT", new_y="TOP")
            self.set_dash_pattern(0.5, 0.7, 0)
            self.set_draw_color(150, 160, 170)
            self.set_line_width(0.25)
            self.line(x0 + min(w_txt + 3, 158), y0 + 4, 180, y0 + 4)
            self.set_dash_pattern(0)
            self.set_xy(182, y0)
            self.cell(8, 6.5 if level == 1 else 6, str(page), align="R",
                      new_x="LMARGIN", new_y="NEXT")
            self.set_y(self.get_y() + (2.2 if level == 1 else 0.8))

    def chapter(self, title):
        self._no_header_page = True
        self.add_page()
        self.chapter_title = title
        self.set_fill_color(*C_NAVY)
        self.rect(0, 0, self.w, 52, "F")
        self.set_fill_color(*C_BLUE)
        self.rect(0, 52, self.w, 2, "F")
        self.set_text_color(*C_WHITE)
        self.set_font(SANS, "B", 10)
        self.set_xy(20, 12)
        self.cell(0, 5, self.meta.get("vol_label", "CURSO").upper(), align="L",
                  new_x="LMARGIN", new_y="NEXT")
        self.set_font(SERIF, "B", 20)
        self.set_xy(20, 22)
        self.multi_cell(self.w - 40, 9, title)
        self.set_xy(20, 66)

    def section(self, title, level=2):
        if level == 2:
            if self.get_y() > 222:
                self.add_page()
                self.set_y(self.t_y())
            self.ln(3)
            self.set_font(SANS, "B", 15)
            self.set_text_color(*C_NAVY)
            self.set_x(20)
            self.multi_cell(170, 7.5, title)
            tw = self.get_string_width(title)
            self.set_draw_color(*C_BLUE)
            self.set_line_width(0.5)
            self.line(20, self.get_y() + 0.5, 20 + min(tw, 165), self.get_y() + 0.5)
            self.ln(4.5)
        else:
            if self.get_y() > 242:
                self.add_page()
                self.set_y(self.t_y())
            self.ln(1.5)
            self.set_font(SANS, "B", 12)
            self.set_text_color(*C_BLUE)
            self.set_x(20)
            self.multi_cell(170, 6.5, title)
            self.ln(1.5)

    def para(self, txt):
        lines = self.styled_lines(txt, 168)
        y = self.get_y()
        for ln in lines:
            if y + BODY_LH > 278:
                self.add_page()
                y = self.t_y()
            self.set_text_color(*C_DARK)
            self.set_xy(20, y)
            for style, chunk in ln:
                if style == "B":
                    self.set_font(SERIF, "B", BODY_SIZE)
                elif style == "I":
                    self.set_font(SERIF, "I", BODY_SIZE)
                elif style == "M":
                    self.set_font(MONO, "B", 9.5)
                    w = self.get_string_width(chunk)
                    self.set_fill_color(*C_GREY_BG)
                    self.rect(self.get_x(), y - 1.4, w, 4.6, "F")
                else:
                    self.set_font(SERIF, "", BODY_SIZE)
                self.write(BODY_LH, chunk)
            y += BODY_LH
        self.set_x(20)
        self.set_y(y + 2.8)

    def box(self, tag, txt):
        color, bg, label = BOX_STYLES.get(tag.upper(), BOX_STYLES["EXEMPLO"])
        self.set_font(SERIF, "", 10)
        w = 162
        lines = self.styled_lines(txt, w - 6)
        nlines = max(1, len(lines))
        h = nlines * 5 + 8.5
        if self.get_y() + h > 278:
            self.add_page()
            self.set_y(self.t_y())
        y0 = self.get_y()
        self.set_fill_color(*bg)
        self.rect(20, y0, 170, h, "F")
        self.set_fill_color(*color)
        self.rect(20, y0, 2.2, h, "F")
        self.set_text_color(*color)
        self.set_font(SANS, "B", 8.5)
        self.set_xy(25.5, y0 + 2.2)
        self.cell(40, 4, label, new_x="LMARGIN", new_y="NEXT")
        y = y0 + 6.8
        self.set_text_color(*C_DARK)
        for ln in lines:
            self.set_xy(25.5, y)
            for style, chunk in ln:
                if style == "B":
                    self.set_font(SERIF, "B", 10)
                elif style == "I":
                    self.set_font(SERIF, "I", 10)
                elif style == "M":
                    self.set_font(MONO, "B", 9)
                else:
                    self.set_font(SERIF, "", 10)
                self.write(5, chunk)
            y += 5
        self.set_x(20)
        self.set_y(y0 + h + 4)

    def qblock(self, txt):
        self.set_font(SERIF, "", 10)
        w = 160
        # pré-processa: remove ** e marca a linha de gabarito
        raw_lines = [l for l in txt.split("\n") if l.strip()]
        lines = []  # (kind, styled_lines)
        for rl in raw_lines:
            ls = rl.strip()
            if ls.upper().startswith("**GABARITO") or ls.upper().startswith("GABARITO:"):
                clean = re.sub(r"\*\*", "", ls)
                m = re.match(r"(GABARITO[^—]*?)(—.*)?", clean)
                if m and m.group(2):
                    head = m.group(1).strip().rstrip("—").strip()
                    body = m.group(2).strip().lstrip("—").strip()
                    lines.append(("g", head))
                    lines.append(("c", body))
                else:
                    lines.append(("g", clean))
            else:
                lines.append(("n", re.sub(r"\*\*(.+?)\*\*", r"\1", ls)))
        # calcula altura com quebras
        wrapped = []
        for kind, t in lines:
            size = 9.5 if kind == "g" else 10
            lh = 5.0
            if kind == "c":
                wrapped.append((kind, self.styled_lines(t, w - 4), size, lh))
            elif kind == "g":
                self.set_font(SANS, "B", size)
                n = max(1, math.ceil(self.get_string_width(t) / (w - 4)))
                wrapped.append((kind, [t], size, lh))
            else:
                wrapped.append((kind, self.styled_lines(t, w - 4), size, lh))
        total_h = sum(len(ls) * lh for _, ls, _, lh in wrapped) + 8
        if self.get_y() + total_h > 278 and self.get_y() > 30:
            self.add_page()
            self.set_y(self.t_y())
        y0 = self.get_y()
        self.set_fill_color(249, 250, 251)
        self.set_draw_color(205, 214, 224)
        self.set_line_width(0.3)
        self.rect(20, y0, 170, total_h, "DF")
        y = y0 + 4
        for kind, content, size, lh in wrapped:
            if kind == "g":
                for t in content:
                    self.set_font(SANS, "B", size)
                    self.set_text_color(*C_GREEN)
                    self.set_xy(25, y)
                    self.multi_cell(w - 4, lh, t)
                    y += lh
            else:
                for ln in content:
                    self.set_xy(25, y)
                    for style, chunk in ln:
                        if kind == "c":
                            self.set_font(SERIF, "I", size)
                            self.set_text_color(55, 62, 70)
                        elif style == "B":
                            self.set_font(SERIF, "B", size)
                            self.set_text_color(*C_DARK)
                        elif style == "I":
                            self.set_font(SERIF, "I", size)
                            self.set_text_color(*C_DARK)
                        else:
                            self.set_font(SERIF, "", size)
                            self.set_text_color(*C_DARK)
                        self.write(lh, chunk)
                    y += lh
        self.set_x(20)
        self.set_y(y0 + total_h + 4)

    def bullets(self, items, ordered=False):
        for i, it in enumerate(items, 1):
            mark = f"{i}." if ordered else "•"
            if self.get_y() > 268:
                self.add_page()
                self.set_y(self.t_y())
            x0 = 23
            y_start = self.get_y()
            self.set_font(SANS, "B", 10.5)
            self.set_text_color(*C_BLUE)
            self.set_xy(x0, y_start)
            self.cell(7, BODY_LH, mark, new_x="RIGHT", new_y="TOP")
            lines = self.styled_lines(it, 168 - 7)
            y = y_start
            for ln in lines:
                if y + BODY_LH > 278:
                    self.add_page()
                    y = self.t_y()
                self.set_text_color(*C_DARK)
                self.set_xy(x0 + 7, y)
                for style, chunk in ln:
                    if style == "B":
                        self.set_font(SERIF, "B", BODY_SIZE)
                    elif style == "I":
                        self.set_font(SERIF, "I", BODY_SIZE)
                    elif style == "M":
                        self.set_font(MONO, "B", 9.5)
                    else:
                        self.set_font(SERIF, "", BODY_SIZE)
                    self.write(BODY_LH, chunk)
                y += BODY_LH
            self.set_x(20)
            self.set_y(y + 1.2)

    def table(self, lines):
        rows = []
        for ln in lines:
            cells = [c.strip() for c in ln.strip("|").split("|")]
            if all(re.fullmatch(r":?-{2,}:?", c or "----") for c in cells):
                continue
            rows.append(cells)
        if not rows:
            return
        ncols = max(len(r) for r in rows)
        total_w = 170
        widths = []
        for ci in range(ncols):
            mx = 6
            for r in rows:
                if ci < len(r):
                    mx = max(mx, min(60, len(r[ci]) * 0.6 + 4))
            widths.append(mx)
        s = sum(widths)
        widths = [max(14, w * total_w / s) for w in widths][:ncols]
        diff = total_w - sum(widths)
        widths[0] += diff

        def row_h(cells, ws):
            hs = []
            for ci, c in enumerate(cells):
                w = max(8, ws[ci] - 3)
                n = max(1, len(self.styled_lines(c, w)))
                hs.append(n * SMALL_LH)
            return max(hs) + 2.6

        self.ln(1)
        if self.get_y() > 262:
            self.add_page()
            self.set_y(self.t_y())
        for ri, r in enumerate(rows):
            cells = r + [""] * (ncols - len(r))
            rh = row_h(cells, widths)
            if self.get_y() + rh > 278:
                self.add_page()
                self.set_y(self.t_y())
            y0 = self.get_y()
            if ri == 0:
                self.set_fill_color(*C_NAVY)
                self.rect(20, y0, total_w, rh, "F")
                self.set_text_color(*C_WHITE)
            else:
                self.set_fill_color(*(C_GREY_BG if ri % 2 == 0 else C_WHITE))
                self.rect(20, y0, total_w, rh, "F")
                self.set_text_color(*C_DARK)
            x = 20
            for ci, c in enumerate(cells):
                ws = max(8, widths[ci] - 3)
                wrapped = self.styled_lines(c, ws)
                y1 = y0 + 1.3
                for ln in wrapped:
                    if ri == 0:
                        self.set_font(SANS, "B", 9)
                    else:
                        self.set_font(SERIF, "", 9)
                    self.set_xy(x + 1.5, y1)
                    for style, chunk in ln:
                        if ri == 0:
                            self.set_font(SANS, "B", 9)
                        elif style == "B":
                            self.set_font(SERIF, "B", 9)
                        else:
                            self.set_font(SERIF, "", 9)
                        self.write(SMALL_LH, chunk)
                    y1 += SMALL_LH
                x += widths[ci]
            self.set_x(20)
            self.set_y(y0 + rh)
        self.ln(3)

    def code(self, txt):
        self.set_font(MONO, "", 9)
        for ln in txt.split("\n"):
            if self.get_y() > 270:
                self.add_page()
                self.set_y(self.t_y())
            self.set_fill_color(*C_GREY_BG)
            self.set_xy(20, self.get_y())
            self.cell(170, 5, "  " + ln, fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(2)


class Builder:
    def __init__(self, md_path, out_path=None):
        self.md_path = md_path
        with open(md_path, encoding="utf-8") as f:
            self.text = f.read()
        self.meta = self._parse_meta()
        self.out_path = out_path or os.path.join(
            os.path.dirname(md_path), self.meta["file_out"]
        )

    def _parse_meta(self):
        meta = {"title": "", "subtitle": "", "file_out": "livro.pdf",
                "header_left": "", "vol_label": "Curso"}
        rest_lines = []
        for line in self.text.split("\n"):
            if line.startswith("%"):
                key, _, val = line[1:].partition(":")
                meta[key.strip()] = val.strip()
            else:
                rest_lines.append(line)
        self.text = "\n".join(rest_lines)
        meta["header_left"] = meta.get("header_left") or meta.get("title", "")
        return meta

    def split_blocks(self):
        blocks = []
        lines = self.text.split("\n")
        i = 0
        n = len(lines)
        while i < n:
            line = lines[i]
            s = line.strip()
            if not s:
                i += 1
                continue
            if s.startswith("::q"):
                j = i + 1
                buf = []
                while j < n and not lines[j].strip().startswith("::/q"):
                    buf.append(lines[j])
                    j += 1
                blocks.append(("q", "\n".join(buf)))
                i = j + 1
                continue
            if s.startswith("> ["):
                m = re.match(r"^>\s*\[([A-ZÀ-Ü]+)\]\s*(.*)$", s)
                tag = m.group(1).upper()
                buf = [m.group(2)]
                i += 1
                while i < n and lines[i].strip().startswith(">"):
                    buf.append(lines[i].strip().lstrip(">").strip())
                    i += 1
                blocks.append(("box", (tag, " ".join(x for x in buf if x))))
                continue
            if s.startswith("|"):
                buf = []
                while i < n and lines[i].strip().startswith("|"):
                    buf.append(lines[i].strip())
                    i += 1
                blocks.append(("table", buf))
                continue
            if s == "---":
                blocks.append(("hr", ""))
                i += 1
                continue
            if s.startswith("```"):
                buf = []
                i += 1
                while i < n and not lines[i].strip().startswith("```"):
                    buf.append(lines[i])
                    i += 1
                blocks.append(("code", "\n".join(buf)))
                i += 1
                continue
            if s.startswith("# "):
                blocks.append(("h1", s[2:]))
                i += 1
                continue
            if s.startswith("## "):
                blocks.append(("h2", s[3:]))
                i += 1
                continue
            if s.startswith("### "):
                blocks.append(("h3", s[4:]))
                i += 1
                continue
            if re.match(r"^\s*[-*]\s+", line):
                buf = []
                while i < n and re.match(r"^\s*[-*]\s+", lines[i]):
                    buf.append(re.sub(r"^\s*[-*]\s+", "", lines[i]).strip())
                    i += 1
                blocks.append(("ul", buf))
                continue
            if re.match(r"^\s*\d+\.\s+", line):
                buf = []
                while i < n and re.match(r"^\s*\d+\.\s+", lines[i]):
                    buf.append(re.sub(r"^\s*\d+\.\s+", "", lines[i]).strip())
                    i += 1
                blocks.append(("ol", buf))
                continue
            buf = [line.rstrip()]
            i += 1
            while i < n and lines[i].strip() and not lines[i].strip().startswith(("#", ">", "|", "::q", "```")) \
                    and not re.match(r"^\s*[-*]\s+", lines[i]) and not re.match(r"^\s*\d+\.\s+", lines[i]):
                buf.append(lines[i].rstrip())
                i += 1
            blocks.append(("p", " ".join(x.strip() for x in buf)))
        return blocks

    @staticmethod
    def _render(pdf, blocks):
        for kind, content in blocks:
            if kind == "h1":
                pdf.chapter(content)
            elif kind == "h2":
                pdf.section(content, 2)
            elif kind == "h3":
                pdf.section(content, 3)
            elif kind == "p":
                pdf.para(content)
            elif kind == "ul":
                pdf.bullets(content, ordered=False)
            elif kind == "ol":
                pdf.bullets(content, ordered=True)
            elif kind == "box":
                pdf.box(*content)
            elif kind == "table":
                pdf.table(content)
            elif kind == "q":
                pdf.qblock(content)
            elif kind == "code":
                pdf.code(content)
            elif kind == "hr":
                pdf.ln(3)

    def _toc_pages(self, entries):
        h = 30.0
        for level, _, _ in entries:
            h += 9.5 if level == 1 else 6.8
        return max(1, math.ceil(h / 248))

    def build(self):
        blocks = self.split_blocks()
        # ---- passada 1: documento rascunho para medir o sumário ----
        scratch = BookPDF(self.meta, header_visible=False)
        scratch._load_fonts()
        scratch.set_margins(20, 20, 20)
        entries = []
        for kind, content in blocks:
            if kind == "h1":
                # o capítulo abre em uma página nova: +1
                entries.append((1, content, scratch.page_no() + 1))
            elif kind == "h2":
                entries.append((2, content, scratch.page_no()))
            self._render(scratch, [(kind, content)])
        n_toc = self._toc_pages(entries)
        # ---- documento final ----
        pdf = BookPDF(self.meta, header_visible=True)
        pdf._load_fonts()
        pdf.set_margins(20, 20, 20)
        pdf.toc_offset = n_toc + 1
        pdf.cover(self.meta.get("vol_label", "Curso"))
        pdf.toc(entries)
        self._render(pdf, blocks)
        pdf.output(self.out_path)
        return self.out_path


if __name__ == "__main__":
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else None
    b = Builder(src, out)
    p = b.build()
    print("OK:", p)
