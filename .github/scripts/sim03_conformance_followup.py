from pathlib import Path
import re
p=Path('sim03/public/index.html')
s=p.read_text()
pat=re.compile(r"function renderBuyers\(\)\{.*?\n\}\nfunction renderClose\(\)\{",re.S)
if not pat.search(s): raise SystemExit('renderBuyers block missing')
s=pat.sub("function renderBuyers(){S.step=9;return renderClose()}\nfunction renderClose(){",s,count=1)
p.write_text(s)
