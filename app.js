'use strict';

const STATUSES = ['office', 'remote', 'absent', 'leave'];
const LOCALES = { tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU' };

const STRINGS = {
  tr: {
    brand: 'Yoklama',
    status: { office: 'Ofiste', remote: 'Evden', absent: 'Gelmedi', leave: 'İzinli' },
    floor: (n) => `${n}. Kat`,
    progress: (done, all) => `${all} kişiden ${done} tanesi işaretlendi`,
    markRest: 'Kalanlar ofiste',
    dock: (done, all) => `${done} / ${all} işaretlendi`,
    openSummary: 'Özeti hazırla',
    summaryTitle: 'Bugünün özeti',
    close: 'Kapat',
    unmarked: (n) => `${n} kişi henüz işaretlenmedi. Mesajda "İşaretlenmedi" olarak sayılır.`,
    messageLabel: 'WhatsApp mesajı',
    send: "WhatsApp'a gönder",
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    copyFailed: 'Kopyalanamadı',
    reset: 'Yoklamayı temizle',
    resetConfirm: 'Bugünkü tüm işaretler silinsin mi?',
    emptyFloor: 'Bu katta kayıtlı çalışan yok.',
    loading: 'Çalışan listesi yükleniyor…',
    loadError: 'Çalışan listesi yüklenemedi.',
    retry: 'Tekrar dene',
    lockTitle: "Şifre gerekli",
    passwordLabel: "Şifre",
    unlock: "Aç",
    wrongPassword: "Şifre yanlış.",
    noCrypto: "Bu tarayıcı şifre çözmeyi desteklemiyor. Sayfayı https ile açın.",
  },
  en: {
    brand: 'Roll call',
    status: { office: 'In office', remote: 'Remote', absent: 'Absent', leave: 'On leave' },
    floor: (n) => `Floor ${n}`,
    progress: (done, all) => `${done} of ${all} marked`,
    markRest: 'Rest are in office',
    dock: (done, all) => `${done} / ${all} marked`,
    openSummary: 'Prepare summary',
    summaryTitle: "Today's summary",
    close: 'Close',
    unmarked: (n) => `${n} not marked yet. The Turkish message counts them as "İşaretlenmedi".`,
    messageLabel: 'WhatsApp message (in Turkish)',
    send: 'Send on WhatsApp',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    reset: 'Clear roll call',
    resetConfirm: "Clear all of today's marks?",
    emptyFloor: 'No one is listed on this floor.',
    loading: 'Loading the staff list…',
    loadError: 'The staff list could not be loaded.',
    retry: 'Try again',
    lockTitle: "Password required",
    passwordLabel: "Password",
    unlock: "Unlock",
    wrongPassword: "Wrong password.",
    noCrypto: "This browser cannot decrypt the list. Open the page over https.",
  },
  ru: {
    brand: 'Перекличка',
    status: { office: 'В офисе', remote: 'Из дома', absent: 'Не пришёл', leave: 'В отпуске' },
    floor: (n) => `${n} этаж`,
    progress: (done, all) => `Отмечено ${done} из ${all}`,
    markRest: 'Остальные в офисе',
    dock: (done, all) => `Отмечено ${done} / ${all}`,
    openSummary: 'Подготовить отчёт',
    summaryTitle: 'Отчёт за сегодня',
    close: 'Закрыть',
    unmarked: (n) => `Не отмечено: ${n}. В сообщении на турецком они указаны как «İşaretlenmedi».`,
    messageLabel: 'Сообщение WhatsApp (на турецком)',
    send: 'Отправить в WhatsApp',
    copy: 'Копировать',
    copied: 'Скопировано',
    copyFailed: 'Не удалось скопировать',
    reset: 'Очистить перекличку',
    resetConfirm: 'Удалить все отметки за сегодня?',
    emptyFloor: 'На этом этаже нет сотрудников.',
    loading: 'Загрузка списка сотрудников…',
    loadError: 'Не удалось загрузить список сотрудников.',
    retry: 'Повторить',
    lockTitle: "Нужен пароль",
    passwordLabel: "Пароль",
    unlock: "Открыть",
    wrongPassword: "Неверный пароль.",
    noCrypto: "Этот браузер не может расшифровать список. Откройте страницу через https.",
  },
};

/* The summary goes to the team, so it is always in Turkish whatever the screen language is. */
const MESSAGE_LANG = 'tr';

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/* Storage is only a convenience: a phone can reload the tab after switching to WhatsApp. */
function readStore(store, key) {
  try { return store.getItem(key); } catch { return null; }
}
function writeStore(store, key, value) {
  try { store.setItem(key, value); } catch { /* private mode */ }
}

const todayKey = `attendance-${new Date().toLocaleDateString('sv')}`;

const app = {
  data: null,
  lang: 'tr',
  officeId: null,
  floor: null,
  marks: {},
};

function detectLang() {
  const saved = readStore(localStorage, 'attendance-lang');
  if (saved in STRINGS) return saved;
  const device = (navigator.language || '').slice(0, 2).toLowerCase();
  return device in STRINGS ? device : 'en';
}

const t = () => STRINGS[app.lang];
const personKey = (p) => `${p.office}|${p.name}`;
const statusOf = (p) => app.marks[personKey(p)] || null;
const officeById = (id) => app.data.offices.find((o) => o.id === id);

/* A floor used by an employee still gets a tab even if the office list forgot it. */
function floorsOf(office) {
  const used = app.data.employees
    .filter((p) => p.office === office.id && p.floor != null)
    .map((p) => p.floor);
  return [...new Set([...(office.floors || []), ...used])].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : 0));
}

const peopleInOffice = (id) => app.data.employees.filter((p) => p.office === id);

function currentPeople() {
  return peopleInOffice(app.officeId).filter((p) => app.floor == null || p.floor === app.floor);
}

/* A floor is a number ("1. Kat") or, while the real floor is unknown, plain text such as a team name. */
function floorLabel(floor, lang = app.lang) {
  return typeof floor === 'number' ? STRINGS[lang].floor(floor) : floor;
}

function placeLabel(p, lang = app.lang) {
  const office = officeById(p.office).name;
  return p.floor == null ? office : `${office}, ${floorLabel(p.floor, lang)}`;
}

function countLabel(people) {
  const done = people.filter(statusOf).length;
  return `${done}/${people.length}`;
}

/* Rendering */

function selectOffice(id) {
  app.officeId = id;
  const floors = floorsOf(officeById(id));
  app.floor = floors.length
    ? floors.find((f) => peopleInOffice(id).some((p) => p.floor === f)) ?? floors[0]
    : null;
  render();
}

function selectFloor(floor) {
  app.floor = floor;
  render();
  window.scrollTo({ top: 0 });
}

function tab(label, count, current, onClick) {
  const button = el('button', { type: 'button', className: 'tab', onclick: onClick }, label, ' ', el('small', { textContent: count }));
  button.setAttribute('aria-current', String(current));
  return button;
}

function renderTabs() {
  const offices = app.data.offices.map((o) =>
    tab(o.name, countLabel(peopleInOffice(o.id)), o.id === app.officeId, () => selectOffice(o.id)));
  $('office-tabs').replaceChildren(...offices);

  const office = officeById(app.officeId);
  const floors = floorsOf(office).map((f) => {
    const people = peopleInOffice(office.id).filter((p) => p.floor === f);
    return tab(floorLabel(f), countLabel(people), f === app.floor, () => selectFloor(f));
  });
  $('floor-tabs').replaceChildren(...floors);
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const picked = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
  return picked.map((w) => w[0].toLocaleUpperCase('tr')).join('');
}

function hueOf(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)) % 360;
  return hash;
}

function face(person) {
  const fallback = el('div', { className: 'face', textContent: initials(person.name) });
  fallback.style.setProperty('--hue', hueOf(person.name));
  fallback.setAttribute('aria-hidden', 'true');
  if (!person.photo) return fallback;
  const img = el('img', { className: 'face', src: person.photo, alt: person.name, loading: 'lazy' });
  img.onerror = () => img.replaceWith(fallback);
  return img;
}

/* An office such as the remote group can start with a status; it can still be changed by hand. */
function applyDefaults() {
  for (const person of app.data.employees) {
    const fallback = officeById(person.office).defaultStatus;
    if (fallback && !statusOf(person)) app.marks[personKey(person)] = fallback;
  }
}

function setStatus(person, status) {
  const key = personKey(person);
  if (app.marks[key] === status) delete app.marks[key];
  else app.marks[key] = status;
  writeStore(sessionStorage, todayKey, JSON.stringify(app.marks));
}

function renderRoster() {
  const rows = currentPeople().map((person) => {
    const choices = el('div', { className: 'choices' });
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', person.name);
    for (const status of STATUSES) {
      const button = el('button', { type: 'button', className: 'choice', textContent: t().status[status] });
      button.dataset.status = status;
      button.setAttribute('aria-pressed', String(statusOf(person) === status));
      button.onclick = () => {
        setStatus(person, status);
        for (const b of choices.children) {
          b.setAttribute('aria-pressed', String(statusOf(person) === b.dataset.status));
        }
        renderSummaryBits();
      };
      choices.append(button);
    }
    const who = el('div', { className: 'who' },
      el('div', { className: 'name', textContent: person.name }),
      el('div', { className: 'dept', textContent: person.department }));
    return el('li', { className: 'person' }, face(person), who, choices);
  });
  $('roster').replaceChildren(...rows);

  const empty = rows.length === 0;
  $('state').hidden = !empty;
  if (empty) $('state').textContent = t().emptyFloor;
  $('progress').hidden = empty;
}

function renderSummaryBits() {
  renderTabs();
  const people = currentPeople();
  const done = people.filter(statusOf).length;
  $('strip').replaceChildren(...people.map((p) => {
    const cell = el('i');
    if (statusOf(p)) cell.dataset.status = statusOf(p);
    return cell;
  }));
  $('progress-text').textContent = t().progress(done, people.length);
  $('mark-rest').textContent = t().markRest;
  $('mark-rest').disabled = done === people.length;

  const everyone = app.data.employees;
  const total = everyone.filter(statusOf).length;
  $('dock-text').textContent = t().dock(total, everyone.length);
  $('open-summary').disabled = total === 0;
}

function renderChrome() {
  const lang = app.lang;
  document.documentElement.lang = lang;
  document.title = t().brand;
  $('brand-name').textContent = t().brand;
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  }
  $('today').textContent = formatDate(lang);
  $('lock-title').textContent = t().lockTitle;
  $('password-label').textContent = t().passwordLabel;
  $('unlock').textContent = t().unlock;
  $('open-summary').textContent = t().openSummary;
  $('summary-title').textContent = t().summaryTitle;
  $('close-summary').textContent = t().close;
  $('message-label').textContent = t().messageLabel;
  $('send-whatsapp').textContent = t().send;
  $('copy-message').textContent = t().copy;
  $('reset').textContent = t().reset;
}

function render() {
  renderChrome();
  const office = officeById(app.officeId);
  $('scope-title').textContent = app.floor == null ? office.name : `${office.name} · ${floorLabel(app.floor)}`;
  renderRoster();
  renderSummaryBits();
}

/* Message */

function formatDate(lang) {
  return new Date().toLocaleDateString(LOCALES[lang], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function buildMessage() {
  const lang = MESSAGE_LANG;
  const s = STRINGS[lang];
  const everyone = app.data.employees;
  const inStatus = (status) => everyone.filter((p) => statusOf(p) === status);
  const unmarked = everyone.filter((p) => !statusOf(p)).length;

  const counts = STATUSES.map((status) => `${s.status[status]}: ${inStatus(status).length}`);
  if (unmarked) counts.push(`İşaretlenmedi: ${unmarked}`);

  const headings = { remote: 'Evden çalışıyor', absent: 'Gelmedi', leave: 'İzinli' };
  const lines = [`*${s.brand} - ${formatDate(lang)}*`, counts.join(' | ')];
  for (const status of ['remote', 'absent', 'leave']) {
    const people = inStatus(status);
    if (!people.length) continue;
    lines.push('', `*${headings[status]} (${people.length})*`);
    for (const p of people) {
      const place = officeById(p.office).defaultStatus ? p.department : placeLabel(p, lang);
      lines.push(`- ${p.name} (${place})`);
    }
  }
  return lines.join('\n');
}

function whatsappUrl(text) {
  const number = String(app.data.whatsappNumber || '').replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function renderSheet() {
  const everyone = app.data.employees;
  $('tally').replaceChildren(...STATUSES.map((status) => {
    const n = everyone.filter((p) => statusOf(p) === status).length;
    return el('div', {},
      el('dt', { textContent: t().status[status] }),
      el('dd', { textContent: n, className: n ? '' : 'zero' }));
  }));

  const unmarked = everyone.filter((p) => !statusOf(p)).length;
  $('unmarked-note').hidden = unmarked === 0;
  $('unmarked-note').textContent = t().unmarked(unmarked);

  const message = buildMessage();
  $('message').textContent = message;
  $('send-whatsapp').href = whatsappUrl(message);
  $('copy-message').textContent = t().copy;
}

/* Events */

function bindEvents() {
  for (const b of document.querySelectorAll('[data-lang]')) {
    b.onclick = () => {
      app.lang = b.dataset.lang;
      writeStore(localStorage, 'attendance-lang', app.lang);
      if (app.data) render(); else renderChrome();
    };
  }
  $('mark-rest').onclick = () => {
    for (const p of currentPeople()) if (!statusOf(p)) setStatus(p, 'office');
    renderRoster();
    renderSummaryBits();
  };
  $('open-summary').onclick = () => { renderSheet(); $('summary').showModal(); };
  $('close-summary').onclick = () => $('summary').close();
  $('summary').addEventListener('click', (e) => {
    if (e.target === $('summary')) $('summary').close();
  });
  $('copy-message').onclick = async () => {
    const button = $('copy-message');
    try {
      await navigator.clipboard.writeText($('message').textContent);
      button.textContent = t().copied;
    } catch {
      button.textContent = t().copyFailed;
    }
  };
  $('reset').onclick = () => {
    if (!window.confirm(t().resetConfirm)) return;
    app.marks = {};
    applyDefaults();
    writeStore(sessionStorage, todayKey, JSON.stringify(app.marks));
    $('summary').close();
    render();
  };
}

/* Start */

function showLoadError() {
  const retry = el('button', { type: 'button', className: 'btn-secondary', textContent: t().retry, onclick: start });
  $('state').replaceChildren(el('p', { textContent: t().loadError }), retry);
  $('state').hidden = false;
}

/* The published file is AES-GCM encrypted by tools/encrypt.mjs; the password stays in this function. */
async function decryptList(box, password) {
  const bytes = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(box.salt), iterations: box.iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(box.iv) }, key, bytes(box.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

function askPassword(box) {
  const form = $('lock');
  const error = $('lock-error');
  $('state').hidden = true;
  form.hidden = false;
  $('password').focus();
  form.onsubmit = async (event) => {
    event.preventDefault();
    error.hidden = true;
    $('unlock').disabled = true;
    try {
      if (!crypto.subtle) throw new Error('no-crypto');
      app.data = await decryptList(box, $('password').value);
    } catch (failure) {
      error.textContent = failure.message === 'no-crypto' ? t().noCrypto : t().wrongPassword;
      error.hidden = false;
      $('unlock').disabled = false;
      return;
    }
    $('password').value = '';
    form.hidden = true;
    document.body.classList.remove('locked');
    openApp();
  };
}

async function start() {
  $('state').hidden = false;
  $('state').textContent = t().loading;
  try {
    const response = await fetch('data/employees.enc.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    askPassword(await response.json());
  } catch {
    showLoadError();
  }
}

function openApp() {
  try {
    app.marks = JSON.parse(readStore(sessionStorage, todayKey)) || {};
  } catch {
    app.marks = {};
  }
  applyDefaults();
  selectOffice(app.data.offices[0].id);
}

app.lang = detectLang();
bindEvents();
renderChrome();
start();
