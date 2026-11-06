// 반응형 레이아웃 계층
// - PC·태블릿(≥768px): 한 면을 A3 용지 한 장으로 보여 주고, 화면 그대로 A3로 인쇄합니다.
// - 모바일(≤767px): 같은 기능을 앱형 화면(하단 이동 바, 목차 시트, 스와이프)으로 제공합니다.
// app.js/content.js의 로직은 그대로 재사용합니다.
(function () {
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const isMobile = () => mqMobile.matches;
  const PX_PER_MM = 96 / 25.4;
  const SHEET_W = 297 * PX_PER_MM;

  // A3 화면 배율: 창이 A3 폭보다 좁을 때만 축소(인쇄는 CSS에서 항상 100%)
  function sheetZoom() {
    const avail = document.querySelector('main').clientWidth - 40;
    const z = isMobile() ? 1 : Math.min(1, avail / SHEET_W);
    document.documentElement.style.setProperty('--sheet-zoom', z.toFixed(4));
  }

  // A3 한 장에 내용이 꼭 맞도록 본문 글자 크기(--fs)를 이분 탐색으로 조절
  const FS_MIN = 7.5, FS_MAX = 13;
  let warned = false;
  function fitSheet() {
    const p = $('paper');
    if (isMobile() && !printing) { p.style.removeProperty('--fs'); p.classList.remove('overflow'); return; }
    const fits = fs => { p.style.setProperty('--fs', fs + 'px'); return p.scrollHeight <= p.clientHeight + 1; };
    let lo = FS_MIN, hi = FS_MAX;
    if (fits(hi)) return p.classList.remove('overflow');
    if (!fits(lo)) {
      p.classList.add('overflow');
      if (admin && !warned) { warned = true; toast('내용이 A3 한 장을 넘칩니다. 글을 조금 줄여 주세요.'); }
      return;
    }
    p.classList.remove('overflow'); warned = false;
    for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    fits(Math.floor(lo * 20) / 20);
  }
  function layoutSheet() { sheetZoom(); fitSheet(); }

  // 인쇄 직전: 100% 배율로 다시 맞춘 뒤 인쇄, 끝나면 화면 배율 복원
  let printing = false;
  window.addEventListener('beforeprint', () => { printing = true; document.documentElement.style.setProperty('--sheet-zoom', '1'); fitSheet(); });
  window.addEventListener('afterprint', () => { printing = false; layoutSheet(); });

  // 편집 중 글이 늘거나 사진·글꼴이 늦게 로드되면 다시 맞춤
  let fitTimer;
  const refit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(layoutSheet, 120); };
  $('paper').addEventListener('input', refit);
  $('paper').addEventListener('load', refit, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);

  // 모바일 지면 목차(바텀 시트) — data-page 속성이 있어 render()가 이동 핸들러를 연결합니다.
  $('pagelist').innerHTML = sections.map((s, i) =>
    `<button data-page="${i}"><span class="pl-num">${String(i + 1).padStart(2, '0')}</span><span class="pl-name">${s}</span><span class="pl-go" aria-hidden="true">›</span></button>`
  ).join('');
  $('pagelist').addEventListener('click', e => { if (e.target.closest('[data-page]')) $('pages').close(); });
  $('mPages').onclick = () => $('pages').showModal();
  $('closepages').onclick = () => $('pages').close();
  $('mPrev').onclick = () => go(Math.max(0, page - 1));
  $('mNext').onclick = () => go(Math.min(TOTAL - 1, page + 1));

  // 바텀 시트/대화상자 바깥(배경) 탭으로 닫기
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }));

  // 면 이동 후 스크롤 위치: 지면 상단(고정 헤더 높이만큼 보정)
  go = function (n) {
    page = n;
    render();
    if (!isMobile()) { $('nav').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const header = document.querySelector('.top').offsetHeight;
    const y = $('paper').getBoundingClientRect().top + window.scrollY - header - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  };

  // render 이후 기기별 UI 동기화
  const prevRender = render;
  render = function () {
    prevRender();
    document.body.classList.toggle('is-admin', admin);
    $('mCount').textContent = `${page + 1} / ${TOTAL}면`;
    $('mSection').textContent = sections[page];
    $('mPrev').disabled = page === 0;
    $('mNext').disabled = page === TOTAL - 1;
    document.querySelectorAll('#pagelist [data-page]').forEach(b => {
      const on = +b.dataset.page === page;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const active = $('nav').querySelector('.active');
    if (active) {
      active.setAttribute('aria-current', 'page');
      // 태블릿/모바일 가로 스크롤 칩: 현재 면을 가운데로
      const nav = $('nav');
      if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
    }
    syncSavebar();
    layoutSheet();
  };

  // 편집 모드에서 모바일 하단 바들이 겹치지 않도록 저장 바 높이를 CSS 변수로 전달
  function syncSavebar() {
    const h = admin ? $('savebar').offsetHeight : 0;
    document.documentElement.style.setProperty('--savebar-h', h + 'px');
  }
  window.addEventListener('resize', () => { syncSavebar(); refit(); });

  // PC: 키보드 좌우 화살표로 면 넘기기
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const t = e.target;
    if (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    go(e.key === 'ArrowLeft' ? Math.max(0, page - 1) : Math.min(TOTAL - 1, page + 1));
  });

  // 모바일/터치: 지면을 좌우로 밀어 면 넘기기 (편집 중인 글자 위에서는 동작하지 않음)
  let sx = 0, sy = 0, st = 0, tracking = false;
  const paper = $('paper');
  paper.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('[contenteditable="true"], button')) { tracking = false; return; }
    tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
  }, { passive: true });
  paper.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Date.now() - st > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    if (window.getSelection && String(window.getSelection())) return;
    if (dx < 0 && page < TOTAL - 1) go(page + 1);
    else if (dx > 0 && page > 0) go(page - 1);
  }, { passive: true });

  // 모바일 첫 방문 안내 (한 번만)
  if (isMobile()) {
    let seen = false;
    try { seen = localStorage.getItem('dangha2026-swipe-hint') === '1'; } catch {}
    if (!seen) {
      setTimeout(() => toast('지면을 좌우로 밀거나 아래 버튼으로 면을 넘겨 보세요.'), 900);
      try { localStorage.setItem('dangha2026-swipe-hint', '1'); } catch {}
    }
  }

  // 화면 크기가 바뀌면(회전 등) 다시 그려 칩 위치·바 높이 갱신
  const rerender = () => render();
  mqMobile.addEventListener ? mqMobile.addEventListener('change', rerender) : mqMobile.addListener(rerender);

  render();
})();
