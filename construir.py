#!/usr/bin/env python3
"""Construye index.html desde src/ y regenera el inventario de traducciones."""
from __future__ import annotations

import csv
import html
import json
import pathlib
import re
import sys

AQUI = pathlib.Path(__file__).resolve().parent
SRC_DIR = AQUI / "src"
DONDE = {
    "01": "Pantalla principal",
    "05": "Idioma",
    "10": "General",
    "20": "Grabar",
    "25": "Audio",
    "30": "Acervo",
    "35": "Plantillas",
    "38": "Listas",
    "40": "Ficha",
    "50": "Exportar",
    "55": "Exportar",
    "60": "Importar",
    "70": "Ajustes",
}
RE_JS = re.compile(r"(?<![\w.$])(?:t|tH|N_)\(\s*'((?:[^'\\\n]|\\.)*)'")
RE_DIN = re.compile(r"(?<![\w.$])(?:t|tH)\(\s*(?!['\s)])")
SECCION = {"vGrabar": "Grabar", "vAcervo": "Acervo", "vListas": "Listas", "vAjustes": "Ajustes"}


def js_texto(texto: str) -> str:
    """Interpreta los escapes simples de las claves JS capturadas por RE_JS."""
    return re.sub(
        r"\\(.)",
        lambda m: {"n": "\n", "t": "\t", "\\": "\\", "'": "'", '"': '"'}.get(m.group(1), m.group(1)),
        texto,
    )


def obtener_fuentes() -> list[pathlib.Path]:
    if not SRC_DIR.is_dir():
        raise FileNotFoundError(f"No existe la carpeta de fuentes: {SRC_DIR}")
    fuentes = sorted(
        (p for p in SRC_DIR.iterdir() if p.is_file() and p.suffix in {".html", ".js"}),
        key=lambda p: p.name,
    )
    requeridos = {"00_head.html", "01_body.html", "05_idioma.js", "10_base.js", "38_listas.js", "70_init.js"}
    faltan = sorted(requeridos - {p.name for p in fuentes})
    if faltan:
        raise FileNotFoundError("Faltan archivos necesarios en src/: " + ", ".join(faltan))
    return fuentes


def main() -> int:
    fuentes = obtener_fuentes()
    textos: dict[str, str] = {}
    avisos: list[str] = []

    for ruta in fuentes:
        contenido = ruta.read_text(encoding="utf-8")
        zona = DONDE.get(ruta.name[:2], ruta.stem)
        if ruta.suffix == ".js":
            for coincidencia in RE_JS.finditer(contenido):
                textos.setdefault(js_texto(coincidencia.group(1)), zona)
            dinamicos = len(RE_DIN.findall(contenido))
            if dinamicos:
                avisos.append(
                    f"{ruta.name}: {dinamicos} llamada(s) t()/tH() con texto variable; "
                    "comprueba que cada texto dinámico también esté marcado en otra parte."
                )
            continue

        zona_actual = "Pantalla principal"
        for linea in contenido.splitlines():
            seccion = re.search(r'<section id="(\w+)"', linea)
            if seccion:
                zona_actual = SECCION.get(seccion.group(1), zona_actual)
            for coincidencia in re.finditer(r'<(\w+)\b[^>]*?\sdata-t(?=[\s>])[^>]*>([^<]*)<', linea):
                valor = html.unescape(coincidencia.group(2)).strip()
                if valor:
                    textos.setdefault(valor, zona_actual)
            for coincidencia in re.finditer(r'data-t[pa]="([^"]*)"', linea):
                textos.setdefault(html.unescape(coincidencia.group(1)), zona_actual)

    textos.pop("", None)
    fuente = [[clave, zona] for clave, zona in textos.items()]
    if not fuente:
        raise RuntimeError("No se encontraron textos traducibles; se cancela la construcción.")

    html_base = "".join(p.read_text(encoding="utf-8") for p in fuentes if p.suffix == ".html")
    javascript = "\n".join(p.read_text(encoding="utf-8") for p in fuentes if p.suffix == ".js")
    marca = "'use strict';"
    if marca not in javascript:
        raise RuntimeError("No se encontró la directiva 'use strict'; en los módulos JavaScript.")
    tabla = "const TEXTOS_FUENTE = " + json.dumps(fuente, ensure_ascii=False) + ";"
    javascript = javascript.replace(marca, marca + "\n" + tabla, 1)

    salida = html_base + "<script>\n" + javascript + "\n</script>\n</body>\n</html>\n"
    destino = AQUI / "index.html"
    temporal = AQUI / "index.html.tmp"
    temporal.write_text(salida, encoding="utf-8")
    temporal.replace(destino)

    carpeta_idiomas = AQUI / "idiomas"
    carpeta_idiomas.mkdir(exist_ok=True)
    with (carpeta_idiomas / "textos_es.csv").open("w", encoding="utf-8-sig", newline="") as archivo:
        escritor = csv.writer(archivo)
        escritor.writerow(["texto_original", "donde_aparece"])
        escritor.writerows(fuente)

    print(f"index.html: {len(salida.encode('utf-8'))} bytes · {len(fuente)} textos traducibles")
    for aviso in avisos:
        print("  aviso:", aviso, file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Error al construir Vírgula: {error}", file=sys.stderr)
        raise SystemExit(1)
