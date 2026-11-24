/**
 * Step 9 - Preview & Publish
 * Handles live preview card and publish checklist
 */

import { R2_CONFIG } from '../r2-config.js';
import { isWideCommittee } from './step2.js';

let wizardDataRef = {};

/**
 * Initialize Step 9
 */
export async function initStep9(existingData = {}) {
  wizardDataRef = existingData;

  // Render preview card
  renderPreview();

  // Render checklist
  renderChecklist();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Cleanup Step 9
 */
export function cleanupStep9() {
  // Clean up if needed
}

/**
 * Get Step 9 data
 */
export function getStep9Data() {
  return {};
}

/**
 * Validate Step 9
 */
export function validateStep9() {
  // Preview step doesn't need validation - it reads from other steps
  return true;
}

/**
 * Render preview card
 */
function renderPreview() {
  const data = wizardDataRef;

  // Title
  const titleEl = document.getElementById('previewTitle');
  if (titleEl) titleEl.textContent = data.title || 'Conference Name';

  // Institution
  const instEl = document.getElementById('previewInstitution');
  if (instEl) instEl.textContent = data.institution || 'Institution Name';

  // Description/Tagline
  const taglineEl = document.getElementById('previewTagline');
  if (taglineEl) {
    if (data.description) {
      taglineEl.textContent = data.description;
      taglineEl.style.display = 'block';
    } else {
      taglineEl.style.display = 'none';
    }
  }

  // Dates
  const datesEl = document.getElementById('previewDates');
  if (datesEl && data.startDate && data.endDate) {
    const start = new Date(data.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(data.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    datesEl.textContent = `${start} – ${end}`;
  } else if (datesEl) {
    datesEl.textContent = 'Dates TBD';
  }

  // Venue
  const venueEl = document.getElementById('previewVenue');
  if (venueEl) {
    const parts = [data.venueAddress, data.city, data.state, data.country].filter(Boolean);
    venueEl.textContent = parts.length > 0 ? parts.join(', ') : 'Venue TBD';
  }

  // Committees
  const committeesEl = document.getElementById('previewCommittees');
  if (committeesEl && data.committees && data.committees.length > 0) {
    committeesEl.innerHTML = data.committees.slice(0, 6).map(c => {
      const isCustom = Boolean(c.isCustom);
      const isWide = isWideCommittee(c.code);
      const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(c.code) : '';
      return `
        <div class="conf-comm-chip">
          <div class="conf-comm-chip-icon ${isWide ? 'is-wide' : ''}">
            ${logoUrl ? `<img src="${logoUrl}" alt="${c.code}" />` : `<ion-icon name="${getCommitteeIcon(c.category)}"></ion-icon>`}
          </div>
          <span class="conf-comm-chip-code">${c.code}</span>
        </div>
      `;
    }).join('');
    if (data.committees.length > 6) {
      committeesEl.innerHTML += `<span class="conf-comm-chip" style="padding: 2px 8px;"><span class="conf-comm-chip-code">+${data.committees.length - 6} more</span></span>`;
    }
  } else if (committeesEl) {
    committeesEl.innerHTML = '<span class="conf-comm-chip" style="padding: 2px 8px; color: #94a3b8;"><span class="conf-comm-chip-code" style="color: #94a3b8; font-weight: 500;">No committees yet</span></span>';
  }

  // Logo & Monogram Fallback
  const logoImg = document.getElementById('previewLogoImg');
  const logoPlaceholder = document.getElementById('previewLogoPlaceholder');
  const monogramEl = document.getElementById('previewMonogram');

  if (monogramEl) {
    let mono = 'MUN';
    if (data.title && data.title.trim()) {
      const words = data.title.trim().split(/\s+/).filter(Boolean);
      mono = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : data.title.slice(0, 3).toUpperCase();
    }
    monogramEl.textContent = mono;
  }

  if (logoImg && data.logoDataUrl) {
    logoImg.src = data.logoDataUrl;
    logoImg.style.display = 'block';
    if (logoPlaceholder) logoPlaceholder.style.display = 'none';
  } else if (logoImg) {
    logoImg.style.display = 'none';
    if (logoPlaceholder) logoPlaceholder.style.display = 'flex';
  }

  // Fee
  const feeEl = document.getElementById('previewFee');
  if (feeEl) {
    if (data.delegateFee > 0) {
      feeEl.textContent = `₹${data.delegateFee.toLocaleString()}`;
    } else {
      feeEl.textContent = 'Free';
    }
  }
}

/**
 * Render checklist
 */
function renderChecklist() {
  const data = wizardDataRef;
  const checklist = document.getElementById('publishChecklist');
  if (!checklist) return;

  const hasSecretariat = Boolean(
    data.secretariat &&
    (data.secretariat.sg?.enabled || data.secretariat.dsg?.enabled || Object.values(data.secretariat).some(v => v.enabled))
  );

  const hasEb = Boolean(
    data.ebRoles && Object.keys(data.ebRoles).length > 0 &&
    Object.values(data.ebRoles).some(commRoles =>
      Array.isArray(commRoles) ? commRoles.length > 0 : Object.values(commRoles).some(r => r.enabled)
    )
  );

  const hasCountryMatrix = Boolean(
    data.countryMatrix && Object.keys(data.countryMatrix).length > 0 &&
    Object.values(data.countryMatrix).some(allot => (allot.countries && allot.countries.length > 0) || (allot.positions && allot.positions.length > 0))
  );

  const checks = [
    { id: 'title', label: 'Conference name set', pass: !!data.title },
    { id: 'dates', label: 'Dates configured', pass: !!data.startDate && !!data.endDate },
    { id: 'venue', label: 'Venue set', pass: !!data.venueAddress && !!data.city },
    { id: 'committees', label: 'At least 1 committee added', pass: data.committees && data.committees.length > 0 },
    { id: 'countries', label: 'Countries / portfolios allotted', pass: hasCountryMatrix },
    { id: 'eb', label: 'Executive Board assigned', pass: hasEb },
    { id: 'secretariat', label: 'Secretariat roles configured', pass: hasSecretariat },
    { id: 'itinerary', label: 'Conference schedule / itinerary configured', pass: data.itinerary && data.itinerary.length > 0 },
    { id: 'logo', label: 'Logo uploaded', pass: !!data.logoDataUrl },
    { id: 'description', label: 'Description written', pass: !!data.description }
  ];

  checklist.innerHTML = checks.map(check => `
    <div class="cc-checklist-item ${check.pass ? 'passed' : 'failed'}" data-check="${check.id}">
      <ion-icon class="cc-checklist-icon" name="${check.pass ? 'checkmark-circle' : 'close-circle-outline'}"></ion-icon>
      <span class="cc-checklist-text">${check.label}</span>
    </div>
  `).join('');
}

/**
 * Get committee icon
 */
function getCommitteeIcon(category) {
  const icons = {
    'unga': 'globe-outline',
    'un-organs': 'business-outline',
    'agencies': 'construct-outline',
    'regional': 'map-outline',
    'crisis': 'flash-outline',
    'national': 'flag-outline',
    'custom': 'add-outline'
  };
  return icons[category] || 'people-outline';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Listen for data updates from other steps
  window.addEventListener('wizard:dirty', debounce(() => {
    if (document.getElementById('panel9')?.classList.contains('is-active')) {
      renderPreview();
      renderChecklist();
    }
  }, 100));
}

/**
 * Debounce helper
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
