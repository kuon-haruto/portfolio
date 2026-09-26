const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../scripts/game-gallery.js'), 'utf8');

function element() {
  const classes = new Set();
  return {
    attrs: {},
    events: {},
    matches: () => false,
    classList: {
      add: value => classes.add(value),
      contains: value => classes.has(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
    },
    addEventListener(name, handler) { this.events[name] = handler; },
    setAttribute(name, value) { this.attrs[name] = value; },
  };
}

function setup(reduced = false) {
  const links = Array.from({ length: 5 }, element);
  const copies = Array.from({ length: 5 }, element);
  const copy = { ...element(), querySelectorAll: () => copies };
  const group = { ...element(), cloneNode: () => copy, contains: target => links.includes(target) };
  const track = { ...element(), appendChild: child => { track.child = child; } };
  const viewport = { ...element(), scrollLeft: 50, contains: target => links.includes(target) || copies.includes(target) };
  const toggle = element();
  const parts = {
    '.game-gallery-track': track,
    '.game-gallery-group': group,
    '.gallery-toggle': toggle,
    '.game-gallery-viewport': viewport,
  };
  const gallery = { ...element(), querySelector: selector => parts[selector] };
  const media = { ...element(), matches: reduced };
  const document = { ...element(), hidden: false, querySelector: () => gallery };
  vm.runInNewContext(source, { document, window: { matchMedia: () => media } });
  return { gallery, media, document, viewport, toggle, links, copies, track };
}

test('starts the loop and excludes duplicate links from keyboard navigation', () => {
  const state = setup();
  assert.equal(state.gallery.classList.contains('is-animated'), true);
  assert.equal(state.toggle.hidden, false);
  assert.equal(state.viewport.scrollLeft, 0);
  assert.equal(state.track.child.attrs['aria-hidden'], 'true');
  assert.equal(state.copies.length, 5);
  assert.ok(state.copies.every(link => link.attrs.tabindex === '-1'));
});

test('pause button stops the horizontal loop and can resume', () => {
  const { gallery, toggle } = setup();
  toggle.events.click();
  assert.equal(gallery.classList.contains('is-paused'), true);
  assert.equal(toggle.attrs['aria-label'], '自動巡回を再開');
  toggle.events.click();
  assert.equal(gallery.classList.contains('is-paused'), false);
  assert.equal(toggle.attrs['aria-label'], '自動巡回を一時停止');
});

test('horizontal loop starts automatically without needing a play-button click', () => {
  const { gallery, toggle } = setup(true);
  assert.equal(gallery.classList.contains('is-animated'), true);
  assert.equal(gallery.classList.contains('is-paused'), false);
  assert.equal(toggle.hidden, false);
  assert.equal(toggle.attrs['aria-label'], '自動巡回を一時停止');
});

test('pointer focus on an icon does not stop the loop', () => {
  const { gallery, viewport, links } = setup();
  viewport.events.focusin({ target: links[0] });
  assert.equal(gallery.classList.contains('is-animated'), true);
  assert.equal(gallery.classList.contains('is-paused'), false);
});

test('keyboard focus reveals the original list until focus leaves it', () => {
  const { gallery, viewport, links } = setup();
  let revealed = false;
  links[3].matches = () => true;
  links[3].scrollIntoView = () => { revealed = true; };
  viewport.events.focusin({ target: links[3] });
  assert.equal(gallery.classList.contains('is-animated'), false);
  assert.equal(revealed, true);
  viewport.events.focusout({ relatedTarget: links[1] });
  assert.equal(gallery.classList.contains('is-animated'), false);
  viewport.events.focusout({ relatedTarget: null });
  assert.equal(gallery.classList.contains('is-animated'), true);
});

test('hidden pages stop animating without losing a user pause', () => {
  const { gallery, document, toggle } = setup();
  document.hidden = true;
  document.events.visibilitychange();
  assert.equal(gallery.classList.contains('is-paused'), true);
  document.hidden = false;
  document.events.visibilitychange();
  assert.equal(gallery.classList.contains('is-paused'), false);
  toggle.events.click();
  document.events.visibilitychange();
  assert.equal(gallery.classList.contains('is-paused'), true);
});

test('pages without a gallery remain unaffected', () => {
  assert.doesNotThrow(() => vm.runInNewContext(source, {
    document: { querySelector: () => null },
  }));
});
