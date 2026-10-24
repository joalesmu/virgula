#!/usr/bin/env python3
"""Une las partes de src/ en un solo index.html (la app completa en un archivo).

También reúne todos los textos de la interfaz —t('…'), tH('…'), N_('…') en el código y
data-t / data-tp / data-ta en el HTML— y los guarda en TEXTOS_FUENTE dentro de la app:
de ahí sale la plantilla de traducción. Además deja una copia en idiomas/textos_es.csv.

Uso: python3 construir.py
"""
import csv, html, json, pathlib, re, sys

AQUI = pathlib.Path(__file__).parent
SRC = sorted((AQUI / 'src').iterdir())
DONDE = {'01': 'Pantalla principal', '05': 'Idioma', '10': 'General', '20': 'Grabar', '25': 'Audio', '30': 'Acervo',
         '35': 'Plantillas', '40': 'Ficha', '50': 'Exportar', '55': 'Exportar', '60': 'Importar', '70': 'Ajustes'}
RE_JS = re.compile(r"(?<![\w.$])(?:t|tH|N_)\(\s*'((?:[^'\\\n]|\\.)*)'")
RE_DIN = re.compile(r"(?<![\w.$])(?:t|tH)\(\s*(?!['\s)])")
SECCION = {'vGrabar': 'Grabar', 'vAcervo': 'Acervo', 'vAjustes': 'Ajustes'}


def js_texto(s):
    return re.sub(r"\\(.)", lambda m: {'n': '\n', 't': '\t', '\\': '\\', "'": "'", '"': '"'}.get(m.group(1), m.group(1)), s)


def main():
    textos, avisos = {}, []
    for p in SRC:
        donde = DONDE.get(p.name[:2], p.stem)
        txt = p.read_text(encoding='utf-8')
        if p.suffix == '.js':
            for m in RE_JS.finditer(txt):
                textos.setdefault(js_texto(m.group(1)), donde)
            dinamicos = len(RE_DIN.findall(txt))
            if dinamicos:
                avisos.append(f'{p.name}: {dinamicos} llamada(s) t()/tH() con texto variable (se traducen si el texto está marcado en otra parte)')
        elif p.suffix == '.html':
            zona = 'Pantalla principal'
            for linea in txt.splitlines():
                s = re.search(r'<section id="(\w+)"', linea)
                if s:
                    zona = SECCION.get(s.group(1), zona)
                for m in re.finditer(r'<(\w+)\b[^>]*?\sdata-t(?=[\s>])[^>]*>([^<]*)<', linea):
                    v = html.unescape(m.group(2)).strip()
                    if v:
                        textos.setdefault(v, zona)
                for m in re.finditer(r'data-t[pa]="([^"]*)"', linea):
                    textos.setdefault(html.unescape(m.group(1)), zona)
    textos.pop('', None)
    fuente = [[k, v] for k, v in textos.items()]
    cabeza = ''.join(p.read_text(encoding='utf-8') for p in SRC if p.suffix == '.html')
    js = '\n'.join(p.read_text(encoding='utf-8') for p in SRC if p.suffix == '.js')
    js = js.replace("'use strict';", "'use strict';\nconst TEXTOS_FUENTE = " + json.dumps(fuente, ensure_ascii=False) + ';', 1)
    salida = cabeza + '<script>\n' + js + '\n</script>\n</body>\n</html>\n'
    (AQUI / 'index.html').write_text(salida, encoding='utf-8')
    (AQUI / 'idiomas').mkdir(exist_ok=True)
    with open(AQUI / 'idiomas' / 'textos_es.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(['texto_original', 'donde_aparece'])
        w.writerows(fuente)
    print(f'index.html: {len(salida.encode())} bytes · {len(fuente)} textos traducibles')
    for a in avisos:
        print('  aviso:', a, file=sys.stderr)


if __name__ == '__main__':
    main()
