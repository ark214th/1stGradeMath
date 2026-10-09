#!/usr/bin/env python3
"""KanjiVG の SVG から 1年生の漢字80字の書き順データ（kanji-strokes.js）を作る。

使い方:
  1. https://github.com/KanjiVG/kanjivg の kanji/XXXXX.svg を1つのフォルダに集める
  2. python3 tools/build_strokes.py <そのフォルダ> > kanji-strokes.js
"""
import re
import sys
from pathlib import Path

KANJI = '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六'

HEADER = """/*
 * 1年生の漢字80字の書き順データ（画ごとの SVG パス、座標は 109×109）。
 * tools/build_strokes.py で KanjiVG から作成。手で編集しない。
 *
 * This file is derived from KanjiVG (http://kanjivg.tagaini.net)
 * Copyright (C) 2009-2011 Ulrich Apel.
 * Licensed under the Creative Commons Attribution-Share Alike 3.0 License.
 * https://creativecommons.org/licenses/by-sa/3.0/
 */
"""


def num(m):
    v = round(float(m.group(0)), 1)
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    if s in ('-0', '0'):
        # 「-0.01」が「0」になると、前の数字とくっついてしまうので空白で区切る
        return ' 0' if m.group(0).startswith('-') else '0'
    return s


def strokes(svg):
    found = re.findall(r'id="kvg:[0-9a-f]+-s(\d+)"[^>]*?\sd="([^"]+)"', svg)
    found.sort(key=lambda t: int(t[0]))
    return [re.sub(r'-?\d+(?:\.\d+)?', num, d) for _, d in found]


def main(folder):
    out = [HEADER, '(function (root) {', '  var S = {']
    for ch in KANJI:
        svg = (Path(folder) / ('%05x.svg' % ord(ch))).read_text(encoding='utf-8')
        paths = strokes(svg)
        assert paths, ch
        out.append('    %s: [%s],' % (repr(ch).replace("'", '"'), ', '.join('"%s"' % p for p in paths)))
    out += ['  };', "  root.KANJI_STROKES = S;", "  if (typeof module !== 'undefined') module.exports = S;", '})(typeof window !== "undefined" ? window : globalThis);', '']
    sys.stdout.write('\n'.join(out))


if __name__ == '__main__':
    main(sys.argv[1])
