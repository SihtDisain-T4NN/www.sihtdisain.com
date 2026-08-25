import { getStore, json, readJson, requireAdmin, sameOrigin } from '../../lib/admin.js';
import { logActivity } from '../../lib/insights.js';
import { DEFAULT_TEAM, TEAM_KEY, readTeam, validateTeam } from '../team.js';

export async function onRequestGet({ request, env }) {
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);
  const members = await readTeam(getStore(env));
  return json({ success: true, managed: Array.isArray(members), members: members || DEFAULT_TEAM });
}

export async function onRequestPut({ request, env }) {
  if (!sameOrigin(request)) return json({ success: false, error: 'Vigane päring.' }, 403);
  if (!await requireAdmin(request, env)) return json({ success: false, error: 'Sisselogimine on vajalik.' }, 401);

  const payload = await readJson(request);
  const members = validateTeam(payload?.members);
  if (!members) return json({ success: false, error: 'Kontrolli töötajate nime, rolli, tutvustust ja pilti.' }, 400);

  const store = getStore(env);
  if (!store) return json({ success: false, error: 'Andmesalvestus pole seadistatud.' }, 503);
  const previous = await readTeam(store) || DEFAULT_TEAM;
  await store.put(TEAM_KEY, JSON.stringify(members));
  await logTeamChanges(env, previous, members);
  return json({ success: true, managed: true, members });
}

async function logTeamChanges(env, previous, current) {
  const before = new Map(previous.map(member => [member.id, member]));
  const after = new Map(current.map(member => [member.id, member]));

  for (const member of current) {
    const oldMember = before.get(member.id);
    if (!oldMember) {
      await logActivity(env, { type: 'team_member_added', actor: 'Omanik', message: `Meeskonda lisati: ${member.name}`, meta: { memberId: member.id } });
    } else if (JSON.stringify(oldMember) !== JSON.stringify(member)) {
      await logActivity(env, { type: 'team_member_updated', actor: 'Omanik', message: `Meeskonna liiget uuendati: ${member.name}`, meta: { memberId: member.id } });
    }
  }

  for (const member of previous) {
    if (!after.has(member.id)) {
      await logActivity(env, { type: 'team_member_removed', actor: 'Omanik', message: `Meeskonnast eemaldati: ${member.name}`, meta: { memberId: member.id } });
    }
  }
}
