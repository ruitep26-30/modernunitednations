/**
 * Step 4 - Committee Agendas
 * 2-Column Workspace:
 * - Left Sidebar: Vertical/2x2 committees list (matching Step 3)
 * - Right Main Area: Focused, clean input for the active committee's agenda
 */

import { R2_CONFIG } from '../r2-config.js';
import { isWideCommittee, getCommitteeIcon } from './step2.js';

let selectedCommittees = [];
let committeeAgendasData = {};
let activeCommitteeIndex = 0;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initialize Step 4
 */
export async function initStep4(existingData = {}) {
  // Normalize committees from wizardData or Step 2
  const rawCommittees = existingData.committees || (window.__wizardData && window.__wizardData.committees) || [];
  selectedCommittees = rawCommittees.map(item => {
    if (typeof item === 'string') {
      return { code: item, name: item, category: 'unga', isCustom: false };
    }
    return item;
  });

  // Restore agendas data
  committeeAgendasData = existingData.committeeAgendas ? { ...existingData.committeeAgendas } : {};

  // If active index is out of bounds, clamp it
  if (activeCommitteeIndex >= selectedCommittees.length) {
    activeCommitteeIndex = Math.max(0, selectedCommittees.length - 1);
  }

  document.body.classList.add('cc-step4-active');
  renderAgWorkspace();

  setTimeout(() => {
    const textarea = document.getElementById('commAgendaInput');
    if (textarea) textarea.focus();
  }, 100);
}

/**
 * Cleanup Step 4
 */
export function cleanupStep4() {
  saveCurrentAgendaInput();
  document.body.classList.remove('cc-step4-active');
}

/**
 * Save current agenda input from DOM
 */
function saveCurrentAgendaInput() {
  const activeComm = selectedCommittees[activeCommitteeIndex];
  if (!activeComm) return;
  const input = document.getElementById('commAgendaInput');
  if (input) {
    committeeAgendasData[activeComm.code] = input.value.trim();
  }
}

/**
 * Get Step 4 Data
 */
export function getStep4Data() {
  saveCurrentAgendaInput();

  const summaryParts = Object.entries(committeeAgendasData)
    .filter(([_, ag]) => ag && String(ag).trim())
    .map(([code, ag]) => `${code}: ${String(ag).trim()}`);

  return {
    committeeAgendas: { ...committeeAgendasData },
    agendas: summaryParts.join('; '),
    agenda: summaryParts.join('; ')
  };
}

/**
 * Validate Step 4
 */
export function validateStep4(showErrors = false) {
  saveCurrentAgendaInput();

  if (selectedCommittees.length === 0) {
    if (showErrors) {
      window.dispatchEvent(new CustomEvent('wizard:toast', {
        detail: { message: 'Please select committees in Step 2 before setting agendas.', type: 'error' }
      }));
    }
    return false;
  }

  for (let i = 0; i < selectedCommittees.length; i++) {
    const comm = selectedCommittees[i];
    const ag = (committeeAgendasData[comm.code] || '').trim();
    if (!ag) {
      if (showErrors) {
        activeCommitteeIndex = i;
        renderAgWorkspace();
        const input = document.getElementById('commAgendaInput');
        if (input) {
          input.focus();
          input.classList.add('has-error');
          input.closest('.cc-ag-input-container')?.classList.add('has-error');
        }
        window.dispatchEvent(new CustomEvent('wizard:toast', {
          detail: { message: `Please enter the agenda for ${comm.code || comm.name}.`, type: 'error' }
        }));
      }
      return false;
    }
  }

  return true;
}

/**
 * Render Committee Agendas Workspace
 */
function renderAgWorkspace() {
  const container = document.getElementById('agendaDeckContainer');
  if (!container) return;

  if (selectedCommittees.length === 0) {
    container.innerHTML = `
      <div class="cc-ag-empty-state">
        <div class="cc-ag-empty-icon-box">
          <ion-icon name="alert-circle-outline"></ion-icon>
        </div>
        <h3 class="cc-ag-empty-title">No Committees Selected</h3>
        <p class="cc-ag-empty-desc">Please go back to Step 2 and choose committees for your conference before setting agendas.</p>
      </div>
    `;
    return;
  }

  const activeComm = selectedCommittees[activeCommitteeIndex] || selectedCommittees[0];
  const isCustom = Boolean(activeComm.isCustom);
  const isWide = isWideCommittee(activeComm.code);
  const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(activeComm.code) : (activeComm.logoUrl || '');
  const currentAgenda = committeeAgendasData[activeComm.code] || '';

  container.innerHTML = `
    <div class="cc-ag-workspace">
      <!-- Left Sidebar: Vertical Committees List (Same as Step 3) -->
      <aside class="cc-ag-committees-sidebar">
        <div class="cc-ag-sidebar-sticky-inner">
          <div class="cc-ag-sidebar-header">
            <span class="cc-ag-sidebar-title">Committees</span>
            <span class="cc-ag-sidebar-count">${selectedCommittees.length} ${selectedCommittees.length === 1 ? 'Committee' : 'Committees'}</span>
          </div>
          <div class="cc-ag-sidebar-list" id="agSidebarList">
            ${renderSidebarCommittees()}
          </div>
        </div>
      </aside>

      <!-- Right Main Workspace: Clean Agenda Input -->
      <main class="cc-ag-main-workspace" id="agMainWorkspace">
        <!-- Active Committee Header Bar -->
        <div class="cc-ag-main-header">
          <div class="cc-ag-comm-logo-wrap ${isWide ? 'is-wide' : ''}">
            ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(activeComm.code)}" />` : `<div class="cc-ag-comm-logo-fallback"><ion-icon name="${getCommitteeIcon(activeComm.category)}"></ion-icon></div>`}
          </div>
          <div class="cc-ag-comm-info">
            <div class="cc-ag-comm-code">${escapeHtml(activeComm.code)}</div>
            <div class="cc-ag-comm-fullname">${escapeHtml(activeComm.name || activeComm.code)}</div>
          </div>
        </div>

        <!-- Clean Input Area: Just the input, no other clutter -->
        <div class="cc-ag-input-container">
          <div class="cc-ag-input-label">
            <span>Agenda</span>
            <span class="cc-ag-input-counter" id="agCharCounter">${currentAgenda.length} characters</span>
          </div>
          <textarea
            id="commAgendaInput"
            class="cc-ag-textarea"
            placeholder="Enter the primary agenda or discussion topic for ${escapeHtml(activeComm.code)}..."
            spellcheck="true"
          >${escapeHtml(currentAgenda)}</textarea>
        </div>
      </main>
    </div>
  `;

  attachAgEvents();
}

/**
 * Render Sidebar Committees (Identical 2x2 style to Step 3)
 */
function renderSidebarCommittees() {
  return selectedCommittees.map((comm, idx) => {
    const isActive = idx === activeCommitteeIndex;
    const isCustom = Boolean(comm.isCustom);
    const isWide = isWideCommittee(comm.code);
    const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(comm.code) : (comm.logoUrl || '');
    const hasAgenda = Boolean(committeeAgendasData[comm.code] && committeeAgendasData[comm.code].trim());

    return `
      <div class="cc-ag-sidebar-comm-item ${isActive ? 'is-active' : ''} ${hasAgenda ? 'has-agenda' : ''}" data-index="${idx}">
        <div class="cc-ag-sidebar-comm-logo ${isWide ? 'is-wide' : ''}">
          ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(comm.code)}" loading="lazy" />` : `<div class="cc-ag-sidebar-comm-logo-fallback"><ion-icon name="${getCommitteeIcon(comm.category)}"></ion-icon></div>`}
        </div>
        <span class="cc-ag-sidebar-comm-name" title="${escapeHtml(comm.name || comm.code)}">${escapeHtml(comm.code)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Attach Event Listeners
 */
function attachAgEvents() {
  // Sidebar clicks
  const sidebarItems = document.querySelectorAll('.cc-ag-sidebar-comm-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.getAttribute('data-index'), 10);
      if (idx === activeCommitteeIndex) return;

      // Save current input before switching
      saveCurrentAgendaInput();

      activeCommitteeIndex = idx;
      renderAgWorkspace();

      // Focus the textarea
      setTimeout(() => {
        const textarea = document.getElementById('commAgendaInput');
        if (textarea) textarea.focus();
      }, 50);
    });
  });

  // Textarea input
  const textarea = document.getElementById('commAgendaInput');
  const counter = document.getElementById('agCharCounter');
  const inputContainer = document.querySelector('.cc-ag-input-container');

  if (inputContainer && textarea) {
    inputContainer.addEventListener('click', () => {
      textarea.focus();
    });
  }

  if (textarea) {
    textarea.addEventListener('input', () => {
      const val = textarea.value;
      const activeComm = selectedCommittees[activeCommitteeIndex];
      if (activeComm) {
        committeeAgendasData[activeComm.code] = val;
      }
      if (counter) {
        counter.textContent = `${val.length} character${val.length === 1 ? '' : 's'}`;
      }

      // Update sidebar has-agenda state
      const currentItem = document.querySelector(`.cc-ag-sidebar-comm-item[data-index="${activeCommitteeIndex}"]`);
      if (currentItem) {
        const hasText = Boolean(val.trim());
        currentItem.classList.toggle('has-agenda', hasText);
      }

      window.dispatchEvent(new CustomEvent('wizard:dirty'));
    });
  }
}
