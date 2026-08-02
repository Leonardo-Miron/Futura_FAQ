/* app.js — Centro de Ayuda (sitio público). Carga el contenido desde /api/content. */
let DATA = [];
let CONTACT = {};

const heroSlot = document.getElementById('hero-slot');
const view = document.getElementById('view');
document.getElementById('year').textContent = new Date().getFullYear();

function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}
function go(hash){ if(location.hash===hash){render();} else {location.hash=hash;} window.scrollTo(0,0); }
function findCat(id){return DATA.find(c=>c.id===id);}
function findArt(slug){for(const c of DATA){for(const s of c.sections){const a=s.articles.find(x=>x.slug===slug);if(a)return {cat:c,sec:s,art:a};}}return null;}
function catCount(c){return c.sections.reduce((n,s)=>n+s.articles.length,0);}

function bigHero(){return `<div class="hero"><div class="hero-inner">
    <h1>¿Cómo podemos ayudarte?</h1>
    <p>Centro de ayuda para doctores y clínicas que trabajan con Futura Labs.</p>
    ${searchInput()}</div></div>`;}
function smallHero(){return `<div class="subhero"><div class="subhero-inner">${searchInput()}</div></div>`;}
function searchInput(){
  const v = (location.hash.startsWith('#/buscar/')) ? decodeURIComponent(location.hash.split('/')[2]||'') : '';
  return `<div class="searchbox">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    <input id="search" type="text" value="${v.replace(/"/g,'&quot;')}" placeholder="Busca… (ej. aprobar diseño, garantía, tiempos, recolección)" autocomplete="off"></div>`;
}
function wireSearch(){
  const el=document.getElementById('search'); if(!el)return;
  el.addEventListener('keydown',e=>{ if(e.key==='Enter'){const q=el.value.trim(); go(q?('#/buscar/'+encodeURIComponent(q)):'#/');} });
  el.addEventListener('input',()=>{ const q=el.value.trim(); if(q.length>=2){ history.replaceState(null,'','#/buscar/'+encodeURIComponent(q)); renderSearch(q,true);} else if(q.length===0 && location.hash.startsWith('#/buscar')){ go('#/'); } });
}

function contactBlock(){
  const c=CONTACT;
  return `<section class="contact" id="contacto">
    <h2>¿No encontraste lo que buscabas?</h2>
    <p class="sub">Nuestro equipo está listo para ayudarte. Ten a la mano tu número de orden.</p>
    <div class="contact-grid">
      <div class="contact-card"><div class="ico">💬</div><b>WhatsApp</b><span>${c.whatsapp||''}</span></div>
      <div class="contact-card"><div class="ico">📞</div><b>Teléfono</b><span>${c.telefono||''}</span></div>
      <div class="contact-card"><div class="ico">✉️</div><b>Correo</b><span>${c.correo||''}</span></div>
      <div class="contact-card"><div class="ico">🕐</div><b>Horario</b><span>${c.horario||''}</span></div>
      <div class="contact-card"><div class="ico">🖥️</div><b>Portal</b><span>${c.portal||''}</span></div>
      <div class="contact-card"><div class="ico">📍</div><b>Cobertura</b><span>${c.cobertura||''}</span></div>
    </div></section>`;
}

function renderHome(){
  heroSlot.innerHTML = bigHero();
  const cards = DATA.map(c=>`<div class="cat" onclick="go('#/categoria/${c.id}')">
      <div class="ico">${c.icon}</div><h3>${c.title}</h3><p>${c.blurb}</p>
      <span class="count">${catCount(c)} artículos →</span></div>`).join('');
  const popSlugs=['como-funciona','aprobar-diseno','cuando-listo','solicitar-garantia','recogen-o-llevo','horario'];
  const pop=popSlugs.map(s=>{const f=findArt(s);return f?`<div class="pop-item" onclick="go('#/articulo/${s}')"><span class="doc">📄</span>${f.art.title}</div>`:''}).join('');
  view.innerHTML = `
    <div class="grid">${cards}</div>
    <div class="popular"><h2>Artículos populares</h2><div class="pop-list">${pop}</div></div>
    ${contactBlock()}`;
  wireSearch();
}

function renderCategory(id){
  const c=findCat(id); if(!c){renderHome();return;}
  heroSlot.innerHTML = smallHero();
  const blocks = c.sections.map(s=>`
    <div class="section-block"><h3>${s.name}</h3><div class="art-list">
      ${s.articles.map(a=>`<div class="art-card" onclick="go('#/articulo/${a.slug}')">
        <div class="txt"><b>${a.title}</b><span>${a.excerpt}</span></div><div class="arrow">›</div></div>`).join('')}
    </div></div>`).join('');
  view.innerHTML = `
    <div class="crumb"><a onclick="go('#/')">Inicio</a><span class="sep">›</span><span>${c.title}</span></div>
    <div class="cathead"><div class="ico">${c.icon}</div><div><h1>${c.title}</h1><p>${c.blurb}</p></div></div>
    ${blocks}
    ${id==='soporte'?contactBlock():''}
    <div class="backlink" onclick="go('#/')">‹ Volver al inicio</div>`;
  wireSearch();
}

function renderArticle(slug){
  const f=findArt(slug); if(!f){renderHome();return;}
  const {cat,sec,art}=f;
  heroSlot.innerHTML = smallHero();
  const related = sec.articles.filter(a=>a.slug!==slug).slice(0,4)
    .map(a=>`<div class="art-card" onclick="go('#/articulo/${a.slug}')"><div class="txt"><b>${a.title}</b><span>${a.excerpt}</span></div><div class="arrow">›</div></div>`).join('');
  view.innerHTML = `
    <div class="crumb"><a onclick="go('#/')">Inicio</a><span class="sep">›</span><a onclick="go('#/categoria/${cat.id}')">${cat.title}</a><span class="sep">›</span><span>${art.title}</span></div>
    <article class="article">
      <h1>${art.title}</h1>
      <div class="meta">${cat.title} · ${sec.name}</div>
      <div class="body">${art.body}</div>
      <div class="helpful"><b>¿Te resultó útil este artículo?</b>
        <div class="btns"><button onclick="thanks(this)">👍 Sí</button><button onclick="thanks(this)">👎 No</button></div>
        <div class="thanks">¡Gracias por tu comentario!</div></div>
      ${related?`<div class="related"><h3>Artículos relacionados</h3><div class="art-list">${related}</div></div>`:''}
      <div class="backlink" onclick="go('#/categoria/${cat.id}')">‹ Volver a ${cat.title}</div>
    </article>`;
  wireSearch();
}
function thanks(btn){ const box=btn.closest('.helpful'); box.querySelector('.btns').style.display='none'; box.querySelector('.thanks').style.display='block'; }

function renderSearch(q, keepFocus){
  const nq=norm(q); const hits=[];
  for(const c of DATA){for(const s of c.sections){for(const a of s.articles){
    if(norm(a.title+' '+a.excerpt+' '+a.body).includes(nq)) hits.push({c,a});
  }}}
  heroSlot.innerHTML = smallHero();
  const list = hits.length? hits.map(h=>`<div class="res-item" onclick="go('#/articulo/${h.a.slug}')">
      <span class="cat-tag">${h.c.icon} ${h.c.title}</span><b>${h.a.title}</b><p>${h.a.excerpt}</p></div>`).join('')
    : `<div class="no-res">No encontramos resultados para "<b>${q}</b>". Intenta con otras palabras o <a onclick="go('#/categoria/soporte')">contáctanos</a>.</div>`;
  view.innerHTML = `
    <div class="crumb"><a onclick="go('#/')">Inicio</a><span class="sep">›</span><span>Búsqueda</span></div>
    <div class="results"><h1>Resultados de búsqueda</h1><p class="sub">${hits.length} resultado(s) para "${q}"</p>${list}</div>`;
  wireSearch();
  if(keepFocus){const el=document.getElementById('search'); if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}}
}

function render(){
  if(!DATA.length){return;}
  const h=location.hash||'#/'; const parts=h.split('/');
  if(h==='#/'||h===''||h==='#'){renderHome();}
  else if(parts[1]==='categoria'){renderCategory(parts[2]);}
  else if(parts[1]==='articulo'){renderArticle(parts[2]);}
  else if(parts[1]==='buscar'){renderSearch(decodeURIComponent(parts[2]||''));}
  else {renderHome();}
}
window.addEventListener('hashchange',render);

/* Carga inicial del contenido desde la API */
fetch('/api/content').then(r=>r.json()).then(d=>{
  DATA = d.categories || [];
  CONTACT = d.contact || {};
  render();
}).catch(()=>{ view.innerHTML='<p style="padding:40px;text-align:center;color:#b91c1c">No se pudo cargar el contenido. ¿El servidor está corriendo?</p>'; });
