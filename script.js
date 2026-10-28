(() => {
  const frameCount = 208;
  const framePath = (index) => `public/frames/ezgif-frame-${String(index).padStart(3, '0')}.jpg`;
  const background = document.getElementById('cinematic');
  const canvas = document.getElementById('frame-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loading = document.getElementById('loading');
  const progressLine = document.getElementById('progress-line');
  const hint = document.getElementById('sequence-hint');
  const header = document.getElementById('site-header');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frames = new Array(frameCount);
  let currentFrame = -1;
  let readyCount = 0;
  let renderQueued = false;
  let lastProgress = 0;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(currentFrame < 0 ? 0 : currentFrame);
  }

  function drawFrame(index) {
    index = Math.max(0, Math.min(frameCount - 1, index));
    const image = frames[index];
    if (!image || !image.complete || !image.naturalWidth) return;
    currentFrame = index;
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (!width || !height) return;
    // Cover the viewport without distorting the supplied frame composition.
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.fillStyle = '#08070a';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  }

  function renderForScroll() {
    renderQueued = false;
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const travelled = Math.min(scrollable, Math.max(0, window.scrollY));
    const progress = reducedMotion ? 0 : travelled / scrollable;
    const frameIndex = Math.round(progress * (frameCount - 1));
    if (frameIndex !== currentFrame) {
      if (frames[frameIndex]?.complete) drawFrame(frameIndex);
      else {
        // If the exact frame is not ready, use the nearest loaded frame to avoid a blank canvas.
        for (let distance = 1; distance < frameCount; distance++) {
          const before = frameIndex - distance;
          const after = frameIndex + distance;
          if (before >= 0 && frames[before]?.complete) { drawFrame(before); break; }
          if (after < frameCount && frames[after]?.complete) { drawFrame(after); break; }
        }
      }
    }
    progressLine.style.width = `${progress * 100}%`;
    hint.style.opacity = progress > .92 ? '0' : '1';
    lastProgress = progress;
    header.classList.toggle('visible', window.scrollY > window.innerHeight * .55);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(renderForScroll);
  }

  // Load frames progressively, with the first frame prioritised for immediate display.
  function loadFrame(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try { if (img.decode) await img.decode(); } catch (_) {}
        frames[index] = img;
        readyCount++;
        if (index === 0 || currentFrame < 0) drawFrame(index);
        if (readyCount === frameCount) loading.classList.add('hidden');
        resolve();
      };
      img.onerror = () => { readyCount++; if (readyCount === frameCount) loading.classList.add('hidden'); resolve(); };
      img.src = framePath(index + 1);
    });
  }

  async function initFrames() {
    await loadFrame(0);
    loading.classList.add('hidden');
    resizeCanvas();
    // Small batches keep decoding from blocking the opening experience.
    const batchSize = 12;
    for (let start = 1; start < frameCount; start += batchSize) {
      const batch = [];
      for (let i = start; i < Math.min(frameCount, start + batchSize); i++) batch.push(loadFrame(i));
      await Promise.all(batch);
      if (lastProgress > 0) scheduleRender();
    }
  }

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', () => { resizeCanvas(); scheduleRender(); }, { passive: true });
  if (reducedMotion) background.classList.add('reduced-motion');
  resizeCanvas();
  initFrames();
  scheduleRender();

  // Reveal content only when it enters the viewport.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  // Mobile navigation.
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('nav');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));

  // Highlight the active section in the navigation.
  const navLinks = [...nav.querySelectorAll('a[href^="#"]')];
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-35% 0px -55% 0px' });
  ['about', 'skills', 'projects', 'experience', 'contact'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) sectionObserver.observe(el);
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
