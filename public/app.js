/* ===== ZooStatus Price List — app.js ===== */

// ─── Settings ───────────────────────────────────────────
const CSV_PRICES_URL = './price.csv';
const CSV_ORDER_URL  = './newpricepopular.csv';
const ENABLE_CACHE_BUST = true;
// ─────────────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const elList      = $('#serviceList');
const elLoading   = $('#stateLoading');
const elError     = $('#stateError');
const elErrorDetail = $('#errorDetail');
const elEmpty     = $('#stateEmpty');
const elSearch    = $('#searchInput');
const elDept      = $('#filterDepartment');
const elCat       = $('#filterCategory');
const elCount     = $('#resultsCount');

let allItems = []; // merged list

// ─── Helpers ────────────────────────────────────────────
function cacheBust(url) {
  if (!ENABLE_CACHE_BUST) return url;
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
}

function makeKey(name, dept, cat) {
  return [name, dept, cat].map(s => (s || '').trim().toLowerCase()).join('|||');
}

function formatPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
}

function debounce(fn, ms) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, arguments), ms);
  };
}

function col(row, name) {
  // CSV headers may have BOM or spaces — try exact then trimmed
  if (row[name] !== undefined) return row[name];
  for (const k of Object.keys(row)) {
    if (k.trim() === name) return row[k];
  }
  return '';
}

// ─── Load CSV ───────────────────────────────────────────
function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(cacheBust(url), {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: (r) => resolve(r.data),
      error: (err) => reject(err),
    });
  });
}

// ─── Merge logic ────────────────────────────────────────
function mergeData(priceRows, orderRows) {
  // Build lookup maps from price.csv
  const byKey = new Map();
  const byName = new Map();
  const nameCounts = new Map();

  for (const r of priceRows) {
    const name = (col(r, 'Название') || '').trim();
    const dept = (col(r, 'Подразделение') || '').trim();
    const cat  = (col(r, 'Категория услуги') || '').trim();
    const cost = col(r, 'Стоимость');
    if (!name) continue;
    const key = makeKey(name, dept, cat);
    byKey.set(key, cost);
    nameCounts.set(name.toLowerCase(), (nameCounts.get(name.toLowerCase()) || 0) + 1);
    // Store last seen for unique fallback
    byName.set(name.toLowerCase(), cost);
  }

  // Remove non-unique names from byName
  for (const [n, c] of nameCounts) {
    if (c > 1) byName.delete(n);
  }

  const usedPriceKeys = new Set();
  const items = [];

  // Process order file
  for (const r of orderRows) {
    const rank = parseInt(col(r, 'Ранг популярности'), 10);
    const name = (col(r, 'Название') || '').trim();
    const dept = (col(r, 'Подразделение') || '').trim();
    const cat  = (col(r, 'Категория услуги') || '').trim();
    if (!name) continue;

    const key = makeKey(name, dept, cat);
    let price = null;
    let matched = false;

    // 1) exact key match
    if (byKey.has(key)) {
      price = byKey.get(key);
      matched = true;
    }
    // 2) unique name fallback
    if (!matched && byName.has(name.toLowerCase())) {
      price = byName.get(name.toLowerCase());
      matched = true;
    }

    usedPriceKeys.add(key);

    items.push({
      name, dept, cat,
      rank: isNaN(rank) ? 999999 : rank,
      price: formatPrice(price),
      noPrice: !matched,
      section: null,
    });
  }

  // Sort by rank
  items.sort((a, b) => a.rank - b.rank);

  // Remaining from price.csv not in order file
  const extras = [];
  for (const r of priceRows) {
    const name = (col(r, 'Название') || '').trim();
    const dept = (col(r, 'Подразделение') || '').trim();
    const cat  = (col(r, 'Категория услуги') || '').trim();
    const cost = col(r, 'Стоимость');
    if (!name) continue;
    const key = makeKey(name, dept, cat);
    if (!usedPriceKeys.has(key)) {
      usedPriceKeys.add(key); // avoid dupes
      extras.push({
        name, dept, cat,
        rank: 999999,
        price: formatPrice(cost),
        noPrice: false,
        section: 'other',
      });
    }
  }
  extras.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  return items.concat(extras);
}

// ─── Populate filters ───────────────────────────────────
function populateFilters(items) {
  const depts = [...new Set(items.map(i => i.dept).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ru'));
  const cats  = [...new Set(items.map(i => i.cat).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ru'));

  for (const d of depts) {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    elDept.appendChild(o);
  }
  for (const c of cats) {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    elCat.appendChild(o);
  }
}

// ─── Render ─────────────────────────────────────────────
function render() {
  const q    = elSearch.value.trim().toLowerCase();
  const dept = elDept.value;
  const cat  = elCat.value;

  const filtered = allItems.filter(item => {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (dept && item.dept !== dept) return false;
    if (cat && item.cat !== cat) return false;
    return true;
  });

  elList.innerHTML = '';
  elEmpty.hidden = filtered.length > 0;
  elCount.textContent = filtered.length
    ? `Найдено: ${filtered.length}`
    : '';

  if (!filtered.length) return;

  const frag = document.createDocumentFragment();
  let inOtherSection = false;

  for (const item of filtered) {
    // Section heading for extras
    if (item.section === 'other' && !inOtherSection) {
      inOtherSection = true;
      const h = document.createElement('div');
      h.className = 'section-heading';
      h.textContent = 'Прочие услуги';
      frag.appendChild(h);
    }

    const card = document.createElement('div');
    card.className = 'service-card';

    const info = document.createElement('div');
    info.className = 'service-card__info';

    const nameEl = document.createElement('div');
    nameEl.className = 'service-card__name';
    nameEl.textContent = item.name;
    info.appendChild(nameEl);

    if (item.dept || item.cat) {
      const meta = document.createElement('div');
      meta.className = 'service-card__meta';
      meta.textContent = [item.dept, item.cat].filter(Boolean).join(' · ');
      info.appendChild(meta);
    }

    const priceEl = document.createElement('div');
    if (item.noPrice) {
      priceEl.className = 'service-card__price service-card__price--missing';
      priceEl.textContent = '— нет цены';
    } else {
      priceEl.className = 'service-card__price';
      priceEl.textContent = item.price || '—';
    }

    card.appendChild(info);
    card.appendChild(priceEl);
    frag.appendChild(card);
  }

  elList.appendChild(frag);
}

// ─── Init ───────────────────────────────────────────────
(async function init() {
  try {
    const [priceRows, orderRows] = await Promise.all([
      loadCSV(CSV_PRICES_URL),
      loadCSV(CSV_ORDER_URL),
    ]);

    allItems = mergeData(priceRows, orderRows);
    populateFilters(allItems);

    elLoading.hidden = true;
    render();
  } catch (err) {
    console.error('CSV load error:', err);
    elLoading.hidden = true;
    elError.hidden = false;
    elErrorDetail.textContent = err.message || String(err);
  }
})();

elSearch.addEventListener('input', debounce(render, 300));
elDept.addEventListener('change', render);
elCat.addEventListener('change', render);
