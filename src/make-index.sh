#!/bin/bash
# Builds index.html (the deployable page) from the sources in this folder,
# then writes the Content-Security-Policy header (with the sha256 of the inline <script> and <style>) into ../vercel.json,
# then VERIFIES that the hashes in vercel.json match the inline <script> and <style> of ../index.html and prints them.
# The build fails loudly (exit code 1, message starting "CSP CHECK FAILED") if they do not match.
#   bash src/make-index.sh           build, write the policy, verify
#   bash src/make-index.sh --check   verify only (no build). Run this before every deploy: any hand edit of index.html
#                                    without a rebuild makes the browser refuse the inline script and the site goes white.
cd "$(dirname "$0")" || exit 1
CHECK_ONLY=0; [ "$1" = "--check" ] && CHECK_ONLY=1
RC=0
if [ $CHECK_ONLY -eq 0 ]; then
bash build.sh && python3 - <<'PY'
import re
d=open('demo.html',encoding='utf-8').read()
i=d.index('<style>')
head='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Vidyapeeth ERP Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
</head>
<body>
'''
open('../index.html','w',encoding='utf-8').write(head+d[i:]+'\n</body></html>\n')
PY
[ $? -eq 0 ] && python3 - <<'PY'
import re,json,hashlib,base64
html=open('../index.html',encoding='utf-8').read()
def only(tag):
    assert html.count('<'+tag)==1 and html.count('</'+tag+'>')==1, 'index.html must contain exactly one inline <%s>'%tag
    return re.search(r'<'+tag+r'>(.*?)</'+tag+'>',html,re.S).group(1)
h=lambda t:"'sha256-"+base64.b64encode(hashlib.sha256(t.encode('utf-8')).digest()).decode()+"'"
sh,st=h(only('script')),h(only('style'))
csp="; ".join(["default-src 'none'","script-src "+sh,"style-src "+st+" https://fonts.googleapis.com","style-src-attr 'unsafe-inline'","font-src https://fonts.gstatic.com","connect-src 'self'","img-src 'self' data:","object-src 'none'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'"])
p='../vercel.json'
v=json.load(open(p,encoding='utf-8'))
blk=[x for x in v['headers'] if x['source']=='/(.*)'][0]
blk['headers']=[x for x in blk['headers'] if x['key']!='Content-Security-Policy']+[{'key':'Content-Security-Policy','value':csp}]
out=['{']
keys=[k for k in v if k!='headers']+['headers']
for k in keys:
    if k!='headers':
        out.append('  %s: %s,'%(json.dumps(k),json.dumps(v[k])));continue
    out.append('  "headers": [')
    for j,b in enumerate(v['headers']):
        out.append('    { "source": %s, "headers": ['%json.dumps(b['source']))
        out.append(',\n'.join('      { "key": %s, "value": %s }'%(json.dumps(x['key']),json.dumps(x['value'])) for x in b['headers']))
        out.append('    ]}'+(',' if j<len(v['headers'])-1 else ''))
    out.append('  ]')
out.append('}')
txt='\n'.join(out)+'\n';json.loads(txt)
open(p,'w',encoding='utf-8').write(txt)
print('CSP written: script',sh,'style',st)
PY
RC=$?
rm -f demo.html
[ $RC -eq 0 ] || { echo "BUILD FAILED: index.html / vercel.json were not completed. Do not deploy." >&2; exit 1; }
fi

# ---- verify: the Content-Security-Policy in vercel.json must contain the sha256 of the CURRENT inline <script> and <style> of index.html ----
python3 - <<'PY'
import re,json,hashlib,base64,sys
def die(m):
    sys.stderr.write('\n*** CSP CHECK FAILED: '+m+'\n*** Fix: run "bash src/make-index.sh" (it rebuilds index.html and rewrites vercel.json). Do NOT deploy this state: the browser would refuse the inline script and the site would be a white page.\n\n')
    sys.exit(1)
try:
    html=open('../index.html',encoding='utf-8').read()
    v=json.load(open('../vercel.json',encoding='utf-8'))
except Exception as e:
    die('cannot read index.html or vercel.json ('+str(e)+')')
def only(tag):
    if html.count('<'+tag)!=1 or html.count('</'+tag+'>')!=1: die('index.html must contain exactly one inline <%s>'%tag)
    return re.search(r'<'+tag+r'>(.*?)</'+tag+'>',html,re.S).group(1)
h=lambda t:"'sha256-"+base64.b64encode(hashlib.sha256(t.encode('utf-8')).digest()).decode()+"'"
want={'script':h(only('script')),'style':h(only('style'))}
csp=''
for b in v.get('headers',[]):
    for x in b.get('headers',[]):
        if x.get('key')=='Content-Security-Policy': csp=x.get('value','')
if not csp: die('vercel.json has no Content-Security-Policy header')
for tag,src in (('script','script-src'),('style','style-src')):
    m=re.search(r'(?:^|;)\s*'+src+r'\s([^;]*)',csp)
    if not m or want[tag] not in m.group(1).split(): die('the %s hash in vercel.json does not match the inline <%s> of index.html (expected %s)'%(tag,tag,want[tag]))
    if "'unsafe-inline'" in m.group(1): die(src+" must not contain 'unsafe-inline'")
print('CSP check OK: script',want['script'],'style',want['style'])
PY
exit $?
