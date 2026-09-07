from pathlib import Path
p=Path('sim03/build.js')
s=p.read_text()
old="  'Your summary',"
new="  'Full results',"
if old not in s:
    raise SystemExit('old summary build marker missing')
p.write_text(s.replace(old,new,1))
