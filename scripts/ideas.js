(() => {
  'use strict';
  const form = document.getElementById('ideas-controls');
  const search = document.getElementById('idea-search');
  const stage = document.getElementById('idea-stage');
  const count = document.getElementById('idea-count');
  const empty = document.getElementById('ideas-empty');
  const cards = [...document.querySelectorAll('.idea-card')];
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ja');
  const texts = cards.map(card => normalize(card.textContent));

  function filter() {
    const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
    let visible = 0;
    cards.forEach((card, i) => {
      card.hidden = !(stage.value === 'all' || stage.value === card.dataset.stage)
        || !words.every(word => texts[i].includes(word));
      if (!card.hidden) visible += 1;
    });
    count.textContent = `${visible} / ${cards.length}件`;
    empty.hidden = visible !== 0;
  }

  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const card = cards.find(item => item.id === id);
    if (!card) return;
    search.value = '';
    stage.value = 'all';
    filter();
    card.querySelector('details').open = true;
    card.scrollIntoView({ block: 'start' });
  }

  form.hidden = false;
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filter);
  form.addEventListener('change', filter);
  form.addEventListener('reset', () => {
    search.value = '';
    stage.value = 'all';
    filter();
  });
  window.addEventListener('hashchange', revealHash);
  filter();
  revealHash();
})();
