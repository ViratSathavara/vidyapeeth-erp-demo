#!/usr/bin/env python3
"""Build src/p0_vault.js from the college fee registers (B.Ed + M.Ed .xlsx).

The real student data is written ENCRYPTED (AES-256-GCM, key = PBKDF2-SHA256 of the
demo password, 210,000 rounds). The page asks for the password, decrypts in the browser
and only then loads the data. The .xlsx files and the password are never committed.

  NPCTE_DEMO_PASSWORD='...' NPCTE_ALIASES=aliases.json python3 tools/build_vault.py B.ED.xlsx M.ED.xlsx

Rules (agreed with Virat, 20-11-2026):
  * every student in the sheets is listed; names keep the sheet spelling (spaces trimmed);
    a few spelling variants of the same student are merged (ALIASES below)
  * receipt numbers, dates and amounts are exactly as in the sheet
  * a "Sem 1&2" / "Sem 3&4" receipt is split equally over the two semesters (one record per
    semester, same receipt number) because the demo keeps one semester per payment
  * BY CASH -> Cash, BY CHECK-<no> -> Cheque, BY GPAY / BY IMPS -> UPI, BY EXP... -> Expense
  * rows without a date and receipt number ("RRP CASH IN HAND") are skipped: decision pending
  * email / phone are test values: <name>.test@example.com, 90000 00001 ...
"""
import base64, datetime, json, os, re, sys
import openpyxl
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROUNDS = 210_000
# spelling variant -> spelling kept, per course: {"BED": {"VARIANT": "KEPT"}, "MED": {...}}
# Kept OUTSIDE the repo (it holds student names): pass its path in NPCTE_ALIASES.
ALIASES = json.load(open(os.environ['NPCTE_ALIASES'])) if os.environ.get('NPCTE_ALIASES') else {'BED': {}, 'MED': {}}
# admission reference spellings -> one name
REF_FIX = {'AXAY': 'AKSHAY', 'MAULIKBHAI': 'MAULIK', 'SANJAY BHAI PRI': 'SANJAYBHAI PRI'}

def inr(n):
    n = int(round(n)); s = str(abs(n))
    if len(s) > 3: s = ','.join([s[:-3][::-1][i:i+2][::-1] for i in range(0, len(s) - 3, 2)][::-1]) + ',' + s[-3:]
    return ('-' if n < 0 else '') + s


clean = lambda v: re.sub(r'\s+', ' ', str(v or '')).strip()
key_of = lambda n: clean(n).upper()


def mode_of(remark):
    r = remark.upper()
    if 'EXP' in r: return 'EXPENSE', ''
    m = re.search(r'CHE(?:CK|QUE)\s*-?\s*(\d+)', r)
    if m: return 'CHEQUE', m.group(1)
    if 'GPAY' in r or 'IMPS' in r or 'UPI' in r: return 'UPI', ''
    if 'CASH' in r: return 'CASH', ''
    raise ValueError('Unknown payment mode in remark: ' + remark)


def sems_of(v):
    s = clean(v).upper().replace(' ', '')
    m = re.fullmatch(r'SEM(\d)(?:&(\d))?', s)
    if not m: raise ValueError('Bad SEM value: %r' % v)
    return [int(x) for x in m.groups() if x]


def read(path, cid, out, skipped):
    ws = openpyxl.load_workbook(path).active
    # REMARKS (H) and TOTAL AMOUNT (I) are merged over a group of receipts paid together
    group = {}
    for m in ws.merged_cells.ranges:
        if m.min_col == 8 and m.min_row >= 3:
            for r in range(m.min_row, m.max_row + 1): group[r] = m.min_row
    for r in range(3, ws.max_row + 1):
        v = [ws.cell(r, c).value for c in range(1, 11)]
        name = clean(v[1])
        if not name: continue
        if v[4] is None or v[6] is None:
            skipped.append({'course': cid, 'row': r, 'name': name, 'sem': clean(v[2]), 'batch': clean(v[3]), 'amount': v[5], 'remark': clean(ws.cell(group.get(r, r), 8).value)})
            continue
        g = group.get(r, r)
        remark, total = clean(ws.cell(g, 8).value), ws.cell(g, 9).value
        n_in = sum(1 for x in group.values() if x == g) or 1
        mode, chq = mode_of(remark)
        k = key_of(name); k = ALIASES[cid].get(k, k)
        sid = cid + ':' + k
        batch = clean(v[3]).replace(' ', '')
        if sid not in out['students']:
            out['students'][sid] = {'name': name, 'course': cid, 'adm': int(batch[:4]),
                                    'ref': REF_FIX.get(key_of(v[9]), key_of(v[9]))}
        elif key_of(name) == k and out['students'][sid]['name'].upper() != k:
            out['students'][sid]['name'] = name  # prefer the spelling we keep
        sems = sems_of(v[2])
        amt = round(float(v[5]) * 100)
        parts = [amt // len(sems)] * len(sems); parts[-1] += amt - sum(parts)
        d = v[4] if isinstance(v[4], datetime.datetime) else datetime.datetime.strptime(str(v[4]), '%d-%m-%Y')
        grp = ('Group of %d receipts · total ₹%s · ' % (n_in, inr(total)) if n_in > 1 else '') + remark
        for i, s in enumerate(sems):
            note = grp + (' · Receipt %s covers Sem %s (₹%s), split equally' % (v[6], '&'.join(map(str, sems)), inr(v[5])) if len(sems) > 1 else '')
            out['payments'].append({'s': sid, 'sem': s, 'mode': mode, 'amt': parts[i], 'date': d.strftime('%Y-%m-%d'),
                                    'rc': str(v[6]), 'chq': chq, 'batch': batch,
                                    'reason': remark[:300] if mode == 'EXPENSE' else '', 'note': note[:300]})


def main():
    pw = os.environ.get('NPCTE_DEMO_PASSWORD')
    if not pw or len(sys.argv) != 3: sys.exit(__doc__)
    out, skipped = {'students': {}, 'payments': []}, []
    read(sys.argv[1], 'BED', out, skipped)
    read(sys.argv[2], 'MED', out, skipped)
    ids = list(out['students'])
    used = {}
    studs = []
    for i, sid in enumerate(ids):
        st = out['students'][sid]
        base = re.sub(r'[^a-z]+', '.', st['name'].lower()).strip('.')
        used[base] = used.get(base, 0) + 1
        st['email'] = base + ('' if used[base] == 1 else str(used[base])) + '.test@example.com'
        st['phone'] = '90000' + str(i + 1).zfill(5)
        studs.append(st)
    idx = {sid: i for i, sid in enumerate(ids)}
    for p in out['payments']: p['s'] = idx[p['s']]
    data = json.dumps({'students': studs, 'payments': out['payments'], 'source': 'B.ED_2026-27.xlsx + M.ED_2026-27.xlsx'}, ensure_ascii=False, separators=(',', ':')).encode()
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ROUNDS).derive(pw.encode())
    ct = AESGCM(key).encrypt(iv, data, None)
    b = lambda x: base64.b64encode(x).decode()
    js = ('/* Real NPCTE fee-register data (B.Ed + M.Ed 2026-27), ENCRYPTED. Built by tools/build_vault.py.\n'
          '   Unlocked in the browser with the demo password (password gate in p6d_notify.js). Do not edit by hand. */\n'
          f"const VAULT={{v:1,kdf:'PBKDF2-SHA256',rounds:{ROUNDS},salt:'{b(salt)}',iv:'{b(iv)}',ct:'{b(ct)}'}};\n")
    open(os.path.join(os.path.dirname(__file__), '..', 'src', 'p0_vault.js'), 'w').write(js)
    print('students', len(studs), '(B.Ed', sum(s['course'] == 'BED' for s in studs), '/ M.Ed', sum(s['course'] == 'MED' for s in studs), ')')
    print('payment records', len(out['payments']), 'receipts', len({(p['rc'], studs[p['s']]['course']) for p in out['payments']}))
    print('skipped rows (no date / receipt no.)', len(skipped), 'total ₹', sum(x['amount'] or 0 for x in skipped))
    json.dump({'skipped': skipped}, open('/tmp/vault_report.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
