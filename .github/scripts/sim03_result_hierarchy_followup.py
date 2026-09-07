from pathlib import Path
p=Path('sim03/build.js')
s=p.read_text()
old="  'Full results',"
new="  'Your outcome',"
if old not in s:
    raise SystemExit('legacy full-results required marker missing')
p.write_text(s.replace(old,new,1))
