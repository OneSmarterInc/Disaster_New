'use strict';
const { verifyLaunch } = require('./launch');

function body(req) {
  if (typeof req.body === 'string') { try { return JSON.parse(req.body) || {}; } catch { return {}; } }
  return req.body && typeof req.body === 'object' ? req.body : {};
}
function access(req, b) {
  const lt = req.headers?.['x-launch-token'] || b?.launchToken;
  if (lt) {
    const p = verifyLaunch(String(lt));
    return p && p.sub && ['student', 'faculty', 'faculty_preview'].includes(p.role)
      ? { platform: true, id: `platform:${p.sub}`, name: p.name || 'Participant', courseId: p.course || null, role: p.role, mode: p.mode }
      : null;
  }
  return process.env.ACCESS_CODE && req.headers?.['x-access-code'] === process.env.ACCESS_CODE
    ? { platform: false } : null;
}
function faculty(req, b) {
  const p = access(req, b);
  if (p?.platform) return ['faculty', 'faculty_preview'].includes(p.role) ? p : null;
  const given = String(b.facultyCode || req.headers?.['x-faculty-code'] || '').trim();
  if (!given) return null;
  const list = String(process.env.FACULTY_CODES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (process.env.FACULTY_CODE) list.push('Facilitator:' + process.env.FACULTY_CODE);
  const matched = list.find(entry => entry.slice(entry.lastIndexOf(':') + 1).trim() === given);
  return matched ? { platform: false, name: matched.slice(0, matched.lastIndexOf(':')).trim() || 'Facilitator' } : null;
}
function owns(who, session) {
  if (!who || who.platform !== session.platformAuth) return false;
  if (session.platformAuth) return session.ownerId === who.id && (!session.courseId || session.courseId === who.courseId);
  return session.owner === who.name;
}
function participant(req, b, session) {
  const p = access(req, b);
  if (!p || p.platform !== session.platformAuth) return null;
  if (session.platformAuth && session.courseId && p.courseId !== session.courseId) return null;
  if (p.platform) return p;
  const id = String(b.participantId || '');
  return id && session.participants[id] ? { ...p, id } : { ...p, id: null };
}
module.exports = { body, access, faculty, owns, participant };
