/**
 * auditions-modal.js
 * Minimalist Modal Alert and State Manager for Auditions Accessibility
 * Used across Step 5 (Executives) and Step 6 (Secretariat)
 */

import { setLiveRoleAudition } from '../../js/realtime-sync.js';

export function isAuditionsOpen() {
  if (window.__ebAuditionsOpen !== undefined) return Boolean(window.__ebAuditionsOpen);
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data && parsed.data.ebAuditionsOpen !== undefined) {
        window.__ebAuditionsOpen = Boolean(parsed.data.ebAuditionsOpen);
        return window.__ebAuditionsOpen;
      }
    }
  } catch (e) {}
  return false;
}

export function isCommitteeAuditionOpen(commCode, defaultVal = false) {
  const norm = String(commCode || '').toUpperCase().trim();
  if (window.__committeeAuditions && window.__committeeAuditions[norm] !== undefined) {
    return Boolean(window.__committeeAuditions[norm]);
  }
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data?.committeeAuditions && parsed.data.committeeAuditions[norm] !== undefined) {
        return Boolean(parsed.data.committeeAuditions[norm]);
      }
      if (Array.isArray(parsed.data?.committees)) {
        const found = parsed.data.committees.find(c => (c.code || '').toUpperCase().trim() === norm);
        if (found && found.auditionsOpen !== undefined) {
          return Boolean(found.auditionsOpen);
        }
      }
      // Check if any roleAudition is open for this committee
      if (parsed.data?.roleAuditions) {
        const hasOpenRole = Object.entries(parsed.data.roleAuditions).some(([k, v]) => {
          return k.startsWith(`${norm}_`) && Boolean(v);
        });
        if (hasOpenRole) return true;
      }
      if (parsed.data?.ebAuditionsOpen !== undefined) {
        return Boolean(parsed.data.ebAuditionsOpen);
      }
    }
  } catch (e) {}
  return defaultVal;
}

export function setCommitteeAudition(commCode, isOpen) {
  const norm = String(commCode || '').toUpperCase().trim();
  if (!window.__committeeAuditions) window.__committeeAuditions = {};
  window.__committeeAuditions[norm] = Boolean(isOpen);

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        if (!parsed.data.committeeAuditions) parsed.data.committeeAuditions = {};
        parsed.data.committeeAuditions[norm] = Boolean(isOpen);
        if (Array.isArray(parsed.data.committees)) {
          const cObj = parsed.data.committees.find(c => (c.code || '').toUpperCase().trim() === norm);
          if (cObj) cObj.auditionsOpen = Boolean(isOpen);
        }
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
    }
  } catch (e) {}
}

export function setAllCommitteesAuditions(committees, isOpen) {
  if (!window.__committeeAuditions) window.__committeeAuditions = {};
  window.__ebAuditionsOpen = Boolean(isOpen);
  (committees || []).forEach(c => {
    const norm = String(c.code || c || '').toUpperCase().trim();
    if (norm) {
      window.__committeeAuditions[norm] = Boolean(isOpen);
      if (c && typeof c === 'object') c.auditionsOpen = Boolean(isOpen);
    }
  });

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        parsed.data.ebAuditionsOpen = Boolean(isOpen);
        if (!parsed.data.committeeAuditions) parsed.data.committeeAuditions = {};
        (committees || []).forEach(c => {
          const norm = String(c.code || c || '').toUpperCase().trim();
          if (norm) parsed.data.committeeAuditions[norm] = Boolean(isOpen);
        });
        if (Array.isArray(parsed.data.committees)) {
          parsed.data.committees.forEach(c => {
            c.auditionsOpen = Boolean(isOpen);
          });
        }
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
    }
  } catch (e) {}
}

/**
 * Returns the selected (accepted) executive for a given role, or null if unselected
 */
export function getRoleSelectedExecutive(roleId, execList = []) {
  if (!Array.isArray(execList)) return null;
  const normId = String(roleId || '').toLowerCase().trim();
  return execList.find(ex => {
    if (!ex) return false;
    const exRoleId = String(ex.roleId || '').toLowerCase().trim();
    const exRoleLabel = String(ex.roleLabel || '').toLowerCase().trim();
    const isStatusSelected = (ex.status || '').toLowerCase() === 'accepted';
    return isStatusSelected && (exRoleId === normId || exRoleLabel === normId);
  }) || null;
}

/**
 * Returns dais roles for a committee (Shows all standard dais roles and any custom roles)
 */
export function getCommitteeDaisRoles(commCode, execList = []) {
  const isCrisis = /crisis|unsc|security|cabinet|war/i.test(commCode || '');
  const allRoles = [
    { id: 'chair', label: 'Chairperson', icon: 'ribbon-outline' },
    { id: 'vice-chair', label: 'Vice-Chairperson', icon: 'shield-checkmark-outline' },
    { id: 'rapporteur', label: isCrisis ? 'Director' : 'Rapporteur', icon: 'document-text-outline' },
    { id: 'director', label: 'Director', icon: 'business-outline' },
    { id: 'moderator', label: 'Moderator', icon: 'megaphone-outline' },
    { id: 'crisis-director', label: 'Crisis Director', icon: 'flame-outline' },
    { id: 'assistant-director', label: 'Assistant Director', icon: 'person-outline' },
    { id: 'president', label: 'President', icon: 'ribbon-outline' },
    { id: 'vice-president', label: 'Vice President', icon: 'shield-outline' },
    { id: 'legal-counsel', label: 'Legal Counsel', icon: 'book-outline' },
    { id: 'special-advisor', label: 'Special Advisor', icon: 'bulb-outline' },
    { id: 'deputy-secretary-general', label: 'Deputy Secretary-General', icon: 'shield-checkmark-outline' },
    { id: 'under-secretary-general', label: 'Under-Secretary-General', icon: 'globe-outline' }
  ];

  const roleMap = new Map();
  allRoles.forEach(r => {
    if (!roleMap.has(r.id)) {
      roleMap.set(r.id, { ...r });
    }
  });

  // Include custom committee roles from memory or draft
  const cNorm = String(commCode || '').toUpperCase().trim();
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      const storedCustom = parsed.data?.customCommitteeRoles?.[cNorm];
      if (Array.isArray(storedCustom)) {
        if (!window.__customCommitteeRoles) window.__customCommitteeRoles = {};
        if (!window.__customCommitteeRoles[cNorm]) window.__customCommitteeRoles[cNorm] = [];
        storedCustom.forEach(sc => {
          if (!window.__customCommitteeRoles[cNorm].some(r => r.id === sc.id)) {
            window.__customCommitteeRoles[cNorm].push(sc);
          }
        });
      }
    }
  } catch (e) {}

  const customList = (window.__customCommitteeRoles && window.__customCommitteeRoles[cNorm]) || [];
  customList.forEach(cr => {
    if (cr && cr.id && !roleMap.has(cr.id)) {
      roleMap.set(cr.id, {
        id: cr.id,
        label: cr.label || 'Custom Role',
        icon: cr.icon || 'ribbon-outline',
        isCustom: true
      });
    }
  });

  if (Array.isArray(execList)) {
    execList.forEach(ex => {
      if (!ex) return;
      const rId = (ex.roleId || ex.id || 'custom').toLowerCase().trim();
      if (!roleMap.has(rId)) {
        roleMap.set(rId, {
          id: rId,
          label: ex.roleLabel || 'Executive',
          icon: ex.icon || 'ribbon-outline',
          isCustom: true
        });
      }
    });
  }
  return Array.from(roleMap.values());
}

/**
 * Register a custom dais role for a committee
 */
export function addCustomCommitteeRole(commCode, roleLabel) {
  const cNorm = String(commCode || '').toUpperCase().trim();
  const cleanLabel = String(roleLabel || '').trim();
  if (!cleanLabel) return null;
  const newId = 'custom_' + cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');

  if (!window.__customCommitteeRoles) window.__customCommitteeRoles = {};
  if (!Array.isArray(window.__customCommitteeRoles[cNorm])) {
    window.__customCommitteeRoles[cNorm] = [];
  }

  let existing = window.__customCommitteeRoles[cNorm].find(r => r.id === newId || r.label.toLowerCase() === cleanLabel.toLowerCase());
  if (!existing) {
    existing = { id: newId, label: cleanLabel, isCustom: true };
    window.__customCommitteeRoles[cNorm].push(existing);
  }

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        if (!parsed.data.customCommitteeRoles) parsed.data.customCommitteeRoles = {};
        if (!Array.isArray(parsed.data.customCommitteeRoles[cNorm])) {
          parsed.data.customCommitteeRoles[cNorm] = [];
        }
        if (!parsed.data.customCommitteeRoles[cNorm].some(r => r.id === newId)) {
          parsed.data.customCommitteeRoles[cNorm].push(existing);
        }
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
    }
  } catch (e) {}

  return existing;
}

/**
 * Delete a custom dais role from a committee
 */
export function deleteCustomCommitteeRole(commCode, roleId) {
  const cNorm = String(commCode || '').toUpperCase().trim();
  const rNorm = String(roleId || '').toLowerCase().trim();
  if (!cNorm || !rNorm) return false;

  if (window.__customCommitteeRoles && Array.isArray(window.__customCommitteeRoles[cNorm])) {
    window.__customCommitteeRoles[cNorm] = window.__customCommitteeRoles[cNorm].filter(r => {
      const id = String(r.id || '').toLowerCase().trim();
      return id !== rNorm;
    });
  }

  // Remove role audition state
  const key = `${cNorm}_${rNorm}`;
  if (window.__roleAuditions) {
    delete window.__roleAuditions[key];
  }

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        if (parsed.data.customCommitteeRoles && Array.isArray(parsed.data.customCommitteeRoles[cNorm])) {
          parsed.data.customCommitteeRoles[cNorm] = parsed.data.customCommitteeRoles[cNorm].filter(r => {
            const id = String(r.id || '').toLowerCase().trim();
            return id !== rNorm;
          });
        }
        if (parsed.data.roleAuditions && parsed.data.roleAuditions[key] !== undefined) {
          delete parsed.data.roleAuditions[key];
        }
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
    }
  } catch (e) {}

  return true;
}

/**
 * Check if auditions are open for a specific role in a committee.
 * Auditions are strictly NOT allowed for roles whose executive has already been selected.
 */
export function isRoleAuditionOpen(commCode, roleId, execList = []) {
  if (getRoleSelectedExecutive(roleId, execList)) {
    return false; // Executive already selected: auditions not allowed!
  }
  const cNorm = String(commCode || '').toUpperCase().trim();
  const rNorm = String(roleId || '').toLowerCase().trim();
  const key = `${cNorm}_${rNorm}`;
  if (window.__roleAuditions && window.__roleAuditions[key] !== undefined) {
    return Boolean(window.__roleAuditions[key]);
  }
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data?.roleAuditions && parsed.data.roleAuditions[key] !== undefined) {
        if (!window.__roleAuditions) window.__roleAuditions = {};
        window.__roleAuditions[key] = Boolean(parsed.data.roleAuditions[key]);
        return window.__roleAuditions[key];
      }
    }
  } catch (e) {}
  return isCommitteeAuditionOpen(cNorm, false);
}

/**
 * Toggle or set auditions for a specific role.
 * Fails if an executive has already been selected for this role.
 */
export function setRoleAudition(commCode, roleId, isOpen, execList = []) {
  if (isOpen && getRoleSelectedExecutive(roleId, execList)) {
    return false; // Role is already filled by a selected executive
  }
  const cNorm = String(commCode || '').toUpperCase().trim();
  const rNorm = String(roleId || '').toLowerCase().trim();
  const key = `${cNorm}_${rNorm}`;
  if (!window.__roleAuditions) window.__roleAuditions = {};
  window.__roleAuditions[key] = Boolean(isOpen);

  if (isOpen) {
    if (!window.__committeeAuditions) window.__committeeAuditions = {};
    window.__committeeAuditions[cNorm] = true;
    window.__ebAuditionsOpen = true;
  }

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        if (!parsed.data.roleAuditions) parsed.data.roleAuditions = {};
        parsed.data.roleAuditions[key] = Boolean(isOpen);
        if (isOpen) {
          if (!parsed.data.committeeAuditions) parsed.data.committeeAuditions = {};
          parsed.data.committeeAuditions[cNorm] = true;
          parsed.data.ebAuditionsOpen = true;
        }
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
      const confId = parsed.data?.confId || parsed.confId || localStorage.getItem('mun_last_conference_id') || 'draft';
      setLiveRoleAudition(confId, 'committee', cNorm, rNorm, isOpen);
    }
  } catch (e) {}
  return true;
}

/**
 * Check if auditions are open for a specific Secretariat role.
 * Auditions are strictly NOT allowed for roles whose executive/member has already been selected.
 */
export function isSecRoleAuditionOpen(roleId, isFilled = false) {
  if (isFilled) return false;
  const rNorm = String(roleId || '').toLowerCase().trim();
  if (window.__secRoleAuditions && window.__secRoleAuditions[rNorm] !== undefined) {
    return Boolean(window.__secRoleAuditions[rNorm]);
  }
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data?.secRoleAuditions && parsed.data.secRoleAuditions[rNorm] !== undefined) {
        return Boolean(parsed.data.secRoleAuditions[rNorm]);
      }
    }
  } catch (e) {}
  return isAuditionsOpen();
}

/**
 * Toggle or set auditions for a specific Secretariat role.
 * Fails if a member has already been selected/accepted for this role.
 */
export function setSecRoleAudition(roleId, isOpen, isFilled = false) {
  if (isOpen && isFilled) return false;
  const rNorm = String(roleId || '').toLowerCase().trim();
  if (!window.__secRoleAuditions) window.__secRoleAuditions = {};
  window.__secRoleAuditions[rNorm] = Boolean(isOpen);

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        if (!parsed.data.secRoleAuditions) parsed.data.secRoleAuditions = {};
        parsed.data.secRoleAuditions[rNorm] = Boolean(isOpen);
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
      const confId = parsed.data?.confId || parsed.confId || localStorage.getItem('mun_last_conference_id') || 'draft';
      setLiveRoleAudition(confId, 'secretariat', null, rNorm, isOpen);
    }
  } catch (e) {}
  return true;
}

export function enableAuditionsInDraft() {
  window.__ebAuditionsOpen = true;
  window.__secAuditionsOpen = true;

  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.data) {
        parsed.data.ebAuditionsOpen = true;
        if (!parsed.data.committeeAuditions) parsed.data.committeeAuditions = {};
        if (Array.isArray(parsed.data.committees)) {
          parsed.data.committees.forEach(c => {
            c.auditionsOpen = true;
            const code = (c.code || '').toUpperCase().trim();
            if (code) parsed.data.committeeAuditions[code] = true;
          });
        }
      }
      localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
      try {
        const bc = new BroadcastChannel('mun_conference_draft_channel');
        bc.postMessage({ action: 'draft_saved', draft: parsed });
        setTimeout(() => { try { bc.close(); } catch (e) {} }, 1500);
      } catch (e) {}
    }
  } catch (e) {
    console.warn('Failed to enable auditions in localStorage draft:', e);
  }
}

export function promptAuditionsModal({
  title = 'Turn On Auditions Accessibility?',
  subtitle = "You haven't assigned any Executive Board or Secretariat members yet.",
  description = "Turning on Auditions Accessibility allows executive chairs and candidates across the platform to discover and apply for your summit's committees and dais roles.",
  confirmText = 'Turn On Auditions & Continue',
  skipText = 'Continue Without Auditions',
  onConfirm,
  onSkip,
  onCancel
} = {}) {
  let modal = document.getElementById('auditionsPromptModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'auditionsPromptModal';
    modal.className = 'cc-minimal-modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="cc-minimal-modal-card cc-auditions-prompt-card">
      <div class="cc-auditions-prompt-header">
        <div class="cc-auditions-prompt-icon">
          <ion-icon name="megaphone-outline"></ion-icon>
        </div>
        <div class="cc-auditions-prompt-titles">
          <h3 class="cc-auditions-prompt-title">${title}</h3>
          <p class="cc-auditions-prompt-sub">${subtitle}</p>
        </div>
        <button type="button" class="cc-minimal-modal-close" id="btnCloseAuditionsPrompt" title="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>

      <div class="cc-auditions-prompt-body">
        <div class="cc-auditions-prompt-callout">
          <ion-icon name="sparkles" class="cc-auditions-prompt-sparkle"></ion-icon>
          <div class="cc-auditions-prompt-callout-text">${description}</div>
        </div>
      </div>

      <div class="cc-auditions-prompt-actions">
        <button type="button" class="cc-auditions-prompt-confirm-btn" id="btnConfirmAuditionsPrompt">
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          <span>${confirmText}</span>
        </button>
        <button type="button" class="cc-auditions-prompt-skip-btn" id="btnSkipAuditionsPrompt">
          <span>${skipText}</span>
        </button>
      </div>
    </div>
  `;

  function closeModal() {
    modal.classList.remove('is-open');
    setTimeout(() => {
      if (!modal.classList.contains('is-open')) {
        modal.style.display = 'none';
      }
    }, 200);
  }

  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('is-open');
  });

  document.getElementById('btnCloseAuditionsPrompt')?.addEventListener('click', () => {
    closeModal();
    if (typeof onCancel === 'function') onCancel();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  document.getElementById('btnConfirmAuditionsPrompt')?.addEventListener('click', () => {
    closeModal();
    if (typeof onConfirm === 'function') {
      onConfirm();
    } else {
      enableAuditionsInDraft();
      window.dispatchEvent(new CustomEvent('wizard:force-next'));
    }
  });

  document.getElementById('btnSkipAuditionsPrompt')?.addEventListener('click', () => {
    closeModal();
    if (typeof onSkip === 'function') {
      onSkip();
    } else {
      window.dispatchEvent(new CustomEvent('wizard:force-next'));
    }
  });
}
