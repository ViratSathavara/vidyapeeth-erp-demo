#!/usr/bin/env python3
"""Build src/p4c_assets.js: images and font widths for the receipt PDF (design: NPCTE-Fee-Invoice-Final.pdf).

  python3 tools/build_receipt_assets.py

Images come from assets/receipt/ (taken from the college's final invoice design):
  logo.png              college emblem, top-left white box
  gujarati-name.png     the Gujarati college name line (a PDF built in the browser cannot shape Gujarati text)
  watermark-mask.png    the emblem as a soft mask; it is printed in navy at low opacity behind the content
Font widths: Times-Bold / Times-BoldItalic / Times-Italic (standard PDF fonts, metric-compatible with Liberation Serif).
"""
import base64, io, os
from PIL import Image, ImageDraw, ImageFont
R = os.path.join(os.path.dirname(__file__), '..')
A = os.path.join(R, 'assets', 'receipt')
NAVY = (43, 44, 126)

def jpg(im, q=85, mode='RGB'):
    b = io.BytesIO(); im.convert(mode).save(b, 'JPEG', quality=q, optimize=True); return base64.b64encode(b.getvalue()).decode()

def entry(name, im, mask=None, q=85):
    o = {'w': im.width, 'h': im.height, 'gray': im.mode == 'L', 'jpg': jpg(im, q, 'L' if im.mode == 'L' else 'RGB')}
    if mask is not None: o['mask'] = jpg(mask, 80, 'L')
    return name + ':' + repr(o).replace("True", 'true').replace("False", 'false')

logo = Image.open(os.path.join(A, 'logo.png')).convert('RGB')
guj = Image.open(os.path.join(A, 'gujarati-name.png')).convert('RGB')
guj = guj.resize((1600, round(1600 * guj.height / guj.width)), Image.LANCZOS)
wm = Image.open(os.path.join(A, 'watermark-mask.png')).convert('L').resize((320, 326), Image.LANCZOS)
wmc = Image.new('RGB', wm.size, NAVY)
# phone icon (the WinAnsi fonts of the PDF have no telephone sign)
ic = Image.new('RGB', (72, 72), 'white'); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 64)
ImageDraw.Draw(ic).text((36, 38), '☎', font=f, fill=NAVY, anchor='mm')

def widths(path):
    f = ImageFont.truetype(path, 1000); return [round(f.getlength(chr(c))) for c in range(32, 127)]
L = '/usr/share/fonts/truetype/liberation/LiberationSerif-'
js = ('/* Receipt PDF assets (built by tools/build_receipt_assets.py from assets/receipt/). Do not edit by hand. */\n'
      'const RCPT_IMG={' + ',\n'.join([entry('logo', logo), entry('guj', guj, q=80), entry('wm', wmc, wm, 70), entry('phone', ic)]) + '};\n'
      'const TIMES_W={tb:' + str(widths(L + 'Bold.ttf')) + ',tbi:' + str(widths(L + 'BoldItalic.ttf')) + ',ti:' + str(widths(L + 'Italic.ttf')) + '};\n')
open(os.path.join(R, 'src', 'p4c_assets.js'), 'w').write(js)
print('p4c_assets.js', len(js) // 1024, 'KB')
