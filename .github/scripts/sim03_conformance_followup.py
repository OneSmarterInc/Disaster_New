from pathlib import Path
import re

p=Path('sim03/public/index.html')
s=p.read_text()
pat=re.compile(r"function renderBuyers\(\)\{.*?\n\}\nfunction renderClose\(\)\{",re.S)
if not pat.search(s): raise SystemExit('renderBuyers block missing')
s=pat.sub("function renderBuyers(){S.step=9;return renderClose()}\nfunction renderClose(){",s,count=1)
p.write_text(s)

p=Path('sim03/tools/check.js')
s=p.read_text()
old="assert.equal(S.evaluateYear3(gapA, gapB).band, 'unresolved_calibration');"
new="const gap3 = S.evaluateYear3(gapA, gapB);\nassert.equal(gap3.band, 'pilot');\nassert.equal(gap3.calibrationGap, true);"
if old not in s: raise SystemExit('Year 3 gap assertion missing')
s=s.replace(old,new,1)
p.write_text(s)
