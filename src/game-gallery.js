import { PerspectiveCamera, Vector3 } from 'three';

const gallery = document.querySelector('[data-game-gallery]');
if (gallery) {
  const viewport = gallery.querySelector('.game-gallery-viewport');
  const group = gallery.querySelector('.game-gallery-group');
  const items = [...group.children];
  const labels = items.map(item => item.querySelector('.game-icon-link > span:last-child'));
  gallery.querySelector('.game-gallery-heading strong').textContent = items.length;
  items.forEach(item => {
    const link = item.querySelector('a');
    link.title = link.textContent.trim();
  });
  const toggle = gallery.querySelector('.gallery-toggle');
  const canvas = document.createElement('canvas');
  canvas.className = 'gallery-orbit';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  const camera = new PerspectiveCamera(35, 1, 1, 2000);
  const point = new Vector3();
  const position = new Vector3();
  camera.position.z = 900;
  camera.updateMatrixWorld();
  // This gallery is explicitly designed to circulate; its visible pause control remains available.
  let paused = false;
  let browsing = false;
  let visible = true;
  let phase = 0;
  let frame = 0;
  let lastTime = 0;
  let width = 0;
  let height = 0;
  let radiusX = 0;
  let rise = 0;
  let depth = 0;
  let compact = false;
  let angleStep = 0;
  let visibleHalf = 0;

  // Project both the orbit and upright HTML links through the same Three.js camera.
  // HTML keeps native links, accessible names and crisp text without a WebGL context.
  function project(angle, ringScale = 1) {
    position.set(Math.sin(angle) * radiusX * ringScale, rise * (0.4 - Math.cos(angle) * ringScale), Math.cos(angle) * depth * ringScale);
    point.copy(position).project(camera);
    return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, scale: 900 / (900 - position.z) };
  }

  function render() {
    if (!width || browsing) return;
    context.clearRect(0, 0, width, height);
    for (const ringScale of [0.86, 1.08]) {
      context.beginPath();
      for (let step = 0; step <= 160; step++) {
        const p = project(step / 160 * Math.PI * 2, ringScale);
        if (!step) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      }
      context.strokeStyle = ringScale < 1 ? 'rgba(58, 211, 190, 0.25)' : 'rgba(111, 158, 255, 0.3)';
      context.lineWidth = 1;
      context.stroke();
    }
    let front = 0;
    let nearest = -Infinity;
    items.forEach((item, index) => {
      // A fixed-size viewing arc prevents future additions from shrinking the icons.
      // The remaining works share the rear arc, keeping five clear foreground slots.
      const slot = (index + phase + items.length / 2) % items.length - items.length / 2;
      const rear = Math.abs(slot) > visibleHalf;
      const rearProgress = rear ? (Math.abs(slot) - visibleHalf) / (items.length / 2 - visibleHalf) : 0;
      const opacity = rear
        ? 0.42 * Math.min(1, (Math.abs(slot) - visibleHalf) / 0.3)
        : Math.min(1, Math.max(0, (visibleHalf - Math.abs(slot)) / 0.3));
      item.classList.toggle('is-in-orbit', !rear && opacity > 0);
      item.classList.toggle('is-rear-orbit', rear && opacity > 0);
      item.style.setProperty('--orbit-opacity', opacity);
      item.style.setProperty('--orbit-blur', `${rear ? 3 + rearProgress * 3 : 0}px`);
      if (!opacity) return;
      const edgeAngle = visibleHalf * angleStep;
      const angle = rear
        ? Math.sign(slot) * (edgeAngle + rearProgress * (Math.PI - edgeAngle))
        : slot * angleStep;
      const p = project(angle);
      p.scale *= rear ? Math.max(0.5, 0.66 + 0.34 * Math.cos(angle)) : 0.66 + 0.34 * Math.cos(angle);
      if (!rear && p.scale > nearest) { nearest = p.scale; front = index; }
      item.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${p.scale})`;
      labels[index].style.transform = `translateX(${(width / 2 - p.x) / p.scale}px)`;
      item.style.zIndex = String(Math.round(p.scale * (rear ? 50 : 100)));
      item.style.setProperty('--depth-opacity', String(rear ? 1 : 0.78 + 0.22 * Math.cos(angle)));
    });
    items.forEach((item, index) => item.classList.toggle('is-front', index === front));
  }

  function resize() {
    width = viewport.clientWidth;
    height = viewport.clientHeight;
    compact = width <= 640;
    radiusX = width * (compact ? 0.5 : 0.53);
    rise = compact ? 52 : 80;
    depth = 180;
    angleStep = compact ? Math.PI / 4 : Math.PI / 7;
    visibleHalf = Math.min(items.length / 2 + 0.01, compact ? 1.5 : 2.5);
    gallery.style.setProperty('--orbit-icon-size', `${Math.min(compact ? 120 : 200, width / (compact ? 4 : 7))}px`);
    camera.aspect = width / height;
    camera.fov = 2 * Math.atan(height / 1800) * 180 / Math.PI;
    camera.updateProjectionMatrix();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function animate(now) {
    if (lastTime) phase = (phase + Math.min(now - lastTime, 80) / 4200) % items.length;
    lastTime = now;
    render();
    frame = requestAnimationFrame(animate);
  }

  function update() {
    cancelAnimationFrame(frame);
    lastTime = 0;
    gallery.classList.toggle('is-orbit', !browsing);
    gallery.classList.toggle('is-user-paused', paused);
    gallery.classList.toggle('is-paused', paused || browsing || document.hidden || !visible);
    toggle.hidden = false;
    const label = paused ? '自動巡回を再開' : '自動巡回を一時停止';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    if (!browsing) { viewport.scrollLeft = 0; render(); }
    if (!paused && !browsing && !document.hidden && visible) frame = requestAnimationFrame(animate);
  }

  if (context) {
    viewport.prepend(canvas);
    gallery.classList.add('is-orbit');
    toggle.addEventListener('click', () => { paused = !paused; update(); });
    toggle.addEventListener('keydown', event => {
      if (event.key === 'Tab' && !event.shiftKey) { browsing = true; update(); }
    });
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
    // Freeze during a touch/click so a moving icon cannot slip out from under the pointer.
    viewport.addEventListener('pointerdown', () => { cancelAnimationFrame(frame); lastTime = 0; });
    window.addEventListener('pointerup', update);
    window.addEventListener('pointercancel', update);
    document.addEventListener('visibilitychange', update);
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(viewport);
    new ResizeObserver(resize).observe(viewport);
    resize();
    update();
  }
}
