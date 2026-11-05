// 반응형 레이아웃 계층: PC와 모바일이 같은 기능(지면 이동, 편집, 사진, 백업, 인쇄)을 쓰되
// 조작 방식과 배치만 기기에 맞게 바꿉니다. app.js/content.js의 로직은 그대로 재사용합니다.
(function () {
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const mqDesktop = window.matchMedia('(min-width: 1100px)');
  const isMobile = () => mqMobile.matches;

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
    const header = document.querySelector('.top').offsetHeight;
    const target = isMobile() ? $('paper') : document.querySelector('main');
    const y = target.getBoundingClientRect().top + window.scrollY - header - 12;
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
  };

  // 편집 모드에서 모바일 하단 바들이 겹치지 않도록 저장 바 높이를 CSS 변수로 전달
  function syncSavebar() {
    const h = admin ? $('savebar').offsetHeight : 0;
    document.documentElement.style.setProperty('--savebar-h', h + 'px');
  }
  window.addEventListener('resize', syncSavebar);

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
  mqDesktop.addEventListener ? mqDesktop.addEventListener('change', rerender) : mqDesktop.addListener(rerender);

  render();
})();
