'use strict';
const $ = (id) => document.getElementById(id);
const elements = {
  sections: $('catalog-sections'),
  empty: $('empty-state'),
  search: $('search'),
  brand: $('brand-filter'),
  count: $('results-count'),
  updated: $('updated-at')
};
let items = [];
const MATERIAL_ORDER = ['PLA', 'PETG'];
const FAMILY_ORDER = ['Red & Pink', 'Orange & Yellow', 'Green', 'Blue & Purple', 'Other', 'Brown & Beige', 'Black & Gray', 'White & Clear'];
const cleanHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(v || '') ? v.toUpperCase() : '#D9DFD7';
const prettyTime = (v) => {
  if (!v) return 'Inventory not yet synchronized';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Inventory snapshot';
  return 'Inventory updated ' + new Intl.DateTimeFormat(undefined, {dateStyle:'medium', timeStyle:'short'}).format(d);
};
function fillSelect(el, values) {
  for (const v of [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b))) {
    const option = document.createElement('option');
    option.value = v;
    option.textContent = v;
    el.append(option);
  }
}
function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1,3),16)/255;
    g = parseInt(hex.slice(3,5),16)/255;
    b = parseInt(hex.slice(5,7),16)/255;
  }
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = ((b - r) / d + 2); break;
      default: h = ((r - g) / d + 4); break;
    }
    h *= 60;
  }
  return {h, s, l};
}
// Keep families broad. Finish words such as "silk" and "metallic" do not create
// separate families: gold stays with warm yellows, silver with neutrals, etc.
function classifyColorFamily(item) {
  const name = item.name.toLowerCase();
  const {h, s, l} = hexToHsl(item.color);
  // Explicit color names take precedence over hue so dark/navy blues stay blue,
  // and opaque-looking swatches called "Transparent" remain in White & Clear.
  if (/\b(transparent|translucent|clear|white|marble|ivory|cream)\b/.test(name)) return 'White & Clear';
  if (/\b(black|gray|grey|charcoal|silver|graphite)\b/.test(name)) return 'Black & Gray';
  if (/\b(brown|chocolate|beige|tan|skin|sand|bronze|copper)\b/.test(name)) return 'Brown & Beige';
  if (/\b(red|pink|rose|magenta|crimson|scarlet)\b/.test(name)) return 'Red & Pink';
  if (/\b(orange|yellow|gold|golden|amber)\b/.test(name)) return 'Orange & Yellow';
  if (/\b(green|olive|mint|lime)\b/.test(name)) return 'Green';
  if (/\b(blue|cyan|navy|teal|turquoise|purple|violet|lavender|indigo)\b/.test(name)) return 'Blue & Purple';
  // Fallback for future filaments with non-descriptive names.
  if (s < 0.12 || l < 0.10) {
    return l > 0.88 ? 'White & Clear' : 'Black & Gray';
  }
  if (l > 0.94 && s < 0.30) return 'White & Clear';
  if (h >= 335 || h < 14) return 'Red & Pink';
  if (h < 65) return 'Orange & Yellow';
  if (h < 170) return 'Green';
  if (h < 330) return 'Blue & Purple';
  return 'Red & Pink';
}
function familySortValue(family) {
  const idx = FAMILY_ORDER.indexOf(family);
  return idx === -1 ? 999 : idx;
}
function hueSortValue(item) {
  const {h, s, l} = hexToHsl(item.color);
  if (item.colorFamily === 'Black & Gray') return l; // dark to light
  if (item.colorFamily === 'White & Clear') return l; // darker clear swatches before white
  if (item.colorFamily === 'Brown & Beige') return l + h / 36000;
  if (item.colorFamily === 'Red & Pink') return h > 300 ? (h - 360) : h;
  return h + (1 - s) * 0.01 + l * 0.001;
}
// Repeat material on each card so the item is unambiguous when shared or copied.
function displayName(item) {
  const name = item.name.trim() || 'Unnamed color';
  const material = item.material.trim();
  if (!material || material.toLowerCase() === 'unknown') return name;
  const tokens = name.toUpperCase().split(/[\s\-_/()]+/);
  return tokens.includes(material.toUpperCase()) ? name : `${name} ${material}`;
}
function weightLabel(weight) {
  return weight === null
    ? 'Weight not recorded'
    : `≈ ${new Intl.NumberFormat(undefined, {maximumFractionDigits:0}).format(weight)} g remaining`;
}
function card(item) {
  const article = document.createElement('article');
  article.className = 'tile';
  const swatch = document.createElement('div');
  swatch.className = 'swatch-full';
  swatch.style.background = item.color;
  const hex = document.createElement('span');
  hex.className = 'swatch-label';
  hex.textContent = item.color;
  swatch.append(hex);
  const body = document.createElement('div');
  body.className = 'tile-body compact';
  const brand = document.createElement('div');
  brand.className = 'tile-kicker';
  brand.textContent = item.brand || 'Unbranded';
  const title = document.createElement('h3');
  title.textContent = displayName(item);
  const weight = document.createElement('p');
  weight.className = 'weight-value';
  weight.textContent = weightLabel(item.weight_g);
  body.append(brand, title, weight);
  article.append(swatch, body);
  return article;
}
function buildSections(filtered) {
  const fragment = document.createDocumentFragment();
  const materials = [...new Set(filtered.map(i => i.material).filter(Boolean))].sort((a,b) => {
    const ai = MATERIAL_ORDER.indexOf(a), bi = MATERIAL_ORDER.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b);
  });
  for (const material of materials) {
    const materialItems = filtered.filter(i => i.material === material);
    const section = document.createElement('section');
    section.className = 'material-section';
    const head = document.createElement('div');
    head.className = 'material-header';
    const title = document.createElement('h2');
    title.textContent = material;
    const count = document.createElement('span');
    count.className = 'material-count';
    count.textContent = `${materialItems.length} filament${materialItems.length === 1 ? '' : 's'}`;
    head.append(title, count);
    section.append(head);
    const families = [...new Set(materialItems.map(i => i.colorFamily))].sort((a,b)=> familySortValue(a) - familySortValue(b) || a.localeCompare(b));
    for (const familyName of families) {
      const familyItems = materialItems
        .filter(i => i.colorFamily === familyName)
        .sort((a,b)=> hueSortValue(a)-hueSortValue(b) || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name));
      const familyBlock = document.createElement('div');
      familyBlock.className = 'family-block';
      const familyHeader = document.createElement('div');
      familyHeader.className = 'family-header';
      const familyTitle = document.createElement('h3');
      familyTitle.textContent = familyName;
      const familyCount = document.createElement('span');
      familyCount.className = 'family-count';
      familyCount.textContent = `${familyItems.length}`;
      familyHeader.append(familyTitle, familyCount);
      const grid = document.createElement('div');
      grid.className = 'catalog-grid';
      grid.append(...familyItems.map(card));
      familyBlock.append(familyHeader, grid);
      section.append(familyBlock);
    }
    fragment.append(section);
  }
  return fragment;
}
function render() {
  const q = elements.search.value.trim().toLowerCase();
  const filtered = items.filter(i => {
    const haystack = [i.name, i.brand, i.material, i.colorFamily].join(' ').toLowerCase();
    return (!q || haystack.includes(q))
      && (elements.brand.value === 'all' || i.brand === elements.brand.value);
  });
  elements.sections.replaceChildren();
  if (filtered.length) elements.sections.append(buildSections(filtered));
  elements.empty.hidden = filtered.length > 0;
  elements.count.textContent = `Showing ${filtered.length} of ${items.length} filaments`;
}
function reset() {
  elements.search.value='';
  elements.brand.value='all';
  render();
}
async function load() {
  try {
    const response = await fetch('catalog.json', {cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if(!Array.isArray(data.items)) throw new Error('Invalid catalog data');
    items = data.items.map(i => ({
      brand: String(i.brand || ''),
      name: String(i.name || ''),
      material: String(i.material || ''),
      color: cleanHex(i.color),
      weight_g: Number.isFinite(i.weight_g) && i.weight_g >= 0 ? Math.round(i.weight_g) : null
    })).map(i => ({...i, colorFamily: classifyColorFamily(i)}));
    elements.updated.textContent = prettyTime(data.generated_at);
    fillSelect(elements.brand, items.map(i => i.brand));
    render();
  } catch(err) {
    elements.sections.replaceChildren();
    const note = document.createElement('p');
    note.className = 'loading';
    note.textContent = 'Catalog temporarily unavailable. Please try again later.';
    elements.sections.append(note);
    elements.count.textContent = 'Unable to load catalog';
    elements.updated.textContent = 'Update unavailable';
    console.error('Catalog fetch failed:', err);
  }
}
for (const el of [elements.search, elements.brand]) el.addEventListener('input', render);
$('reset-filters').addEventListener('click', reset);
$('empty-reset').addEventListener('click', reset);
load();
