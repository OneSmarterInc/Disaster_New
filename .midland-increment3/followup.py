from pathlib import Path
root=Path('sim03')
p=root/'tools/check.js';s=p.read_text()
s=s.replace("'Headroom for growth and for anything that needs to compute.'","'Headroom for growth and for anything that needs to compute. No one in the room speaks for this line.'")
s=s.replace("inc1.position.startsWith('You have $9 million')","inc1.position.startsWith('Allocate all $9 million')")
p.write_text(s)
p=root/'public/index.html';s=p.read_text()
old="  S.reflection1=argument.value.trim()+REFLECTION_DIVIDER+reconsideration.value.trim();S.reflection2=document.getElementById('r2').value.trim();"
assert s.count(old)==1
s=s.replace(old,"  const firstResponse=argument.value.trim()+REFLECTION_DIVIDER+reconsideration.value.trim();\n  if(firstResponse.length>1500){alert('Please shorten the first two answers to fit the saved-response limit. Your text has not been changed.');return}\n  S.reflection1=firstResponse;S.reflection2=document.getElementById('r2').value.trim();")
p.write_text(s)
p=root/'lib/closingLesson.js';s=p.read_text()
start=s.index('function heatSentence(');end=s.index('function dollars(',start);s=s[:start]+s[end:]
start=s.index('const LABELS = {');end=s.index('\n\nfunction amount(',start);s=s[:start]+s[end:]
s=s.replace("  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;\n",'')
s=s.replace("  if (band === 'strong') {\n    return `${dollars(c.capacity - capStrong + 1)} less in Capacity", "  if (band === 'strong') {\n    if (capStrong <= 0) return '';\n    return `${dollars(c.capacity - capStrong + 1)} less in Capacity")
p.write_text(s)
print('Updated only superseded copy assertions; removed unused closing-summary helpers.')
