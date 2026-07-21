/**
 * Turns an uploaded File into a common in-memory book representation:
 *   { mode: 'reflow', title, chapters: [{ title, html }] }
 *   { mode: 'paged',  title, pages: [{ dataUrl }] }
 * 'reflow' content gets paginated live by paginator.js (like a real book
 * reflowing text). 'paged' content (PDF pages, images) is already a fixed
 * page and is shown as-is.
 */
(function (global) {
  function getExt(filename) {
    const m = /\.([a-z0-9]+)$/i.exec(filename || '');
    return m ? m[1].toLowerCase() : '';
  }

  function stripExt(filename) {
    return (filename || 'Untitled').replace(/\.[a-z0-9]+$/i, '');
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizePath(path) {
    const parts = path.split('/');
    const out = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    return out.join('/');
  }

  function resolvePath(base, rel) {
    if (/^https?:\/\//i.test(rel)) return rel;
    if (!base) return normalizePath(rel);
    return normalizePath(base + '/' + rel);
  }

  // Sanitizes untrusted HTML pulled from uploaded files/pages before it is
  // ever inserted into the live DOM. DOMPurify is the primary path; if the
  // CDN didn't load (offline, blocked, ad-blocker) we fall back to a manual
  // strip of scripts/embeds/event-handlers rather than ever passing raw HTML
  // through unsanitized.
  function sanitizeHtml(html, opts) {
    if (global.DOMPurify && typeof global.DOMPurify.sanitize === 'function') {
      return global.DOMPurify.sanitize(html, opts);
    }
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((el) => el.remove());
    div.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();
        if (name.startsWith('on') || /^\s*javascript:/i.test(value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return div.innerHTML;
  }

  async function parseText(file, title) {
    const text = await file.text();
    const paragraphs = text
      .split(/\r?\n\s*\r?\n/)
      .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`)
      .join('\n');
    return {
      mode: 'reflow',
      title,
      chapters: [{ title: 'Text', html: paragraphs || '<p><em>(empty file)</em></p>' }],
    };
  }

  async function parseMarkdown(file, title) {
    const text = await file.text();
    const rawHtml = global.marked ? global.marked.parse(text) : `<pre>${escapeHtml(text)}</pre>`;
    const clean = sanitizeHtml(rawHtml);
    return { mode: 'reflow', title, chapters: [{ title: 'Content', html: clean }] };
  }

  async function parseHtmlFile(file, title) {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const docTitle = doc.querySelector('title')?.textContent?.trim();
    const body = doc.body;
    const clean = sanitizeHtml(body ? body.innerHTML : text);
    return {
      mode: 'reflow',
      title: docTitle || title,
      chapters: [{ title: 'Content', html: clean }],
    };
  }

  async function parseDocx(file, title) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await global.mammoth.convertToHtml({ arrayBuffer });
    const clean = sanitizeHtml(result.value);
    return { mode: 'reflow', title, chapters: [{ title: 'Content', html: clean }] };
  }

  async function parseImage(file, title) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { mode: 'paged', title, pages: [{ dataUrl }] };
  }

  async function parsePdf(file, title, onProgress) {
    if (!global.pdfjsLib) throw new Error('pdf.js not available');
    global.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await global.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.85) });
      if (onProgress) onProgress(i, pdf.numPages);
      canvas.width = 0;
      canvas.height = 0;
    }
    return { mode: 'paged', title, pages };
  }

  async function parseEpub(file, title) {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await global.JSZip.loadAsync(arrayBuffer);

    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) throw new Error('Invalid EPUB: missing container.xml');
    const containerXml = await containerFile.async('string');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const rootfilePath = containerDoc.querySelector('rootfile').getAttribute('full-path');
    const opfDir = rootfilePath.includes('/')
      ? rootfilePath.slice(0, rootfilePath.lastIndexOf('/'))
      : '';

    const opfFile = zip.file(rootfilePath);
    const opfText = await opfFile.async('string');
    const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml');

    const manifestItems = {};
    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
      manifestItems[item.getAttribute('id')] = {
        href: item.getAttribute('href'),
        mediaType: item.getAttribute('media-type'),
      };
    });

    const spineIdrefs = Array.from(opfDoc.querySelectorAll('spine > itemref')).map((el) =>
      el.getAttribute('idref')
    );

    const dcTitleEl = opfDoc.getElementsByTagName('dc:title')[0];
    const bookTitle = dcTitleEl?.textContent?.trim() || title;

    const imageUrlCache = {};
    async function blobUrlForPath(path) {
      if (imageUrlCache[path]) return imageUrlCache[path];
      const entry = zip.file(path);
      if (!entry) return null;
      const blob = await entry.async('blob');
      const url = URL.createObjectURL(blob);
      imageUrlCache[path] = url;
      return url;
    }

    const chapters = [];
    for (const idref of spineIdrefs) {
      const item = manifestItems[idref];
      if (!item) continue;
      const path = resolvePath(opfDir, item.href);
      const entry = zip.file(path);
      if (!entry) continue;
      const xhtml = await entry.async('string');

      let doc = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
      if (doc.querySelector('parsererror')) {
        doc = new DOMParser().parseFromString(xhtml, 'text/html');
      }
      const bodyEl = doc.querySelector('body');
      if (!bodyEl) continue;

      const chapterDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const mediaEls = bodyEl.querySelectorAll('img, image');
      for (const el of mediaEls) {
        const srcAttr =
          el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('xlink:href');
        if (!srcAttr) continue;
        const imgPath = resolvePath(chapterDir, srcAttr);
        const url = await blobUrlForPath(imgPath);
        if (url) {
          if (el.hasAttribute('src')) el.setAttribute('src', url);
          if (el.hasAttribute('href')) el.setAttribute('href', url);
          if (el.hasAttribute('xlink:href')) el.setAttribute('xlink:href', url);
        }
      }

      const clean = sanitizeHtml(bodyEl.innerHTML, {
        ADD_TAGS: ['svg', 'image'],
        ADD_ATTR: ['xlink:href'],
      });

      const heading = bodyEl.querySelector('h1, h2, h3');
      const chapTitle = heading ? heading.textContent.trim() : `Chapter ${chapters.length + 1}`;
      chapters.push({ title: chapTitle, html: clean });
    }

    return {
      mode: 'reflow',
      title: bookTitle,
      chapters: chapters.length
        ? chapters
        : [{ title: 'Content', html: '<p><em>No readable content found in this EPUB.</em></p>' }],
    };
  }

  async function parseUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url) throw new Error('No URL provided');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let host;
    try {
      host = new URL(url).hostname;
    } catch (e) {
      throw new Error('That does not look like a valid URL');
    }

    // No backend of our own, so we lean on a public "reader" endpoint that
    // fetches the page server-side and hands back clean, boilerplate-free
    // article text (title + body), which sidesteps both CORS and the mess
    // of nav bars / ads / scripts on the original page.
    const res = await fetch('https://r.jina.ai/' + url);
    if (!res.ok) throw new Error('Could not fetch that page (status ' + res.status + ')');
    const raw = await res.text();

    let title = host;
    let body = raw;
    const titleMatch = /^Title:\s*(.+)$/m.exec(raw);
    if (titleMatch) title = titleMatch[1].trim();
    const markerIdx = raw.indexOf('Markdown Content:');
    if (markerIdx !== -1) {
      body = raw.slice(markerIdx + 'Markdown Content:'.length).trim();
    }
    if (!body.trim()) throw new Error('No readable content found at that link');

    const rawHtml = global.marked ? global.marked.parse(body) : `<pre>${escapeHtml(body)}</pre>`;
    const clean = sanitizeHtml(rawHtml);
    return {
      mode: 'reflow',
      title,
      chapters: [{ title: 'Article', html: clean }],
      sourceUrl: url,
    };
  }

  async function parseFallback(file, title, err) {
    console.warn('Falling back for', file.name, err);
    return {
      mode: 'reflow',
      title,
      chapters: [
        {
          title: 'Notice',
          html: `<p><em>This file type could not be fully read (${escapeHtml(
            getExt(file.name) || 'unknown'
          )}). Showing what we could recover.</em></p>`,
        },
      ],
    };
  }

  async function parseFile(file, onProgress) {
    const ext = getExt(file.name);
    const title = stripExt(file.name);
    try {
      if (ext === 'pdf') return await parsePdf(file, title, onProgress);
      if (ext === 'epub') return await parseEpub(file, title);
      if (ext === 'docx') return await parseDocx(file, title);
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
        return await parseImage(file, title);
      }
      if (['md', 'markdown'].includes(ext)) return await parseMarkdown(file, title);
      if (['html', 'htm'].includes(ext)) return await parseHtmlFile(file, title);
      return await parseText(file, title);
    } catch (err) {
      try {
        return await parseFallback(file, title, err);
      } catch (err2) {
        throw err2;
      }
    }
  }

  global.GrasyaParsers = { parseFile, parseUrl, getExt, stripExt };
})(window);
