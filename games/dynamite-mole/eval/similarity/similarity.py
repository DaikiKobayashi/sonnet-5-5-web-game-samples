# 参考実装(opus-medium / fable-high)のコードが既存 5 実装と酷似していないかの静的チェック(dynamite-mole 版)。
# games/sunset-rush/eval/scripts/similarity.py の方法を参考に、このゲームの構成(dist/ 直下または dist/js/ の素の JS、
# アセットはコード生成、PNG/SVG は favicon のみ)に合わせて書き直したもの。
# 7 実装すべての組み合わせで同じ指標を計算し、既存 5 実装どうしの値を「同じ仕様書から独立に書いた場合の基準」とする。
#   (a) ファイル単位の SHA-256 一致(完全一致 / 空白をすべて除いた一致)。impl/<v>/ 以下の全ファイル(README・tools を含む)
#   (b) 正規化した行(前後空白除去・連続空白を 1 つに、25 文字以上)の一致率(A の行のうち B にもある割合)
#   (c) トークン 12-gram の一致率(A の 12-gram のうち B にもある割合)。コメントは除く
#   (d) 識別子を ID に置き換えたトークン 12-gram の一致率(変数名を変えただけの流用を拾うため)
#   (e) 16 進カラーリテラル(#rgb / #rrggbb)の一致率(仕様書にカラーコードはほぼない)
#   (f) 長い文字列リテラル(ドット絵の行など 12 文字以上)の一致
# (b)(c)(d) は SPEC.md に出てくる 12-gram・行(ステージ表・mulberry32 など、仕様書から写せる部分)を除いた版も出す。
# 対象は dist/ の .js / .html / .css。出力: eval/similarity/code-similarity.json
import hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.abspath(os.path.join(HERE, '..', '..'))
V = ['low', 'medium', 'high', 'xhigh', 'max', 'opus-medium', 'fable-high']
EXIST = V[:5]
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


res = {'variants': V, 'note': '一致率は「A の特徴のうち B にもある割合」。existingPairs* は既存 5 実装どうし(20 の有向ペア)の値'}

# (a) ハッシュ
H = {}
for v in V:
    for r, p in files(v):
        b = open(p, 'rb').read()
        H.setdefault('exact:' + hashlib.sha256(b).hexdigest(), []).append(f'{v}/{r}')
        H.setdefault('nows:' + hashlib.sha256(re.sub(rb'\s+', b'', b)).hexdigest(), []).append(f'{v}/{r}')
dups = {k: sorted(x) for k, x in H.items() if len({y.split('/')[0] for y in x}) > 1}
res['hashMatchesAcrossVariants'] = dups
res['hashMatchesInvolvingRefs'] = {k: x for k, x in dups.items() if any(y.split('/')[0] in REFS for y in x)}
res['fileCounts'] = {v: len(files(v)) for v in V}

TOK = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*|0x[0-9A-Fa-f]+|\d+\.?\d*|"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'|`[^`]*`|\S')
KW = set('''break case catch class const continue debugger default delete do else export extends finally for function if import in
instanceof let new return super switch this throw try typeof var void while with yield async await of null true false undefined
Math window document performance console JSON Object Array Number String Boolean Map Set'''.split())


def strip_comments(t):
    t = re.sub(r'/\*.*?\*/', ' ', t, flags=re.S)
    t = re.sub(r'(^|[^:\\])//[^\n]*', r'\1 ', t)
    t = re.sub(r'<!--.*?-->', ' ', t, flags=re.S)
    return t


def feats(v):
    lines, grams, agrams, colors, lits = set(), set(), set(), set(), set()
    for r, t in src(v):
        for l in t.split('\n'):
            n = re.sub(r'\s+', ' ', l.strip())
            if len(n) >= 25 and re.search(r'[A-Za-z0-9]', n):
                lines.add(n)
        toks = TOK.findall(strip_comments(t))
        # 識別子を位置に依らない ID に置き換えた列(キーワード・よく使う組み込みは残す)
        atoks = ['ID' if re.match(r'^[A-Za-z_$]', x) and x not in KW else x for x in toks]
        for i in range(len(toks) - 11):
            grams.add(' '.join(toks[i:i + 12]))
            agrams.add(' '.join(atoks[i:i + 12]))
        for m in re.findall(r'#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b', t):
            c = m.lower()
            if len(c) == 4:
                c = '#' + ''.join(ch * 2 for ch in c[1:])
            colors.add(c)
        for m in re.findall(r"'([^'\n]{12,})'|\"([^\"\n]{12,})\"|`([^`\n]{12,})`", t):
            s = m[0] or m[1] or m[2]
            # ドット絵の行らしい文字列(同じ記号が続く・空白以外の記号が多い)
            if re.search(r'([^\sA-Za-z])\1{3,}', s) or re.fullmatch(r'[.#@*=+XxO0-9a-zA-Z ]{12,}', s) and not re.search(r'\s[a-z]+\s', s):
                lits.add(s)
    return {'lines': lines, 'grams': grams, 'agrams': agrams, 'colors': colors, 'lits': lits}


F = {v: feats(v) for v in V}
spec = open(os.path.join(GAME, 'SPEC.md'), encoding='utf8').read()
_st = TOK.findall(spec)
SPEC_GRAMS = {' '.join(_st[i:i + 12]) for i in range(len(_st) - 11)}
_sa = ['ID' if re.match(r'^[A-Za-z_$]', x) and x not in KW else x for x in _st]
SPEC_AGRAMS = {' '.join(_sa[i:i + 12]) for i in range(len(_sa) - 11)}
SPEC_LINES = {re.sub(r'\s+', ' ', l.strip()) for l in spec.split('\n')}
NUMISH = re.compile(r'[\[\]{}()\s,:;\-0-9.ID]+')
for v in V:
    F[v]['gramsNoSpec'] = {g for g in F[v]['grams'] if g not in SPEC_GRAMS and not NUMISH.fullmatch(g)}
    F[v]['agramsNoSpec'] = {g for g in F[v]['agrams'] if g not in SPEC_AGRAMS and not NUMISH.fullmatch(g)}
    F[v]['linesNoSpec'] = {l for l in F[v]['lines'] if not NUMISH.fullmatch(l) and l not in SPEC_LINES and l not in spec}

KEYS = ['lines', 'linesNoSpec', 'grams', 'gramsNoSpec', 'agrams', 'agramsNoSpec', 'colors', 'lits']


def cont(a, b):
    return round(len(a & b) / len(a), 4) if a else None


for k in KEYS:
    res[k] = {a: {b: cont(F[a][k], F[b][k]) for b in V if b != a} for a in V}
summ = {}
for k in KEYS:
    vals = sorted(res[k][a][b] for a in EXIST for b in EXIST if a != b and res[k][a][b] is not None)
    summ[k] = {
        'existingPairsMin': vals[0], 'existingPairsMedian': vals[len(vals) // 2], 'existingPairsMax': vals[-1],
        'refToExistingMax': {r: max((res[k][r][b], b) for b in EXIST) for r in REFS},
        'existingToRefMax': {r: max((res[k][b][r], b) for b in EXIST) for r in REFS},
        'refToRef': {r: res[k][r][[x for x in REFS if x != r][0]] for r in REFS},
    }
res['summary'] = summ
ex = {}
for r in REFS:
    ex[r] = {}
    for b in [x for x in V if x != r]:
        common = sorted(F[r]['linesNoSpec'] & F[b]['linesNoSpec'], key=len, reverse=True)
        cg = sorted(F[r]['gramsNoSpec'] & F[b]['gramsNoSpec'])
        ex[r][b] = {'commonLinesNoSpec': len(common), 'longestCommonLinesNoSpec': common[:15],
                    'commonGramsNoSpec': len(cg), 'sampleCommonGramsNoSpec': cg[:15],
                    'commonColors': sorted(F[r]['colors'] & F[b]['colors']), 'commonLits': sorted(F[r]['lits'] & F[b]['lits'])[:15]}
res['examples'] = ex
res['featureSizes'] = {v: {k: len(x) for k, x in F[v].items()} for v in V}

# (h) 最長の共通トークン列(コメントを除いたトークン列で、連続して一致する最長の長さ。ファイルの境界はまたがない)
def token_seqs(v):
    return [TOK.findall(strip_comments(t)) for _, t in src(v)]


TS = {v: token_seqs(v) for v in V}
_ids = {}


def ids(seq):
    return [_ids.setdefault(x, len(_ids) + 1) for x in seq]


TI = {v: [ids(s) for s in TS[v]] for v in V}
MOD, BASE = (1 << 61) - 1, 1000003


def ngram_hashes(seqs, n):
    out = {}
    pw = pow(BASE, n - 1, MOD)
    for si, s in enumerate(seqs):
        if len(s) < n:
            continue
        h = 0
        for i in range(n):
            h = (h * BASE + s[i]) % MOD
        out.setdefault(h, (si, 0))
        for i in range(n, len(s)):
            h = ((h - s[i - n] * pw) * BASE + s[i]) % MOD
            out.setdefault(h, (si, i - n + 1))
    return out


def longest_common(a, b):
    lo, hi, best = 1, 4000, None
    while lo <= hi:
        mid = (lo + hi) // 2
        ha, hb = ngram_hashes(TI[a], mid), ngram_hashes(TI[b], mid)
        common = ha.keys() & hb.keys()
        if common:
            h = next(iter(common))
            si, i = ha[h]
            best = (mid, ' '.join(TS[a][si][i:i + mid]))
            lo = mid + 1
        else:
            hi = mid - 1
    return best


lcs = {}
for i, a in enumerate(V):
    for b in V[i + 1:]:
        r = longest_common(a, b)
        lcs[f'{a}|{b}'] = {'tokens': r[0] if r else 0, 'text': (r[1][:400] if r else '')}
lv = sorted(x['tokens'] for k, x in lcs.items() if all(y in EXIST for y in k.split('|')))
res['longestCommonTokenRun'] = {'pairs': lcs, 'existingPairs': {'min': lv[0], 'median': lv[len(lv) // 2], 'max': lv[-1]}}

# (g) 5x7 フォントの字形の一致(7 実装とも font.js に文字 → 7 行 x 5 桁のビットマップを持つ。書式の違いを吸収して比べる)
def glyphs(v):
    base = os.path.join(GAME, 'impl', v, 'dist')
    t = ''
    for d, _, fs in os.walk(base):
        for f in fs:
            if f == 'font.js':
                t += open(os.path.join(d, f), encoding='utf8').read()
    out = {}
    pat = re.compile(r"""(?:'(\\?.)'|"(\\?.)"|(?<![\w$'"])([A-Za-z0-9])(?![\w$'"]))\s*:\s*(\[[^\]]*\]|'[^'\n]*'|"[^"\n]*")""")
    for m in pat.finditer(t):
        ch = (m.group(1) or m.group(2) or m.group(3)).replace('\\', '')
        body = m.group(4)
        rows = re.findall(r"'([^']*)'|\"([^\"]*)\"", body) if body.startswith('[') else None
        rows = [a or b for a, b in rows] if rows else re.split(r'[,/|]', body[1:-1])
        if len(rows) != 7 or any(len(r) != 5 for r in rows):
            continue
        bits = ''.join('1' if c in '1#Xx@*' else '0' for c in ''.join(rows))
        out[ch.upper() if ch != 'x' else 'x'] = bits
    return out


GL = {v: glyphs(v) for v in V}
font = {'glyphCounts': {v: len(GL[v]) for v in V}, 'pairs': {}}
for i, a in enumerate(V):
    for b in V[i + 1:]:
        common = sorted(set(GL[a]) & set(GL[b]))
        same = [c for c in common if GL[a][c] == GL[b][c]]
        font['pairs'][f'{a}|{b}'] = {'commonChars': len(common), 'identical': len(same), 'rate': round(len(same) / len(common), 3) if common else None, 'differentChars': ''.join(c for c in common if c not in same)}
fv = sorted(p['rate'] for k, p in font['pairs'].items() if p['rate'] is not None and all(x in EXIST for x in k.split('|')))
font['existingPairsRate'] = {'min': fv[0], 'median': fv[len(fv) // 2], 'max': fv[-1]}
res['font'] = font

os.makedirs(HERE, exist_ok=True)
json.dump(res, open(os.path.join(HERE, 'code-similarity.json'), 'w'), ensure_ascii=False, indent=1)
print('hash matches involving refs:', json.dumps(res['hashMatchesInvolvingRefs'], ensure_ascii=False, indent=1))
print('hash matches among existing:', json.dumps({k: x for k, x in dups.items() if k not in res['hashMatchesInvolvingRefs']}, ensure_ascii=False, indent=1))
for k in KEYS:
    s = summ[k]
    print(f"{k:14s} existing min/med/max={s['existingPairsMin']}/{s['existingPairsMedian']}/{s['existingPairsMax']}  ref->exist max={s['refToExistingMax']}  exist->ref max={s['existingToRefMax']}  ref<->ref={s['refToRef']}")
print(json.dumps(res['featureSizes']))
print('font glyph counts', font['glyphCounts'], 'existing pairs identical-rate', font['existingPairsRate'])
for k, p in font['pairs'].items():
    print('font', k, p['identical'], '/', p['commonChars'], p['rate'])
print('longest common token run, existing pairs', res['longestCommonTokenRun']['existingPairs'])
for k, x in lcs.items():
    print('lcs', k, x['tokens'], x['text'][:160])
