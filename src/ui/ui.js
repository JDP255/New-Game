// DOM-based HUD and menus.
import { audio } from '../core/audio.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.hpGhostW = 100;
    this.bossGhostW = 100;
    this.activeMenu = null;
    this.menuIndex = 0;
    this.toastsEl = $('toasts');
    this.hintTimer = 0;
    this.subTimer = 0;
    addEventListener('keydown', (e) => this.menuKey(e));
  }

  // ---------------------------------------------------------------- HUD
  showHUD(on) { $('hud').classList.toggle('hidden', !on); }
  setCine(on) { document.body.classList.toggle('cine', on); }

  updateVitals(p) {
    const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
    $('hp-fill').style.width = hpPct + '%';
    $('hp-ghost').style.width = hpPct + '%';
    $('hp').classList.toggle('low', hpPct < 25);
    $('hp').style.width = 240 + p.maxHp * 0.6 + 'px';
    const off = 327 * (1 - p.glory / 100);
    $('glory-fill').style.strokeDashoffset = off;
    $('emblem').classList.toggle('full', p.glory >= 100);
    const w = $('wings');
    const n = p.maxStamina;
    if (w.children.length !== n) {
      w.innerHTML = '';
      for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'pip'; w.appendChild(d); }
    }
    for (let i = 0; i < n; i++) w.children[i].classList.toggle('empty', p.stamina < i + 1);
  }

  setObjective(text) {
    if (text === this.lastObjective) return;
    this.lastObjective = text;
    const o = $('objective');
    if (!text) { o.style.opacity = 0; return; }
    o.style.opacity = 1;
    $('obj-text').textContent = text;
    o.classList.remove('flash');
    void o.offsetWidth;
    o.classList.add('flash');
  }

  setCounts(f, fmax, s, smax, r, rmax) {
    $('cnt-f').textContent = `${f}/${fmax}`;
    $('cnt-s').textContent = `${s}/${smax}`;
    $('cnt-r').textContent = `${r}/${rmax}`;
  }

  setBoss(name, pct) {
    const b = $('boss');
    if (name == null) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden');
    $('boss-name').textContent = name;
    $('boss-fill').style.width = Math.max(0, pct * 100) + '%';
    $('boss-ghost').style.width = Math.max(0, pct * 100) + '%';
  }

  toast(html, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = html;
    this.toastsEl.appendChild(t);
    while (this.toastsEl.children.length > 5) this.toastsEl.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 3600);
  }

  hint(html, dur = 5) {
    const h = $('hint');
    h.innerHTML = html;
    h.classList.remove('hidden');
    this.hintTimer = dur;
  }
  clearHint() { $('hint').classList.add('hidden'); this.hintTimer = 0; }

  prompt(text) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    $('prompt-text').textContent = text;
  }

  marker(x, y, dist, visible) {
    const m = $('marker');
    if (!visible) { m.classList.add('hidden'); return; }
    m.classList.remove('hidden');
    m.style.left = x + 'px';
    m.style.top = y + 'px';
    m.querySelector('.dist').textContent = dist != null ? Math.round(dist) + 'm' : '';
  }

  lock(x, y, visible) {
    const l = $('lock');
    if (!visible) { l.classList.add('hidden'); return; }
    l.classList.remove('hidden');
    l.style.left = x + 'px';
    l.style.top = y + 'px';
  }

  subtitle(speaker, line, dur = 4) {
    const s = $('subtitle');
    if (!line) { s.classList.add('hidden'); return; }
    s.classList.remove('hidden');
    s.classList.toggle('narrator', !speaker);
    s.querySelector('.speaker').textContent = speaker || '';
    s.querySelector('.line').textContent = line;
    this.subTimer = dur;
  }

  chapterCard(ch, show = true) {
    const c = $('chapter-card');
    if (!show) {
      c.classList.add('out');
      setTimeout(() => c.classList.add('hidden'), 1200);
      return;
    }
    c.querySelector('.numeral').textContent = ch.numeral ? 'CHAPTER ' + ch.numeral : '';
    c.querySelector('.title').textContent = ch.title;
    c.querySelector('.realm').textContent = ch.realm || '';
    c.querySelector('.verse').textContent = ch.verse ? '“' + ch.verse + '”' : '';
    c.querySelector('.ref').textContent = ch.ref ? '— ' + ch.ref : '';
    c.classList.remove('hidden', 'out');
    void c.offsetWidth;
  }

  bigTitle(show) {
    const b = $('bigtitle');
    if (show) { b.classList.remove('hidden', 'out'); void b.offsetWidth; }
    else { b.classList.add('out'); setTimeout(() => b.classList.add('hidden'), 1600); }
  }

  fade(to, dur = 1, white = false) {
    const f = $('fade');
    f.classList.toggle('white', white);
    f.style.transition = `opacity ${dur}s ease`;
    f.style.opacity = to;
  }

  update(dt) {
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.clearHint(); }
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.subtitle(null, null); }
  }

  // ---------------------------------------------------------------- menus
  buildMenu(container, items) {
    container.innerHTML = '';
    const buttons = [];
    items.forEach((it) => {
      if (!it) return;
      const b = document.createElement('button');
      b.innerHTML = it.label + (it.note ? `<small>${it.note}</small>` : '');
      b.disabled = !!it.disabled;
      b.addEventListener('mouseenter', () => { if (!b.disabled) { this.select(buttons.indexOf(b)); audio.sfx('ui', { f: 700 }); } });
      b.addEventListener('click', (e) => { e.stopPropagation(); if (!b.disabled) { audio.sfx('uiConfirm'); it.action(); } });
      container.appendChild(b);
      buttons.push(b);
    });
    this.activeMenu = buttons;
    this.menuIndex = -1;
    this.select(buttons.findIndex((b) => !b.disabled));
  }
  select(i) {
    if (!this.activeMenu) return;
    this.activeMenu.forEach((b, k) => b.classList.toggle('sel', k === i));
    this.menuIndex = i;
  }
  menuKey(e) {
    if (!this.activeMenu || !this.activeMenu.length || !this.activeMenu[0].isConnected) return;
    const vis = this.activeMenu[0].offsetParent !== null;
    if (!vis) return;
    const n = this.activeMenu.length;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      let i = this.menuIndex;
      for (let k = 0; k < n; k++) { i = (i + 1) % n; if (!this.activeMenu[i].disabled) break; }
      this.select(i); audio.sfx('ui', { f: 700 });
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      let i = this.menuIndex;
      for (let k = 0; k < n; k++) { i = (i - 1 + n) % n; if (!this.activeMenu[i].disabled) break; }
      this.select(i); audio.sfx('ui', { f: 700 });
    } else if (e.code === 'Enter') {
      const b = this.activeMenu[this.menuIndex];
      if (b && !b.disabled) b.click();
    }
  }

  showScreen(id, on = true) { $(id).classList.toggle('hidden', !on); }

  panel(title, bodyHTML, items) {
    $('panel-title').textContent = title;
    $('panel-body').innerHTML = bodyHTML;
    this.showScreen('panel', true);
    this.buildMenu($('panel-menu'), items);
    return $('panel-body');
  }
  closePanel() { this.showScreen('panel', false); this.activeMenu = null; }

  reader(kind, title, verse, ref, text) {
    $('reader-kind').textContent = kind;
    $('reader-title').textContent = title;
    $('reader-verse').textContent = verse ? '“' + verse + '”' : '';
    $('reader-ref').textContent = ref ? '— ' + ref : '';
    $('reader-text').textContent = text;
    this.showScreen('reader', true);
  }
  closeReader() { this.showScreen('reader', false); }

  death(verse, ref, items) {
    $('death-verse').textContent = '“' + verse + '”';
    $('death-ref').textContent = '— ' + ref;
    this.showScreen('death', true);
    this.buildMenu($('death-menu'), items);
  }

  loading(on, tip) {
    this.showScreen('loading', on);
    if (tip) $('loading-tip').textContent = tip;
  }
}
