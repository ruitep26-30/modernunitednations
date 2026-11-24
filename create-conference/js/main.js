/**
 * Main Wizard Controller
 * Handles navigation, panel loading, state management, and Firebase integration
 */

import { initStep1, cleanupStep1, getStep1Data, validateStep1 } from './steps/step1.js';
import { initStep2, cleanupStep2, getStep2Data, validateStep2 } from './steps/step2.js';
import { initStep3, cleanupStep3, getStep3Data, validateStep3 } from './steps/step3.js';
import { initStep4, cleanupStep4, getStep4Data, validateStep4 } from './steps/step4.js';
import { initStep5, cleanupStep5, getStep5Data, validateStep5 } from './steps/step5.js';
import { initStep6, cleanupStep6, getStep6Data, validateStep6 } from './steps/step6.js';
import { initStep7, cleanupStep7, getStep7Data, validateStep7 } from './steps/step7.js';
import { initStep8, cleanupStep8, getStep8Data, validateStep8 } from './steps/step8.js';
import { initStep9, cleanupStep9, getStep9Data, validateStep9 } from './steps/step9.js';

// Guaranteed direct Cloud Database connections (Firebase Firestore & Firebase Storage)
import {
  auth,
  db as firebaseDb,
  storage as firebaseStorage,
  storageRef as firebaseStorageRef,
  uploadString as firebaseUploadString,
  getDownloadURL as firebaseGetDownloadURL,
  collection as collectionFn,
  addDoc as addDocFn,
  doc as docFn,
  setDoc as setDocFn,
  getDoc as getDocFn,
  deleteDoc as deleteDocFn,
  onAuthStateChanged,
  getSession
} from '../../js/firebase-config.js';

// BroadcastChannel safe dispatcher that keeps channel open long enough for browser IPC
function safePostBroadcast(channelName, data) {
  try {
    const bc = new BroadcastChannel(channelName);
    bc.postMessage(data);
    setTimeout(() => {
      try { bc.close(); } catch (e) {}
    }, 2500);
  } catch (e) {}
}

/**
 * Upload a Base64 data URL to Firebase Storage and return its public HTTPS URL
 * Safely falls back to dataUrl if storage is unreachable so publish never breaks.
 */
async function uploadDataUrlToStorage(dataUrl, storagePath) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl || '';
  }
  if (!firebaseStorage || !firebaseStorageRef || !firebaseUploadString || !firebaseGetDownloadURL) {
    return dataUrl;
  }
  try {
    const sRef = firebaseStorageRef(firebaseStorage, storagePath);
    const snap = await firebaseUploadString(sRef, dataUrl, 'data_url');
    const downloadUrl = await firebaseGetDownloadURL(snap.ref);
    console.log(`[Firebase Storage] Uploaded ${storagePath} -> ${downloadUrl}`);
    return downloadUrl;
  } catch (err) {
    console.warn(`[Firebase Storage] Upload notice for ${storagePath} (retained as dataUrl):`, err);
    return dataUrl;
  }
}

const STEP_COUNT = 9;
let currentStep = 1;
let wizardData = {};
let isDirty = false;
const completedSteps = new Set();

// DOM Elements
const stepPanels = document.getElementById('stepPanels');
const stepsBar = document.getElementById('stepsBar');
const btnBack = document.getElementById('btnBack');
const btnNext = document.getElementById('btnNext');
const btnMakeLive = document.getElementById('btnMakeLive');
const mainWrap = document.getElementById('mainWrap');
const loadingScreen = document.getElementById('loadingScreen');
const toastWrap = document.getElementById('toastWrap');

// Step panel HTML cache
const panelCache = {};
const initFunctions = { 1: initStep1, 2: initStep2, 3: initStep3, 4: initStep4, 5: initStep5, 6: initStep6, 7: initStep7, 8: initStep8, 9: initStep9 };
const cleanupFunctions = { 1: cleanupStep1, 2: cleanupStep2, 3: cleanupStep3, 4: cleanupStep4, 5: cleanupStep5, 6: cleanupStep6, 7: cleanupStep7, 8: cleanupStep8, 9: cleanupStep9 };
const getDataFunctions = { 1: getStep1Data, 2: getStep2Data, 3: getStep3Data, 4: getStep4Data, 5: getStep5Data, 6: getStep6Data, 7: getStep7Data, 8: getStep8Data, 9: getStep9Data };
const validateFunctions = { 1: validateStep1, 2: validateStep2, 3: validateStep3, 4: validateStep4, 5: validateStep5, 6: validateStep6, 7: validateStep7, 8: validateStep8, 9: validateStep9 };

// Live User Auth State
let currentUser = auth ? auth.currentUser : null;
if (auth && onAuthStateChanged) {
  try {
    onAuthStateChanged(auth, user => {
      currentUser = user;
    });
  } catch (e) {}
}

// Helper to deeply sanitize payloads for Firestore (no undefined values)
function sanitizeForFirestore(val) {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeForFirestore);
  const res = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      res[k] = sanitizeForFirestore(v);
    }
  }
  return res;
}

/**
 * Initialize the wizard
 */
export async function initWizard() {
  // Load panel HTML files first
  await loadPanels();

  // Setup event listeners
  setupEventListeners();

  // Load draft from Cloud / localStorage first so wizardData is populated
  const initialStep = await loadDraft();

  // Initialize and activate the step with wizardData fully restored
  await activateStep(initialStep || 1);

  // Show main UI
  if (loadingScreen) loadingScreen.classList.add('hidden');
  if (mainWrap) mainWrap.style.display = 'flex';
}

/**
 * Load all step panel HTML files
 */
async function loadPanels() {
  const panelFiles = [
    'steps/step1.html',
    'steps/step2.html',
    'steps/step3.html',
    'steps/step4.html',
    'steps/step5.html',
    'steps/step6.html',
    'steps/step7.html',
    'steps/step8.html',
    'steps/step9.html'
  ];

  for (let i = 0; i < panelFiles.length; i++) {
    try {
      const response = await fetch(`${panelFiles[i]}?_v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to load ${panelFiles[i]}`);
      let html = await response.text();
      // Clean any live-server script injections or safety tags
      html = html.replace(/<!-- Code injected by live-server -->[\s\S]*?<\/script>/gi, '');
      html = html.replace(/<!--\s*<\/body><\/html>\s*-->/gi, '');
      html = html.replace(/<\/body><\/html>\s*-->/gi, '');
      panelCache[i + 1] = html;
    } catch (e) {
      console.error(`Error loading panel ${i + 1}:`, e);
    }
  }
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
  // Navigation buttons
  btnBack?.addEventListener('click', goBack);
  btnNext?.addEventListener('click', goNext);
  btnMakeLive?.addEventListener('click', makeLive);

  // Stepper sidebar clicks (allow jumping to completed steps or next valid step)
  stepsBar?.addEventListener('click', e => {
    const stepEl = e.target.closest('.cc-step');
    if (stepEl) {
      const step = parseInt(stepEl.dataset.step, 10);
      if (step && step !== currentStep) {
        if (canGoToStep(step)) {
          saveCurrentStepData();
          saveDraft();
          goToStep(step);
        }
      }
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' && (e.ctrlKey || e.metaKey)) goNext();
    if (e.key === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) goBack();
  });

  // Auto-save draft on changes and custom wizard events
  let saveTimeout;
  const scheduleSave = () => {
    console.log('[WIZARD DEBUG] scheduleSave triggered');
    isDirty = true;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveDraft, 400);
  };

  document.addEventListener('input', scheduleSave, true);
  document.addEventListener('change', scheduleSave, true);
  window.addEventListener('wizard:dirty', scheduleSave);
  window.addEventListener('wizard:next', goNext);
  window.addEventListener('wizard:force-next', async () => {
    completedSteps.add(currentStep);
    saveCurrentStepData();
    saveDraft();
    if (currentStep < STEP_COUNT) {
      await goToStep(currentStep + 1);
    }
  });
  window.addEventListener('wizard:prev', goBack);
  window.addEventListener('wizard:toast', e => {
    if (e.detail && e.detail.message) {
      showToast(e.detail.message, e.detail.type || 'info');
    }
  });
}

/**
 * Activate a step panel
 */
async function activateStep(step) {
  if (!panelCache[step]) return;

  // Cleanup previous step
  if (currentStep !== step && cleanupFunctions[currentStep]) {
    cleanupFunctions[currentStep]();
  }

  // Inject panel HTML
  stepPanels.innerHTML = panelCache[step];

  // Set currentStep before calling step init
  currentStep = step;

  // Ensure injected step panel is visible
  const activePanel = stepPanels.querySelector('.cc-panel');
  if (activePanel) {
    activePanel.classList.add('is-active');
  }

  // Scroll to the very top immediately
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Initialize step-specific logic with preserved wizardData
  if (initFunctions[step]) {
    await initFunctions[step](wizardData);
  }

  // Update UI
  updateStepperUI(step);
  updateNavigationUI(step);

  // Guarantee top position after step logic and layout calculations
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

/**
 * Update stepper sidebar UI
 */
function updateStepperUI(step) {
  for (let i = 1; i <= STEP_COUNT; i++) {
    const bubble = document.getElementById(`stepCircle${i}`);
    const connector = document.getElementById(`conn${i}`);
    const stepEl = document.getElementById(`stepBubble${i}`);

    const isDone = i < step || completedSteps.has(i);

    if (stepEl) {
      stepEl.classList.remove('active', 'completed');
      if (i === step) {
        stepEl.classList.add('active');
      } else if (isDone) {
        stepEl.classList.add('completed');
      }
    }
    if (bubble) {
      if (isDone && i !== step) {
        bubble.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
      } else {
        bubble.textContent = i;
      }
    }
    if (connector) {
      connector.classList.toggle('completed', i < step || completedSteps.has(i));
    }
  }
}

/**
 * Update floating navigation buttons
 */
function updateNavigationUI(step) {
  btnBack.style.display = step === 1 ? 'none' : 'flex';

  if (step === STEP_COUNT) {
    btnNext.style.display = 'none';
    btnMakeLive.style.display = 'flex';
    updateMakeLiveButton();
  } else {
    btnNext.style.display = 'flex';
    btnMakeLive.style.display = 'none';
    btnNext.innerHTML = `<ion-icon name="chevron-forward-outline"></ion-icon>`;
    btnNext.disabled = false; // Always clickable so clicking it provides instant feedback
  }
}

/**
 * Check if we can proceed to next step
 * @param {boolean} showErrors - whether to show visual errors
 */
function canProceed(showErrors = false) {
  return validateFunctions[currentStep]?.(showErrors) ?? true;
}

/**
 * Check if we can jump to a specific step
 */
function canGoToStep(step) {
  // Can always go back to previous steps
  if (step < currentStep) return true;
  // If attempting to go forward, current step MUST validate first
  if (!canProceed(true)) return false;
  // Can only advance 1 step or to previously completed steps
  if (completedSteps.has(step) || step === currentStep + 1) return true;
  return false;
}

/**
 * Go to next step
 */
async function goNext() {
  if (!canProceed(true)) {
    // If the step validator didn't already dispatch a specific toast, show fallback
    if (!toastWrap || toastWrap.children.length === 0) {
      showToast('Please fill in all required fields to continue', 'error');
    }
    const firstInvalid = document.querySelector(
      '.cc-field.has-error input, .cc-field.has-error button, .cc-field.has-error .shadcn-country-trigger, .cc-ag-textarea.has-error, .cc-upload-block.has-error, .cc-sec-role-card.has-error'
    );
    firstInvalid?.focus();
    return;
  }

  // Mark current step as completed
  completedSteps.add(currentStep);

  // Save current step data and persist to storage immediately
  saveCurrentStepData();
  saveDraft();

  if (currentStep < STEP_COUNT) {
    await goToStep(currentStep + 1);
  }
}

/**
 * Go to previous step
 */
async function goBack() {
  saveCurrentStepData();
  saveDraft();
  if (currentStep > 1) {
    await goToStep(currentStep - 1);
  }
}

/**
 * Navigate to specific step
 */
async function goToStep(step) {
  if (step >= 1 && step <= STEP_COUNT) {
    await activateStep(step);
    saveDraft();
  }
}

/**
 * Save current step data to wizardData
 */
function saveCurrentStepData() {
  const getData = getDataFunctions[currentStep];
  if (getData) {
    wizardData = { ...wizardData, ...getData() };
  }
}

/**
 * Update Make Live button state
 */
function updateMakeLiveButton() {
  btnMakeLive.disabled = false; // Always clickable so clicking it provides instant feedback
}

/**
 * Make conference live
 */
async function makeLive() {
  saveCurrentStepData();

  // Strict verification: each and every step (1 through 8) must be completely filled before publishing
  for (let s = 1; s <= 8; s++) {
    const valFn = validateFunctions[s];
    if (valFn && !valFn(false)) {
      await goToStep(s);
      valFn(true);
      return;
    }
  }

  // Collect all data
  const finalData = { ...wizardData };
  for (let i = 1; i <= STEP_COUNT; i++) {
    const getData = getDataFunctions[i];
    if (getData) {
      Object.assign(finalData, getData());
    }
  }

  showToast('Publishing conference...', 'info');

  try {
    // Format dates string
    let datesStr = '';
    if (finalData.startDate && finalData.endDate) {
      const s = new Date(finalData.startDate);
      const e = new Date(finalData.endDate);
      const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      datesStr = `${sStr} - ${eStr}`;
    } else {
      datesStr = finalData.dates || 'Dates TBA';
    }

    // Format venue string
    const locParts = [finalData.venue, finalData.city, finalData.state, finalData.country].filter(Boolean);
    const venueStr = locParts.join(', ') || 'Venue TBA';

    // Format rich committees preserving all custom & standard committee details
    const richCommittees = (finalData.committees || []).map(c => {
      if (typeof c === 'string') {
        return {
          code: c,
          name: c,
          fullName: c,
          category: 'General',
          logoUrl: '',
          isCustom: false
        };
      }
      return {
        code: c.code || c.id || c.name || '',
        name: c.name || c.fullName || c.code || '',
        fullName: c.fullName || c.name || c.code || '',
        category: c.category || 'General',
        logoUrl: c.logoUrl || '',
        isCustom: Boolean(c.isCustom),
        history: c.history || c.mandate || '',
        hq: c.hq || '',
        year: c.year || '',
        auditionsOpen: (c.auditionsOpen !== undefined)
          ? Boolean(c.auditionsOpen)
          : (finalData.committeeAuditions && finalData.committeeAuditions[(c.code || '').toUpperCase()] !== undefined
            ? Boolean(finalData.committeeAuditions[(c.code || '').toUpperCase()])
            : (finalData.ebAuditionsOpen !== undefined ? Boolean(finalData.ebAuditionsOpen) : true))
      };
    });

    // Get cached user session if Firebase auth is still hydrating
    const cachedSession = (() => {
      try {
        return JSON.parse(localStorage.getItem('mun_user_session') || '{}');
      } catch (e) {
        return {};
      }
    })();

    // Format fee string from delegateFee or confDelegateFee
    let feeStr = 'Free';
    const rawFee = finalData.delegateFee !== undefined
      ? finalData.delegateFee
      : (finalData.confDelegateFee !== undefined
        ? finalData.confDelegateFee
        : (finalData.fee !== undefined ? finalData.fee : finalData.feeAmount));
    const feeNum = typeof rawFee === 'number'
      ? rawFee
      : parseInt(String(rawFee || '0').replace(/[^0-9]/g, ''), 10);

    if (!isNaN(feeNum) && feeNum > 0) {
      feeStr = `₹${feeNum.toLocaleString('en-IN')}`;
    } else if (typeof rawFee === 'string' && rawFee.trim() && rawFee.trim().toLowerCase() !== '0' && rawFee.trim().toLowerCase() !== 'free') {
      feeStr = rawFee.startsWith('₹') ? rawFee : `₹${rawFee}`;
    }

    const confId = 'conf_' + Date.now();

    showToast('Uploading media to Firebase Storage...', 'info');

    // 1. Upload Conference Crest & Banner to Firebase Storage
    let finalLogoUrl = finalData.logoUrl || finalData.logoDataUrl || '';
    if (finalLogoUrl && finalLogoUrl.startsWith('data:image/')) {
      finalLogoUrl = await uploadDataUrlToStorage(finalLogoUrl, `conferences/${confId}/crest.png`);
    }

    let finalBannerUrl = finalData.bannerUrl || finalData.bannerDataUrl || '';
    if (finalBannerUrl && finalBannerUrl.startsWith('data:image/')) {
      finalBannerUrl = await uploadDataUrlToStorage(finalBannerUrl, `conferences/${confId}/banner.png`);
    }

    const galleryUrls = [...(finalData.galleryDataUrls || finalData.galleryUrls || [])];
    for (let g = 0; g < galleryUrls.length; g++) {
      if (galleryUrls[g] && galleryUrls[g].startsWith('data:image/')) {
        galleryUrls[g] = await uploadDataUrlToStorage(galleryUrls[g], `conferences/${confId}/gallery_${g}.png`);
      }
    }

    // 2. Upload Custom Committee Logos to Firebase Storage
    for (let i = 0; i < richCommittees.length; i++) {
      const comm = richCommittees[i];
      if (comm.logoUrl && comm.logoUrl.startsWith('data:image/')) {
        comm.logoUrl = await uploadDataUrlToStorage(comm.logoUrl, `conferences/${confId}/committees/${comm.code || 'custom'}_logo.png`);
      }
    }

    // 3. Process Executive Board Invitations
    const ebRolesPayload = { ...(finalData.ebRoles || {}) };

    // 4. Process Secretariat Invitations
    const secretariatPayload = { ...(finalData.secretariat || {}) };

    // Extract any already accepted executives from ebRoles and secretariat
    const connectedExecutives = [];
    const connectedExecutiveUids = [];

    for (const [cmCode, execList] of Object.entries(ebRolesPayload)) {
      if (Array.isArray(execList)) {
        for (const ex of execList) {
          if (ex && (ex.status === 'accepted' || ex.acceptedUid)) {
            const uid = ex.acceptedUid || ex.uid || null;
            connectedExecutives.push({
              uid,
              email: (ex.email || '').toLowerCase().trim(),
              displayName: ex.name || ex.displayName || '',
              name: ex.name || ex.displayName || '',
              avatar: ex.avatar || '',
              roleLabel: ex.roleLabel || 'Executive',
              roleTitle: ex.roleLabel || 'Executive',
              roleType: 'executive',
              committeeCode: cmCode,
              committeeName: cmCode,
              committee: cmCode,
              status: 'accepted',
              acceptedAt: ex.acceptedAt || new Date().toISOString()
            });
            if (uid && !connectedExecutiveUids.includes(uid)) {
              connectedExecutiveUids.push(uid);
            }
          }
        }
      }
    }

    for (const [rId, sec] of Object.entries(secretariatPayload)) {
      if (sec && (sec.status === 'accepted' || sec.acceptedUid)) {
        const uid = sec.acceptedUid || sec.uid || null;
        connectedExecutives.push({
          uid,
          email: (sec.email || '').toLowerCase().trim(),
          displayName: sec.name || sec.displayName || '',
          name: sec.name || sec.displayName || '',
          avatar: sec.avatar || '',
          roleLabel: sec.roleLabel || 'Secretariat',
          roleTitle: sec.roleLabel || 'Secretariat',
          roleType: 'secretariat',
          committeeCode: null,
          committee: 'Secretariat',
          status: 'accepted',
          acceptedAt: sec.acceptedAt || new Date().toISOString()
        });
        if (uid && !connectedExecutiveUids.includes(uid)) {
          connectedExecutiveUids.push(uid);
        }
      }
    }

    showToast('Saving structured conference data to Cloud Firestore...', 'info');

    const confPayload = {
      id: confId,
      title: (finalData.title || '').trim(),
      status: 'open',
      format: finalData.format || 'In-Person',
      region: finalData.country || finalData.region || 'Global',
      fee: feeStr,
      delegateFee: feeNum || 0,
      confDelegateFee: feeNum || 0,
      dates: datesStr,
      startDate: finalData.startDate || '',
      endDate: finalData.endDate || '',
      registrationDeadline: finalData.registrationDeadline || '',
      venue: venueStr,
      city: finalData.city || '',
      state: finalData.state || '',
      country: finalData.country || '',
      hostSecretariat: finalData.institution || 'Secretariat',
      institution: finalData.institution || 'Secretariat',
      logoUrl: finalLogoUrl,
      bannerUrl: finalBannerUrl,
      galleryUrls: galleryUrls,
      accentColor: finalData.accentColor || '#0091FF',
      organizerName: finalData.institution || (currentUser ? (currentUser.displayName || currentUser.email) : (cachedSession.displayName || 'Secretariat')),
      organizerUid: (currentUser && currentUser.uid) || cachedSession.uid || 'organizer_' + Date.now(),
      createdBy: (currentUser && currentUser.uid) || cachedSession.uid || 'organizer_' + Date.now(),
      createdByEmail: (currentUser && currentUser.email) || cachedSession.email || '',
      committees: richCommittees,
      committeeCodes: richCommittees.map(c => c.code),
      agendas: finalData.agendas || finalData.agenda || '',
      committeeAgendas: finalData.committeeAgendas || {},
      countryMatrix: finalData.countryMatrix || {},
      ebRoles: ebRolesPayload,
      secretariat: secretariatPayload,
      itinerary: finalData.itinerary || [],
      description: finalData.description || finalData.tagline || '',
      ebAuditionsOpen: finalData.ebAuditionsOpen !== undefined ? Boolean(finalData.ebAuditionsOpen) : true,
      ebRolesNeeded: 'Chairperson, Vice-Chairperson, Crisis Director',
      ebAuditionNote: finalData.ebAuditionNote || '',
      connectedExecutives: connectedExecutives,
      connectedExecutiveUids: connectedExecutiveUids,
      createdAt: new Date().toISOString()
    };

    // 1. PRIMARY SAVE: Persist the entire conference with all committee details directly to Cloud Firestore database
    const firestoreDoc = sanitizeForFirestore(confPayload);
    let firestoreId = null;
    if (firebaseDb && addDocFn && collectionFn) {
      try {
        const docRef = await addDocFn(collectionFn(firebaseDb, 'conferences'), firestoreDoc);
        if (docRef && docRef.id) {
          firestoreId = docRef.id;
          confPayload.id = firestoreId;
          console.log('[Cloud Database] Conference successfully persisted to Cloud Firestore:', firestoreId);

          // Persist individual invitation records to Firestore 'conferenceInvitations' collection
          try {
            const invCollection = collectionFn(firebaseDb, 'conferenceInvitations');
            const organizerUid = (currentUser && currentUser.uid) || cachedSession.uid || '';
            const organizerEmail = (currentUser && currentUser.email) || cachedSession.email || '';
            const confTitle = (finalData.title || '').trim() || 'Untitled Conference';

            // Executive Board Invitations
            for (const [cmCode, execList] of Object.entries(ebRolesPayload)) {
              if (Array.isArray(execList)) {
                for (const ex of execList) {
                  if (ex && ex.email) {
                    const invId = ex.id || `inv_eb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                    const safeInvId = String(invId).replace(/\//g, '_');
                    const cleanEmail = (ex.email || '').toLowerCase().trim();
                    const payload = sanitizeForFirestore({
                      id: safeInvId,
                      confId: firestoreId,
                      confTitle,
                      organizerUid,
                      organizerEmail,
                      recipientEmail: cleanEmail,
                      email: cleanEmail,
                      recipientUid: ex.uid || ex.recipientUid || null,
                      recipientName: ex.name || formatDisplayNameFromEmail(cleanEmail),
                      recipientAvatar: (ex.avatar && ex.avatar.startsWith('data:image/') && ex.avatar.length > 2048) ? null : (ex.avatar || null),
                      roleType: 'executive',
                      roleId: ex.roleId || 'chair',
                      roleLabel: ex.roleLabel || 'Chairperson',
                      committeeCode: cmCode,
                      status: ex.status || 'pending',
                      note: ex.note || '',
                      invitedAt: ex.invitedAt || new Date().toISOString(),
                      createdAt: ex.invitedAt || new Date().toISOString()
                    });
                    if (setDocFn && docFn) {
                      await setDocFn(docFn(firebaseDb, 'conferenceInvitations', safeInvId), payload, { merge: true });
                    } else {
                      await addDocFn(invCollection, payload);
                    }
                  }
                }
              }
            }

            // Secretariat Invitations
            const secList = Object.entries(secretariatPayload)
              .filter(([k]) => k !== 'customRoles')
              .map(([_, v]) => v)
              .concat(secretariatPayload.customRoles || []);

            for (const secRole of secList) {
              if (secRole && secRole.email) {
                const rawInvId = secRole.id ? (secRole.isCustom || String(secRole.id).startsWith('custom-sec-') ? secRole.id : (String(secRole.id).startsWith('sec-inv-') ? secRole.id : `sec-inv-${secRole.id}`)) : `inv_sec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                const safeInvId = String(rawInvId).replace(/\//g, '_');
                const cleanEmail = (secRole.email || '').toLowerCase().trim();
                const payload = sanitizeForFirestore({
                  id: safeInvId,
                  confId: firestoreId,
                  confTitle,
                  organizerUid,
                  organizerEmail,
                  recipientEmail: cleanEmail,
                  email: cleanEmail,
                  recipientUid: secRole.uid || secRole.recipientUid || null,
                  recipientName: secRole.name || formatDisplayNameFromEmail(cleanEmail),
                  recipientAvatar: (secRole.avatar && secRole.avatar.startsWith('data:image/') && secRole.avatar.length > 2048) ? null : (secRole.avatar || null),
                  roleType: 'secretariat',
                  roleId: secRole.id || secRole.roleId || 'custom',
                  roleLabel: secRole.label || secRole.roleLabel || 'Secretariat Member',
                  status: secRole.status || 'pending',
                  note: secRole.note || '',
                  invitedAt: secRole.invitedAt || new Date().toISOString(),
                  createdAt: secRole.invitedAt || new Date().toISOString()
                });
                if (setDocFn && docFn) {
                  await setDocFn(docFn(firebaseDb, 'conferenceInvitations', safeInvId), payload, { merge: true });
                } else {
                  await addDocFn(invCollection, payload);
                }
              }
            }
            console.log('[Invitations] Successfully dispatched role invitations to Firestore conferenceInvitations.');
          } catch (invErr) {
            console.warn('[Invitations] Notice writing conferenceInvitations:', invErr);
          }
        }
      } catch (fbErr) {
        console.error('[Cloud Database] Cloud Firestore write error:', fbErr);
      }
    }

    // 2. Client-side local cache for instant 0ms offline Frame-0 rendering
    try {
      const local = JSON.parse(localStorage.getItem('mun_local_conferences') || '[]');
      const updated = [confPayload, ...local.filter(c => c.title !== confPayload.title && c.id !== confPayload.id && c.id !== confId)];
      localStorage.setItem('mun_local_conferences', JSON.stringify(updated));
    } catch (locErr) {
      console.warn('Local storage cache note:', locErr);
    }

    // Persist local offline invitations cache so invitations show up on home.html immediately
    try {
      const existingLocalInv = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
      const newLocalInv = [];
      const organizerUid = (currentUser && currentUser.uid) || cachedSession.uid || '';
      const organizerEmail = (currentUser && currentUser.email) || cachedSession.email || '';
      const confTitle = (finalData.title || '').trim() || 'Untitled Conference';

      for (const [cmCode, execList] of Object.entries(ebRolesPayload)) {
        if (Array.isArray(execList)) {
          for (const ex of execList) {
            if (ex && ex.email) {
              newLocalInv.push({
                id: ex.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
                confId: firestoreId || confId,
                confTitle,
                organizerUid,
                organizerEmail,
                recipientEmail: ex.email.toLowerCase().trim(),
                recipientUid: ex.uid || ex.recipientUid || null,
                roleType: 'executive',
                roleId: ex.roleId || 'chair',
                roleLabel: ex.roleLabel || 'Chairperson',
                committeeCode: cmCode,
                status: ex.status || 'pending',
                note: ex.note || '',
                createdAt: ex.invitedAt || new Date().toISOString()
              });
            }
          }
        }
      }

      const secList = Object.entries(secretariatPayload)
        .filter(([k]) => k !== 'customRoles')
        .map(([_, v]) => v)
        .concat(secretariatPayload.customRoles || []);

      for (const secRole of secList) {
        if (secRole && secRole.email) {
          newLocalInv.push({
            id: secRole.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            confId: firestoreId || confId,
            confTitle,
            organizerUid,
            organizerEmail,
            recipientEmail: secRole.email.toLowerCase().trim(),
            recipientUid: secRole.uid || secRole.recipientUid || null,
            roleType: 'secretariat',
            roleId: secRole.id || secRole.roleId || 'custom',
            roleLabel: secRole.label || secRole.roleLabel || 'Secretariat Member',
            status: secRole.status || 'pending',
            note: secRole.note || '',
            createdAt: secRole.invitedAt || new Date().toISOString()
          });
        }
      }

      const mergedInv = [...newLocalInv, ...existingLocalInv.filter(old =>
        !newLocalInv.some(n => n.confId === old.confId && n.recipientEmail === old.recipientEmail && n.roleLabel === old.roleLabel && (n.committeeCode || '') === (old.committeeCode || ''))
      )];
      localStorage.setItem('mun_local_invitations', JSON.stringify(mergedInv));
      window.dispatchEvent(new CustomEvent('mun:invitation-dispatched', { detail: mergedInv }));
      safePostBroadcast('mun_invitations_channel', { type: 'invitations_bulk_dispatched', invitations: mergedInv });
    } catch (locInvErr) {
      console.warn('Local storage invitations cache note:', locInvErr);
    }

    showToast(firestoreId ? 'Entire conference saved to Cloud Database!' : 'Conference published successfully!', 'success');
    await clearDraft();

    // Redirect to conferences directory
    setTimeout(() => {
      window.location.href = '../conferences.html';
    }, 1200);
  } catch (error) {
    console.error('Publish error:', error);
    await clearDraft();
    showToast('Conference saved! Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = '../conferences.html';
    }, 1200);
  }
}

let toastTimer = null;
let toastRemoveTimer = null;

/**
 * Show toast notification (White Theme, single-instance)
 */
function showToast(message, type = 'info') {
  if (!toastWrap) return;

  // Clear existing toasts immediately so only one alert is shown at a time
  toastWrap.innerHTML = '';
  if (toastTimer) clearTimeout(toastTimer);
  if (toastRemoveTimer) clearTimeout(toastRemoveTimer);

  const toast = document.createElement('div');
  toast.className = `cc-toast cc-toast-${type} ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <ion-icon name="${type === 'success' ? 'checkmark-circle-outline' : type === 'error' ? 'alert-circle-outline' : 'information-circle-outline'}"></ion-icon>
    <span class="cc-toast-msg">${message}</span>
  `;
  toastWrap.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastRemoveTimer = setTimeout(() => {
      if (toast.parentNode === toastWrap) {
        toast.remove();
      }
    }, 280);
  }, 3200);
}

let cloudDraftTimeout = null;

/**
 * Save draft to both Local Storage and Cloud Firestore database
 */
function saveDraft() {
  console.log('[WIZARD DEBUG] saveDraft called, currentStep:', currentStep);
  saveCurrentStepData();

  if (!wizardData.confId && !wizardData.id) {
    let persistentId = localStorage.getItem('cc_draft_conference_id');
    if (!persistentId) {
      persistentId = 'draft_conf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('cc_draft_conference_id', persistentId);
    }
    wizardData.id = persistentId;
    wizardData.confId = persistentId;
  }

  const draft = {
    step: currentStep,
    data: sanitizeForFirestore(wizardData),
    completedSteps: Array.from(completedSteps),
    updatedAt: new Date().toISOString(),
    timestamp: Date.now()
  };
  console.log('[WIZARD DEBUG] draft object:', draft);

  // 1. Immediately save to browser local storage
  try {
    localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
    console.log('[WIZARD DEBUG] Saved to localStorage');
  } catch (err) {
    console.error('Failed to save draft to localStorage:', err);
  }

  // Broadcast to other tabs ( home screen)
  try {
    const bc = new BroadcastChannel('mun_conference_draft_channel');
    bc.postMessage({ action: 'draft_saved', timestamp: draft.timestamp, draft });
    bc.close();
    console.log('[WIZARD DEBUG] BroadcastChannel message sent');
  } catch (e) {
    console.error('[WIZARD DEBUG] BroadcastChannel error:', e);
  }

  // 2. Debounced auto-save directly to Cloud Firestore
  clearTimeout(cloudDraftTimeout);
  cloudDraftTimeout = setTimeout(async () => {
    try {
      const loggedInUid = (currentUser && currentUser.uid) || getSession()?.uid;
      const uid = loggedInUid || localStorage.getItem('mun_cloud_draft_uid') || (() => {
        const id = 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem('mun_cloud_draft_uid', id);
        return id;
      })();
      if (loggedInUid) {
        try { localStorage.setItem('mun_cloud_draft_uid', loggedInUid); } catch (e) {}
      }

      if (draft.data) {
        draft.data.organizerUid = loggedInUid || uid;
        draft.data.draftOwnerUid = uid;
        draft.data.confId = wizardData.confId || wizardData.id;
      }

      if (firebaseDb && setDocFn && docFn) {
        const payload = {
          ...draft,
          draftOwnerUid: uid,
          userId: loggedInUid || uid,
          ownerEmail: (currentUser && currentUser.email) || getSession()?.email || 'guest'
        };
        await setDocFn(docFn(firebaseDb, 'conference_drafts', uid), payload, { merge: true });
        if (loggedInUid && loggedInUid !== uid) {
          await setDocFn(docFn(firebaseDb, 'conference_drafts', loggedInUid), payload, { merge: true });
        }
        console.log('[Cloud Database] Auto-saved draft to Cloud Firestore for:', uid);
      }
    } catch (cloudErr) {
      console.warn('[Cloud Database] Draft auto-save warning:', cloudErr);
    }
  }, 800);
}

/**
 * Load draft from Cloud Firestore or Local Storage
 * Returns the restored step number
 */
async function loadDraft() {
  console.log('[WIZARD DEBUG] loadDraft called');
  let activeDraft = null;

  // 1. Check local storage
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    console.log('[WIZARD DEBUG] localStorage cc_conference_draft:', raw);
    if (raw) activeDraft = JSON.parse(raw);
  } catch (e) {
    console.error('[WIZARD DEBUG] Error reading localStorage:', e);
  }

  // 2. Check Cloud Firestore for any cloud draft
  try {
    const uid = (currentUser && currentUser.uid) || getSession()?.uid || localStorage.getItem('mun_cloud_draft_uid');
    console.log('[WIZARD DEBUG] Checking cloud draft for uid:', uid);
    if (uid && firebaseDb && getDocFn && docFn) {
      const snap = await getDocFn(docFn(firebaseDb, 'conference_drafts', uid));
      if (snap && snap.exists()) {
        const cloudDraft = snap.data();
        console.log('[WIZARD DEBUG] Cloud draft found:', cloudDraft);
        if (!activeDraft || (cloudDraft.timestamp && cloudDraft.timestamp > (activeDraft.timestamp || 0))) {
          activeDraft = cloudDraft;
          try {
            localStorage.setItem('cc_conference_draft', JSON.stringify(cloudDraft));
          } catch (e) {}
          console.log('[Cloud Database] Restored draft from Cloud Firestore for:', uid);
        } else if (activeDraft && activeDraft.data && cloudDraft.data) {
          // Merge accepted executive statuses from cloud into active draft so local autosave never reverts acceptances!
          let merged = false;
          if (cloudDraft.data.ebRoles && typeof cloudDraft.data.ebRoles === 'object') {
            activeDraft.data.ebRoles = activeDraft.data.ebRoles || {};
            for (const [commCode, list] of Object.entries(cloudDraft.data.ebRoles)) {
              if (!Array.isArray(list)) continue;
              if (!activeDraft.data.ebRoles[commCode]) activeDraft.data.ebRoles[commCode] = [];
              list.forEach(cItem => {
                const cEmail = (cItem.email || cItem.recipientEmail || '').trim().toLowerCase();
                const localItem = activeDraft.data.ebRoles[commCode].find(x =>
                  (x.id && cItem.id && x.id === cItem.id) ||
                  ((x.email || '').trim().toLowerCase() === cEmail)
                );
                if (localItem) {
                  if (cItem.status === 'accepted' && localItem.status !== 'accepted') {
                    localItem.status = 'accepted';
                    localItem.acceptedAt = cItem.acceptedAt;
                    localItem.acceptedUid = cItem.acceptedUid;
                    if (cItem.name) localItem.name = cItem.name;
                    if (cItem.avatar) localItem.avatar = cItem.avatar;
                    merged = true;
                  }
                } else if (cItem.status !== 'revoked' && cItem.status !== 'deleted') {
                  activeDraft.data.ebRoles[commCode].push({ ...cItem });
                  merged = true;
                }
              });
            }
          }
          if (Array.isArray(cloudDraft.data.connectedExecutives) && cloudDraft.data.connectedExecutives.length > 0) {
            activeDraft.data.connectedExecutives = cloudDraft.data.connectedExecutives;
            activeDraft.data.connectedExecutiveUids = cloudDraft.data.connectedExecutiveUids || [];
            merged = true;
          }
          if (merged) {
            try {
              localStorage.setItem('cc_conference_draft', JSON.stringify(activeDraft));
            } catch (e) {}
          }
        }
      }
    }
  } catch (cloudErr) {
    console.warn('[Cloud Database] Cloud draft restore warning:', cloudErr);
  }

  if (activeDraft && activeDraft.data && Object.keys(activeDraft.data).length > 0) {
    wizardData = { ...activeDraft.data };
    if (wizardData.confId) {
      try { localStorage.setItem('cc_draft_conference_id', wizardData.confId); } catch (e) {}
    } else if (wizardData.id) {
      try { localStorage.setItem('cc_draft_conference_id', wizardData.id); } catch (e) {}
    }
    if (Array.isArray(activeDraft.completedSteps)) {
      activeDraft.completedSteps.forEach(s => completedSteps.add(s));
    }
    const savedStep = parseInt(activeDraft.step, 10);
    if (savedStep && savedStep >= 1 && savedStep <= STEP_COUNT) {
      for (let s = 1; s < savedStep; s++) {
        completedSteps.add(s);
      }
      return savedStep;
    }
  }
  return 1;
}

/**
 * Clear draft from Local Storage and Cloud Firestore
 */
async function clearDraft() {
  completedSteps.clear();
  localStorage.removeItem('cc_conference_draft');
  try {
    const bc = new BroadcastChannel('mun_conference_draft_channel');
    bc.postMessage({ action: 'draft_cleared', timestamp: Date.now() });
    bc.close();
  } catch (e) {}
  try {
    const uid = (currentUser && currentUser.uid) || getSession()?.uid || localStorage.getItem('mun_cloud_draft_uid');
    if (uid && firebaseDb && deleteDocFn && docFn) {
      await deleteDocFn(docFn(firebaseDb, 'conference_drafts', uid));
      console.log('[Cloud Database] Cleared cloud draft from Firestore for:', uid);
    }
  } catch (e) {}
}

/**
 * Get wizard data for external use
 */
export function getWizardData() {
  saveCurrentStepData();
  return { ...wizardData };
}

if (typeof window !== 'undefined') {
  window.saveConferenceDraft = saveDraft;
  window.loadConferenceDraft = loadDraft;
}
