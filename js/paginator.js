/**
 * Paginates arbitrary reflowable HTML into fixed, book-like pages using the
 * CSS multi-column trick: fixing the container's height forces overflow
 * content into additional columns that extend sideways instead of
 * vertically, so each "column" becomes one page we can slide to.
 */
(function (global) {
  class Paginator {
    constructor(viewportEl, contentEl) {
      this.viewportEl = viewportEl;
      this.contentEl = contentEl;
      this.currentPage = 0;
      this.totalPages = 1;
      this.slot = 1;
      this._resizeHandler = this._debounce(() => this._remeasure(true), 150);
      window.addEventListener('resize', this._resizeHandler);
    }

    _debounce(fn, ms) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    }

    loadHtml(html) {
      this.contentEl.style.transition = 'none';
      this.contentEl.innerHTML = html;
      this.currentPage = 0;
      this._remeasure(false);
      // restore transition on next frame so the initial layout doesn't animate
      requestAnimationFrame(() => {
        this.contentEl.style.transition = '';
      });
    }

    _remeasure(preserveFraction) {
      const prevFraction = preserveFraction ? this.getFraction() : 0;
      const rect = this.viewportEl.getBoundingClientRect();
      const pageWidth = Math.max(1, Math.floor(rect.width));
      const pageHeight = Math.max(1, Math.floor(rect.height));
      this.contentEl.style.columnWidth = pageWidth + 'px';
      this.contentEl.style.height = pageHeight + 'px';
      const gap = parseFloat(getComputedStyle(this.contentEl).columnGap) || 0;
      this.pageWidth = pageWidth;
      this.gap = gap;
      this.slot = pageWidth + gap;
      const scrollWidth = this.contentEl.scrollWidth;
      this.totalPages = Math.max(1, Math.round((scrollWidth + gap) / this.slot));
      if (preserveFraction) {
        this.goToFraction(prevFraction, true);
      } else {
        this._applyTransform(true);
      }
    }

    _applyTransform(instant) {
      if (instant) {
        const prevTransition = this.contentEl.style.transition;
        this.contentEl.style.transition = 'none';
        this.contentEl.style.transform = `translateX(-${this.currentPage * this.slot}px)`;
        // force reflow then restore transition
        void this.contentEl.offsetHeight;
        this.contentEl.style.transition = prevTransition;
      } else {
        this.contentEl.style.transform = `translateX(-${this.currentPage * this.slot}px)`;
      }
    }

    goToPage(n, instant) {
      this.currentPage = Math.max(0, Math.min(n, this.totalPages - 1));
      this._applyTransform(instant);
    }

    goToFraction(fraction, instant) {
      const target = Math.round(fraction * (this.totalPages - 1));
      this.goToPage(target, instant);
    }

    getFraction() {
      if (this.totalPages <= 1) return 0;
      return this.currentPage / (this.totalPages - 1);
    }

    next() {
      if (this.currentPage >= this.totalPages - 1) return false;
      this.goToPage(this.currentPage + 1);
      return true;
    }

    prev() {
      if (this.currentPage <= 0) return false;
      this.goToPage(this.currentPage - 1);
      return true;
    }

    isFirstPage() {
      return this.currentPage === 0;
    }

    isLastPage() {
      return this.currentPage >= this.totalPages - 1;
    }

    destroy() {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }

  global.GrasyaPaginator = Paginator;
})(window);
