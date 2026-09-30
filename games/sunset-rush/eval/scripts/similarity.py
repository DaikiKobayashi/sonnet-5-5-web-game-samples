# 参考実装(opus-medium / fable-high)が既存 5 実装と酷似していないかの静的チェック。
# 7 実装すべての組み合わせで同じ指標を計算し、既存 5 実装どうしの値を「同じ仕様書から独立に書いた場合の基準」として比べる。
#   (a) ファイル単位の SHA-256 一致(完全一致 / 空白を除いた一致)
#   (b) 正規化した行(前後空白除去・連続空白を 1 つに、25 文字以上)の一致率(A の行のうち B にもある割合)
#   (c) トークン 12-gram の一致率(A の 12-gram のうち B にもある割合)
#   (d) 16 進カラーリテラル(#rgb / #rrggbb / 0xrrggbb)の一致率(仕様書にカラーコードは 1 つもない)
#   (e) 長い数値リテラル・文字列リテラル(アセット生成の定数・ドット絵の文字列)の一致
# 出力: eval/raw/similarity.json
import hashlib, json, os, re, itertools, sys

GAME = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
V = ['low', 'medium', 'high', 'xhigh', 'max', 'opus-medium', 'fable-high']
REFS = ['opus-medium', 'fable-high']


def files(v):
    base = os.path.join(GAME, 'impl', v)
    out = []
    for d, _, fs in os.walk(base):
        for f in fs:
            p = os.path.join(d, f)
            out.append((os.path.relpath(p, base), p))
    return sorted(out)


def src(v):
    return [(r, open(p, encoding='utf8', errors='replace').read()) for r, p in files(v) if r.startswith('dist/') and re.search(r'\.(js|mjs|html|css)$', r)]


res = {'variants': V}
# (a) ハッシュ
H = {}
for v in V:
    for r, p in files(v):
        b = open(p, 'rb').read()
        H.setdefault(hashlib.sha256(b).hexdigest(), []).append(f'{v}/{r}')
        H.setdefault('ws:' + hashlib.sha256(re.sub(rb'\s+', b'', b)).hexdigest(), []).append(f'{v}/{r}')
dups = {k: sorted(x) for k, x in H.items() if len({y.split('/')[0] for y in x}) > 1}
res['hashMatchesAcrossVariants'] = dups
res['hashMatchesInvolvingRefs'] = {k: x for k, x in dups.items() if any(y.split('/')[0] in REFS for y in x)}
res['fileCounts'] = {v: len(files(v)) for v in V}

# (b)(c)(d)(e) の特徴集合
TOK = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*|0x[0-9A-Fa-f]+|\d+\.?\d*|"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'|`[^`]*`|\S')


def feats(v):
    lines, grams, colors, lits = set(), set(), set(), set()
    for r, t in src(v):
        for l in t.split('\n'):
            n = re.sub(r'\s+', ' ', l.strip())
            if len(n) >= 25 and re.search(r'[A-Za-z0-9]', n):
                lines.add(n)
        t2 = re.sub(r'/\*.*?\*/', ' ', t, flags=re.S)
        t2 = re.sub(r'//[^\n]*', ' ', t2)
        toks = TOK.findall(t2)
        for i in range(len(toks) - 11):
            grams.add(' '.join(toks[i:i + 12]))
        for m in re.findall(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|0x[0-9A-Fa-f]{6}\b', t):
            c = m.lower().replace('0x', '#')
            if len(c) == 4:
                c = '#' + ''.join(ch * 2 for ch in c[1:])
            colors.add(c)
        # 16 文字以上の文字列リテラル(ドット絵の行など)と、5 要素以上の数値配列リテラル
        for m in re.findall(r"'([^'\n]{16,})'|\"([^\"\n]{16,})\"", t):
            s = m[0] or m[1]
            if not re.match(r'^[\w\s.,:;!?()/-]*$', s) or re.search(r'[#.@*=+XxO0-9]{8,}', s):
                lits.add(s)
        for m in re.findall(r'\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?){4,})\s*\]', t):
            lits.add('[' + re.sub(r'\s+', '', m) + ']')
    return {'lines': lines, 'grams': grams, 'colors': colors, 'lits': lits}


F = {v: feats(v) for v in V}
# 仕様書に由来する部分(セクション表・数式など)を除いた版も計算する: SPEC.md 中の 12-gram と、数値配列の各要素行を除外
spec = open(os.path.join(GAME, 'SPEC.md'), encoding='utf8').read()
_st = TOK.findall(spec)
SPEC_GRAMS = {' '.join(_st[i:i + 12]) for i in range(len(_st) - 11)}
SPEC_NUMS = set(re.findall(r'-?\d+(?:\.\d+)?', spec))
for v in V:
    F[v]['gramsNoSpec'] = {g for g in F[v]['grams'] if g not in SPEC_GRAMS and not re.fullmatch(r'[\[\]\s,\-0-9.]+', g)}
    F[v]['linesNoSpec'] = {l for l in F[v]['lines'] if not re.fullmatch(r'[\[\]\s,\-0-9.]+', l) and not any(l in x for x in [spec])}


def cont(a, b):
    return round(len(a & b) / len(a), 4) if a else None


for k in ['lines', 'grams', 'colors', 'lits', 'gramsNoSpec', 'linesNoSpec']:
    res[k] = {a: {b: cont(F[a][k], F[b][k]) for b in V if b != a} for a in V}
# 既存 5 実装どうしの基準(最大・中央値)と、参考実装から既存 5 実装への最大値
base = {}
for k in ['lines', 'grams', 'colors', 'lits', 'gramsNoSpec', 'linesNoSpec']:
    vals = sorted(res[k][a][b] for a in V[:5] for b in V[:5] if a != b and res[k][a][b] is not None)
    base[k] = {'existingPairsMax': vals[-1], 'existingPairsMedian': vals[len(vals) // 2], 'refToExistingMax': {r: max((res[k][r][b], b) for b in V[:5]) for r in REFS}, 'refToRef': {r: res[k][r][[x for x in REFS if x != r][0]] for r in REFS}}
res['summary'] = base
# 参考実装と既存実装で共通する行・12-gram の具体例(上位)
ex = {}
for r in REFS:
    ex[r] = {}
    for b in V[:5]:
        common = sorted(F[r]['linesNoSpec'] & F[b]['linesNoSpec'], key=len, reverse=True)
        ex[r][b] = {'commonLinesNoSpec': len(common), 'longestCommonLinesNoSpec': common[:12], 'commonColors': sorted(F[r]['colors'] & F[b]['colors']), 'commonLits': sorted(F[r]['lits'] & F[b]['lits'])[:10]}
res['examples'] = ex
res['featureSizes'] = {v: {k: len(x) for k, x in F[v].items()} for v in V}
json.dump(res, open(os.path.join(GAME, 'eval', 'raw', 'similarity.json'), 'w'), ensure_ascii=False, indent=1)
print(json.dumps(res['hashMatchesInvolvingRefs'], ensure_ascii=False, indent=1))
print(json.dumps(res['summary'], ensure_ascii=False, indent=1))
print(json.dumps({v: {k: len(x) for k, x in F[v].items()} for v in V}))
