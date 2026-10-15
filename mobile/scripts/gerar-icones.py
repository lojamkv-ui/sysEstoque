#!/usr/bin/env python3
"""Gera os ícones, o ícone adaptativo e as telas de abertura (splash) do app Android do Stoki SDY.

O símbolo é uma câmera de leitura com um QR Code na "janela" — representa a conferência
por QR Code / EAN dentro do app. A logo do sistema é usada nas telas de abertura.

Uso (na raiz do repositório):  python3 mobile/scripts/gerar-icones.py
"""
import os
from PIL import Image, ImageDraw

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
MOBILE = os.path.join(RAIZ, 'mobile', 'www')
ANDROID_RES = os.path.join(RAIZ, 'mobile', 'android', 'app', 'src', 'main', 'res')
LOGO = os.path.join(RAIZ, 'logo-stoki-sdy.png')

AZUL = (11, 87, 201, 255)
AZUL_ESCURO = (8, 61, 141, 255)
CIANO = (46, 155, 255, 255)
BRANCO = (255, 255, 255, 255)
FUNDO_SPLASH = (255, 255, 255, 255)

DENSIDADES = {  # nome da pasta -> fator (mdpi = 1dp)
    'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4,
}


def desenhar_camera(tam, com_fundo=False, com_borda=False, variante='qr'):
    """Desenha o símbolo da câmera de leitura. `tam` em pixels (quadrado)."""
    S = tam
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if com_fundo:
        raio = int(S * 0.22) if com_borda else 0
        if com_borda:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=raio, fill=BRANCO, outline=(211, 223, 238, 255), width=max(1, S // 96))
        else:
            # círculo cheio (ícone redondo)
            d.ellipse([0, 0, S - 1, S - 1], fill=BRANCO)
    # área útil dentro do ícone
    m = S * (0.20 if com_fundo else 0.06)
    largura = S - 2 * m
    altura = largura * 0.82
    topo = m + largura * 0.10
    corpo = [m, topo, m + largura, topo + altura]
    raio = max(2, int(largura * 0.16))
    # hump do visor
    hump_w = largura * 0.36
    hump_h = largura * 0.11
    hump = [m + largura * 0.32, topo - hump_h * 0.85, m + largura * 0.32 + hump_w, topo + altura * 0.12]
    d.rounded_rectangle(hump, radius=max(2, int(largura * 0.04)), fill=AZUL_ESCURO)
    # corpo
    d.rounded_rectangle(corpo, radius=raio, fill=AZUL)
    # "janela" do leitor
    jw = largura * 0.60
    jx = m + (largura - jw) / 2
    jy = topo + (altura - jw) / 2
    if variante == 'qr':
        d.rounded_rectangle([jx, jy, jx + jw, jy + jw], radius=max(1, int(largura * 0.07)), fill=BRANCO)
        # três "marcadores" de QR Code (cantos) + módulos de dados: lê-se como QR em qualquer tamanho
        recuo = jw * 0.13
        area = jw - 2 * recuo
        marc = area * 0.40
        passo_marc = area - marc
        for (mx, my) in ((jx + recuo, jy + recuo), (jx + recuo + passo_marc, jy + recuo), (jx + recuo, jy + recuo + passo_marc)):
            d.rounded_rectangle([mx, my, mx + marc, my + marc], radius=max(1, int(marc * 0.14)), fill=AZUL_ESCURO)
            i1 = marc * 0.21
            d.rounded_rectangle([mx + i1, my + i1, mx + marc - i1, my + marc - i1], radius=max(1, int(marc * 0.10)), fill=BRANCO)
            i2 = marc * 0.34
            d.rounded_rectangle([mx + i2, my + i2, mx + marc - i2, my + marc - i2], radius=max(1, int(marc * 0.10)), fill=AZUL_ESCURO)
        # módulos de dados no canto inferior direito
        mod = area * 0.115
        gx = jx + recuo + passo_marc + marc * 0.10
        gy = jy + recuo + passo_marc + marc * 0.10
        for li in range(3):
            for co in range(3):
                if (li * 3 + co) % 4 != 3:
                    x0 = gx + co * (mod * 1.32)
                    y0 = gy + li * (mod * 1.32)
                    d.rectangle([x0, y0, x0 + mod, y0 + mod], fill=AZUL_ESCURO)
    else:
        r = jw / 2
        cx, cy = jx + r, jy + r
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BRANCO)
        d.ellipse([cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62], fill=AZUL_ESCURO)
        d.ellipse([cx - r * 0.26, cy - r * 0.26, cx + r * 0.26, cy + r * 0.26], fill=CIANO)
    # flash
    fr = largura * 0.055
    fx, fy = m + largura - fr * 1.6, topo + altura * 0.18
    d.ellipse([fx - fr, fy - fr, fx + fr, fy + fr], fill=CIANO)
    return img


def logo_com_fundo(tam, escala=0.72, fundo=FUNDO_SPLASH):
    """Logo do sistema centralizada num quadrado de `tam` px."""
    base = Image.new('RGBA', (tam, tam), fundo)
    logo = Image.open(LOGO).convert('RGBA')
    # recorta a margem branca
    px = logo.load()
    w, h = logo.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a > 8 and (r < 240 or g < 240 or b < 240):
                minx = min(minx, x); maxx = max(maxx, x); miny = min(miny, y); maxy = max(maxy, y)
    logo = logo.crop((max(0, minx - 6), max(0, miny - 6), min(w, maxx + 7), min(h, maxy + 7)))
    esc = min(tam * escala / logo.width, tam * escala / logo.height)
    novo = (max(1, int(logo.width * esc)), max(1, int(logo.height * esc)))
    red = logo.resize(novo, Image.LANCZOS)
    base.paste(red, ((tam - novo[0]) // 2, (tam - novo[1]) // 2), red)
    return base.convert('RGB')


def salvar(img, destino):
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    img.save(destino, optimize=True)


def main():
    # mascote usado como base para todos os tamanhos (renderizado grande e reduzido)
    base_legado = desenhar_camera(1024, com_fundo=True, com_borda=True)
    base_redondo = desenhar_camera(1024, com_fundo=True, com_borda=False)
    base_adaptativo = desenhar_camera(1024, com_fundo=False)

    for nome, fator in DENSIDADES.items():
        d = os.path.join(ANDROID_RES, 'mipmap-' + nome)
        # ícone legado (48dp) e redondo (48dp)
        lado = int(round(48 * fator))
        salvar(base_legado.resize((lado, lado), Image.LANCZOS), os.path.join(d, 'ic_launcher.png'))
        salvar(base_redondo.resize((lado, lado), Image.LANCZOS), os.path.join(d, 'ic_launcher_round.png'))
        # foreground adaptativo: 108dp, com o símbolo dentro da zona segura (66dp)
        tam = int(round(108 * fator))
        simbolo = base_adaptativo.resize((int(tam * 0.86), int(tam * 0.86)), Image.LANCZOS)
        fg = Image.new('RGBA', (tam, tam), (0, 0, 0, 0))
        fg.paste(simbolo, ((tam - simbolo.width) // 2, (tam - simbolo.height) // 2), simbolo)
        salvar(fg, os.path.join(d, 'ic_launcher_foreground.png'))

    # launchers antigos: PNG solto em drawable-* (mesmo nome do vetor, que é removido)
    for nome, fator in DENSIDADES.items():
        lado = int(round(108 * fator))
        destino = os.path.join(ANDROID_RES, 'drawable' + ('' if nome == 'mdpi' else '-' + nome), 'ic_launcher_foreground.png')
        salvar(base_adaptativo.resize((int(lado * 0.9), int(lado * 0.9)), Image.LANCZOS), destino)
    # o vetor original (logo padrão do Capacitor) sai de cena para os PNGs acima valerem
    vetor = os.path.join(ANDROID_RES, 'drawable-v24', 'ic_launcher_foreground.xml')
    if os.path.exists(vetor):
        os.remove(vetor)

    # telas de abertura (splash) — mesmas medidas dos arquivos originais
    originais = []
    for pasta in sorted(os.listdir(ANDROID_RES)):
        if pasta.startswith('drawable'):
            caminho = os.path.join(ANDROID_RES, pasta, 'splash.png')
            if os.path.exists(caminho):
                originais.append((caminho, Image.open(caminho).size))
    for caminho, (w, h) in originais:
        # mesma proporção do original, com a logo ocupando ~46% do menor lado
        lado = int(min(w, h) * 0.46)
        arte = logo_com_fundo(lado, escala=1.0)
        tela = Image.new('RGB', (w, h), FUNDO_SPLASH)
        tela.paste(arte, ((w - lado) // 2, (h - lado) // 2))
        salvar(tela, caminho)

    # ícones do manifest da PWA (instalação por link, sem loja) — mesmo símbolo do app
    for lado in (192, 512):
        salvar(desenhar_camera(lado, com_fundo=True, com_borda=True), os.path.join(MOBILE, 'icone-%d.png' % lado))
    # maskable: mesmo desenho com a zona segura respeitada (símbolo a ~62% do lado)
    masc = desenhar_camera(1024, com_fundo=True, com_borda=True)
    maskable = Image.new('RGBA', (512, 512), BRANCO)
    arte = masc.resize((int(512 * 0.62), int(512 * 0.62)), Image.LANCZOS)
    maskable.paste(arte, ((512 - arte.width) // 2, (512 - arte.height) // 2), arte)
    salvar(maskable, os.path.join(MOBILE, 'icone-512-maskable.png'))
    # favicon/atalho do navegador
    salvar(desenhar_camera(64, com_fundo=False), os.path.join(MOBILE, 'icone-64.png'))
    print('ícones Android (%d densidades), foreground adaptativo, %d splashes e 4 ícones da PWA gerados.' % (len(DENSIDADES), len(originais)))


if __name__ == '__main__':
    main()
