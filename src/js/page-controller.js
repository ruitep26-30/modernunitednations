/**
 * Modern United Nations - Page Controller
 * Centralizes page-specific initialization logic for the persistent app shell
 * Each page's logic is moved here from individual HTML files
 */

import { auth, db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, onAuthStateChanged, signOut, getSession, saveSession, clearSession, ensureUserSession } from './firebase-config.js';
import { findCatalogCommitteeByQuery } from './committees-catalog.js';
import { R2_CONFIG } from './r2-config.js';

// ============================================================================
// Shared Utilities
// ============================================================================
const WIDE_COMMITTEE_CODES = new Set(['ls', 'rs', 'oecd', 'unfpa', 'eu', 'asean', 'brics', 'ioc', 'fifa']);
const STEP_NAMES = {
  1: 'Basics & Venue', 2: 'Committees Selection', 3: 'Countries & Positions',
  4: 'Committee Agendas', 5: 'Executive Board', 6: 'Secretariat',
  7: 'Itinerary & Schedule', 8: 'Logo & Accent Color', 9: 'Review & Publish'
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#039;');
}

function formatRelativeTime(isoStringOrTimestamp) {
  if (!isoStringOrTimestamp) return 'Recently';
  try {
    const timestamp = typeof isoStringOrTimestamp === 'number' ? isoStringOrTimestamp : new Date(isoStringOrTimestamp).getTime();
    if (isNaN(timestamp)) return 'Recently';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) { return 'Recently'; }
}

function isValidDraft(draft) {
  if (!draft || typeof draft !== 'object') return false;
  const data = draft.data || {};
  return Boolean((data.title && data.title.trim()) || (data.institution && data.institution.trim()) || (Array.isArray(data.committees) && data.committees.length > 0) || (draft.step && draft.step > 1));
}

function getLocalDraft() {
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidDraft(parsed) ? parsed : null;
  } catch (e) { return null; }
}

function resolveCommitteeInfo(cmStr) {
  if (!cmStr) return { code: 'UN', name: 'Committee', isWide: false, logoUrl: '' };
  let cmObj = null, raw = '';
  if (typeof cmStr === 'object' && cmStr !== null) { cmObj = cmStr; raw = String(cmStr.code || cmStr.name || cmStr.id || '').trim(); }
  else { raw = String(cmStr).trim(); }
  let match = findCatalogCommitteeByQuery(raw);
  if (!match) {
    const upper = raw.toUpperCase();
    if (upper.includes('CABINET') || upper === 'INDCN') match = findCatalogCommitteeByQuery('INDCN');
    else if (upper.includes('DISEC')) match = findCatalogCommitteeByQuery('DISEC');
    else if (upper.includes('LEGAL')) match = findCatalogCommitteeByQuery('LEGAL');
    else if (upper.includes('HRC')) match = findCatalogCommitteeByQuery('UNHRC');
    else if (upper.includes('ECOSOC')) match = findCatalogCommitteeByQuery('ECOSOC');
    else if (upper.includes('WHO')) match = findCatalogCommitteeByQuery('WHO');
    else if (upper.includes('ICJ')) match = findCatalogCommitteeByQuery('ICJ');
    else if (upper.includes('UNESCO')) match = findCatalogCommitteeByQuery('UNESCO');
    else if (upper.includes('UNEP')) match = findCatalogCommitteeByQuery('UNEP');
    else if (upper.includes('BRICS')) match = findCatalogCommitteeByQuery('BRICS');
    else if (upper.includes('OECD')) match = findCatalogCommitteeByQuery('OECD');
    else if (upper.includes('UNFPA')) match = findCatalogCommitteeByQuery('UNFPA');
    else if (upper.includes('ASEAN')) match = findCatalogCommitteeByQuery('ASEAN');
    else if (upper.includes('FIFA')) match = findCatalogCommitteeByQuery('FIFA');
    else if (upper.includes('IOC')) match = findCatalogCommitteeByQuery('IOC');
    else if (upper === 'EU') match = findCatalogCommitteeByQuery('EU');
  }
  const code = (cmObj && cmObj.code) ? cmObj.code : (match ? match.code : raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase());
  const name = (cmObj && (cmObj.fullName || cmObj.name)) ? (cmObj.fullName || cmObj.name) : (match ? match.name : raw);
  const logoUrl = (cmObj && cmObj.logoUrl) ? cmObj.logoUrl : R2_CONFIG.getCommitteeLogoUrl(code);
  const isWide = Boolean(cmObj && cmObj.isWide) || WIDE_COMMITTEE_CODES.has(code.toLowerCase()) || WIDE_COMMITTEE_CODES.has(raw.toLowerCase()) || (match && WIDE_COMMITTEE_CODES.has(match.code.toLowerCase()));
  return { code, name, isWide, logoUrl };
}

function formatConferenceDates(item) {
  if (!item) return '';
  if (typeof item.dates === 'string' && item.dates.trim() && isNaN(Date.parse(item.dates))) return item.dates.trim();
  const sRaw = item.startDate || item.confStartDate || item.date || item.dates;
  const eRaw = item.endDate || item.confEndDate || null;
  if (!sRaw) return item.dates || item.date || '';
  const parseDatePart = (val) => { if (!val) return null; if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) { const [y, m, d] = val.split('-').map(Number); return new Date(y, m - 1, d); } const d = new Date(val); return isNaN(d.getTime()) ? null : d; };
  const sDate = parseDatePart(sRaw), eDate = parseDatePart(eRaw);
  if (sDate && eDate) {
    const sMonth = sDate.toLocaleDateString('en-US', { month: 'short' }), eMonth = eDate.toLocaleDateString('en-US', { month: 'short' });
    const sDay = sDate.getDate(), eDay = eDate.getDate(), sYear = sDate.getFullYear(), eYear = eDate.getFullYear();
    if (sYear === eYear) { if (sMonth === eMonth) { if (sDay === eDay) return `${sMonth} ${sDay}, ${sYear}`; return `${sMonth} ${sDay} - ${eDay}, ${sYear}`; } return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${sYear}`; }
    return `${sMonth} ${sDay}, ${sYear} - ${eMonth} ${eDay}, ${eYear}`;
  } else if (sDate) { return sDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  return (sRaw && eRaw) ? `${sRaw} - ${eRaw}` : (sRaw || '');
}

function formatConferenceVenue(item) {
  if (!item) return '';
  const fmt = (item.format || item.confFormat || '').toLowerCase();
  if (fmt === 'virtual' || fmt === 'online') return 'Virtual Conference';
  if (item.venue && !item.venueAddress && !item.city) return item.venue;
  const v = (item.venueAddress || item.confVenueAddress || item.venue || '').trim();
  const c = (item.city || item.confCity || '').trim();
  const co = (item.country || item.confCountry || '').trim();
  const parts = []; if (v) parts.push(v); if (c && !v.toLowerCase().includes(c.toLowerCase())) parts.push(c); if (co && !v.toLowerCase().includes(co.toLowerCase()) && (!c || !c.toLowerCase().includes(co.toLowerCase()))) parts.push(co);
  if (parts.length > 0) return parts.join(', '); if (item.venue) return item.venue; return '';
}

function showToast(msg, type = 'info') {
  let toast = document.getElementById('homeToast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'homeToast'; toast.className = 'home-toast'; document.body.appendChild(toast); }
  toast.innerHTML = `<ion-icon name="${type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}"></ion-icon><span>${escapeHtml(msg)}</span>`;
  toast.classList.remove('is-error'); if (type === 'error') toast.classList.add('is-error');
  toast.classList.add('is-visible'); clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3400);
}

// ============================================================================
// Page Initializers
// ============================================================================

/** Home / Dashboard Page */
export async function initHomePage(user) {
  const pageContent = document.getElementById('pageContent');
  if (!pageContent) return;

  // Elements
  const navDisplayName = document.getElementById('navDisplayName');
  const navAvatar = document.getElementById('navAvatar');
  const mobileAvatar = document.getElementById('mobileAvatar');
  const homeInvitationsSection = document.getElementById('homeInvitationsSection');
  const homeNotifBtn = document.getElementById('homeNotifBtn');
  const mobileNotifBtn = document.getElementById('mobileNotifBtn');
  const homeNotifBadge = document.getElementById('homeNotifBadge');
  const mobileNotifBadge = document.getElementById('mobileNotifBadge');
  const homeYourConferencesSection = document.getElementById('homeYourConferencesSection');
  const homeConfHeaderAction = document.getElementById('homeConfHeaderAction');
  const homeConferencesContainer = document.getElementById('homeConferencesContainer');
  const homeSearchForm = document.getElementById('homeSearchForm');
  const homeSearchInput = document.getElementById('homeSearchInput');
  const homeSearchClear = document.getElementById('homeSearchClear');
  const logoutBtn = document.getElementById('logoutBtn');

  let unsubscribeInvitations = null;
  let unsubscribeUserConferences = null;
  let allPendingInvitations = [];
  let currentDraft = null;
  let currentOwnedConferences = [];
  let currentUser = user;

  function renderUserData(userData) {
    if (!userData) return;
    const displayName = userData.displayName || (userData.email ? userData.email.split('@')[0] : 'Delegate');
    const initial = (displayName[0] || 'D').toUpperCase();
    const role = userData.accountType || userData.role || 'individual';
    const photoURL = userData.photoURL || userData.avatar || userData.profile?.photoURL || userData.profile?.avatar || null;
    if (navDisplayName) navDisplayName.textContent = displayName;
    if (navAvatar) { if (photoURL) navAvatar.innerHTML = `<img src="${photoURL}" alt="${displayName}">`; else navAvatar.textContent = initial; }
    if (mobileAvatar) { if (photoURL) mobileAvatar.innerHTML = `<img src="${photoURL}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`; else mobileAvatar.textContent = initial; }
    if (window.drawerController) window.drawerController.applyRole(role);
  }

  function triggerUniversalNotifications(e) { if (e) { e.preventDefault(); e.stopPropagation(); } window.location.href = 'notifications.html'; }
  document.getElementById('sidebarNotifItem')?.addEventListener('click', triggerUniversalNotifications);
  homeNotifBtn?.addEventListener('click', triggerUniversalNotifications);
  mobileNotifBtn?.addEventListener('click', triggerUniversalNotifications);

  async function acceptInvitationAction(targetInv, user, btn) { /* ... implementation from home.html ... */ }
  async function declineInvitationAction(targetInv, user, btn) { /* ... implementation from home.html ... */ }

  function renderInvitations(invList, user) { /* ... implementation from home.html ... */ }
  function listenForRoleInvitations(user) { /* ... implementation from home.html ... */ }
  function getLocalUserConferences(user) { /* ... implementation from home.html ... */ }
  function renderYourConferences(conferences, user) { /* ... implementation from home.html ... */ }
  function listenForUserConferences(user) { /* ... implementation from home.html ... */ }

  // Search functionality
  if (homeSearchInput) {
    const toggleClear = () => { if (homeSearchClear) homeSearchClear.classList.toggle('is-visible', homeSearchInput.value.trim().length > 0); };
    homeSearchInput.addEventListener('input', toggleClear);
    if (homeSearchClear) { homeSearchClear.addEventListener('click', () => { homeSearchInput.value = ''; toggleClear(); homeSearchInput.focus(); }); }
    if (homeSearchForm) { homeSearchForm.addEventListener('submit', (e) => { e.preventDefault(); const val = homeSearchInput.value.trim(); const params = new URLSearchParams(); if (val) params.set('search', val); window.location.href = `conferences.html?${params.toString()}`; }); }
  }

  // Initial load
  currentDraft = getLocalDraft();
  const initialLocalConfs = getLocalUserConferences(currentUser);
  currentOwnedConferences = initialLocalConfs;
  renderYourConferences(initialLocalConfs, currentUser);

  if (currentUser?.email) listenForRoleInvitations(currentUser);
  listenForUserConferences(currentUser);

  // Logout
  if (logoutBtn) { logoutBtn.addEventListener('click', async () => { if (unsubscribeInvitations) unsubscribeInvitations(); if (unsubscribeUserConferences) unsubscribeUserConferences(); currentDraft = null; clearSession(); await signOut(auth); window.location.href = 'index.html'; }); }

  // Cleanup on unload
  return () => { if (unsubscribeInvitations) unsubscribeInvitations(); if (unsubscribeUserConferences) unsubscribeUserConferences(); };
}

/** Conferences Page */
export async function initConferencesPage(user) {
  // Implementation from conferences.html
  // ... (similar pattern - move the conferences.html script logic here)
  console.log('[PageController] Conferences page initialized');
}

/** Committees Page */
export async function initCommitteesPage(user) {
  console.log('[PageController] Committees page initialized');
}

/** Resources Page */
export async function initResourcesPage(user) {
  const countryGrid = document.getElementById('countryGrid');
  const countrySearchInput = document.getElementById('countrySearchInput');
  const countryCountPill = document.getElementById('countryCountPill');
  const countryDossierSubtitle = document.getElementById('countryDossierSubtitle');
  const mapCountryCount = document.getElementById('mapCountryCount');

  const activeRopBadge = document.getElementById('activeRopBadge');
  const timerChimeStatusBadge = document.getElementById('timerChimeStatusBadge');

  // Dossier modal elements
  const countryDossierModal = document.getElementById('countryDossierModal');
  const countryNotesForm = document.getElementById('countryNotesForm');
  const dossierFlagImg = document.getElementById('dossierFlagImg');
  const dossierCountryTitle = document.getElementById('dossierCountryTitle');
  const dossierCca3 = document.getElementById('dossierCca3');
  const dossierNameHidden = document.getElementById('dossierNameHidden');
  const dossierFactsGrid = document.getElementById('dossierFactsGrid');
  const dossierAlliesInput = document.getElementById('dossierAlliesInput');
  const dossierStanceNotes = document.getElementById('dossierStanceNotes');
  const dossierSaveStatus = document.getElementById('dossierSaveStatus');
  const btnSaveCountryNotes = document.getElementById('btnSaveCountryNotes');

  let currentUser = user;
  let userPrefs = { timerChime: true, ropStandard: 'American / Harvard HMUN' };
  let allCountries = [];
  let userCountryNotesMap = new Map();
  let unsubscribeNotes = null;
  let unsubscribeUserPrefs = null;

  // ---- World Map (Leaflet) ----
  let map = null;
  let mapLoaded = false;
  let countryMarkers = [];

  async function loadLeaflet() {
    if (window.L) return;
    if (mapLoaded) return;
    mapLoaded = true;
    if (!document.querySelector('link[href*="leaflet.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="leaflet.js"]')) {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';
        script.onload = resolve;
        script.onerror = resolve;
        document.head.appendChild(script);
      });
    }
  }

  function initWorldMap(countries) {
    const container = document.getElementById('worldMapContainer');
    if (!container) return;
    container.innerHTML = '<div id="leafletMap" style="height: 100%; width: 100%;"></div>';
    loadLeaflet().then(() => {
      if (!window.L) return;
      try {
        map = L.map('leafletMap', { zoomControl: true, attributionControl: false }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 5,
          minZoom: 1,
        }).addTo(map);

        const latlngs = countries.map(c => {
          const latlng = c.latlng;
          if (latlng && latlng.length === 2) return [latlng[0], latlng[1]];
          return null;
        }).filter(Boolean);

        if (latlngs.length) {
          const group = L.featureGroup(latlngs.map(p => L.marker(p)));
          map.fitBounds(group.getBounds().pad(0.15));
        }

        countryMarkers = countries.map(c => {
          const latlng = c.latlng;
          if (!latlng || latlng.length !== 2) return null;
          const marker = L.marker([latlng[0], latlng[1]], { title: c.name?.common || c.cca3 });
          marker.addTo(map);
          marker.on('click', () => openDossierByCode(c.cca3));
          return marker;
        }).filter(Boolean);

        if (mapCountryCount) mapCountryCount.textContent = `${countries.length} UN States`;
      } catch (mapErr) {
        console.warn('Map initialization notice:', mapErr);
      }
    }).catch((err) => {
      console.warn('Leaflet map load failed:', err);
      if (mapCountryCount) mapCountryCount.textContent = 'Map unavailable';
    });
  }

  function openDossierByCode(cca3) {
    const c = allCountries.find(item => item.cca3 === cca3);
    if (!c) return;
    if (dossierCca3) dossierCca3.value = cca3;
    if (dossierNameHidden) dossierNameHidden.value = c.name?.common || cca3;
    if (dossierCountryTitle) dossierCountryTitle.textContent = `${c.name?.common || cca3} (${cca3})`;
    if (dossierSaveStatus) dossierSaveStatus.textContent = '';

    if (dossierFlagImg) {
      if (c.flags?.svg) {
        dossierFlagImg.src = c.flags.svg;
        dossierFlagImg.style.display = 'block';
      } else {
        dossierFlagImg.style.display = 'none';
      }
    }

    const capital = Array.isArray(c.capital) && c.capital.length ? c.capital.join(', ') : '—';
    const pop = typeof c.population === 'number' ? c.population.toLocaleString() : '—';
    const langs = c.languages ? Object.values(c.languages).slice(0, 3).join(', ') : '—';
    const currs = c.currencies ? Object.values(c.currencies).map(cur => `${cur.name} (${cur.symbol || ''})`).slice(0, 2).join(', ') : '—';

    if (dossierFactsGrid) {
      dossierFactsGrid.innerHTML = `
        <div><strong>Official Name:</strong><br>${escapeHtml(c.name?.official || '—')}</div>
        <div><strong>Region:</strong><br>${escapeHtml(c.subregion || c.region || '—')}</div>
        <div><strong>Capital:</strong><br>${escapeHtml(capital)}</div>
        <div><strong>Population:</strong><br>${escapeHtml(pop)}</div>
        <div><strong>Languages:</strong><br>${escapeHtml(langs)}</div>
        <div><strong>Currency:</strong><br>${escapeHtml(currs)}</div>
      `;
    }

    const saved = userCountryNotesMap.get(cca3) || {};
    if (dossierAlliesInput) dossierAlliesInput.value = saved.allies || '';
    if (dossierStanceNotes) dossierStanceNotes.value = saved.stanceNotes || '';

    if (countryDossierModal) countryDossierModal.classList.add('is-open');
  }

  // Modal close handlers
  document.querySelectorAll('[data-close-modal="countryDossierModal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (countryDossierModal) countryDossierModal.classList.remove('is-open');
    });
  });

  function applyUserPreferences(prefs = {}) {
    userPrefs = {
      timerChime: prefs.timerChime !== false,
      ropStandard: prefs.ropStandard || 'American / Harvard HMUN'
    };
    if (activeRopBadge) activeRopBadge.textContent = `Standard: ${userPrefs.ropStandard}`;
    if (timerChimeStatusBadge) {
      timerChimeStatusBadge.textContent = `Audio Chime: ${userPrefs.timerChime ? 'Enabled' : 'Muted (Settings)'}`;
    }
  }

  const initialSession = getSession();
  if (initialSession && initialSession.preferences) {
    applyUserPreferences(initialSession.preferences);
  }

  function renderCountries() {
    if (!countryGrid) return;
    const queryStr = (countrySearchInput?.value || '').trim().toLowerCase();

    const filtered = allCountries.filter(c => {
      if (!queryStr) return true;
      const name = (c.name?.common || '').toLowerCase();
      const official = (c.name?.official || '').toLowerCase();
      const region = (c.region || '').toLowerCase();
      const subregion = (c.subregion || '').toLowerCase();
      const capital = (Array.isArray(c.capital) ? c.capital.join(' ') : '').toLowerCase();
      const cca3 = (c.cca3 || '').toLowerCase();
      return name.includes(queryStr) || official.includes(queryStr) || region.includes(queryStr) || subregion.includes(queryStr) || capital.includes(queryStr) || cca3.includes(queryStr);
    });

    if (countryCountPill) {
      countryCountPill.textContent = `${filtered.length} UN States`;
    }

    if (filtered.length === 0) {
      countryGrid.innerHTML = `
        <div class="mun-db-empty-card">
          <ion-icon name="search-outline"></ion-icon>
          <h3>No matching UN Member States found</h3>
          <p>Try searching by country name, ISO code, region (Europe, Asia, Africa), or capital city.</p>
        </div>
      `;
      return;
    }

    countryGrid.innerHTML = filtered.map(c => {
      const hasNotes = userCountryNotesMap.has(c.cca3);
      const cap = Array.isArray(c.capital) && c.capital.length > 0 ? c.capital[0] : c.region;
      return `
        <button type="button" class="country-pill-card" data-country-code="${escapeHtml(c.cca3)}" style="text-align: left; cursor: pointer; width: 100%; border: 1px solid ${hasNotes ? '#86efac' : '#e2e8f0'}; background: ${hasNotes ? '#f0fdf4' : '#ffffff'};">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            ${c.flags?.svg ? `<img src="${escapeHtml(c.flags.svg)}" alt="${escapeHtml(c.name?.common)}" style="width: 28px; height: 19px; object-fit: cover; border-radius: 3px; border: 1px solid #e2e8f0; flex-shrink: 0;">` : ''}
            <div style="min-width: 0;">
              <div class="country-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.name?.common || '')}</div>
              <div class="country-bloc">${escapeHtml(c.subregion || c.region || 'UN Member')}  ${escapeHtml(cap || '')}${hasNotes ? '  Notes Saved' : ''}</div>
            </div>
            <ion-icon name="chevron-forward-outline" style="flex-shrink: 0;"></ion-icon>
          </div>
        </button>
      `;
    }).join('');
  }

  async function loadLiveUNMemberStates() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/independent?status=true&fields=name,cca3,region,subregion,capital,population,flags,languages,currencies,unMember,latlng');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      allCountries = (Array.isArray(data) ? data : [])
        .filter(c => c && c.unMember)
        .sort((a, b) => (a.name?.common || '').localeCompare(b.name?.common || ''));

      if (countryDossierSubtitle) {
        countryDossierSubtitle.textContent = `${allCountries.length} sovereign United Nations Member States loaded live via REST Countries API. Click any state to inspect facts & save Firestore diplomatic notes.`;
      }
      renderCountries();
      initWorldMap(allCountries);
    } catch (err) {
      if (countryDossierSubtitle) {
        countryDossierSubtitle.textContent = 'Could not reach live REST Countries API.';
      }
      if (countryGrid) {
        countryGrid.innerHTML = `
          <div class="mun-db-empty-card">
            <ion-icon name="cloud-offline-outline" style="color: #dc2626;"></ion-icon>
            <h3>Unable to fetch live UN Member States</h3>
            <p>Check your internet connection and reload to query live REST Countries state dossiers.</p>
          </div>
        `;
      }
    }
  }

  loadLiveUNMemberStates();

  if (countrySearchInput) {
    countrySearchInput.addEventListener('input', renderCountries);
  }

  if (countryGrid) {
    countryGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-country-code]');
      if (!btn) return;
      const cca3 = btn.getAttribute('data-country-code');
      openDossierByCode(cca3);
    });
  }

  if (countryNotesForm) {
    countryNotesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser || !currentUser.uid) {
        alert('Please sign in to save diplomatic research notes.');
        return;
      }

      const cca3 = dossierCca3.value;
      if (!cca3) return;

      if (btnSaveCountryNotes) {
        btnSaveCountryNotes.disabled = true;
        btnSaveCountryNotes.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon><span>Saving...</span>';
      }
      if (dossierSaveStatus) dossierSaveStatus.textContent = '';

      try {
        const noteId = `${currentUser.uid}_${cca3}`;
        await setDoc(doc(db, 'countryNotes', noteId), {
          uid: currentUser.uid,
          countryCode: cca3,
          countryName: dossierNameHidden?.value || cca3,
          allies: (dossierAlliesInput?.value || '').trim(),
          stanceNotes: (dossierStanceNotes?.value || '').trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        if (dossierSaveStatus) {
          dossierSaveStatus.style.color = '#059669';
          dossierSaveStatus.textContent = 'Diplomatic research notes saved to Cloud Firestore!';
        }
        userCountryNotesMap.set(cca3, {
          allies: (dossierAlliesInput?.value || '').trim(),
          stanceNotes: (dossierStanceNotes?.value || '').trim(),
        });
        renderCountries();
      } catch (err) {
        if (dossierSaveStatus) {
          dossierSaveStatus.style.color = '#dc2626';
          dossierSaveStatus.textContent = err.message || 'Database error occurred while saving notes.';
        }
      } finally {
        if (btnSaveCountryNotes) {
          btnSaveCountryNotes.disabled = false;
          btnSaveCountryNotes.innerHTML = '<ion-icon name="save-outline"></ion-icon><span>Save Research Notes</span>';
        }
      }
    });
  }

  // Firestore listeners for notes
  if (currentUser && currentUser.uid) {
    try {
      const notesQuery = query(collection(db, 'countryNotes'), where('uid', '==', currentUser.uid));
      unsubscribeNotes = onSnapshot(notesQuery, (snap) => {
        userCountryNotesMap = new Map(snap.docs.map(d => {
          const data = d.data();
          return [data.countryCode, data];
        }));
        renderCountries();
      });
    } catch (e) { }
  }

  // Interactive Caucus Timer
  let remainingSeconds = 60;
  let initialPreset = 60;
  let timerInterval = null;
  let isRunning = false;
  const timerDisplay = document.getElementById('timerDisplay');
  const timerNoticeText = document.getElementById('timerNoticeText');
  const timerStartBtn = document.getElementById('timerStartBtn');
  const timerPauseBtn = document.getElementById('timerPauseBtn');
  const timerResetBtn = document.getElementById('timerResetBtn');
  const timerPresetBtns = document.querySelectorAll('[data-timer-sec]');

  function playChime() {
    if (!userPrefs.timerChime) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (e) { }
  }

  function updateTimerDisplay() {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    if (timerDisplay) {
      timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  timerPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      timerPresetBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      clearInterval(timerInterval);
      isRunning = false;
      initialPreset = parseInt(btn.getAttribute('data-timer-sec'), 10) || 60;
      remainingSeconds = initialPreset;
      if (timerNoticeText) timerNoticeText.textContent = '';
      updateTimerDisplay();
    });
  });

  if (timerStartBtn) {
    timerStartBtn.addEventListener('click', () => {
      if (isRunning) return;
      if (timerNoticeText) timerNoticeText.textContent = '';
      isRunning = true;
      timerInterval = setInterval(() => {
        if (remainingSeconds > 0) {
          remainingSeconds--;
          updateTimerDisplay();
        } else {
          clearInterval(timerInterval);
          isRunning = false;
          playChime();
          if (timerNoticeText) {
            timerNoticeText.textContent = 'Time has elapsed — yield to the Chair or another delegate.';
          }
        }
      }, 1000);
    });
  }

  if (timerPauseBtn) {
    timerPauseBtn.addEventListener('click', () => {
      clearInterval(timerInterval);
      isRunning = false;
    });
  }

  if (timerResetBtn) {
    timerResetBtn.addEventListener('click', () => {
      clearInterval(timerInterval);
      isRunning = false;
      remainingSeconds = initialPreset;
      if (timerNoticeText) timerNoticeText.textContent = '';
      updateTimerDisplay();
    });
  }

  console.log('[PageController] Resources page initialized');

  // Return cleanup function when leaving the page
  return () => {
    clearInterval(timerInterval);
    if (unsubscribeNotes) unsubscribeNotes();
    if (unsubscribeUserPrefs) unsubscribeUserPrefs();
    if (map) {
      try { map.remove(); } catch (e) { }
      map = null;
    }
  };
}

/** Resolutions Page */
export async function initResolutionsPage(user) {
  console.log('[PageController] Resolutions page initialized');
}

/** NGOs Page */
export async function initNGOsPage(user) {
  console.log('[PageController] NGOs page initialized');
}

/** Pricing Page */
export async function initPricingPage(user) {
  console.log('[PageController] Pricing page initialized');
}

/** Profile Page */
export async function initProfilePage(user) {
  console.log('[PageController] Profile page initialized');
}

/** Notifications Page */
export async function initNotificationsPage(user) {
  console.log('[PageController] Notifications page initialized');
}

/** Conference Detail Page */
export async function initConferenceDetailPage(user) {
  console.log('[PageController] Conference Detail page initialized');
}

/** Committee Detail Page */
export async function initCommitteeDetailPage(user) {
  console.log('[PageController] Committee Detail page initialized');
}

/** Country Directory Page */
export async function initCountryPage(user) {
  const countryGrid = document.getElementById('countryGrid');
  const countrySearch = document.getElementById('countryPageSearch');
  const regionFilter = document.getElementById('countryRegionFilter');
  const blocFilter = document.getElementById('countryBlocFilter');
  const unFilter = document.getElementById('countryUnFilter');

  const statTotalCountries = document.getElementById('statTotalCountries');
  const statTotalPopulation = document.getElementById('statTotalPopulation');
  const statTotalArea = document.getElementById('statTotalArea');
  const statUnMembers = document.getElementById('statUnMembers');

  // Dossier modal elements
  const countryDossierModal = document.getElementById('countryDossierModal');
  const countryNotesForm = document.getElementById('countryNotesForm');
  const dossierFlagImg = document.getElementById('dossierFlagImg');
  const dossierCountryTitle = document.getElementById('dossierCountryTitle');
  const dossierCca3 = document.getElementById('dossierCca3');
  const dossierNameHidden = document.getElementById('dossierNameHidden');
  const dossierFactsGrid = document.getElementById('dossierFactsGrid');
  const dossierAlliesInput = document.getElementById('dossierAlliesInput');
  const dossierStanceNotes = document.getElementById('dossierStanceNotes');
  const dossierSaveStatus = document.getElementById('dossierSaveStatus');
  const btnSaveCountryNotes = document.getElementById('btnSaveCountryNotes');

  let allCountries = [];
  let userCountryNotesMap = new Map();
  let unsubscribeNotes = null;

  function openDossierByCode(cca3) {
    const c = allCountries.find(item => item.cca3 === cca3);
    if (!c) return;
    if (dossierCca3) dossierCca3.value = cca3;
    if (dossierNameHidden) dossierNameHidden.value = c.name?.common || cca3;
    if (dossierCountryTitle) dossierCountryTitle.textContent = `${c.name?.common || cca3} (${cca3})`;
    if (dossierSaveStatus) dossierSaveStatus.textContent = '';

    if (dossierFlagImg) {
      if (c.flags?.svg) {
        dossierFlagImg.src = c.flags.svg;
        dossierFlagImg.style.display = 'block';
      } else {
        dossierFlagImg.style.display = 'none';
      }
    }

    const capital = Array.isArray(c.capital) && c.capital.length ? c.capital.join(', ') : '—';
    const pop = typeof c.population === 'number' ? c.population.toLocaleString() : '—';
    const langs = c.languages ? Object.values(c.languages).slice(0, 3).join(', ') : '—';
    const currs = c.currencies ? Object.values(c.currencies).map(cur => `${cur.name} (${cur.symbol || ''})`).slice(0, 2).join(', ') : '—';

    if (dossierFactsGrid) {
      dossierFactsGrid.innerHTML = `
        <div><strong>Official Name:</strong><br>${escapeHtml(c.name?.official || '—')}</div>
        <div><strong>Region:</strong><br>${escapeHtml(c.subregion || c.region || '—')}</div>
        <div><strong>Capital:</strong><br>${escapeHtml(capital)}</div>
        <div><strong>Population:</strong><br>${escapeHtml(pop)}</div>
        <div><strong>Languages:</strong><br>${escapeHtml(langs)}</div>
        <div><strong>Currency:</strong><br>${escapeHtml(currs)}</div>
      `;
    }

    const saved = userCountryNotesMap.get(cca3) || {};
    if (dossierAlliesInput) dossierAlliesInput.value = saved.allies || '';
    if (dossierStanceNotes) dossierStanceNotes.value = saved.stanceNotes || '';

    if (countryDossierModal) countryDossierModal.classList.add('is-open');
  }

  // Modal close handlers
  document.querySelectorAll('[data-close-modal="countryDossierModal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (countryDossierModal) countryDossierModal.classList.remove('is-open');
    });
  });

  function renderCountries() {
    if (!countryGrid) return;
    const queryStr = (countrySearch?.value || '').trim().toLowerCase();
    const selRegion = regionFilter?.value || 'all';
    const selUn = unFilter?.value || 'all';

    const filtered = allCountries.filter(c => {
      // Text search
      if (queryStr) {
        const name = (c.name?.common || '').toLowerCase();
        const official = (c.name?.official || '').toLowerCase();
        const region = (c.region || '').toLowerCase();
        const capital = (Array.isArray(c.capital) ? c.capital.join(' ') : '').toLowerCase();
        const cca3 = (c.cca3 || '').toLowerCase();
        if (!name.includes(queryStr) && !official.includes(queryStr) && !region.includes(queryStr) && !capital.includes(queryStr) && !cca3.includes(queryStr)) {
          return false;
        }
      }
      // Region filter
      if (selRegion !== 'all' && c.region !== selRegion) return false;
      // UN filter
      if (selUn === 'member' && !c.unMember) return false;
      if (selUn === 'observer' && c.unMember) return false;
      return true;
    });

    if (filtered.length === 0) {
      countryGrid.innerHTML = `
        <div class="mun-db-empty-card" style="grid-column: 1 / -1;">
          <ion-icon name="search-outline"></ion-icon>
          <h3>No matching sovereign states found</h3>
          <p>Try broadening your search or adjusting filters.</p>
        </div>
      `;
      return;
    }

    countryGrid.innerHTML = filtered.map(c => {
      const hasNotes = userCountryNotesMap.has(c.cca3);
      const cap = Array.isArray(c.capital) && c.capital.length > 0 ? c.capital[0] : c.region;
      return `
        <div class="country-pill-card" data-country-code="${escapeHtml(c.cca3)}" style="border: 1px solid ${hasNotes ? '#86efac' : '#e2e8f0'}; background: ${hasNotes ? '#f0fdf4' : '#ffffff'};">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            ${c.flags?.svg ? `<img src="${escapeHtml(c.flags.svg)}" alt="${escapeHtml(c.name?.common)}" style="width: 32px; height: 21px; object-fit: cover; border-radius: 3px; border: 1px solid #e2e8f0; flex-shrink: 0;">` : ''}
            <div style="min-width: 0;">
              <div class="country-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.name?.common || '')}</div>
              <div class="country-bloc">${escapeHtml(c.subregion || c.region || 'UN Member')} • ${escapeHtml(cap || '')}${hasNotes ? ' • Notes Saved' : ''}</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <a href="country-detail.html?code=${escapeHtml(c.cca3)}" class="mun-btn-outline" style="padding: 4px 8px; font-size: 11px; text-decoration: none;" title="View Full Profile">
              <span>View</span>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateStats(countries) {
    if (statTotalCountries) statTotalCountries.textContent = countries.length.toLocaleString();
    const totalPop = countries.reduce((sum, c) => sum + (c.population || 0), 0);
    if (statTotalPopulation) {
      if (totalPop >= 1e9) statTotalPopulation.textContent = `${(totalPop / 1e9).toFixed(2)}B`;
      else if (totalPop >= 1e6) statTotalPopulation.textContent = `${(totalPop / 1e6).toFixed(1)}M`;
      else statTotalPopulation.textContent = totalPop.toLocaleString();
    }
    const totalArea = countries.reduce((sum, c) => sum + (c.area || 0), 0);
    if (statTotalArea) {
      if (totalArea >= 1e6) statTotalArea.textContent = `${(totalArea / 1e6).toFixed(1)}M`;
      else statTotalArea.textContent = totalArea.toLocaleString();
    }
    const unCount = countries.filter(c => c.unMember).length;
    if (statUnMembers) statUnMembers.textContent = unCount.toLocaleString();
  }

  // Fetch REST Countries
  try {
    const res = await fetch('https://restcountries.com/v3.1/independent?status=true&fields=name,cca3,cca2,region,subregion,capital,population,area,flags,languages,currencies,unMember');
    if (res.ok) {
      const data = await res.json();
      allCountries = (Array.isArray(data) ? data : []).sort((a, b) => (a.name?.common || '').localeCompare(b.name?.common || ''));
      updateStats(allCountries);
      renderCountries();
    }
  } catch (err) {
    console.warn('Error fetching countries for directory:', err);
  }

  // Event listeners
  if (countrySearch) countrySearch.addEventListener('input', renderCountries);
  if (regionFilter) regionFilter.addEventListener('change', renderCountries);
  if (blocFilter) blocFilter.addEventListener('change', renderCountries);
  if (unFilter) unFilter.addEventListener('change', renderCountries);

  if (countryGrid) {
    countryGrid.addEventListener('click', (e) => {
      const card = e.target.closest('[data-country-code]');
      if (!card || e.target.closest('a')) return;
      const cca3 = card.getAttribute('data-country-code');
      openDossierByCode(cca3);
    });
  }

  // Firestore country notes
  if (user && user.uid) {
    try {
      const notesQuery = query(collection(db, 'countryNotes'), where('uid', '==', user.uid));
      unsubscribeNotes = onSnapshot(notesQuery, (snap) => {
        userCountryNotesMap = new Map(snap.docs.map(d => [d.data().countryCode, d.data()]));
        renderCountries();
      });
    } catch (e) { }
  }

  if (countryNotesForm) {
    countryNotesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!user || !user.uid) {
        alert('Please sign in to save research notes.');
        return;
      }
      const cca3 = dossierCca3?.value;
      if (!cca3) return;
      if (btnSaveCountryNotes) {
        btnSaveCountryNotes.disabled = true;
        btnSaveCountryNotes.innerHTML = '<ion-icon name="sync-outline" class="spin"></ion-icon><span>Saving...</span>';
      }
      try {
        const noteId = `${user.uid}_${cca3}`;
        await setDoc(doc(db, 'countryNotes', noteId), {
          uid: user.uid,
          countryCode: cca3,
          countryName: dossierNameHidden?.value || cca3,
          allies: (dossierAlliesInput?.value || '').trim(),
          stanceNotes: (dossierStanceNotes?.value || '').trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        if (dossierSaveStatus) {
          dossierSaveStatus.style.color = '#059669';
          dossierSaveStatus.textContent = 'Notes saved to Cloud Firestore!';
        }
        userCountryNotesMap.set(cca3, {
          allies: (dossierAlliesInput?.value || '').trim(),
          stanceNotes: (dossierStanceNotes?.value || '').trim()
        });
        renderCountries();
      } catch (err) {
        if (dossierSaveStatus) {
          dossierSaveStatus.style.color = '#dc2626';
          dossierSaveStatus.textContent = err.message || 'Error saving notes.';
        }
      } finally {
        if (btnSaveCountryNotes) {
          btnSaveCountryNotes.disabled = false;
          btnSaveCountryNotes.innerHTML = '<ion-icon name="save-outline"></ion-icon><span>Save Research Notes</span>';
        }
      }
    });
  }

  console.log('[PageController] Country directory page initialized');
  return () => {
    if (unsubscribeNotes) unsubscribeNotes();
  };
}

/** Country Detail Page */
export async function initCountryDetailPage(user) {
  const urlParams = new URLSearchParams(window.location.search);
  const code = (urlParams.get('code') || urlParams.get('cca3') || 'USA').toUpperCase();

  const flagImg = document.getElementById('countryDetailFlag');
  const regionEl = document.getElementById('countryDetailRegion');
  const subregionEl = document.getElementById('countryDetailSubregion');
  const titleEl = document.getElementById('countryDetailTitle');
  const capitalEl = document.getElementById('countryDetailCapital');

  // Tab switcher
  const tabs = document.querySelectorAll('#countryDetailTabs .country-detail-tab');
  const panels = document.querySelectorAll('.country-detail-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(panel => {
        if (panel.id === `panel-ctry-${targetTab}`) {
          panel.classList.add('is-active');
          panel.removeAttribute('hidden');
        } else {
          panel.classList.remove('is-active');
          panel.setAttribute('hidden', '');
        }
      });
    });
  });

  // Fact elements
  const factOfficialName = document.getElementById('factOfficialName');
  const factCca3 = document.getElementById('factCca3');
  const factCca2 = document.getElementById('factCca2');
  const factUnStatus = document.getElementById('factUnStatus');
  const factCapital = document.getElementById('factCapital');
  const factTimezones = document.getElementById('factTimezones');
  const factDrivingSide = document.getElementById('factDrivingSide');
  const ctryBlocs = document.getElementById('ctryBlocs');

  // Notes form elements
  const countryNotesFormInline = document.getElementById('countryNotesFormInline');
  const ctryAlliesInput = document.getElementById('ctryAlliesInput');
  const ctryStanceNotes = document.getElementById('ctryStanceNotes');
  const ctrySaveStatus = document.getElementById('ctrySaveStatus');

  let unsubscribeDetailNotes = null;

  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}`);
    if (res.ok) {
      const data = await res.json();
      const c = Array.isArray(data) ? data[0] : data;
      if (c) {
        if (titleEl) titleEl.textContent = c.name?.common || code;
        if (regionEl) regionEl.textContent = c.region || '—';
        if (subregionEl) subregionEl.textContent = c.subregion ? `• ${c.subregion}` : '';
        const cap = Array.isArray(c.capital) && c.capital.length ? c.capital.join(', ') : '—';
        if (capitalEl) capitalEl.textContent = `Capital: ${cap}`;

        if (flagImg && c.flags?.svg) {
          flagImg.src = c.flags.svg;
          flagImg.alt = c.name?.common || code;
          flagImg.style.display = 'block';
        }

        if (factOfficialName) factOfficialName.textContent = c.name?.official || '—';
        if (factCca3) factCca3.textContent = c.cca3 || code;
        if (factCca2) factCca2.textContent = c.cca2 || '—';
        if (factUnStatus) factUnStatus.textContent = c.unMember ? 'Full Member State' : 'Observer / Non-member';
        if (factCapital) factCapital.textContent = cap;
        if (factTimezones) factTimezones.textContent = Array.isArray(c.timezones) ? c.timezones.slice(0, 3).join(', ') : '—';
        if (factDrivingSide) factDrivingSide.textContent = c.car?.side ? (c.car.side.charAt(0).toUpperCase() + c.car.side.slice(1)) : '—';

        if (ctryBlocs) {
          const blocs = [];
          if (c.unMember) blocs.push('United Nations (UN)');
          if (c.region === 'Europe') blocs.push('European Region');
          if (c.region === 'Africa') blocs.push('African Region');
          if (c.region === 'Americas') blocs.push('Americas Bloc');
          if (c.region === 'Asia') blocs.push('Asia-Pacific');
          ctryBlocs.innerHTML = blocs.map(b => `<span class="bloc-tag">${escapeHtml(b)}</span>`).join('');
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching country detail:', err);
  }

  // Load existing notes from Firestore
  if (user && user.uid) {
    try {
      const noteDocRef = doc(db, 'countryNotes', `${user.uid}_${code}`);
      unsubscribeDetailNotes = onSnapshot(noteDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (ctryAlliesInput) ctryAlliesInput.value = data.allies || '';
          if (ctryStanceNotes) ctryStanceNotes.value = data.stanceNotes || '';
        }
      });
    } catch (e) { }
  }

  if (countryNotesFormInline) {
    countryNotesFormInline.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!user || !user.uid) {
        alert('Please sign in to save diplomatic research notes.');
        return;
      }
      try {
        await setDoc(doc(db, 'countryNotes', `${user.uid}_${code}`), {
          uid: user.uid,
          countryCode: code,
          allies: (ctryAlliesInput?.value || '').trim(),
          stanceNotes: (ctryStanceNotes?.value || '').trim(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        if (ctrySaveStatus) {
          ctrySaveStatus.style.color = '#059669';
          ctrySaveStatus.textContent = 'Diplomatic notes saved to Cloud Firestore!';
        }
      } catch (err) {
        if (ctrySaveStatus) {
          ctrySaveStatus.style.color = '#dc2626';
          ctrySaveStatus.textContent = err.message || 'Error saving notes.';
        }
      }
    });
  }

  console.log('[PageController] Country detail page initialized for', code);
  return () => {
    if (unsubscribeDetailNotes) unsubscribeDetailNotes();
  };
}

/** Onboarding Page */
export async function initOnboardingPage(user) {
  console.log('[PageController] Onboarding page initialized');
}

/** Sign In Page */
export async function initSigninPage(user) {
  console.log('[PageController] Sign In page initialized');
}

/** Sign Up Page */
export async function initSignupPage(user) {
  console.log('[PageController] Sign Up page initialized');
}

/** 404 Page */
export async function init404Page(user) {
  console.log('[PageController] 404 page initialized');
}

// ============================================================================
// Page Router Map
// ============================================================================
export const pageInitializers = {
  'home.html': initHomePage,
  'index.html': initHomePage,
  'conferences.html': initConferencesPage,
  'committees.html': initCommitteesPage,
  'resources.html': initResourcesPage,
  'resolutions.html': initResolutionsPage,
  'ngos.html': initNGOsPage,
  'pricing.html': initPricingPage,
  'profile.html': initProfilePage,
  'notifications.html': initNotificationsPage,
  'conference-detail.html': initConferenceDetailPage,
  'committee-detail.html': initCommitteeDetailPage,
  'country.html': initCountryPage,
  'country-detail.html': initCountryDetailPage,
  'onboarding.html': initOnboardingPage,
  'signin.html': initSigninPage,
  'signup.html': initSignupPage,
  '404.html': init404Page,
};

/** Initialize a page by path */
export async function initializePage(path, user) {
  const pageName = path.split('/').pop() || 'home.html';
  const initializer = pageInitializers[pageName];
  if (initializer) {
    try {
      const cleanup = await initializer(user);
      return cleanup;
    } catch (e) {
      console.error(`[PageController] Error initializing ${pageName}:`, e);
    }
  }
  return null;
}