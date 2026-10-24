#!/usr/bin/env python3
"""Une las partes de src/ en un solo index.html (la app completa en un archivo)."""
import pathlib, re
aqui = pathlib.Path(__file__).parent
src = sorted((aqui / 'src').iterdir())
html = ''.join(p.read_text(encoding='utf-8') for p in src if p.suffix == '.html')
js = '\n'.join(p.read_text(encoding='utf-8') for p in src if p.suffix == '.js')
salida = html + '<script>\n' + js + '\n</script>\n</body>\n</html>\n'
(aqui / 'index.html').write_text(salida, encoding='utf-8')
print('index.html:', len(salida.encode()), 'bytes')
