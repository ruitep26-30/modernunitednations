/**
 * Step 1 - Basics (Conference 101)
 * Handles form fields, dropdowns, calendars, and location cascading
 */

import { COUNTRIES_LIST, LOCATION_DATA } from '../location-data.js';

let calendarInstances = {};
let step1DataCache = {};

/**
 * Retrieve user's registered country, state, and city from session or profile
 */
function getUserProfileLocation() {
  try {
    const raw = localStorage.getItem('mun_user_session');
    if (raw) {
      const s = JSON.parse(raw);
      const c = s.country || s.profile?.country;
      const st = s.state || s.profile?.state;
      const ci = s.city || s.profile?.city;
      if (c || st || ci) {
        return { country: c || '', state: st || '', city: ci || '' };
      }
    }
  } catch (e) {
    console.warn('Error reading mun_user_session:', e);
  }

  try {
    const rawP = localStorage.getItem('mun_cached_user') || localStorage.getItem('user_profile');
    if (rawP) {
      const p = JSON.parse(rawP);
      const c = p.country || p.profile?.country;
      const st = p.state || p.profile?.state;
      const ci = p.city || p.profile?.city;
      if (c || st || ci) {
        return { country: c || '', state: st || '', city: ci || '' };
      }
    }
  } catch (e) {}

  return { country: '', state: '', city: '' };
}

/**
 * Initialize Step 1
 */
export async function initStep1(existingData = {}) {
  step1DataCache = { ...existingData };
  const userLoc = getUserProfileLocation();
  const initialCountry = existingData.country || userLoc.country || 'India';
  const initialState = existingData.state || userLoc.state || '';
  const initialCity = existingData.city || userLoc.city || '';

  // Initialize dropdowns with defensive error handling so no failure blocks calendars
  try {
    initFormatDropdown(existingData.format);
  } catch (err) {
    console.error('Error initializing format dropdown:', err);
  }

  try {
    initCountryDropdown(initialCountry);
  } catch (err) {
    console.error('Error initializing country dropdown:', err);
  }

  try {
    initStateDropdown(initialState);
  } catch (err) {
    console.error('Error initializing state dropdown:', err);
  }

  try {
    initCityDropdown(initialCity);
  } catch (err) {
    console.error('Error initializing city dropdown:', err);
  }

  // Also listen for Firebase Auth in case user profile doc has real-time location data
  try {
    import('../../../js/firebase-config.js').then(({ auth, db, doc, getDoc, onAuthStateChanged }) => {
      if (!auth) return;
      onAuthStateChanged(auth, async user => {
        if (!user || !db) return;
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const data = snap.data() || {};
            const prof = data.profile || {};
            const c = data.country || prof.country;
            const st = data.state || prof.state;
            const ci = data.city || prof.city;
            if (c && !existingData.country) {
              initCountryDropdown(c);
              if (st) initStateDropdown(st);
              if (ci) initCityDropdown(ci);
            }
          }
        } catch (err) {
          console.warn('Firebase profile location sync:', err);
        }
      });
    }).catch(() => {});
  } catch (e) {}

  // Initialize calendars
  try {
    initCalendars(existingData);
  } catch (err) {
    console.error('Error initializing calendars:', err);
  }

  // Populate form fields
  try {
    populateFields(existingData);
  } catch (err) {
    console.error('Error populating form fields:', err);
  }

  // Setup event listeners
  try {
    setupEventListeners();
  } catch (err) {
    console.error('Error setting up event listeners:', err);
  }
}

/**
 * Cleanup Step 1
 */
export function cleanupStep1() {
  // Cleanup calendar instances
  Object.values(calendarInstances).forEach(cal => cal.destroy?.());
  calendarInstances = {};
}

/**
 * Get Step 1 data
 */
export function getStep1Data() {
  const titleEl = document.getElementById('confTitle');
  if (!titleEl) {
    return { ...step1DataCache };
  }

  const title = getValue('confTitle');
  const institution = getValue('confInstitution');
  const description = getValue('confDescription');
  const delegateFee = parseInt(getValue('confDelegateFee') || '0', 10);
  const format = getValue('confFormat') || 'on-site';
  const registrationDeadline = getValue('confRegDeadline');
  const startDate = getValue('confStartDate');
  const endDate = getValue('confEndDate');
  const country = getValue('confCountry');
  const state = getValue('confState');
  const city = getValue('confCity');
  const venueAddress = getValue('confVenueAddress');

  const data = {
    title,
    confTitle: title,
    institution,
    confInstitution: institution,
    description,
    confDescription: description,
    delegateFee,
    confDelegateFee: delegateFee,
    format,
    confFormat: format,
    registrationDeadline,
    confRegDeadline: registrationDeadline,
    startDate,
    confStartDate: startDate,
    endDate,
    confEndDate: endDate,
    country,
    confCountry: country,
    state,
    confState: state,
    city,
    confCity: city,
    venueAddress,
    confVenueAddress: venueAddress
  };

  step1DataCache = { ...step1DataCache, ...data };
  return data;
}

/**
 * Validate Step 1
 * @param {boolean} showErrors - Whether to show visual error highlights on fields
 */
export function validateStep1(showErrors = false) {
  const titleEl = document.getElementById('confTitle');
  if (!titleEl) {
    // If Step 1 is unmounted from DOM, validate against cached/draft data
    const d = step1DataCache;
    const hasTitle = Boolean(d.title && d.title.trim());
    const hasDates = Boolean(d.startDate && d.endDate);
    return hasTitle && hasDates;
  }

  const format = getValue('confFormat') || 'on-site';

  // Mandatory fields required to proceed
  const required = ['confTitle', 'confInstitution', 'confDescription', 'confDelegateFee', 'confFormat', 'confRegDeadline', 'confStartDate', 'confEndDate'];
  if (format === 'virtual') {
    document.getElementById('f-venueAddress')?.classList.remove('has-error');
  } else {
    required.push('confCountry', 'confState', 'confCity', 'confVenueAddress');
  }

  // Visual/form order of fields to check for the first specific error message
  const fieldOrder = [
    'confTitle',
    'confInstitution',
    'confDescription',
    'confDelegateFee',
    'confFormat',
    'confRegDeadline',
    'confStartDate',
    'confEndDate'
  ];
  if (format !== 'virtual') {
    fieldOrder.push('confCountry', 'confState', 'confCity', 'confVenueAddress');
  }

  const fieldMessages = {
    confTitle: 'Please enter the conference name.',
    confInstitution: 'Please enter the host institution name.',
    confDescription: 'Please enter the conference description.',
    confDelegateFee: 'Please enter a valid delegate fee.',
    confFormat: 'Please select a setup type.',
    confRegDeadline: 'Please select the registration deadline.',
    confStartDate: 'Please select the conference start date.',
    confEndDate: 'Please select the conference end date.',
    confCountry: 'Please select a country.',
    confState: 'Please select a state.',
    confCity: 'Please select a city.',
    confVenueAddress: 'Please enter the venue address.'
  };

  let valid = true;
  const missingMap = {};

  required.forEach(id => {
    const el = document.getElementById(id);
    const field = el?.closest('.cc-field');
    const hasValue = el ? (
      el.id === 'confDelegateFee'
        ? (el.value.trim() !== '' && !isNaN(Number(el.value)) && Number(el.value) >= 0)
        : (el.type === 'hidden' ? !!el.value : !!el.value.trim())
    ) : false;

    if (!hasValue) {
      valid = false;
      missingMap[id] = true;
    }

    // Never paint the form with errors on initial load or passive checks
    if (field) {
      if (showErrors) {
        field.classList.toggle('has-error', !hasValue);
      } else if (hasValue) {
        field.classList.remove('has-error');
      }
    }
  });

  // Find first missing field in form order
  let firstMissingField = null;
  for (const id of fieldOrder) {
    if (missingMap[id]) {
      firstMissingField = id;
      break;
    }
  }

  // Validate date logic
  const regDeadline = getValue('confRegDeadline');
  const startDate = getValue('confStartDate');
  const endDate = getValue('confEndDate');
  let dateLogicError = null;

  if (regDeadline && startDate) {
    const dReg = parseLocalDate(regDeadline);
    const dStart = parseLocalDate(startDate);
    if (dReg && dStart && dStart.getTime() <= dReg.getTime()) {
      if (showErrors) {
        showFieldError('f-startDate', 'Start date must be after registration deadline');
      }
      valid = false;
      if (!dateLogicError) dateLogicError = 'Start date must be after registration deadline.';
    }
  }
  if (startDate && endDate) {
    const dStart = parseLocalDate(startDate);
    const dEnd = parseLocalDate(endDate);
    if (dStart && dEnd && dEnd.getTime() <= dStart.getTime()) {
      if (showErrors) {
        showFieldError('f-endDate', 'End date must be after start date');
      }
      valid = false;
      if (!dateLogicError) dateLogicError = 'End date must be after start date.';
    }
  }

  if (!valid && showErrors) {
    const specificMsg = (firstMissingField && fieldMessages[firstMissingField]) || dateLogicError || 'Please complete all required conference details.';
    window.dispatchEvent(new CustomEvent('wizard:toast', {
      detail: { message: specificMsg, type: 'error' }
    }));
  }

  return valid;
}

/**
 * Dropdown helpers: close other open dropdowns and extract location data
 */
function closeAllDropdowns(exceptContainer = null) {
  document.querySelectorAll('.shadcn-country-dropdown.is-open').forEach(el => {
    if (el !== exceptContainer) {
      el.classList.remove('is-open');
      const trg = el.querySelector('.shadcn-country-trigger');
      if (trg) trg.setAttribute('aria-expanded', 'false');
      el.closest('.cc-field')?.style.removeProperty('z-index');
    }
  });
}

function getStatesForCountry(country) {
  if (!country) country = 'India';
  const countryData = LOCATION_DATA?.[country];
  if (!countryData) {
    return [country, 'All Regions'];
  }
  return Object.keys(countryData);
}

function getCitiesForState(country, state) {
  if (!country) country = 'India';
  const countryData = LOCATION_DATA?.[country];
  if (!countryData) {
    return ['Capital / Main City', 'Central District'];
  }

  if (state && Array.isArray(countryData[state])) {
    return countryData[state];
  }

  if (state) {
    const sLower = state.toLowerCase().trim();
    const matchedKey = Object.keys(countryData).find(k => {
      const kLower = k.toLowerCase().trim();
      return kLower === sLower || kLower.includes(sLower) || sLower.includes(kLower);
    });
    if (matchedKey && Array.isArray(countryData[matchedKey])) {
      return countryData[matchedKey];
    }
  }

  const firstKey = Object.keys(countryData)[0];
  return (firstKey && Array.isArray(countryData[firstKey])) ? countryData[firstKey] : ['Central District'];
}

/**
 * Initialize format dropdown (on-site/virtual/dual-mode)
 */
function initFormatDropdown(selectedValue = 'on-site') {
  const trigger = document.getElementById('formatTrigger');
  const dropdown = document.getElementById('formatDropdown');
  const list = document.getElementById('formatOptionsList') || dropdown?.querySelector('.shadcn-command-list');
  const hiddenInput = document.getElementById('confFormat');
  const search = document.getElementById('formatSearch');
  const label = document.getElementById('formatTriggerLabel');
  const emptyState = document.getElementById('formatEmptyState');
  const container = dropdown?.closest('.shadcn-country-dropdown') || dropdown?.parentElement;

  if (!trigger || !dropdown || !list) return;

  const options = [
    { value: 'on-site', label: 'On-site' },
    { value: 'virtual', label: 'Virtual' },
    { value: 'dual-mode', label: 'Dual-mode' }
  ];

  function renderList(filter = '') {
    if (!list) return;
    list.innerHTML = '';
    const filtered = options.filter(o => o.label.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'shadcn-command-item' + (opt.value === selectedValue ? ' is-selected' : '');
      item.setAttribute('data-value', opt.value);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', opt.value === selectedValue);
      item.tabIndex = 0;
      item.innerHTML = `
        <div class="shadcn-item-left">
          <span class="shadcn-item-name">${opt.label}</span>
        </div>
        <svg class="shadcn-check-icon ${opt.value !== selectedValue ? 'is-hidden' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      `;
      item.addEventListener('click', () => selectFormat(opt.value, opt.label));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectFormat(opt.value, opt.label);
        }
      });
      list.appendChild(item);
    });
  }

  function updateVenueFieldForFormat(fmt) {
    const venueField = document.getElementById('f-venueAddress');
    const venueLabel = document.getElementById('venueLabel');
    const venueAsterisk = document.getElementById('venueAsterisk');
    if (!venueField) return;

    if (fmt === 'virtual') {
      if (venueAsterisk) venueAsterisk.style.display = 'none';
      venueField.classList.remove('has-error');
      if (venueLabel) {
        venueLabel.innerHTML = 'Venue <span class="cc-optional">(Optional for Virtual)</span>';
      }
    } else {
      if (venueAsterisk) venueAsterisk.style.display = 'none';
      if (venueLabel) {
        venueLabel.innerHTML = 'Venue';
      }
    }
  }

  function selectFormat(value, optLabel) {
    selectedValue = value;
    if (hiddenInput) hiddenInput.value = value;
    if (label) label.textContent = optLabel;
    dropdown.querySelectorAll('.shadcn-command-item').forEach(item => {
      const isSel = item.getAttribute('data-value') === value;
      item.classList.toggle('is-selected', isSel);
      item.querySelector('.shadcn-check-icon')?.classList.toggle('is-hidden', !isSel);
      item.setAttribute('aria-selected', isSel);
    });
    updateVenueFieldForFormat(value);
    closeDropdown();
    markDirty();
  }

  function openDropdown() {
    closeAllDropdowns(container);
    container?.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
    container?.closest('.cc-field')?.style.setProperty('z-index', '1000');
    if (search) {
      search.value = '';
      search.focus();
    }
    renderList();
  }

  function closeDropdown() {
    container?.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    container?.closest('.cc-field')?.style.removeProperty('z-index');
  }

  trigger?.addEventListener('click', e => {
    e.stopPropagation();
    container?.classList.contains('is-open') ? closeDropdown() : openDropdown();
  });

  search?.addEventListener('input', e => renderList(e.target.value));

  document.addEventListener('click', e => {
    if (container && !container.contains(e.target)) {
      closeDropdown();
    }
  });

  // Initial render
  renderList();
  if (hiddenInput) hiddenInput.value = selectedValue;
  const currentOpt = options.find(o => o.value === selectedValue) || options[0];
  if (label && currentOpt) label.textContent = currentOpt.label;
  updateVenueFieldForFormat(selectedValue);
}

/**
 * Initialize country dropdown with flags
 */
function initCountryDropdown(selectedCountry = '') {
  const trigger = document.getElementById('countryTrigger');
  const dropdown = document.getElementById('countryDropdown');
  const list = document.getElementById('countryOptionsList') || dropdown?.querySelector('.shadcn-command-list');
  const hiddenInput = document.getElementById('confCountry');
  const search = document.getElementById('countrySearch');
  const label = document.getElementById('countryTriggerLabel');
  const flagImg = document.getElementById('countryFlagImg');
  const emptyState = document.getElementById('countryEmptyState');
  const container = dropdown?.closest('.shadcn-country-dropdown') || dropdown?.parentElement;

  if (!trigger || !dropdown || !list) {
    console.warn('initCountryDropdown: Missing trigger, dropdown, or list element.');
    return;
  }

  let selectedValue = selectedCountry || getUserProfileLocation().country || 'India';

  function getCountryCode(countryName) {
    const countries = Array.isArray(COUNTRIES_LIST) ? COUNTRIES_LIST : [];
    const country = countries.find(c => c.name === countryName);
    return country?.code?.toLowerCase() || 'in';
  }

  function renderList(filter = '') {
    if (!list) return;
    list.innerHTML = '';
    const countries = Array.isArray(COUNTRIES_LIST) ? COUNTRIES_LIST : [];
    const filtered = countries.filter(c =>
      c.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(country => {
      const item = document.createElement('div');
      item.className = 'shadcn-command-item' + (country.name === selectedValue ? ' is-selected' : '');
      item.setAttribute('data-value', country.name);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', country.name === selectedValue);
      item.tabIndex = 0;
      const code = country.code?.toLowerCase() || 'in';
      item.innerHTML = `
        <div class="shadcn-item-left">
          <div class="shadcn-flag-circle">
            <img src="https://flagcdn.com/w40/${code}.png" class="circle-flag-img" alt="${country.name} flag" width="20" height="15" />
          </div>
          <span class="shadcn-item-name">${country.name}</span>
        </div>
        <svg class="shadcn-check-icon ${country.name !== selectedValue ? 'is-hidden' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      `;
      item.addEventListener('click', () => selectCountry(country.name));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCountry(country.name);
        }
      });
      list.appendChild(item);
    });
  }

  function selectCountry(countryName) {
    selectedValue = countryName;
    if (hiddenInput) hiddenInput.value = countryName;
    if (label) label.textContent = countryName;
    const code = getCountryCode(countryName);
    if (flagImg) {
      flagImg.src = `https://flagcdn.com/w40/${code}.png`;
      flagImg.alt = `${countryName} flag`;
    }

    dropdown.querySelectorAll('.shadcn-command-item').forEach(item => {
      const isSel = item.getAttribute('data-value') === countryName;
      item.classList.toggle('is-selected', isSel);
      item.querySelector('.shadcn-check-icon')?.classList.toggle('is-hidden', !isSel);
      item.setAttribute('aria-selected', isSel);
    });

    // Reset state and city
    resetStateAndCity(countryName);
    closeDropdown();
    markDirty();
  }

  function openDropdown() {
    closeAllDropdowns(container);
    container?.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
    container?.closest('.cc-field')?.style.setProperty('z-index', '1000');
    if (search) {
      search.value = '';
      search.focus();
    }
    renderList();
  }

  function closeDropdown() {
    container?.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    container?.closest('.cc-field')?.style.removeProperty('z-index');
  }

  trigger?.addEventListener('click', e => {
    e.stopPropagation();
    container?.classList.contains('is-open') ? closeDropdown() : openDropdown();
  });

  search?.addEventListener('input', e => renderList(e.target.value));

  document.addEventListener('click', e => {
    if (container && !container.contains(e.target)) {
      closeDropdown();
    }
  });

  // Initial
  renderList();
  if (hiddenInput) hiddenInput.value = selectedValue;
  if (label) label.textContent = selectedValue;
  const code = getCountryCode(selectedValue);
  if (flagImg) {
    flagImg.src = `https://flagcdn.com/w40/${code}.png`;
    flagImg.alt = `${selectedValue} flag`;
  }
}

/**
 * Initialize state dropdown
 */
function initStateDropdown(selectedState = '') {
  const trigger = document.getElementById('stateTrigger');
  const dropdown = document.getElementById('stateDropdown');
  const list = document.getElementById('stateOptionsList') || dropdown?.querySelector('.shadcn-command-list');
  const hiddenInput = document.getElementById('confState');
  const search = document.getElementById('stateSearch');
  const label = document.getElementById('stateTriggerLabel');
  const emptyState = document.getElementById('stateEmptyState');
  const container = dropdown?.closest('.shadcn-country-dropdown') || dropdown?.parentElement;

  if (!trigger || !dropdown || !list) {
    console.warn('initStateDropdown: Missing trigger, dropdown, or list element.');
    return;
  }

  let states = [];
  let selectedValue = selectedState || getUserProfileLocation().state || '';

  function updateStates(country, resetToFirst = false) {
    states = getStatesForCountry(country);
    if (resetToFirst || !selectedValue) {
      selectedValue = states[0] || '';
    } else {
      const sLower = selectedValue.toLowerCase().trim();
      const match = states.find(s => {
        const kLower = s.toLowerCase().trim();
        return kLower === sLower || kLower.includes(sLower) || sLower.includes(kLower);
      });
      selectedValue = match || states[0] || '';
    }
    renderList();
    updateTrigger();
    if (hiddenInput) hiddenInput.value = selectedValue;
  }

  function renderList(filter = '') {
    if (!list) return;
    list.innerHTML = '';
    const filtered = states.filter(s => s.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(state => {
      const item = document.createElement('div');
      item.className = 'shadcn-command-item' + (state === selectedValue ? ' is-selected' : '');
      item.setAttribute('data-value', state);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', state === selectedValue);
      item.tabIndex = 0;
      item.innerHTML = `
        <div class="shadcn-item-left">
          <span class="shadcn-item-name">${state}</span>
        </div>
        <svg class="shadcn-check-icon ${state !== selectedValue ? 'is-hidden' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      `;
      item.addEventListener('click', () => selectState(state));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectState(state);
        }
      });
      list.appendChild(item);
    });
  }

  function selectState(state) {
    selectedValue = state;
    if (hiddenInput) hiddenInput.value = state;
    if (label) label.textContent = state;

    dropdown.querySelectorAll('.shadcn-command-item').forEach(item => {
      const isSel = item.getAttribute('data-value') === state;
      item.classList.toggle('is-selected', isSel);
      item.querySelector('.shadcn-check-icon')?.classList.toggle('is-hidden', !isSel);
      item.setAttribute('aria-selected', isSel);
    });

    // Reset city
    resetCityForState(state);
    closeDropdown();
    markDirty();
  }

  function updateTrigger() {
    if (label) label.textContent = selectedValue || 'Select state';
  }

  function openDropdown() {
    closeAllDropdowns(container);
    container?.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
    container?.closest('.cc-field')?.style.setProperty('z-index', '1000');
    if (search) {
      search.value = '';
      search.focus();
    }
    renderList();
  }

  function closeDropdown() {
    container?.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    container?.closest('.cc-field')?.style.removeProperty('z-index');
  }

  trigger?.addEventListener('click', e => {
    e.stopPropagation();
    container?.classList.contains('is-open') ? closeDropdown() : openDropdown();
  });

  search?.addEventListener('input', e => renderList(e.target.value));

  document.addEventListener('click', e => {
    if (container && !container.contains(e.target)) {
      closeDropdown();
    }
  });

  // Expose update function for country change
  window.updateStatesForCountry = updateStates;

  // Initialize with initial country
  const currentCountry = getValue('confCountry') || 'India';
  updateStates(currentCountry);
}

/**
 * Initialize city dropdown
 */
function initCityDropdown(selectedCity = '') {
  const trigger = document.getElementById('cityTrigger');
  const dropdown = document.getElementById('cityDropdown');
  const list = document.getElementById('cityOptionsList') || dropdown?.querySelector('.shadcn-command-list');
  const hiddenInput = document.getElementById('confCity');
  const search = document.getElementById('citySearch');
  const label = document.getElementById('cityTriggerLabel');
  const emptyState = document.getElementById('cityEmptyState');
  const container = dropdown?.closest('.shadcn-country-dropdown') || dropdown?.parentElement;

  if (!trigger || !dropdown || !list) {
    console.warn('initCityDropdown: Missing trigger, dropdown, or list element.');
    return;
  }

  let cities = [];
  let selectedValue = selectedCity || getUserProfileLocation().city || '';

  function updateCities(state, resetToFirst = false) {
    const country = getValue('confCountry') || 'India';
    cities = getCitiesForState(country, state);

    if (resetToFirst || !selectedValue) {
      selectedValue = cities[0] || '';
    } else {
      const cLower = selectedValue.toLowerCase().trim();
      const match = cities.find(c => {
        const itemLower = c.toLowerCase().trim();
        return itemLower === cLower || itemLower.includes(cLower) || cLower.includes(itemLower);
      });
      selectedValue = match || cities[0] || '';
    }

    renderList();
    updateTrigger();
    if (hiddenInput) hiddenInput.value = selectedValue;
  }

  function renderList(filter = '') {
    if (!list) return;
    list.innerHTML = '';
    const filtered = cities.filter(c => c.toLowerCase().includes(filter.toLowerCase()));

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach(city => {
      const item = document.createElement('div');
      item.className = 'shadcn-command-item' + (city === selectedValue ? ' is-selected' : '');
      item.setAttribute('data-value', city);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', city === selectedValue);
      item.tabIndex = 0;
      item.innerHTML = `
        <div class="shadcn-item-left">
          <span class="shadcn-item-name">${city}</span>
        </div>
        <svg class="shadcn-check-icon ${city !== selectedValue ? 'is-hidden' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      `;
      item.addEventListener('click', () => selectCity(city));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCity(city);
        }
      });
      list.appendChild(item);
    });
  }

  function selectCity(city) {
    selectedValue = city;
    if (hiddenInput) hiddenInput.value = city;
    if (label) label.textContent = city;

    dropdown.querySelectorAll('.shadcn-command-item').forEach(item => {
      const isSel = item.getAttribute('data-value') === city;
      item.classList.toggle('is-selected', isSel);
      item.querySelector('.shadcn-check-icon')?.classList.toggle('is-hidden', !isSel);
      item.setAttribute('aria-selected', isSel);
    });

    closeDropdown();
    markDirty();
  }

  function updateTrigger() {
    if (label) label.textContent = selectedValue || 'Select city';
  }

  function openDropdown() {
    closeAllDropdowns(container);
    container?.classList.add('is-open');
    trigger?.setAttribute('aria-expanded', 'true');
    container?.closest('.cc-field')?.style.setProperty('z-index', '1000');
    if (search) {
      search.value = '';
      search.focus();
    }
    renderList();
  }

  function closeDropdown() {
    container?.classList.remove('is-open');
    trigger?.setAttribute('aria-expanded', 'false');
    container?.closest('.cc-field')?.style.removeProperty('z-index');
  }

  trigger?.addEventListener('click', e => {
    e.stopPropagation();
    container?.classList.contains('is-open') ? closeDropdown() : openDropdown();
  });

  search?.addEventListener('input', e => renderList(e.target.value));

  document.addEventListener('click', e => {
    if (container && !container.contains(e.target)) {
      closeDropdown();
    }
  });

  // Expose update function for state change
  window.updateCitiesForState = updateCities;

  // Initialize with initial state
  const currentState = getValue('confState') || selectedValue || '';
  updateCities(currentState);
}

/**
 * Reset state and city when country changes
 */
function resetStateAndCity(country) {
  if (window.updateStatesForCountry) {
    window.updateStatesForCountry(country, true);
  }
  const currentState = document.getElementById('confState')?.value;
  if (window.updateCitiesForState) {
    window.updateCitiesForState(currentState, true);
  }
}

/**
 * Reset city when state changes
 */
function resetCityForState(state) {
  if (window.updateCitiesForState) {
    window.updateCitiesForState(state, true);
  }
}

/**
 * Date Helpers for robust timezone-safe calendar handling
 */
function formatLocalDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const str = String(val).trim();
  const datePart = str.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  return null;
}

function startOfDay(d) {
  if (!d || isNaN(d.getTime())) return null;
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d, n) {
  if (!d || isNaN(d.getTime())) return null;
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Initialize calendar widgets
 */
function initCalendars(existingData = {}) {
  const today = startOfDay(new Date());

  // Clean up any prior instances
  Object.values(calendarInstances).forEach(cal => cal.destroy?.());
  calendarInstances = {};

  const calConfigs = [
    {
      id: 'regDeadline',
      inputId: 'confRegDeadline',
      fieldId: 'f-regDeadline',
      keys: ['confRegDeadline', 'registrationDeadline', 'regDeadline']
    },
    {
      id: 'startDate',
      inputId: 'confStartDate',
      fieldId: 'f-startDate',
      keys: ['confStartDate', 'startDate']
    },
    {
      id: 'endDate',
      inputId: 'confEndDate',
      fieldId: 'f-endDate',
      keys: ['confEndDate', 'endDate']
    }
  ];

  // Resolve existing dates from data
  const getExistingDate = (keys) => {
    for (const k of keys) {
      if (existingData[k]) {
        const parsed = parseLocalDate(existingData[k]);
        if (parsed) return parsed;
      }
    }
    return null;
  };

  const initialReg = getExistingDate(calConfigs[0].keys);
  const rawStart = getExistingDate(calConfigs[1].keys);
  const rawEnd = getExistingDate(calConfigs[2].keys);

  // Constraints:
  // Registration: min is today
  // Start: strictly after registration (registration + 1 day)
  // End: strictly after start date (start + 1 day, cannot be the same day)
  const regMin = today;
  const startMin = initialReg ? addDays(initialReg, 1) : null;
  const initialStart = (rawStart && startMin && rawStart.getTime() >= startMin.getTime()) ? rawStart : null;
  const endMin = initialStart ? addDays(initialStart, 1) : null;
  const initialEnd = (rawEnd && endMin && rawEnd.getTime() >= endMin.getTime()) ? rawEnd : null;

  calConfigs.forEach(cfg => {
    const fieldEl = document.getElementById(cfg.fieldId);
    const widget = document.getElementById(`calWidget-${cfg.id}`);
    const grid = document.getElementById(`calGrid-${cfg.id}`);
    const monthTitle = document.getElementById(`calMonth-${cfg.id}`);
    const selectedBadge = document.getElementById(`calSelectedBadge-${cfg.id}`);
    const prevBtn = document.getElementById(`calPrev-${cfg.id}`);
    const nextBtn = document.getElementById(`calNext-${cfg.id}`);
    const hiddenInput = document.getElementById(cfg.inputId);

    if (!grid) return;

    let isLocked = false;
    let initialDate = null;
    let initialMin = null;

    if (cfg.id === 'regDeadline') {
      isLocked = false;
      initialDate = initialReg;
      initialMin = regMin;
    } else if (cfg.id === 'startDate') {
      isLocked = !initialReg;
      initialMin = startMin;
      initialDate = initialStart;
    } else if (cfg.id === 'endDate') {
      isLocked = !initialStart;
      initialMin = endMin;
      initialDate = initialEnd;
    }

    const instance = {
      id: cfg.id,
      inputId: cfg.inputId,
      fieldId: cfg.fieldId,
      currentDate: initialDate 
        ? new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
        : (initialMin 
            ? new Date(initialMin.getFullYear(), initialMin.getMonth(), 1)
            : new Date(today.getFullYear(), today.getMonth(), 1)),
      selectedDate: initialDate,
      minDate: initialMin,
      isLocked: isLocked,
      destroy: () => {}
    };

    function updateBadgeAndInput() {
      if (instance.isLocked) {
        if (selectedBadge) {
          if (cfg.id === 'startDate') {
            selectedBadge.textContent = 'Select registration deadline first';
          } else if (cfg.id === 'endDate') {
            selectedBadge.textContent = 'Select start date first';
          } else {
            selectedBadge.textContent = 'No date selected';
          }
          selectedBadge.classList.remove('has-date');
        }
        if (hiddenInput) {
          hiddenInput.value = '';
        }
        return;
      }

      if (instance.selectedDate) {
        if (selectedBadge) {
          const dateStr = instance.selectedDate.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
          });
          selectedBadge.innerHTML = `
            <span class="cc-cal-status-text">${dateStr}</span>
            <button type="button" class="cc-cal-clear-btn" aria-label="Clear date" title="Deselect date">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          `;
          selectedBadge.classList.add('has-date');
          const clearBtn = selectedBadge.querySelector('.cc-cal-clear-btn');
          clearBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            deselectDate();
          });
        }
        if (hiddenInput) {
          hiddenInput.value = formatLocalDate(instance.selectedDate);
        }
      } else {
        if (selectedBadge) {
          selectedBadge.textContent = 'No date selected';
          selectedBadge.classList.remove('has-date');
        }
        if (hiddenInput) {
          hiddenInput.value = '';
        }
      }
    }

    function render() {
      // Toggle locked CSS classes on field container
      if (fieldEl) {
        if (cfg.id === 'startDate') {
          fieldEl.classList.toggle('date-disabled', instance.isLocked);
        } else if (cfg.id === 'endDate') {
          fieldEl.classList.toggle('end-date-disabled', instance.isLocked);
          fieldEl.classList.toggle('date-disabled', instance.isLocked);
        }
      }

      const year = instance.currentDate.getFullYear();
      const month = instance.currentDate.getMonth();

      if (monthTitle) {
        const monthShort = instance.currentDate.toLocaleString('en-US', { month: 'short' });
        monthTitle.innerHTML = `
          <span class="cc-cal-month-name">${monthShort}</span>
          <span class="cc-cal-year-num">${year}</span>
        `;
      }

      // Month navigation availability
      if (prevBtn) {
        if (instance.isLocked) {
          prevBtn.disabled = true;
          prevBtn.style.opacity = '0.3';
          prevBtn.style.pointerEvents = 'none';
        } else {
          const min = startOfDay(instance.minDate);
          if (min) {
            const prevMonthLastDay = new Date(year, month, 0, 23, 59, 59, 999);
            if (prevMonthLastDay.getTime() < min.getTime()) {
              prevBtn.disabled = true;
              prevBtn.style.opacity = '0.3';
              prevBtn.style.pointerEvents = 'none';
            } else {
              prevBtn.disabled = false;
              prevBtn.style.opacity = '1';
              prevBtn.style.pointerEvents = 'auto';
            }
          } else {
            prevBtn.disabled = false;
            prevBtn.style.opacity = '1';
            prevBtn.style.pointerEvents = 'auto';
          }
        }
      }
      if (nextBtn) {
        if (instance.isLocked) {
          nextBtn.disabled = true;
          nextBtn.style.opacity = '0.3';
          nextBtn.style.pointerEvents = 'none';
        } else {
          nextBtn.disabled = false;
          nextBtn.style.opacity = '1';
          nextBtn.style.pointerEvents = 'auto';
        }
      }

      const firstDayIndex = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const min = startOfDay(instance.minDate);

      grid.innerHTML = '';

      // Empty cells before day 1
      for (let i = 0; i < firstDayIndex; i++) {
        const empty = document.createElement('div');
        empty.className = 'cc-cal-day-cell is-empty';
        empty.setAttribute('aria-hidden', 'true');
        grid.appendChild(empty);
      }

      // Day numbers 1..daysInMonth
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day, 0, 0, 0, 0);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cc-cal-day-cell';
        cell.setAttribute('data-date', formatLocalDate(cellDate));
        cell.innerHTML = `<span class="cc-cal-day-num">${day}</span>`;

        // Disable cell if calendar is locked or cellDate is strictly before minDate
        const isPast = instance.isLocked || (min ? cellDate.getTime() < min.getTime() : false);
        if (isPast) {
          cell.classList.add('is-disabled');
          cell.disabled = true;
          cell.setAttribute('aria-disabled', 'true');
        }

        if (cellDate.getDay() === 0) {
          cell.classList.add('is-sunday');
        }

        if (!instance.isLocked && instance.selectedDate && cellDate.getTime() === instance.selectedDate.getTime()) {
          cell.classList.add('is-selected');
          cell.setAttribute('aria-selected', 'true');
        }

        if (!isPast && !instance.isLocked) {
          cell.addEventListener('click', (e) => {
            e.preventDefault();
            if (instance.selectedDate && cellDate.getTime() === instance.selectedDate.getTime()) {
              deselectDate();
            } else {
              selectDate(cellDate);
            }
          });
        }

        grid.appendChild(cell);
      }

      updateBadgeAndInput();
    }

    function selectDate(date) {
      if (instance.isLocked) return;

      instance.selectedDate = startOfDay(date);
      updateBadgeAndInput();
      hiddenInput?.closest?.('.cc-field')?.classList?.remove('has-error');

      // Sequential date selection cascade
      if (cfg.id === 'regDeadline') {
        const startCal = calendarInstances['startDate'];
        if (startCal) {
          // Unlock Start Date calendar
          startCal.isLocked = false;
          // If registration date is 18, start date MUST be after that (strictly 19+)
          startCal.minDate = addDays(instance.selectedDate, 1);

          const fStart = document.getElementById(startCal.fieldId);
          fStart?.classList?.remove('date-disabled');

          // If start date was previously selected and is <= registration deadline, clear it
          if (startCal.selectedDate && startCal.selectedDate.getTime() < startCal.minDate.getTime()) {
            startCal.selectedDate = null;
            const startInput = document.getElementById(startCal.inputId);
            if (startInput) startInput.value = '';

            // Also lock and clear End Date calendar until a new start date is picked
            const endCal = calendarInstances['endDate'];
            if (endCal) {
              endCal.isLocked = true;
              endCal.selectedDate = null;
              endCal.minDate = null;
              const endInput = document.getElementById(endCal.inputId);
              if (endInput) endInput.value = '';
              const fEnd = document.getElementById(endCal.fieldId);
              fEnd?.classList?.add('end-date-disabled');
              fEnd?.classList?.add('date-disabled');
              endCal.updateBadgeAndInput();
              endCal.render();
            }
          }

          // Ensure start calendar view is at or after minDate month
          if (startCal.minDate && (
            startCal.currentDate.getFullYear() < startCal.minDate.getFullYear() ||
            (startCal.currentDate.getFullYear() === startCal.minDate.getFullYear() && startCal.currentDate.getMonth() < startCal.minDate.getMonth())
          )) {
            startCal.currentDate = new Date(startCal.minDate.getFullYear(), startCal.minDate.getMonth(), 1);
          }

          startCal.render();
        }
      } else if (cfg.id === 'startDate') {
        const endCal = calendarInstances['endDate'];
        if (endCal) {
          // Unlock End Date calendar
          endCal.isLocked = false;
          // End date cannot be the same day; must be strictly after start date (start + 1 day)
          endCal.minDate = addDays(instance.selectedDate, 1);

          const fEnd = document.getElementById(endCal.fieldId);
          fEnd?.classList?.remove('end-date-disabled');
          fEnd?.classList?.remove('date-disabled');

          // If end date was previously selected and is <= start date, clear it
          if (endCal.selectedDate && endCal.selectedDate.getTime() < endCal.minDate.getTime()) {
            endCal.selectedDate = null;
            const endInput = document.getElementById(endCal.inputId);
            if (endInput) endInput.value = '';
          }

          // Ensure end calendar view is at or after minDate month
          if (endCal.minDate && (
            endCal.currentDate.getFullYear() < endCal.minDate.getFullYear() ||
            (endCal.currentDate.getFullYear() === endCal.minDate.getFullYear() && endCal.currentDate.getMonth() < endCal.minDate.getMonth())
          )) {
            endCal.currentDate = new Date(endCal.minDate.getFullYear(), endCal.minDate.getMonth(), 1);
          }

          endCal.render();
        }
      }

      render();
      markDirty();
    }

    function deselectDate() {
      if (instance.isLocked) return;

      instance.selectedDate = null;
      updateBadgeAndInput();

      if (cfg.id === 'regDeadline') {
        // Fallback: If registration deadline is deselected, start date and end date must both fall back and lock!
        const startCal = calendarInstances['startDate'];
        if (startCal) {
          startCal.isLocked = true;
          startCal.selectedDate = null;
          startCal.minDate = null;
          const startInput = document.getElementById(startCal.inputId);
          if (startInput) startInput.value = '';
          const fStart = document.getElementById(startCal.fieldId);
          fStart?.classList?.add('date-disabled');
          startCal.updateBadgeAndInput();
          startCal.render();
        }

        const endCal = calendarInstances['endDate'];
        if (endCal) {
          endCal.isLocked = true;
          endCal.selectedDate = null;
          endCal.minDate = null;
          const endInput = document.getElementById(endCal.inputId);
          if (endInput) endInput.value = '';
          const fEnd = document.getElementById(endCal.fieldId);
          fEnd?.classList?.add('end-date-disabled');
          fEnd?.classList?.add('date-disabled');
          endCal.updateBadgeAndInput();
          endCal.render();
        }
      } else if (cfg.id === 'startDate') {
        // Fallback: If start date is deselected, end date must fall back and lock!
        const endCal = calendarInstances['endDate'];
        if (endCal) {
          endCal.isLocked = true;
          endCal.selectedDate = null;
          endCal.minDate = null;
          const endInput = document.getElementById(endCal.inputId);
          if (endInput) endInput.value = '';
          const fEnd = document.getElementById(endCal.fieldId);
          fEnd?.classList?.add('end-date-disabled');
          fEnd?.classList?.add('date-disabled');
          endCal.updateBadgeAndInput();
          endCal.render();
        }
      }

      render();
      markDirty();
    }

    const onPrev = (e) => {
      e.preventDefault();
      if (instance.isLocked) return;
      instance.currentDate = new Date(instance.currentDate.getFullYear(), instance.currentDate.getMonth() - 1, 1);
      render();
    };

    const onNext = (e) => {
      e.preventDefault();
      if (instance.isLocked) return;
      instance.currentDate = new Date(instance.currentDate.getFullYear(), instance.currentDate.getMonth() + 1, 1);
      render();
    };

    prevBtn?.addEventListener('click', onPrev);
    nextBtn?.addEventListener('click', onNext);

    instance.destroy = () => {
      prevBtn?.removeEventListener('click', onPrev);
      nextBtn?.removeEventListener('click', onNext);
    };

    instance.render = render;
    instance.updateBadgeAndInput = updateBadgeAndInput;
    instance.deselectDate = deselectDate;
    calendarInstances[cfg.id] = instance;

    // Initial render
    render();
  });
}

/**
 * Populate form fields from existing data
 */
function populateFields(data) {
  if (!data) return;
  const fields = [
    'confTitle', 'confInstitution', 'confDescription', 'confDelegateFee',
    'confVenueAddress'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    const val = data[id] ?? (id === 'confTitle' ? data.title : id === 'confInstitution' ? data.institution : id === 'confDescription' ? data.description : id === 'confDelegateFee' ? data.delegateFee : id === 'confVenueAddress' ? data.venueAddress : undefined);
    if (el && val !== undefined && val !== null) {
      el.value = val;
      if (id === 'confDescription') updateCharCount(el);
      if (id === 'confDelegateFee') updateFeeWords(el);
    }
  });
}

/**
 * Setup event listeners for form fields
 */
function setupEventListeners() {
  const descInput = document.getElementById('confDescription');
  descInput?.addEventListener('input', e => updateCharCount(e.target));

  const feeInput = document.getElementById('confDelegateFee');
  feeInput?.addEventListener('input', e => updateFeeWords(e.target));
  if (feeInput) updateFeeWords(feeInput);

  document.querySelectorAll('#panel1 input, #panel1 select, #panel1 textarea').forEach(el => {
    el.addEventListener('input', (e) => {
      markDirty();
      if (e.target.value && e.target.value.trim()) {
        e.target.closest('.cc-field')?.classList.remove('has-error');
      }
    });
    el.addEventListener('change', (e) => {
      markDirty();
      if (e.target.value) {
        e.target.closest('.cc-field')?.classList.remove('has-error');
      }
    });
  });
}

/**
 * Update character count for description
 */
function updateCharCount(input) {
  const count = input.value.length;
  const countEl = document.getElementById('descCount');
  if (countEl) countEl.textContent = count;
}

/**
 * Update fee words display
 */
function updateFeeWords(input) {
  const fee = parseInt(input.value || '0', 10);
  const wordsEl = document.getElementById('feeWords');
  if (!wordsEl) return;

  if (fee === 0) {
    wordsEl.textContent = 'Zero Rupees Only';
  } else {
    wordsEl.textContent = numberToWords(fee) + ' Rupees Only';
  }
}

/**
 * Convert number to words (Indian numbering)
 */
function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
}

/**
 * Show field error
 */
function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (field) {
    field.classList.add('has-error');
    const errorEl = field.querySelector('.cc-field-error');
    if (errorEl) errorEl.textContent = message;
  }
}

/**
 * Get input value helper
 */
function getValue(id) {
  const el = document.getElementById(id);
  return el?.value ?? '';
}

/**
 * Mark form as dirty
 */
function markDirty() {
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}
