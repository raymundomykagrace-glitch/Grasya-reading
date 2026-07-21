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

    // Multi-chapter imports (e.g. a Wattpad story) embed their full chapter
    // list as JSON so reopening the saved file restores every chapter,
    // rather than re-deriving just one chapter's worth of content from the
    // visible HTML body.
    const chaptersScript = doc.getElementById('grasya-chapters');
    if (chaptersScript) {
      try {
        const chapters = JSON.parse(chaptersScript.textContent);
        if (Array.isArray(chapters) && chapters.length) {
          return { mode: 'reflow', title: docTitle || title, chapters };
        }
      } catch (e) {
        // fall through to treating it as a plain HTML file
      }
    }

    const body = doc.body;
    const clean = sanitizeHtml(body ? body.innerHTML : text);
    return {
      mode: 'reflow',
      title: docTitle || title,
      chapters: [{ title: 'Content', html: clean }],
    };
  }

  // Bundles a full parsed book (possibly many chapters) into a single .html
  // File so it can be persisted through GrasyaDB the same way an uploaded
  // file is, and re-parsed losslessly by parseHtmlFile above on reopen.
  function wrapChaptersAsFile(title, chapters) {
    const safeName = (title || 'Article').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'Article';
    const preview = chapters
      .map((c) => `<section>${c.html}</section>`)
      .join('\n');
    const payload = JSON.stringify(chapters).replace(/</g, '\\u003c');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
      title || safeName
    )}</title></head><body>${preview}<script type="application/json" id="grasya-chapters">${payload}</script></body></html>`;
    return new File([html], safeName + '.html', { type: 'text/html' });
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

  function normalizeUrl(rawUrl) {
    let url = (rawUrl || '').trim();
    if (!url) throw new Error('No URL provided');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      new URL(url); // throws if invalid
    } catch (e) {
      throw new Error('That does not look like a valid URL');
    }
    return url;
  }

  // No backend of our own, so we lean on a public "reader" endpoint that
  // fetches the page server-side and hands back clean, boilerplate-free
  // text (title + body), which sidesteps both CORS and the mess of nav
  // bars / ads / scripts on the original page.
  async function fetchReadable(url) {
    const res = await fetch('https://r.jina.ai/' + url);
    if (!res.ok) throw new Error('Could not fetch that page (status ' + res.status + ')');
    const raw = await res.text();
    let title = new URL(url).hostname;
    let body = raw;
    const titleMatch = /^Title:\s*(.+)$/m.exec(raw);
    if (titleMatch) title = titleMatch[1].trim();
    const markerIdx = raw.indexOf('Markdown Content:');
    if (markerIdx !== -1) body = raw.slice(markerIdx + 'Markdown Content:'.length).trim();
    return { title, body };
  }

  function markdownToChapterHtml(body) {
    const rawHtml = global.marked ? global.marked.parse(body) : `<pre>${escapeHtml(body)}</pre>`;
    return sanitizeHtml(rawHtml);
  }

  function isWattpadUrl(url) {
    try {
      return /(^|\.)wattpad\.com$/i.test(new URL(url).hostname);
    } catch (e) {
      return false;
    }
  }

  // Wattpad story/table-of-contents pages list every chapter as a link to
  // /<numericId>-<slug>, distinct from the story page itself (/story/<id>-...).
  // Reader-extracted markdown keeps links, so we can recover the chapter
  // order directly from the text instead of needing Wattpad's own API.
  function extractWattpadChapterLinks(markdown) {
    const re = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?wattpad\.com\/(\d+)[^\s)]*)\)/g;
    const seen = new Set();
    const out = [];
    let m;
    while ((m = re.exec(markdown))) {
      const id = m[3];
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ label: m[1].trim(), url: m[2] });
    }
    return out;
  }

  const WATTPAD_MAX_CHAPTERS = 400;

  async function parseWattpadStory(url, onProgress) {
    const first = await fetchReadable(url);
    let links = extractWattpadChapterLinks(first.body);
    let storyTitle = first.title;

    // If the pasted link is a single chapter rather than the story's table
    // of contents, look for a link back to the story page and follow it to
    // recover the full chapter list.
    if (links.length < 2) {
      const tocMatch = /(https?:\/\/(?:www\.)?wattpad\.com\/story\/\d+[^\s)]*)/i.exec(first.body);
      if (tocMatch) {
        try {
          const toc = await fetchReadable(tocMatch[1]);
          const tocLinks = extractWattpadChapterLinks(toc.body);
          if (tocLinks.length > links.length) {
            links = tocLinks;
            storyTitle = toc.title;
          }
        } catch (e) {
          // fall through and use whatever we already have
        }
      }
    }

    if (!links.length) {
      // Couldn't find a chapter list at all — import the single page as-is
      // rather than fail outright.
      return {
        mode: 'reflow',
        title: first.title,
        chapters: [{ title: 'Chapter', html: markdownToChapterHtml(first.body) }],
        sourceUrl: url,
      };
    }

    const capped = links.slice(0, WATTPAD_MAX_CHAPTERS);
    const chapters = [];
    for (let i = 0; i < capped.length; i++) {
      if (onProgress) onProgress(i + 1, capped.length);
      try {
        const part = await fetchReadable(capped[i].url);
        chapters.push({
          title: capped[i].label || part.title || `Chapter ${i + 1}`,
          html: markdownToChapterHtml(part.body),
        });
      } catch (err) {
        chapters.push({
          title: capped[i].label || `Chapter ${i + 1}`,
          html: '<p><em>This chapter could not be loaded.</em></p>',
        });
      }
      // Be a polite, sequential neighbor to the shared reader service rather
      // than firing dozens of requests at once.
      await new Promise((r) => setTimeout(r, 200));
    }

    return { mode: 'reflow', title: storyTitle, chapters, sourceUrl: url };
  }

  async function parseUrl(rawUrl, onProgress) {
    const url = normalizeUrl(rawUrl);
    if (isWattpadUrl(url)) {
      return parseWattpadStory(url, onProgress);
    }
    const { title, body } = await fetchReadable(url);
    if (!body.trim()) throw new Error('No readable content found at that link');
    return {
      mode: 'reflow',
      title,
      chapters: [{ title: 'Article', html: markdownToChapterHtml(body) }],
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

  global.GrasyaParsers = { parseFile, parseUrl, wrapChaptersAsFile, getExt, stripExt };
})(window);
