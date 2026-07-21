(function(){
"use strict";

/* ---------------------------------------------------------------------
   Flatten the loaded season data (window.HE_DATA, filled in by the
   data/season*.js files) into one ordered list of chapters.
--------------------------------------------------------------------- */
var SEASON_LABELS = {
  1: "Season 1",
  2: "Season 2",
  3: "Season 3"
};

var seasons = (window.HE_DATA || []).slice().sort(function(a,b){ return a.season - b.season; });
var chapters = []; // {season, indexInSeason, title, paragraphs, globalIndex}

seasons.forEach(function(s){
  s.chapters.forEach(function(ch, i){
    chapters.push({
      season: s.season,
      indexInSeason: i,
      title: ch.title,
      paragraphs: ch.paragraphs,
      globalIndex: chapters.length
    });
  });
});

/* ---------------------------------------------------------------------
   Settings (persisted)
--------------------------------------------------------------------- */
var DEFAULTS = {
  fontFamily: "serif",
  fontSize: 19,
  lineHeight: 1.8,
  theme: "cream",
  customBg: "",
  customText: "",
  align: "left",
  measure: "medium"
};

var FONT_STACKS = {
  serif: "Georgia, 'Times New Roman', 'Noto Serif', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  rounded: "Verdana, 'Trebuchet MS', 'Comic Sans MS', sans-serif",
  mono: "'Courier New', ui-monospace, Menlo, Consolas, monospace"
};

var THEMES = {
  cream:  { bg: "#f7f1e3", text: "#2b2620" },
  white:  { bg: "#ffffff", text: "#222222" },
  sepia:  { bg: "#f0e2c8", text: "#4a3524" },
  mint:   { bg: "#e7f3ea", text: "#1f3a2a" },
  blush:  { bg: "#fbe9ec", text: "#4a2028" },
  dusk:   { bg: "#2b2f3a", text: "#e8e6df" },
  dark:   { bg: "#15171c", text: "#d8d6cf" },
  black:  { bg: "#000000", text: "#c9c9c9" }
};

var MEASURES = { narrow: "540px", medium: "640px", wide: "760px" };

function loadSettings(){
  try{
    var raw = localStorage.getItem("he_reader_settings");
    if(!raw) return Object.assign({}, DEFAULTS);
    return Object.assign({}, DEFAULTS, JSON.parse(raw));
  }catch(e){ return Object.assign({}, DEFAULTS); }
}
function saveSettings(){ localStorage.setItem("he_reader_settings", JSON.stringify(settings)); }

function loadPosition(){
  try{
    var raw = localStorage.getItem("he_reader_position");
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function savePosition(globalIndex){
  localStorage.setItem("he_reader_position", JSON.stringify({ globalIndex: globalIndex }));
}

var settings = loadSettings();

/* ---------------------------------------------------------------------
   DOM refs
--------------------------------------------------------------------- */
var app = document.getElementById("app");
var root = document.documentElement;

var currentIndex = -1; // -1 = cover page

function applySettingsToRoot(){
  root.style.setProperty("--font-family", FONT_STACKS[settings.fontFamily] || FONT_STACKS.serif);
  root.style.setProperty("--font-size", settings.fontSize + "px");
  root.style.setProperty("--line-height", settings.lineHeight);
  root.style.setProperty("--measure", MEASURES[settings.measure] || MEASURES.medium);

  var theme = THEMES[settings.theme] || THEMES.cream;
  var bg = settings.customBg || theme.bg;
  var text = settings.customText || theme.text;
  root.style.setProperty("--bg", bg);
  root.style.setProperty("--text", text);
}

/* ---------------------------------------------------------------------
   Rendering
--------------------------------------------------------------------- */
function escapeHtml(s){
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function renderShell(){
  app.innerHTML =
    '<div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>' +
    '<div class="topbar">' +
      '<button class="icon-btn" id="tocBtn" title="Chapters" aria-label="Chapters">&#9776;</button>' +
      '<div class="topbar-title"><span class="book-name" id="topBook">HE\'S INTO HER</span><span class="chap-name" id="topChap"></span></div>' +
      '<button class="icon-btn" id="settingsBtn" title="Reading settings" aria-label="Reading settings">Aa</button>' +
    '</div>' +
    '<div id="mainArea"></div>' +
    '<div class="overlay" id="overlay"></div>' +
    buildSidebarHtml() +
    buildSettingsHtml();

  document.getElementById("tocBtn").addEventListener("click", function(){ toggleSidebar(true); });
  document.getElementById("settingsBtn").addEventListener("click", function(){ toggleSettings(true); });
  document.getElementById("overlay").addEventListener("click", function(){ toggleSidebar(false); toggleSettings(false); });
  document.getElementById("topBook").addEventListener("click", function(){ goToChapter(-1); });
  document.getElementById("topBook").style.cursor = "pointer";

  wireSidebar();
  wireSettings();
}

function buildSidebarHtml(){
  var html = '<nav class="sidebar" id="sidebar">' +
    '<div class="panel-header"><h2>Chapters</h2><button class="panel-close" id="sidebarClose">&times;</button></div>' +
    '<input class="toc-search" id="tocSearch" type="search" placeholder="Search chapters...">' +
    '<div class="toc-body" id="tocBody">';

  seasons.forEach(function(s){
    html += '<div class="season-group" data-season="' + s.season + '">' +
      '<div class="season-header">' + (SEASON_LABELS[s.season] || ("Season " + s.season)) + '</div>';
    s.chapters.forEach(function(ch, i){
      var gi = chapters.find(function(c){ return c.season === s.season && c.indexInSeason === i; }).globalIndex;
      html += '<button class="toc-item" data-index="' + gi + '" data-search="' + escapeHtml(ch.title.toLowerCase()) + '">' + escapeHtml(ch.title) + '</button>';
    });
    html += '</div>';
  });

  html += '</div></nav>';
  return html;
}

function buildSettingsHtml(){
  return '<aside class="settings-panel" id="settingsPanel">' +
    '<div class="panel-header"><h2>Reading Settings</h2><button class="panel-close" id="settingsClose">&times;</button></div>' +
    '<div class="settings-body">' +

      '<div class="setting-group">' +
        '<label class="group-label">Font</label>' +
        '<div class="font-row" id="fontRow">' +
          '<button class="font-choice" data-font="serif" style="font-family:' + FONT_STACKS.serif + '">Serif — Aa Bb Cc</button>' +
          '<button class="font-choice" data-font="sans" style="font-family:' + FONT_STACKS.sans + '">Sans — Aa Bb Cc</button>' +
          '<button class="font-choice" data-font="rounded" style="font-family:' + FONT_STACKS.rounded + '">Rounded — Aa Bb Cc</button>' +
          '<button class="font-choice" data-font="mono" style="font-family:' + FONT_STACKS.mono + '">Mono — Aa Bb Cc</button>' +
        '</div>' +
      '</div>' +

      '<div class="setting-group">' +
        '<label class="group-label">Font size</label>' +
        '<div class="size-row">' +
          '<button id="sizeDown">&minus;</button>' +
          '<input type="range" id="sizeSlider" min="14" max="32" step="1">' +
          '<button id="sizeUp">&plus;</button>' +
          '<span class="size-value" id="sizeValue"></span>' +
        '</div>' +
      '</div>' +

      '<div class="setting-group">' +
        '<label class="group-label">Line spacing</label>' +
        '<div class="align-row" id="lineRow">' +
          '<button data-lh="1.5">Compact</button>' +
          '<button data-lh="1.8">Cozy</button>' +
          '<button data-lh="2.2">Relaxed</button>' +
        '</div>' +
      '</div>' +

      '<div class="setting-group">' +
        '<label class="group-label">Background</label>' +
        '<div class="swatch-row" id="themeRow">' +
          Object.keys(THEMES).map(function(key){
            var t = THEMES[key];
            return '<div class="swatch" data-theme="' + key + '" title="' + key + '" style="background:' + t.bg + ';color:' + t.text + '">Aa</div>';
          }).join('') +
        '</div>' +
        '<div class="custom-colors">' +
          '<label>Background<input type="color" id="customBg"></label>' +
          '<label>Text<input type="color" id="customText"></label>' +
        '</div>' +
      '</div>' +

      '<div class="setting-group">' +
        '<label class="group-label">Text alignment</label>' +
        '<div class="align-row" id="alignRow">' +
          '<button data-align="left">Left</button>' +
          '<button data-align="justify">Justify</button>' +
        '</div>' +
      '</div>' +

      '<div class="setting-group">' +
        '<label class="group-label">Reading width</label>' +
        '<div class="width-row" id="widthRow">' +
          '<button data-measure="narrow">Narrow</button>' +
          '<button data-measure="medium">Medium</button>' +
          '<button data-measure="wide">Wide</button>' +
        '</div>' +
      '</div>' +

      '<button class="reset-btn" id="resetBtn">Reset to defaults</button>' +
    '</div>' +
  '</aside>';
}

function toggleSidebar(open){
  document.getElementById("sidebar").classList.toggle("open", open);
  document.getElementById("overlay").classList.toggle("open", open || document.getElementById("settingsPanel").classList.contains("open"));
}
function toggleSettings(open){
  document.getElementById("settingsPanel").classList.toggle("open", open);
  document.getElementById("overlay").classList.toggle("open", open || document.getElementById("sidebar").classList.contains("open"));
}

function wireSidebar(){
  document.getElementById("sidebarClose").addEventListener("click", function(){ toggleSidebar(false); });
  document.getElementById("tocBody").addEventListener("click", function(e){
    var btn = e.target.closest(".toc-item");
    if(!btn) return;
    var idx = parseInt(btn.getAttribute("data-index"), 10);
    goToChapter(idx);
    toggleSidebar(false);
  });
  document.getElementById("tocSearch").addEventListener("input", function(e){
    var q = e.target.value.trim().toLowerCase();
    var items = document.querySelectorAll(".toc-item");
    items.forEach(function(it){
      var match = !q || it.getAttribute("data-search").indexOf(q) !== -1;
      it.style.display = match ? "" : "none";
    });
    document.querySelectorAll(".season-group").forEach(function(g){
      var anyVisible = Array.prototype.some.call(g.querySelectorAll(".toc-item"), function(it){ return it.style.display !== "none"; });
      g.style.display = anyVisible ? "" : "none";
    });
  });
}

function wireSettings(){
  document.getElementById("settingsClose").addEventListener("click", function(){ toggleSettings(false); });

  document.getElementById("fontRow").addEventListener("click", function(e){
    var btn = e.target.closest(".font-choice");
    if(!btn) return;
    settings.fontFamily = btn.getAttribute("data-font");
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });

  var slider = document.getElementById("sizeSlider");
  slider.addEventListener("input", function(){
    settings.fontSize = parseInt(slider.value, 10);
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });
  document.getElementById("sizeDown").addEventListener("click", function(){
    settings.fontSize = Math.max(14, settings.fontSize - 1);
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });
  document.getElementById("sizeUp").addEventListener("click", function(){
    settings.fontSize = Math.min(32, settings.fontSize + 1);
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });

  document.getElementById("lineRow").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-lh]");
    if(!btn) return;
    settings.lineHeight = parseFloat(btn.getAttribute("data-lh"));
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });

  document.getElementById("themeRow").addEventListener("click", function(e){
    var sw = e.target.closest(".swatch");
    if(!sw) return;
    settings.theme = sw.getAttribute("data-theme");
    settings.customBg = ""; settings.customText = "";
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });

  document.getElementById("customBg").addEventListener("input", function(e){
    settings.customBg = e.target.value;
    saveSettings(); applySettingsToRoot();
  });
  document.getElementById("customText").addEventListener("input", function(e){
    settings.customText = e.target.value;
    saveSettings(); applySettingsToRoot();
  });

  document.getElementById("alignRow").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-align]");
    if(!btn) return;
    settings.align = btn.getAttribute("data-align");
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
    document.body.style.setProperty("--text-align", settings.align);
    applyAlign();
  });

  document.getElementById("widthRow").addEventListener("click", function(e){
    var btn = e.target.closest("button[data-measure]");
    if(!btn) return;
    settings.measure = btn.getAttribute("data-measure");
    saveSettings(); applySettingsToRoot(); refreshSettingsUI();
  });

  document.getElementById("resetBtn").addEventListener("click", function(){
    settings = Object.assign({}, DEFAULTS);
    saveSettings(); applySettingsToRoot(); refreshSettingsUI(); applyAlign();
  });

  refreshSettingsUI();
}

function applyAlign(){
  var body = document.querySelector(".chapter-body");
  if(body) body.style.textAlign = settings.align === "justify" ? "justify" : "left";
}

function refreshSettingsUI(){
  document.querySelectorAll(".font-choice").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-font") === settings.fontFamily);
  });
  var slider = document.getElementById("sizeSlider");
  slider.value = settings.fontSize;
  document.getElementById("sizeValue").textContent = settings.fontSize + "px";
  document.querySelectorAll("#lineRow button").forEach(function(b){
    b.classList.toggle("active", parseFloat(b.getAttribute("data-lh")) === settings.lineHeight);
  });
  document.querySelectorAll(".swatch").forEach(function(s){
    s.classList.toggle("active", s.getAttribute("data-theme") === settings.theme && !settings.customBg);
  });
  document.querySelectorAll("#alignRow button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-align") === settings.align);
  });
  document.querySelectorAll("#widthRow button").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-measure") === settings.measure);
  });
  var theme = THEMES[settings.theme] || THEMES.cream;
  document.getElementById("customBg").value = toHex(settings.customBg || theme.bg);
  document.getElementById("customText").value = toHex(settings.customText || theme.text);
}

function toHex(c){
  if(/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  return "#000000";
}

/* ---------------------------------------------------------------------
   Cover page
--------------------------------------------------------------------- */
function renderCover(){
  currentIndex = -1;
  document.getElementById("topChap").textContent = "";
  document.title = "He's Into Her — Storybook Reader";
  var pos = loadPosition();
  var html = '<div class="cover">' +
    '<h1>He\'s Into Her</h1>' +
    '<div class="byline">by maxinejiji</div>';

  if(pos && chapters[pos.globalIndex]){
    html += '<div class="season-card" id="continueCard"><div><div class="s-title">Continue Reading</div><div class="s-sub">' +
      escapeHtml((SEASON_LABELS[chapters[pos.globalIndex].season] || "") + " – " + chapters[pos.globalIndex].title) +
      '</div></div><div>&#8594;</div></div>';
  }

  seasons.forEach(function(s){
    var first = chapters.find(function(c){ return c.season === s.season; });
    html += '<div class="season-card" data-season="' + s.season + '"><div><div class="s-title">' +
      (SEASON_LABELS[s.season] || ("Season " + s.season)) + '</div><div class="s-sub">' + s.chapters.length + ' sections</div></div><div>&#8594;</div></div>';
  });

  html += '</div>';
  document.getElementById("mainArea").innerHTML = html;
  document.getElementById("progressFill").style.width = "0%";

  if(pos && chapters[pos.globalIndex]){
    document.getElementById("continueCard").addEventListener("click", function(){ goToChapter(pos.globalIndex); });
  }
  document.querySelectorAll(".season-card[data-season]").forEach(function(card){
    card.addEventListener("click", function(){
      var seasonNum = parseInt(card.getAttribute("data-season"), 10);
      var first = chapters.find(function(c){ return c.season === seasonNum; });
      if(first) goToChapter(first.globalIndex);
    });
  });
}

/* ---------------------------------------------------------------------
   Chapter page
--------------------------------------------------------------------- */
function goToChapter(globalIndex){
  if(globalIndex < 0){ renderCover(); window.scrollTo(0,0); return; }
  if(globalIndex >= chapters.length) return;
  currentIndex = globalIndex;
  var ch = chapters[globalIndex];
  savePosition(globalIndex);

  document.getElementById("topBook").textContent = "HE'S INTO HER";
  document.getElementById("topChap").textContent = ch.title;
  document.title = ch.title + " – He's Into Her";

  var prev = chapters[globalIndex - 1];
  var next = chapters[globalIndex + 1];

  var seasonMeta = seasons.find(function(s){ return s.season === ch.season; });
  var eyebrow = (SEASON_LABELS[ch.season] || ("Season " + ch.season)) + " · " + (ch.indexInSeason + 1) + " of " + seasonMeta.chapters.length;

  var bodyHtml = ch.paragraphs.map(function(p){ return "<p>" + escapeHtml(p) + "</p>"; }).join("");

  var html = '<main class="reader">' +
    '<div class="chapter-eyebrow">' + escapeHtml(eyebrow) + '</div>' +
    '<h1 class="chapter-title">' + escapeHtml(ch.title) + '</h1>' +
    '<div class="chapter-body">' + bodyHtml + '</div>' +
    '<div class="chapter-nav">' +
      '<button class="nav-btn prev" id="prevBtn" ' + (prev ? "" : "disabled") + '><span class="label">&larr; Previous</span>' + (prev ? escapeHtml(prev.title) : "") + '</button>' +
      '<button class="nav-btn next" id="nextBtn" ' + (next ? "" : "disabled") + '><span class="label">Next &rarr;</span>' + (next ? escapeHtml(next.title) : "") + '</button>' +
    '</div>' +
  '</main>';

  document.getElementById("mainArea").innerHTML = html;
  applyAlign();

  if(prev) document.getElementById("prevBtn").addEventListener("click", function(){ goToChapter(globalIndex - 1); window.scrollTo(0,0); });
  if(next) document.getElementById("nextBtn").addEventListener("click", function(){ goToChapter(globalIndex + 1); window.scrollTo(0,0); });

  highlightTocActive(globalIndex);
  window.scrollTo(0, 0);
  updateProgress();
}

function highlightTocActive(globalIndex){
  document.querySelectorAll(".toc-item").forEach(function(it){
    it.classList.toggle("active", parseInt(it.getAttribute("data-index"), 10) === globalIndex);
  });
}

function updateProgress(){
  var fill = document.getElementById("progressFill");
  if(!fill) return;
  if(currentIndex < 0){ fill.style.width = "0%"; return; }
  var doc = document.documentElement;
  var scrollTop = doc.scrollTop || document.body.scrollTop;
  var scrollHeight = (doc.scrollHeight || document.body.scrollHeight) - doc.clientHeight;
  var pct = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0;
  fill.style.width = pct + "%";
}

/* ---------------------------------------------------------------------
   Init
--------------------------------------------------------------------- */
window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("keydown", function(e){
  if(document.getElementById("sidebar").classList.contains("open") || document.getElementById("settingsPanel").classList.contains("open")) return;
  if(e.key === "ArrowRight") { var n = currentIndex + 1; if(n < chapters.length) goToChapter(n); }
  if(e.key === "ArrowLeft") { var p = currentIndex - 1; if(p >= -1) goToChapter(p); }
});

applySettingsToRoot();
renderShell();

var pos = loadPosition();
if(pos && chapters[pos.globalIndex] !== undefined){
  goToChapter(pos.globalIndex);
} else {
  renderCover();
}

})();
