/**
 * Reader view controller: renders one open book (paged or reflow), tracks
 * reading position, and manages bookmarks for that book.
 */
(function (global) {
  const els = {};
  let state = null; // current open-book state
  let onExit = null;

  function cacheEls() {
    els.view = document.getElementById('reader-view');
    els.title = document.getElementById('reader-title');
    els.progress = document.getElementById('reader-progress');
    els.backBtn = document.getElementById('back-to-library');
    els.pagedViewer = document.getElementById('paged-viewer');
    els.pagedImage = document.getElementById('paged-image');
    els.reflowViewport = document.getElementById('reflow-viewport');
    els.reflowContent = document.getElementById('reflow-content');
    els.prevBtn = document.getElementById('prev-page');
    els.nextBtn = document.getElementById('next-page');
    els.slider = document.getElementById('progress-slider');
    els.bookmarkBtn = document.getElementById('bookmark-btn');
    els.bookmarksListBtn = document.getElementById('bookmarks-list-btn');
    els.bookmarksMenu = document.getElementById('bookmarks-menu');
    els.settingsBtn = document.getElementById('settings-btn');
    els.settingsMenu = document.getElementById('settings-menu');
    els.fontDec = document.getElementById('font-dec');
    els.fontInc = document.getElementById('font-inc');
  }

  function closeMenus() {
    els.bookmarksMenu.classList.add('hidden');
    els.settingsMenu.classList.add('hidden');
  }

  function applyStoredPrefs() {
    const fontSize = parseInt(localStorage.getItem('grasya-font-size') || '17', 10);
    els.reflowContent.style.fontSize = fontSize + 'px';
    const theme = localStorage.getItem('grasya-theme') || 'light';
    els.view.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    els.view.classList.add('theme-' + theme);
  }

  function setFontSize(delta) {
    const current = parseInt(els.reflowContent.style.fontSize || '17', 10);
    const next = Math.max(13, Math.min(30, current + delta));
    els.reflowContent.style.fontSize = next + 'px';
    localStorage.setItem('grasya-font-size', String(next));
    if (state && state.mode === 'reflow' && state.paginator) {
      state.paginator._remeasure(true);
      renderProgress();
    }
  }

  function setTheme(theme) {
    els.view.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    els.view.classList.add('theme-' + theme);
    localStorage.setItem('grasya-theme', theme);
  }

  async function open(bookId, exitCallback) {
    onExit = exitCallback;
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    overlay.classList.remove('hidden');
    loadingText.textContent = 'Opening your book…';
    try {
      const book = await GrasyaDB.Books.get(bookId);
      if (!book) {
        GrasyaLibrary.showToast('Book not found.');
        return false;
      }
      const file = new File([book.fileBlob], book.filename, { type: book.mimeType });
      const parsed = await GrasyaParsers.parseFile(file, (cur, total) => {
        loadingText.textContent = `Rendering page ${cur}/${total}…`;
      });

      state = {
        book,
        mode: parsed.mode,
        chapters: parsed.chapters || null,
        pages: parsed.pages || null,
        chapterIndex: 0,
        pageIndex: 0,
        paginator: null,
      };

      els.title.textContent = book.title;
      document.getElementById('library-view').classList.add('hidden');
      els.view.classList.remove('hidden');
      applyStoredPrefs();

      if (parsed.mode === 'paged') {
        els.pagedViewer.classList.remove('hidden');
        els.reflowViewport.classList.add('hidden');
        const pos = book.position && book.position.mode === 'paged' ? book.position : null;
        state.pageIndex = pos ? Math.min(pos.pageIndex, parsed.pages.length - 1) : 0;
        renderPagedPage();
      } else {
        els.pagedViewer.classList.add('hidden');
        els.reflowViewport.classList.remove('hidden');
        const pos = book.position && book.position.mode === 'reflow' ? book.position : null;
        state.chapterIndex = pos ? Math.min(pos.chapterIndex, parsed.chapters.length - 1) : 0;
        state.paginator = new GrasyaPaginator(els.reflowViewport, els.reflowContent);
        state.paginator.loadHtml(state.chapters[state.chapterIndex].html);
        if (pos) state.paginator.goToFraction(pos.fraction, true);
      }

      renderProgress();
      await GrasyaDB.Books.update(book.id, { lastOpenedAt: Date.now() });
      return true;
    } catch (err) {
      console.error('Failed to open book', err);
      GrasyaLibrary.showToast('Could not open this book.');
      return false;
    } finally {
      overlay.classList.add('hidden');
    }
  }

  function renderPagedPage() {
    els.pagedImage.src = state.pages[state.pageIndex].dataUrl;
  }

  function renderProgress() {
    if (!state) return;
    if (state.mode === 'paged') {
      const total = state.pages.length;
      els.progress.textContent = `Page ${state.pageIndex + 1} of ${total}`;
      const frac = total > 1 ? state.pageIndex / (total - 1) : 0;
      els.slider.value = Math.round(frac * 1000);
    } else {
      const total = state.chapters.length;
      const chapterFrac = state.paginator.getFraction();
      const overall = (state.chapterIndex + chapterFrac) / total;
      els.progress.textContent =
        total > 1
          ? `Chapter ${state.chapterIndex + 1} of ${total} · page ${
              state.paginator.currentPage + 1
            }/${state.paginator.totalPages}`
          : `Page ${state.paginator.currentPage + 1} of ${state.paginator.totalPages}`;
      els.slider.value = Math.round(overall * 1000);
    }
  }

  function currentPosition() {
    if (state.mode === 'paged') {
      return { mode: 'paged', pageIndex: state.pageIndex, totalPages: state.pages.length };
    }
    return {
      mode: 'reflow',
      chapterIndex: state.chapterIndex,
      fraction: state.paginator.getFraction(),
      totalChapters: state.chapters.length,
    };
  }

  async function savePosition() {
    if (!state) return;
    await GrasyaDB.Books.update(state.book.id, { position: currentPosition() });
  }

  function next() {
    if (!state) return;
    if (state.mode === 'paged') {
      if (state.pageIndex < state.pages.length - 1) {
        state.pageIndex++;
        renderPagedPage();
      } else {
        GrasyaLibrary.showToast('End of book');
        return;
      }
    } else {
      if (!state.paginator.next()) {
        if (state.chapterIndex < state.chapters.length - 1) {
          state.chapterIndex++;
          state.paginator.loadHtml(state.chapters[state.chapterIndex].html);
          state.paginator.goToPage(0, true);
        } else {
          GrasyaLibrary.showToast('End of book');
          return;
        }
      }
    }
    renderProgress();
    savePosition();
  }

  function prev() {
    if (!state) return;
    if (state.mode === 'paged') {
      if (state.pageIndex > 0) {
        state.pageIndex--;
        renderPagedPage();
      } else {
        GrasyaLibrary.showToast('Start of book');
        return;
      }
    } else {
      if (!state.paginator.prev()) {
        if (state.chapterIndex > 0) {
          state.chapterIndex--;
          state.paginator.loadHtml(state.chapters[state.chapterIndex].html);
          state.paginator.goToPage(state.paginator.totalPages - 1, true);
        } else {
          GrasyaLibrary.showToast('Start of book');
          return;
        }
      }
    }
    renderProgress();
    savePosition();
  }

  function seekToFraction(frac) {
    if (!state) return;
    if (state.mode === 'paged') {
      state.pageIndex = Math.round(frac * (state.pages.length - 1));
      renderPagedPage();
    } else {
      const total = state.chapters.length;
      const target = Math.min(total - 1, Math.floor(frac * total));
      const withinChapter = frac * total - target;
      if (target !== state.chapterIndex) {
        state.chapterIndex = target;
        state.paginator.loadHtml(state.chapters[state.chapterIndex].html);
      }
      state.paginator.goToFraction(withinChapter, true);
    }
    renderProgress();
    savePosition();
  }

  async function renderBookmarksMenu() {
    const marks = await GrasyaDB.Bookmarks.forBook(state.book.id);
    if (!marks.length) {
      els.bookmarksMenu.innerHTML = '<div class="bookmark-empty">No bookmarks yet. Tap 🔖 to add one here.</div>';
      return;
    }
    els.bookmarksMenu.innerHTML = marks
      .map(
        (m) => `
      <div class="bookmark-item" data-bm="${m.id}">
        <button class="bookmark-jump" data-jump="${m.id}">${escapeHtml(m.label)}</button>
        <button class="bookmark-del" data-del="${m.id}" title="Delete">✕</button>
      </div>`
      )
      .join('');
    els.bookmarksMenu.querySelectorAll('[data-jump]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mark = marks.find((m) => m.id === btn.getAttribute('data-jump'));
        if (mark) jumpToPosition(mark.position);
        closeMenus();
      });
    });
    els.bookmarksMenu.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await GrasyaDB.Bookmarks.remove(btn.getAttribute('data-del'));
        renderBookmarksMenu();
      });
    });
  }

  function jumpToPosition(pos) {
    if (state.mode === 'paged' && pos.mode === 'paged') {
      state.pageIndex = Math.min(pos.pageIndex, state.pages.length - 1);
      renderPagedPage();
    } else if (state.mode === 'reflow' && pos.mode === 'reflow') {
      state.chapterIndex = Math.min(pos.chapterIndex, state.chapters.length - 1);
      state.paginator.loadHtml(state.chapters[state.chapterIndex].html);
      state.paginator.goToFraction(pos.fraction, true);
    }
    renderProgress();
    savePosition();
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function addBookmarkHere() {
    if (!state) return;
    let label;
    if (state.mode === 'paged') {
      label = `Page ${state.pageIndex + 1}`;
    } else {
      label = `Chapter ${state.chapterIndex + 1}, page ${state.paginator.currentPage + 1}`;
    }
    const custom = prompt('Label this bookmark (optional):', label);
    if (custom === null) return; // cancelled
    await GrasyaDB.Bookmarks.add({
      id: 'bm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      bookId: state.book.id,
      label: custom.trim() || label,
      position: currentPosition(),
      createdAt: Date.now(),
    });
    GrasyaLibrary.showToast('Bookmark added');
  }

  function close() {
    if (state && state.paginator) state.paginator.destroy();
    savePosition().finally(() => {
      state = null;
      els.view.classList.add('hidden');
      document.getElementById('library-view').classList.remove('hidden');
      if (onExit) onExit();
    });
  }

  function init() {
    cacheEls();

    els.backBtn.addEventListener('click', close);
    els.nextBtn.addEventListener('click', next);
    els.prevBtn.addEventListener('click', prev);

    els.slider.addEventListener('input', () => {
      seekToFraction(els.slider.value / 1000);
    });

    els.bookmarkBtn.addEventListener('click', addBookmarkHere);
    els.bookmarksListBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const willOpen = els.bookmarksMenu.classList.contains('hidden');
      closeMenus();
      if (willOpen) {
        await renderBookmarksMenu();
        els.bookmarksMenu.classList.remove('hidden');
      }
    });
    els.settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = els.settingsMenu.classList.contains('hidden');
      closeMenus();
      if (willOpen) els.settingsMenu.classList.remove('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-wrap')) closeMenus();
    });

    els.fontDec.addEventListener('click', () => setFontSize(-1));
    els.fontInc.addEventListener('click', () => setFontSize(1));
    document.querySelectorAll('.theme-swatch').forEach((btn) => {
      btn.addEventListener('click', () => setTheme(btn.getAttribute('data-theme')));
    });

    document.addEventListener('keydown', (e) => {
      if (els.view.classList.contains('hidden')) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') close();
    });

    let touchStartX = null;
    const body = document.getElementById('reader-body');
    body.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
    });
    body.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) next();
        else prev();
      }
      touchStartX = null;
    });

    window.addEventListener('beforeunload', () => {
      if (state) savePosition();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state) savePosition();
    });
  }

  global.GrasyaReader = { init, open, close };
})(window);
