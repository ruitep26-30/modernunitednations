/**
 * Step 2 — Committees
 * Handles standardized committee grid, search filtering, and multi-selection
 */

import { COMMITTEES_DATABASE } from '../committees-data.js';
import { R2_CONFIG } from '../r2-config.js';

// Wide / landscape committee logos (double width)
export const WIDE_COMMITTEE_CODES = new Set(['oecd', 'unfpa', 'brics', 'ioc', 'fifa']);

export function isWideCommittee(code) {
  return code ? WIDE_COMMITTEE_CODES.has(String(code).trim().toLowerCase()) : false;
}

export function getOrdinal(n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num <= 0) return '';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let allCommittees = [];
let selectedCommittees = new Set();
let searchQuery = '';

/**
 * Initialize Step 2
 */
export async function initStep2(existingData = {}) {
  // Load committees database
  allCommittees = COMMITTEES_DATABASE || [];

  // Restore selected committees from existing data
  if (existingData.committees) {
    existingData.committees.forEach(c => {
      if (c && c.code) {
        selectedCommittees.add(c.code);
      }
    });
  }

  // Render committee grid
  renderCommitteeGrid();

  // Update selected committees summary
  updateSelectedSummary();

  // Setup event listeners
  setupEventListeners();
}

/**
 * Cleanup Step 2
 */
export function cleanupStep2() {
  // Clean up any event listeners if needed
}

/**
 * Get Step 2 data
 */
export function getStep2Data() {
  const committees = [];

  selectedCommittees.forEach(code => {
    const standard = allCommittees.find(c => c.code === code);
    if (standard) {
      committees.push({ ...standard, isCustom: false });
    }
  });

  return { committees };
}

/**
 * Validate Step 2
 */
export function validateStep2(showErrors = false) {
  const valid = selectedCommittees.size > 0;
  if (!valid && showErrors) {
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: 'Please select at least 1 committee for your conference.', type: 'error' }
    }));
  }
  return valid;
}

/**
 * Render committee grid
 */
function renderCommitteeGrid() {
  const grid = document.getElementById('committeeGrid');
  const noCommitteesMsg = document.getElementById('noCommitteesMsg');

  if (!grid) return;

  let filtered = allCommittees;

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(c =>
      c.code.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (noCommitteesMsg) noCommitteesMsg.style.display = 'flex';
    return;
  }

  if (noCommitteesMsg) noCommitteesMsg.style.display = 'none';

  const selectedList = Array.from(selectedCommittees);

  grid.innerHTML = filtered.map(committee => {
    const isSelected = selectedCommittees.has(committee.code);
    const isWide = isWideCommittee(committee.code);
    const logoUrl = R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(committee.code) : '';
    const codeEsc = escapeHtml(committee.code);
    const nameEsc = escapeHtml(committee.name);
    const orderNum = isSelected ? (selectedList.indexOf(committee.code) + 1) : '';

    return `
      <div class="cc-grid-committee ${isSelected ? 'selected' : ''} ${isWide ? 'is-wide' : ''}" data-code="${codeEsc}" data-category="${escapeHtml(committee.category || 'unga')}">
        <div class="cc-grid-committee-check">
          ${isSelected ? `<span class="cc-grid-committee-num">${orderNum}</span>` : ''}
        </div>
        <div class="cc-comm-logo-wrap ${isWide ? 'is-wide' : ''}" data-r2-code="${codeEsc}">
          ${logoUrl ? `
            <img class="cc-comm-logo-img ${isWide ? 'is-wide' : ''}" 
                 src="${escapeHtml(logoUrl)}" 
                 alt="${codeEsc} Logo" 
                 loading="lazy" 
                 decoding="async" 
                 onerror="this.style.display='none'; const fb = this.nextElementSibling; if (fb) fb.style.display='flex';" />
          ` : ''}
          <div class="cc-comm-logo-fallback" style="${logoUrl ? 'display:none;' : 'display:flex;'}">
            <ion-icon name="${getCommitteeIcon(committee.category)}"></ion-icon>
          </div>
        </div>
        <div class="cc-grid-committee-code">${codeEsc}</div>
        <div class="cc-grid-committee-name" title="${nameEsc}">${nameEsc}</div>
      </div>
    `;
  }).join('');

  // Add click handlers
  grid.querySelectorAll('.cc-grid-committee').forEach(card => {
    card.addEventListener('click', () => toggleCommittee(card.dataset.code));
  });
}

/**
 * Update number badges on committee cards
 */
function updateCardBadges() {
  const selectedList = Array.from(selectedCommittees);
  document.querySelectorAll('.cc-grid-committee').forEach(card => {
    const code = card.dataset.code;
    const isSel = selectedCommittees.has(code);
    card.classList.toggle('selected', isSel);
    const checkEl = card.querySelector('.cc-grid-committee-check');
    if (checkEl) {
      if (isSel) {
        const orderNum = selectedList.indexOf(code) + 1;
        checkEl.innerHTML = `<span class="cc-grid-committee-num">${orderNum}</span>`;
      } else {
        checkEl.innerHTML = '';
      }
    }
  });
}

/**
 * Toggle committee selection
 */
function toggleCommittee(code) {
  const isSelected = selectedCommittees.has(code);
  if (isSelected) {
    selectedCommittees.delete(code);
  } else {
    selectedCommittees.add(code);
  }

  updateCardBadges();
  updateSelectedSummary();
  markDirty();
}

/**
 * Update selected committees summary
 */
function updateSelectedSummary() {
  const wrap = document.getElementById('selectedCommitteesWrap');
  const list = document.getElementById('selectedCommitteesList');
  const countEl = document.getElementById('selectedCount');

  const totalCount = selectedCommittees.size;
  if (countEl) countEl.textContent = totalCount;

  if (totalCount === 0) {
    if (wrap) wrap.style.display = 'none';
    return;
  }

  if (wrap) wrap.style.display = 'block';
  if (!list) return;

  list.innerHTML = '';

  const selectedList = Array.from(selectedCommittees);

  selectedCommittees.forEach(code => {
    const orderNum = selectedList.indexOf(code) + 1;
    const standard = allCommittees.find(c => c.code === code);
    if (standard) {
      list.appendChild(createSelectedItem(standard, code, orderNum));
    }
  });
}

/**
 * Create selected committee item element
 */
function createSelectedItem(committee, key, orderNum = null) {
  const div = document.createElement('div');
  div.className = 'cc-selected-committee-item';
  const isWide = isWideCommittee(committee.code);
  const logoUrl = R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(committee.code) : '';
  const codeEsc = escapeHtml(committee.code);
  const nameEsc = escapeHtml(committee.name);
  const orderText = orderNum ? getOrdinal(orderNum) : '';

  div.innerHTML = `
    ${orderText ? `<span class="cc-selected-comm-order">${orderText}</span>` : ''}
    <div class="cc-selected-comm-logo-wrap ${isWide ? 'is-wide' : ''}" data-r2-code="${codeEsc}">
      ${logoUrl ? `
        <img class="cc-selected-comm-logo-img ${isWide ? 'is-wide' : ''}" 
             src="${escapeHtml(logoUrl)}" 
             alt="${codeEsc}" 
             loading="lazy" 
             decoding="async" 
             onerror="this.style.display='none'; const fb = this.nextElementSibling; if (fb) fb.style.display='flex';" />
      ` : ''}
      <div class="cc-selected-comm-logo-fallback" style="${logoUrl ? 'display:none;' : 'display:flex;'}">
        <ion-icon name="${getCommitteeIcon(committee.category)}"></ion-icon>
      </div>
    </div>
    <div class="cc-selected-committee-info">
      <strong>${codeEsc}</strong>
      <span title="${nameEsc}">${nameEsc}</span>
    </div>
    <button class="cc-selected-committee-remove" title="Remove ${codeEsc}">
      <ion-icon name="close-outline"></ion-icon>
    </button>
  `;

  div.querySelector('.cc-selected-committee-remove')?.addEventListener('click', e => {
    e.stopPropagation();
    selectedCommittees.delete(key);
    updateCardBadges();
    updateSelectedSummary();
    markDirty();
  });

  return div;
}

/**
 * Get icon for committee category
 */
export function getCommitteeIcon(category) {
  const icons = {
    'unga': 'globe-outline',
    'un-organs': 'business-outline',
    'agencies': 'construct-outline',
    'regional': 'map-outline',
    'crisis': 'flash-outline',
    'national': 'flag-outline'
  };
  return icons[category] || 'people-outline';
}

/**
 * Format category for display
 */
export function formatCategory(category) {
  const labels = {
    'unga': 'UN GA',
    'un-organs': 'UN Organs',
    'agencies': 'Agencies',
    'regional': 'Regional',
    'crisis': 'Crisis',
    'national': 'National'
  };
  return labels[category] || category;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('committeeSearch');
  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    renderCommitteeGrid();
  });

  // Clear all
  document.getElementById('btnClearAllCommittees')?.addEventListener('click', () => {
    if (confirm('Remove all selected committees?')) {
      selectedCommittees.clear();
      renderCommitteeGrid();
      updateSelectedSummary();
      markDirty();
    }
  });

  // Proceed button
  document.getElementById('btnProceedToEB')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('wizard:next'));
  });
}

/**
 * Mark form as dirty
 */
function markDirty() {
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

// Dynamic theme reactivity for WEF logo variant
function updateThemeLogos() {
  const wefImgs = document.querySelectorAll('[data-r2-code="WEF"] .cc-comm-logo-img, [data-r2-code="WEF"] .cc-selected-comm-logo-img');
  wefImgs.forEach(img => {
    if (R2_CONFIG && typeof R2_CONFIG.getCommitteeLogoUrl === 'function') {
      img.src = R2_CONFIG.getCommitteeLogoUrl('WEF');
    }
  });
}

if (typeof window !== 'undefined') {
  if (typeof window.matchMedia === 'function') {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq) {
        if (typeof mq.addEventListener === 'function') {
          mq.addEventListener('change', updateThemeLogos);
        } else if (typeof mq.addListener === 'function') {
          mq.addListener(updateThemeLogos);
        }
      }
    } catch (e) {
      console.warn('matchMedia setup notice:', e);
    }
  }
  if (typeof MutationObserver !== 'undefined') {
    try {
      const themeObserver = new MutationObserver(() => updateThemeLogos());
      if (document.documentElement) {
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      }
      if (document.body) {
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      }
    } catch (e) {
      console.warn('themeObserver setup notice:', e);
    }
  }
}
