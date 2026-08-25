(() => {
  const grid = document.querySelector('[data-team-grid]');
  if (!grid) return;

  fetch('/api/team', { headers: { Accept: 'application/json' } })
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Meeskonda ei õnnestunud laadida.')))
    .then(data => { if (Array.isArray(data.members)) renderMembers(data.members); })
    .catch(() => { /* Static fallback remains visible if the API is unavailable. */ });

  function renderMembers(members) {
    grid.replaceChildren();
    if (!members.length) {
      const empty = document.createElement('p');
      empty.className = 'team-empty';
      empty.textContent = 'Meeskonna uudised on peagi tulemas.';
      grid.append(empty);
      return;
    }
    members.forEach((member, index) => grid.append(createMember(member, index)));
  }

  function createMember(member, index) {
    const article = document.createElement('article');
    article.className = `team-member ${index === 0 ? 'team-member-founder' : ''}`;
    const art = document.createElement('div');
    art.className = `member-art member-art-${['taaniel', 'andreas', 'kaur', 'robi'][index % 4]}`;
    art.setAttribute('aria-hidden', 'true');
    if (member.image) {
      art.classList.add('has-image');
      art.style.backgroundImage = `linear-gradient(180deg, transparent 25%, rgba(0,0,0,.8) 100%), url("${member.image.replace(/"/g, '%22')}")`;
    }
    const initials = document.createElement('span');
    initials.textContent = getInitials(member.name);
    const number = document.createElement('i');
    number.textContent = String(index + 1).padStart(2, '0');
    art.append(initials, number);
    const content = document.createElement('div');
    content.className = 'member-content';
    const indexText = document.createElement('p');
    indexText.className = 'member-index';
    indexText.textContent = `${String(index + 1).padStart(2, '0')} / MEESKOND`;
    const name = document.createElement('h2');
    name.append(...formatName(member.name));
    const meta = document.createElement('div');
    meta.className = 'member-meta';
    const role = document.createElement('p');
    role.textContent = member.role;
    const intro = document.createElement('p');
    intro.textContent = member.intro;
    meta.append(role, intro);
    content.append(indexText, name, meta);
    article.append(art, content);
    return article;
  }

  function getInitials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'SIHT';
  }

  function formatName(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return [document.createTextNode(words[0] || 'MEESKOND')];
    return [document.createTextNode(`${words.slice(0, -1).join(' ')} `), Object.assign(document.createElement('i'), { textContent: words.at(-1) })];
  }
})();
