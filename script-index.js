(async function(){
// ---------- CONFIG : adapte l'URL si besoin ----------
// Ton API fournie: /api/v1/ads/all (token free)
const API_BASE = 'http://localhost:300/api/v1/ads'; // <-- ADAPTE ICI si nécessaire
const TIMEOUT = 12000;

// ---------- UTIL ----------
const root = document.getElementById('continents-root');
const globalFeedback = document.getElementById('global-feedback');

const escapeHtml = (s) => {
    if (s === 0) return '0';
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

const fetchWithTimeout = (url, opts={}) => {
    const controller = new AbortController();
    const id = setTimeout(()=> controller.abort(), TIMEOUT);
    return fetch(url, {...opts, signal: controller.signal}).finally(()=> clearTimeout(id));
};

const itemsPerView = () => {
    const w = window.innerWidth;
if (w < 576) return 1;
    if (w < 768) return 2;
    if (w < 992) return 3;
    return 4;
};

// ---------- fetch all ads ----------
try {
    globalFeedback.textContent = 'Chargement des annonces…';
    const res = await fetchWithTimeout(API_BASE);
    if (!res.ok) {
    // debug : essaye lire le body pour savoir pourquoi
    const txt = await res.text().catch(()=>'(no body)');
    throw new Error(`API returned ${res.status} - ${txt}`);
    }
    const ads = await res.json();
    if (!Array.isArray(ads) || ads.length === 0) {
    globalFeedback.textContent = 'Aucune annonce trouvée.';
    return;
    }

    // ---------- group ads by location/zone/city (flexible)
    const groups = new Map();

    const getGroupKey = (a) => {
    // try several fields in order of likelihood
    if (a.location && (a.location.id || a.location.name)) {
        const id = a.location.id || a.location.name;
        const name = a.location.name || a.location.label || String(id);
        return { id: `loc-${id}`, name };
    }
    if (a.ecoZoneId) {
        // if API provides ecoZone object use its name
        const id = a.ecoZoneId;
        const name = a.ecoZoneName || a.ecoZone?.name || `Zone ${id}`;
        return { id: `eco-${id}`, name };
    }
    if (a.locationId) {
        const id = a.locationId;
        const name = a.locationName || `Lieu ${id}`;
        return { id: `locid-${id}`, name };
    }
    if (a.city) {
        return { id: `city-${a.city}`, name: a.city };
    }
    if (a.continent) {
        return { id: `cont-${a.continent}`, name: a.continent };
    }
    // fallback: group "Toutes les annonces"
    return { id: 'all', name: 'Toutes les annonces' };
    };

    ads.forEach(a => {
    const { id, name } = getGroupKey(a);
    if (!groups.has(id)) groups.set(id, { id, name, items: [] });
    groups.get(id).items.push(a);
    });

    // ---------- render sections
    root.innerHTML = '';
    groups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'continent-block';
    // safe ids
    const gid = group.id.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\-_]/g,'');
    section.innerHTML = `
        <div class="continent-head">
        <h3 class="continent-title">${escapeHtml(group.name)}</h3>
        <p class="continent-desc">Annonces disponibles pour ${escapeHtml(group.name)}.</p>
        </div>
        <div class="annonces-wrap" id="wrap-${gid}">
        <div class="controles prev-wrap" id="prevwrap-${gid}" style="display:none">
            <button class="btn btn-outline-secondary" aria-label="Précédent"><i class="bi bi-chevron-left"></i></button>
        </div>
        <div class="controles next-wrap" id="nextwrap-${gid}" style="display:none">
            <button class="btn btn-outline-secondary" aria-label="Suivant"><i class="bi bi-chevron-right"></i></button>
        </div>
        <div class="annonces-container" id="container-${gid}" aria-roledescription="carousel" aria-label="${escapeHtml(group.name)} annonces"></div>
        <div class="continent-feedback" id="fb-${gid}"></div>
        </div>
    `;
    root.appendChild(section);

    // populate container
    const container = section.querySelector(`#container-${gid}`);
    const fb = section.querySelector(`#fb-${gid}`);
    container.innerHTML = '';
    group.items.forEach(a => {
        const url = a.url || `/annonce/${encodeURIComponent(a.id)}`;
        const img = a.image_url || a.imageUrl || a.image || '';
        const title = a.title || a.name || 'Sans titre';
        const desc = a.short_description || a.description || a.desc || '';
        const item = document.createElement('a');
        item.className = 'annonce-card';
        item.href = url;
        item.setAttribute('aria-label', title);
        item.innerHTML = `
        ${ img ? `<img class="annonce-thumb" src="${escapeHtml(img)}" alt="${escapeHtml(title)}" loading="lazy">` 
                : `<div class="annonce-thumb" role="img" aria-label="${escapeHtml(title)}" style="background-color:#f1f5f8;display:flex;align-items:center;justify-content:center;font-size:28px">🐜</div>` }
        <div class="annonce-title">${escapeHtml(title)}</div>
        <div class="annonce-desc">${escapeHtml(desc)}</div>
        `;
        if (url.startsWith('http')) item.target = '_blank';
        container.appendChild(item);
    });

    setupCarouselFor(container, section.querySelector(`#prevwrap-${gid}`), section.querySelector(`#nextwrap-${gid}`));
    fb.textContent = '';
    });

    globalFeedback.textContent = '';

} catch (err) {
    console.error(err);
    const msg = err?.message || 'Problème réseau.';
    globalFeedback.textContent = `Erreur : ${msg}`;
    root.innerHTML = `<div class="text-danger">Erreur : ${escapeHtml(msg)}</div>`;
    return;
}

// ---------- CAROUSEL helper ----------
function setupCarouselFor(container, prevWrap, nextWrap){
    const total = container.children.length;
    if (total === 0) {
    if (prevWrap) prevWrap.style.display = 'none';
    if (nextWrap) nextWrap.style.display = 'none';
    return;
    }

    let idx = 0;

    const updateControls = () => {
    const per = itemsPerView();
    if (!prevWrap || !nextWrap) return;
    if (total <= per) {
        prevWrap.style.display = 'none';
        nextWrap.style.display = 'none';
    } else {
        prevWrap.style.display = idx > 0 ? '' : 'none';
        nextWrap.style.display = (idx + per) < total ? '' : 'none';
    }
    };

    const scrollToIndex = (i) => {
    const clamped = Math.max(0, Math.min(i, total - 1));
    const item = container.children[clamped];
    if (!item) return;
    const rectItem = item.getBoundingClientRect();
    const rectContainer = container.getBoundingClientRect();
    const gap = parseInt(getComputedStyle(container).gap || 16);
    const left = rectItem.left - rectContainer.left + container.scrollLeft - gap;
    container.scrollTo({ left, behavior: 'smooth' });
    idx = clamped;
    updateControls();
    };

    // bind buttons (if present)
    if (prevWrap) {
    const btnPrev = prevWrap.querySelector('button');
    if (btnPrev) btnPrev.addEventListener('click', () => {
        const per = itemsPerView();
        scrollToIndex(Math.max(0, idx - per));
    });
    }
    if (nextWrap) {
    const btnNext = nextWrap.querySelector('button');
    if (btnNext) btnNext.addEventListener('click', () => {
        const per = itemsPerView();
        scrollToIndex(Math.min(Math.max(0, total - per), idx + per));
    });
    }

    // scroll listener to update idx approx
    container.addEventListener('scroll', () => {
    const rectC = container.getBoundingClientRect();
    for (let i=0;i<container.children.length;i++){
        const c = container.children[i];
        const r = c.getBoundingClientRect();
        if (r.left >= rectC.left - 10) { idx = i; break; }
    }
    updateControls();
    });

    // recenter on resize
    const onResize = () => setTimeout(() => scrollToIndex(idx), 120);
    window.addEventListener('resize', onResize);

    // initial state
    updateControls();
}

// recalc carousels on resize
window.addEventListener('resize', () => {
    setTimeout(() => {
    document.querySelectorAll('.annonces-container').forEach((c) => c.dispatchEvent(new Event('scroll')));
    }, 160);
});

})();