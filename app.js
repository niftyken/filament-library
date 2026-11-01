'use strict';
const $ = (id) => document.getElementById(id);
const elements = {
  grid: $('catalog-grid'), empty: $('empty-state'), search: $('search'),
  material: $('material-filter'), brand: $('brand-filter'), stock: $('stock-filter'),
  count: $('results-count'), updated: $('updated-at')
};
let items = [];
const stockText = {available:'Available', limited:'Limited', 'nearly-empty':'Almost empty', unavailable:'Unavailable', unknown:'Ask first'};
const cleanHex = (v) => /^#[0-9A-Fa-f]{6}$/.test(v || '') ? v.toUpperCase() : '#D9DFD7';
const prettyTime = (v) => {
  if (!v) return 'Inventory not yet synchronized';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return 'Inventory snapshot';
  return 'Inventory updated ' + new Intl.DateTimeFormat(undefined, {dateStyle:'medium', timeStyle:'short'}).format(d);
};
function fillSelect(el, values) {
  for (const v of [...new Set(values)].filter(Boolean).sort((a,b)=>a.localeCompare(b))) {
    const option=document.createElement('option'); option.value=v; option.textContent=v; el.append(option);
  }
}
function card(item) {
  const article=document.createElement('article'); article.className='tile';
  const swatch=document.createElement('div'); swatch.className='swatch';
  swatch.style.setProperty('--swatch',cleanHex(item.color));
  const background=cleanHex(item.color);
  // Deliberately tonal rather than an exact-on-screen simulation of physical pigment.
  swatch.style.background=`linear-gradient(135deg, ${background}22, #f6f6f1 91%)`;
  const code=document.createElement('span'); code.className='swatch-label'; code.textContent=background;
  swatch.append(code);
  const body=document.createElement('div'); body.className='tile-body';
  const kicker=document.createElement('div'); kicker.className='tile-kicker'; kicker.textContent=item.brand || 'Unbranded';
  const title=document.createElement('h3'); title.textContent=item.name || 'Unnamed color';
  const bottom=document.createElement('div'); bottom.className='tile-bottom';
  const type=document.createElement('span'); type.className='type-pill'; type.textContent=item.material || 'Material unknown';
  const status=document.createElement('span'); status.className='pill'; status.textContent=stockText[item.status] || 'Ask first';
  if(item.status==='limited'||item.status==='nearly-empty')status.classList.add('low');
  if(item.status==='unavailable')status.classList.add('empty');
  bottom.append(type,status);body.append(kicker,title,bottom);article.append(swatch,body);
  return article;
}
function render() {
  const q=elements.search.value.trim().toLowerCase();
  const results=items.filter(i=>{
    const haystack=[i.name,i.brand,i.material].join(' ').toLowerCase();
    return (!q||haystack.includes(q))
      && (elements.material.value==='all'||i.material===elements.material.value)
      && (elements.brand.value==='all'||i.brand===elements.brand.value)
      && (elements.stock.value==='all'||i.status===elements.stock.value);
  }).sort((a,b)=>a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name));
  elements.grid.replaceChildren(...results.map(card));
  elements.empty.hidden=results.length>0;
  elements.count.textContent=`Showing ${results.length} of ${items.length} filaments`;
}
function reset() {elements.search.value='';elements.material.value='all';elements.brand.value='all';elements.stock.value='all';render();}
async function load() {
  try {
    const response=await fetch('catalog.json',{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    if(!Array.isArray(data.items)) throw new Error('Invalid catalog data');
    items=data.items.map(i=>({
      brand:String(i.brand||''),name:String(i.name||''),material:String(i.material||''),
      color:cleanHex(i.color),status:String(i.status||'unknown')
    }));
    $('hero-count').textContent=items.length;
    $('hero-brands').textContent=new Set(items.map(x=>x.brand).filter(Boolean)).size;
    $('hero-materials').textContent=new Set(items.map(x=>x.material).filter(Boolean)).size;
    elements.updated.textContent=prettyTime(data.generated_at);
    fillSelect(elements.material,items.map(i=>i.material));
    fillSelect(elements.brand,items.map(i=>i.brand));
    render();
  } catch(err) {
    elements.grid.replaceChildren();
    const note=document.createElement('p');note.className='loading';note.textContent='Catalog temporarily unavailable. Please try again later.';
    elements.grid.append(note);elements.count.textContent='Unable to load catalog';
    elements.updated.textContent='Update unavailable';
    console.error('Catalog fetch failed:',err);
  }
}
for(const el of [elements.search,elements.material,elements.brand,elements.stock]) el.addEventListener('input',render);
$('reset-filters').addEventListener('click',reset);
$('empty-reset').addEventListener('click',reset);
load();
