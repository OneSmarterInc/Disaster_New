// Projector-facing instructor function overrides applied by build.js.
// Defined but not executed here; build.js inserts Function#toString() into the
// standalone instructor bundle.

function sentences(rs){
  const x=rs.filter(r=>r.strategicView);
  if(!x.length)return notice('No opening sentences submitted yet.');
  return `<div class="contrast">${x.map((r,i)=>`<div class="runbox"><div class="meta">Anonymous run ${i+1}</div><div class="sentence">${esc(r.strategicView)}</div>${r.year1?mini(r.year1):'<p>Year 1 not submitted.</p>'}</div>`).join('')}</div>`;
}

module.exports={sentences};
