(() => {
  const gallery = document.querySelector('[data-game-gallery]');
  if (!gallery) return;

  const track = gallery.querySelector('.game-gallery-track');
  const group = gallery.querySelector('.game-gallery-group');
  const toggle = gallery.querySelector('.gallery-toggle');
  const viewport = gallery.querySelector('.game-gallery-viewport');
  const duplicate = group.cloneNode(true);
  duplicate.classList.add('game-gallery-copy');
  duplicate.setAttribute('aria-hidden', 'true');
  duplicate.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'));
  track.appendChild(duplicate);

  let paused = false;
  let browsing = false;

  const update = () => {
    gallery.classList.toggle('is-animated', !browsing);
    gallery.classList.toggle('is-paused', paused || document.hidden);
    gallery.classList.toggle('is-user-paused', paused);
    toggle.hidden = false;
    const label = paused ? '自動巡回を再開' : '自動巡回を一時停止';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    if (!browsing) viewport.scrollLeft = 0;
  };

  toggle.addEventListener('click', () => {
    paused = !paused;
    update();
  });
  // Show the original, scrollable list while navigating with a keyboard.
  viewport.addEventListener('focusin', event => {
    if (!group.contains(event.target) || !event.target.matches(':focus-visible')) return;
    browsing = true;
    update();
    event.target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
  viewport.addEventListener('focusout', event => {
    if (viewport.contains(event.relatedTarget)) return;
    browsing = false;
    update();
  });
  document.addEventListener('visibilitychange', update);
  update();
})();
