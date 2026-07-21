/**
 * Library view: upload handling, book shelf rendering, delete.
 */
(function (global) {
  const PALETTE = [
    ['#a8461f', '#5c3a21'],
    ['#2f5d50', '#1b3b34'],
    ['#3b4a6b', '#22283f'],
    ['#7a4b8a', '#3f2650'],
    ['#b08900', '#5c4600'],
    ['#1f6f78', '#123c42'],
    ['#8a2f3a', '#4a1a20'],
  ];

  function coverColors(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
  }

  function progressFraction(book) {
    const pos = book.position;
    if (!pos) return 0;
    if (pos.mode === 'paged') {
      return pos.totalPages > 1 ? pos.pageIndex / (pos.totalPages - 1) : 0;
    }
    if (pos.mode === 'reflow') {
      const total = Math.max(1, pos.totalChapters);
      return Math.min(1, (pos.chapterIndex + pos.fraction) / total);
    }
    return 0;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function saveParsedAsBook(file, parsed, extra) {
    const [c1, c2] = coverColors(parsed.title || file.name);
    const id = 'bk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const now = Date.now();
    const position =
      parsed.mode === 'paged'
        ? { mode: 'paged', pageIndex: 0, totalPages: parsed.pages.length }
        : { mode: 'reflow', chapterIndex: 0, fraction: 0, totalChapters: parsed.chapters.length };
    const book = Object.assign(
      {
        id,
        title: parsed.title || GrasyaParsers.stripExt(file.name),
        filename: file.name,
        ext: GrasyaParsers.getExt(file.name),
        mimeType: file.type,
        addedAt: now,
        lastOpenedAt: 0,
        c1,
        c2,
        fileBlob: file,
        position,
      },
      extra || {}
    );
    await GrasyaDB.Books.add(book);
    return book;
  }

  async function handleFiles(fileList, onOpen) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    overlay.classList.remove('hidden');
    try {
      for (const file of files) {
        loadingText.textContent = `Reading "${file.name}"…`;
        try {
          const parsed = await GrasyaParsers.parseFile(file, (cur, total) => {
            loadingText.textContent = `Rendering "${file.name}" (${cur}/${total})…`;
          });
          await saveParsedAsBook(file, parsed);
        } catch (err) {
          console.error('Failed to import', file.name, err);
          showToast(`Couldn't import "${file.name}"`);
        }
      }
    } finally {
      overlay.classList.add('hidden');
      loadingText.textContent = 'Preparing your book…';
    }
    await renderLibrary(onOpen);
  }

  function escapeHtmlAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function handleUrlImport(rawUrl, onOpen) {
    if (!rawUrl || !rawUrl.trim()) return;
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    overlay.classList.remove('hidden');
    loadingText.textContent = 'Fetching that link…';
    try {
      const parsed = await GrasyaParsers.parseUrl(rawUrl);
      const wrapperHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtmlAttr(
        parsed.title
      )}</title></head><body>${parsed.chapters[0].html}</body></html>`;
      const safeName = (parsed.title || 'Article').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'Article';
      const file = new File([wrapperHtml], safeName + '.html', { type: 'text/html' });
      await saveParsedAsBook(file, parsed, { sourceUrl: parsed.sourceUrl });
      showToast('Article added to your shelf');
      await renderLibrary(onOpen);
    } catch (err) {
      console.error('Failed to import URL', rawUrl, err);
      showToast('Could not read that link. The site may block automated reading.');
    } finally {
      overlay.classList.add('hidden');
      loadingText.textContent = 'Preparing your book…';
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add('hidden'), 2600);
  }

  function bookCardHtml(book, continueStyle) {
    const pct = Math.round(progressFraction(book) * 100);
    const initials = escapeHtml((book.title || '?').slice(0, 2).toUpperCase());
    if (continueStyle) {
      return `
        <div class="book-card continue-card" data-id="${book.id}" style="--c1:${book.c1};--c2:${book.c2};--spine:${book.c1}">
          <div class="book-cover">${initials}</div>
          <div class="book-body">
            <strong>${escapeHtml(book.title)}</strong>
            <span style="font-size:0.75rem;color:var(--ink-soft)">${pct}% read</span>
          </div>
        </div>`;
    }
    return `
      <div class="book-card" data-id="${book.id}" style="--c1:${book.c1};--c2:${book.c2};--spine:${book.c1}">
        <button class="book-delete" data-del="${book.id}" title="Remove">✕</button>
        <div class="book-cover">${escapeHtml(book.title)}</div>
        <div class="book-progress-bar"><div style="width:${pct}%"></div></div>
        <div class="book-meta"><span>${(book.ext || 'file').toUpperCase()}</span><span>${pct}%</span></div>
      </div>`;
  }

  async function renderLibrary(onOpen) {
    const books = await GrasyaDB.Books.all();
    books.sort((a, b) => b.addedAt - a.addedAt);

    const shelf = document.getElementById('library-shelf');
    const emptyMsg = document.getElementById('library-empty');
    shelf.innerHTML = books.map((b) => bookCardHtml(b, false)).join('');
    emptyMsg.classList.toggle('hidden', books.length > 0);

    const continueWrap = document.getElementById('continue-reading-wrap');
    const continueShelf = document.getElementById('continue-reading');
    const recent = books
      .filter((b) => b.lastOpenedAt)
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
      .slice(0, 4);
    continueWrap.classList.toggle('hidden', recent.length === 0);
    continueShelf.innerHTML = recent.map((b) => bookCardHtml(b, true)).join('');

    shelf.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-del');
        if (!confirm('Remove this book and its bookmarks?')) return;
        await GrasyaDB.Books.remove(id);
        renderLibrary(onOpen);
      });
    });

    [shelf, continueShelf].forEach((el) => {
      el.querySelectorAll('.book-card').forEach((card) => {
        card.addEventListener('click', () => onOpen(card.getAttribute('data-id')));
      });
    });
  }

  global.GrasyaLibrary = { renderLibrary, handleFiles, handleUrlImport, showToast, progressFraction };
})(window);
