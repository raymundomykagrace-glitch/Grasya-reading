/**
 * App bootstrap: wires the library view (upload) to the reader view.
 */
(function () {
  function openBook(id) {
    GrasyaReader.open(id, () => {
      GrasyaLibrary.renderLibrary(openBook);
    });
  }

  function init() {
    GrasyaReader.init();
    GrasyaLibrary.renderLibrary(openBook);

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      GrasyaLibrary.handleFiles(fileInput.files, openBook);
      fileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      });
    });
    dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        GrasyaLibrary.handleFiles(e.dataTransfer.files, openBook);
      }
    });

    const urlInput = document.getElementById('url-input');
    const urlAddBtn = document.getElementById('url-add-btn');
    function submitUrl() {
      const val = urlInput.value;
      if (!val.trim()) return;
      GrasyaLibrary.handleUrlImport(val, openBook);
      urlInput.value = '';
    }
    urlAddBtn.addEventListener('click', submitUrl);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitUrl();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
