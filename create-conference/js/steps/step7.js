/**
 * Step 7 - Conference Itinerary / Schedule Controller
 * Day-wise timeline with vertical left line, session slots (Morning/Afternoon/Evening/Night) & modal
 */

let itineraryData = [];
let activeDayNumber = 1;
let editingEventId = null;
let baseDayCount = 2; // Base day count derived strictly from Step 1 dates

// Period icons and meta
const PERIOD_META = {
  morning: {
    label: 'Morning',
    icon: 'sunny-outline',
    badgeClass: 'morning'
  },
  afternoon: {
    label: 'Afternoon',
    icon: 'partly-sunny-outline',
    badgeClass: 'afternoon'
  },
  evening: {
    label: 'Evening',
    icon: 'cloudy-night-outline',
    badgeClass: 'evening'
  },
  night: {
    label: 'Night',
    icon: 'moon-outline',
    badgeClass: 'night'
  }
};

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

  const str = String(dateStr).trim();
  const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return new Date(y, mon, d);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function getConferenceDaysFromDates(startDateVal, endDateVal) {
  const s = parseLocalDate(startDateVal);
  const e = parseLocalDate(endDateVal);

  if (!s || !e) return null;

  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);

  const start = s <= e ? s : e;
  const end = s <= e ? e : s;

  const days = [];
  const cur = new Date(start);
  let dayNum = 1;

  while (cur <= end && days.length < 30) {
    const curCopy = new Date(cur);
    const dateFormatted = curCopy.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekday = curCopy.toLocaleDateString('en-US', { weekday: 'short' });
    const fullDate = curCopy.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const isoDate = curCopy.toISOString().split('T')[0];

    days.push({
      dayNumber: dayNum,
      dayLabel: `Day ${dayNum}`,
      dateStr: isoDate,
      dateFormatted: `${weekday}, ${dateFormatted}`,
      shortDate: dateFormatted,
      fullDateFormatted: fullDate
    });

    cur.setDate(cur.getDate() + 1);
    dayNum++;
  }

  return days;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format Display Time ( 8 AM - 9 AM, 10:30 AM - 12 PM)
 */
function formatDisplayTime(startTime, endTime, rawTime) {
  const cleanSingleTime = (t) => {
    if (!t) return '';
    let s = String(t).trim();
    // Replace "08:00 AM" with "8 AM", "08:30 AM" with "8:30 AM"
    s = s.replace(/^0?([1-9]|1[0-2]):00\s*(AM|PM)$/i, '$1 $2');
    s = s.replace(/^0?([1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$/i, '$1:$2 $3');
    s = s.replace(/^0?([1-9]|1[0-2])\s*(AM|PM)$/i, '$1 $2');
    return s;
  };

  const start = cleanSingleTime(startTime);
  const end = cleanSingleTime(endTime);

  if (start && end) {
    return `${start} - ${end}`;
  }
  if (start) return start;
  if (end) return end;

  if (rawTime) {
    let r = String(rawTime).replace(/–/g, '-');
    r = r.replace(/\b0?([1-9]|1[0-2]):00\s*(AM|PM)\b/gi, '$1 $2');
    r = r.replace(/\b0?([1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)\b/gi, '$1:$2 $3');
    r = r.replace(/\b0?([1-9]|1[0-2])\s*(AM|PM)\b/gi, '$1 $2');
    return r;
  }

  return '';
}

/**
 * Standard Dummy Morning Breakfast Event for days
 */
function createDefaultBreakfastEvent(dayNum) {
  return {
    id: `ev_breakfast_d${dayNum}`,
    period: 'morning',
    title: 'Morning Breakfast',
    startTime: '8:00 AM',
    endTime: '9:00 AM',
    time: '8 AM - 9 AM',
    location: 'Dining Hall',
    description: 'Morning breakfast and delegate assembly.',
    desc: 'Morning breakfast and delegate assembly.'
  };
}

/**
 * Initialize Step 7 (Itinerary)
 */
export async function initStep7(existingData = {}) {
  // 1. Resolve start and end dates from Step 1 data, global state, or draft
  const draftData = (() => {
    try {
      return JSON.parse(localStorage.getItem('cc_conference_draft') || '{}')?.data || {};
    } catch (e) {
      return {};
    }
  })();

  const startDate = existingData.startDate ||
                    existingData.confStartDate ||
                    window.__wizardData?.startDate ||
                    window.__wizardData?.confStartDate ||
                    draftData.startDate ||
                    draftData.confStartDate;

  const endDate = existingData.endDate ||
                  existingData.confEndDate ||
                  window.__wizardData?.endDate ||
                  window.__wizardData?.confEndDate ||
                  draftData.endDate ||
                  draftData.confEndDate;

  // Compute days strictly from the Step 1 date range
  const computedDays = getConferenceDaysFromDates(startDate, endDate);

  // Existing saved itinerary data (if any)
  const previousItinerary = (Array.isArray(existingData.itinerary) && existingData.itinerary.length > 0)
    ? existingData.itinerary
    : (Array.isArray(window.__wizardData?.itinerary) && window.__wizardData.itinerary.length > 0)
      ? window.__wizardData.itinerary
      : (Array.isArray(draftData.itinerary) && draftData.itinerary.length > 0)
        ? draftData.itinerary
        : [];

  if (computedDays && computedDays.length > 0) {
    baseDayCount = computedDays.length;
    // Synchronize itinerary days strictly according to Step 1 start and end dates
    itineraryData = computedDays.map(comp => {
      const existingDay = previousItinerary.find(d => d.dayNumber === comp.dayNumber);
      let dayEvents = [];

      if (existingDay && Array.isArray(existingDay.events) && existingDay.events.length > 0) {
        // Discard any old dummy events from initial draft templates (except morning breakfast)
        const realEvents = existingDay.events.filter(ev => !String(ev.id).startsWith('ev_d1_') && !String(ev.id).startsWith('ev_d2_'));
        dayEvents = JSON.parse(JSON.stringify(realEvents));
      }

      if (dayEvents.length === 0) {
        dayEvents = [createDefaultBreakfastEvent(comp.dayNumber)];
      }

      return {
        dayNumber: comp.dayNumber,
        dayLabel: comp.dayLabel,
        dateStr: comp.dateStr,
        dateFormatted: comp.dateFormatted,
        shortDate: comp.shortDate,
        fullDateFormatted: comp.fullDateFormatted,
        events: dayEvents
      };
    });

    // If an additional day (+1) was previously saved, preserve only up to 1 additional day
    const extraDayNum = baseDayCount + 1;
    const existingExtraDay = previousItinerary.find(d => d.dayNumber === extraDayNum);
    if (existingExtraDay) {
      const realEvents = (existingExtraDay.events || []).filter(ev => !String(ev.id).startsWith('ev_d1_') && !String(ev.id).startsWith('ev_d2_'));
      const extraEvents = realEvents.length > 0 ? JSON.parse(JSON.stringify(realEvents)) : [createDefaultBreakfastEvent(extraDayNum)];
      itineraryData.push({
        dayNumber: extraDayNum,
        dayLabel: existingExtraDay.dayLabel || `Day ${extraDayNum}`,
        dateStr: existingExtraDay.dateStr || '',
        dateFormatted: existingExtraDay.dateFormatted || '',
        shortDate: existingExtraDay.shortDate || '',
        fullDateFormatted: existingExtraDay.fullDateFormatted || '',
        events: extraEvents
      });
    }
  } else if (previousItinerary.length > 0) {
    baseDayCount = Math.max(1, previousItinerary.length > 2 ? previousItinerary.length - 1 : previousItinerary.length);
    itineraryData = previousItinerary.slice(0, baseDayCount + 1).map(d => {
      const realEvents = (d.events || []).filter(ev => !String(ev.id).startsWith('ev_d1_') && !String(ev.id).startsWith('ev_d2_'));
      return {
        ...d,
        events: realEvents.length > 0 ? realEvents : [createDefaultBreakfastEvent(d.dayNumber)]
      };
    });
  } else {
    // Default fallback to 2 days with morning breakfast schedule
    baseDayCount = 2;
    itineraryData = [
      {
        dayNumber: 1,
        dayLabel: 'Day 1',
        dateStr: '',
        dateFormatted: '',
        shortDate: '',
        fullDateFormatted: '',
        events: [createDefaultBreakfastEvent(1)]
      },
      {
        dayNumber: 2,
        dayLabel: 'Day 2',
        dateStr: '',
        dateFormatted: '',
        shortDate: '',
        fullDateFormatted: '',
        events: [createDefaultBreakfastEvent(2)]
      }
    ];
  }

  // Ensure all days have at least the dummy Morning Breakfast schedule if empty
  itineraryData.forEach(d => {
    if (!Array.isArray(d.events) || d.events.length === 0) {
      d.events = [createDefaultBreakfastEvent(d.dayNumber)];
    }
  });

  activeDayNumber = 1;
  editingEventId = null;

  renderDayTabs();
  renderTimeline();
  setupEventListeners();
}

/**
 * Cleanup Step 7
 */
export function cleanupStep7() {
  closeModal();
}

/**
 * Get Step 7 Data
 */
export function getStep7Data() {
  const formatted = itineraryData.map(d => ({
    ...d,
    day: d.dayLabel || `Day ${d.dayNumber}`,
    dayLabel: d.dayLabel || `Day ${d.dayNumber}`,
    events: (d.events || []).map(ev => ({
      ...ev,
      time: ev.time || [ev.startTime, ev.endTime].filter(Boolean).join(' – ') || 'TBA',
      desc: ev.desc || ev.description || ''
    }))
  }));
  return {
    itinerary: formatted
  };
}

/**
 * Validate Step 7
 */
export function validateStep7(showErrors = false) {
  if (!Array.isArray(itineraryData) || itineraryData.length === 0) {
    if (showErrors) {
      window.dispatchEvent(new CustomEvent('wizard:toast', {
        detail: { message: 'Please configure at least one conference day in the schedule.', type: 'error' }
      }));
    }
    return false;
  }

  for (let i = 0; i < itineraryData.length; i++) {
    const day = itineraryData[i];
    const events = day.events || [];
    if (events.length === 0) {
      if (showErrors) {
        activeDayNumber = day.dayNumber;
        renderTimeline();
        window.dispatchEvent(new CustomEvent('wizard:toast', {
          detail: { message: `Please add at least one scheduled event for ${day.dayLabel || 'Day ' + day.dayNumber}.`, type: 'error' }
        }));
      }
      return false;
    }

    for (let j = 0; j < events.length; j++) {
      const ev = events[j];
      if (!ev.title || !String(ev.title).trim()) {
        if (showErrors) {
          activeDayNumber = day.dayNumber;
          renderTimeline();
          window.dispatchEvent(new CustomEvent('wizard:toast', {
            detail: { message: `Please provide a title for all events in ${day.dayLabel || 'Day ' + day.dayNumber}.`, type: 'error' }
          }));
        }
        return false;
      }
    }
  }

  return true;
}

/**
 * Build Day Header HTML with Date and Chevrons at Right End Corner
 */
function buildDayHeaderHtml(currentDay) {
  const isFirstDay = activeDayNumber <= 1;
  const canAddExtra = itineraryData.length < (baseDayCount + 1);
  const isLastDay = activeDayNumber === itineraryData.length;
  const canGoNext = !isLastDay || canAddExtra;

  const nextBtnTitle = (isLastDay && canAddExtra)
    ? 'Add 1 Additional Day'
    : (isLastDay ? 'Last Day' : 'Next Day');

  return `
    <div class="cc-itin-day-header">
      <div class="cc-itin-day-info">
        <h3 class="cc-itin-current-day-title">${escapeHtml(currentDay.dayLabel || `Day ${currentDay.dayNumber}`)}</h3>
        ${currentDay.fullDateFormatted ? `<span class="cc-itin-current-day-date">${escapeHtml(currentDay.fullDateFormatted)}</span>` : ''}
      </div>

      <!-- Left & Right Chevrons at Right End Corner -->
      <div class="cc-itin-day-nav">
        <button type="button" class="cc-itin-chevron-btn prev" id="btnItinPrevDay" title="Previous Day" ${isFirstDay ? 'disabled' : ''}>
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <button type="button" class="cc-itin-chevron-btn next" id="btnItinNextDay" title="${escapeHtml(nextBtnTitle)}" ${!canGoNext ? 'disabled' : ''}>
          <ion-icon name="chevron-forward-outline"></ion-icon>
        </button>
      </div>
    </div>
  `;
}

/**
 * Attach Day Header Navigation Listeners
 */
function attachDayHeaderListeners() {
  document.getElementById('btnItinPrevDay')?.addEventListener('click', () => {
    if (activeDayNumber > 1) {
      activeDayNumber--;
      renderTimeline();
    }
  });

  document.getElementById('btnItinNextDay')?.addEventListener('click', () => {
    if (activeDayNumber < itineraryData.length) {
      activeDayNumber++;
      renderTimeline();
    } else if (itineraryData.length < (baseDayCount + 1)) {
      addNewAdditionalDay();
    }
  });
}

/**
 * Add 1 Additional Day Beyond Base Dates
 */
function addNewAdditionalDay() {
  if (itineraryData.length >= (baseDayCount + 1)) return;

  const nextNum = itineraryData.length + 1;
  let nextDateStr = '';
  let nextDateFormatted = '';
  let nextFullDate = '';

  const lastDay = itineraryData[itineraryData.length - 1];
  if (lastDay && lastDay.dateStr) {
    const d = parseLocalDate(lastDay.dateStr);
    if (d) {
      d.setDate(d.getDate() + 1);
      const df = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const wk = d.toLocaleDateString('en-US', { weekday: 'short' });
      nextDateFormatted = `${wk}, ${df}`;
      nextFullDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      nextDateStr = d.toISOString().split('T')[0];
    }
  }

  itineraryData.push({
    dayNumber: nextNum,
    dayLabel: `Day ${nextNum}`,
    dateStr: nextDateStr,
    dateFormatted: nextDateFormatted,
    shortDate: nextDateFormatted ? nextDateFormatted.split(',')[1]?.trim() : '',
    fullDateFormatted: nextFullDate,
    events: [createDefaultBreakfastEvent(nextNum)]
  });

  activeDayNumber = nextNum;
  renderTimeline();
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Delete the 1 Additional Day
 */
function deleteAdditionalDay() {
  if (itineraryData.length <= baseDayCount) return;
  const extraDayNum = itineraryData.length;
  if (confirm(`Remove the additional day (Day ${extraDayNum}) and all its scheduled events?`)) {
    itineraryData = itineraryData.filter(d => d.dayNumber !== extraDayNum);
    if (activeDayNumber >= extraDayNum) {
      activeDayNumber = baseDayCount;
    }
    renderTimeline();
    window.dispatchEvent(new CustomEvent('wizard:dirty'));
  }
}

/**
 * Render Day Tabs Navigation (Kept for compatibility)
 */
function renderDayTabs() {
  // Navigation is handled cleanly inline within the Day Header
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 9999;
  const m = String(timeStr).trim().match(/^0?([1-9]|1[0-2]):?([0-5][0-9])?\s*(AM|PM)?$/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10) % 12;
  if (m[3]?.toUpperCase() === 'PM') h += 12;
  return h * 60 + (m[2] ? parseInt(m[2], 10) : 0);
}

/**
 * Render Timeline for Active Day
 */
function renderTimeline() {
  const workspace = document.getElementById('itinWorkspace');
  if (!workspace) return;

  if (activeDayNumber > itineraryData.length) {
    activeDayNumber = Math.max(1, itineraryData.length);
  }

  const currentDay = itineraryData.find(d => d.dayNumber === activeDayNumber) || itineraryData[0];
  if (!currentDay) {
    workspace.innerHTML = '<div class="cc-itin-empty"><p>No day selected.</p></div>';
    return;
  }

  // Sort events chronologically by start time
  const events = (currentDay.events || []).slice().sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
  const dayHeaderHtml = buildDayHeaderHtml(currentDay);

  // Render vertical timeline
  let itemsHtml = events.map((ev, index) => {
    const meta = PERIOD_META[ev.period] || PERIOD_META.morning;
    const timeFormatted = formatDisplayTime(ev.startTime, ev.endTime, ev.time);

    return `
      <div class="cc-itin-item" data-period="${escapeHtml(ev.period)}" data-id="${escapeHtml(ev.id)}">
        <!-- Circular Node on Left Line -->
        <div class="cc-itin-node" title="${meta.label}">
          <ion-icon name="${meta.icon}"></ion-icon>
        </div>

        <!-- Event Card -->
        <div class="cc-itin-card">
          <!-- Top Row: Time & Venue on Left, Actions on Right -->
          <div class="cc-itin-card-top">
            <div class="cc-itin-card-meta-left">
              ${timeFormatted ? `
                <div class="cc-itin-time-text">
                  <span>${escapeHtml(timeFormatted)}</span>
                </div>
              ` : ''}

              <!-- Venue with 📍 Pin -->
              ${ev.location ? `
                <div class="cc-itin-venue">
                  <span class="cc-itin-pin-emoji">📍</span>
                  <span>${escapeHtml(ev.location)}</span>
                </div>
              ` : ''}
            </div>

            <!-- Actions -->
            <div class="cc-itin-card-actions">
              <button type="button" class="cc-itin-btn-action edit" data-id="${escapeHtml(ev.id)}" title="Edit Event">
                <ion-icon name="pencil-outline"></ion-icon>
              </button>
              <button type="button" class="cc-itin-btn-action delete" data-id="${escapeHtml(ev.id)}" title="Delete Event">
                <ion-icon name="trash-outline"></ion-icon>
              </button>
            </div>
          </div>

          <!-- Event Title -->
          <h3 class="cc-itin-title">${escapeHtml(ev.title)}</h3>

          <!-- Description -->
          ${ev.description ? `
            <p class="cc-itin-desc">${escapeHtml(ev.description)}</p>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  workspace.innerHTML = `
    ${dayHeaderHtml}
    <div class="cc-itin-timeline-wrap">
      ${itemsHtml}

      <!-- Inline circular "+" node on the timeline line -->
      <div class="cc-itin-inline-add">
        <button type="button" class="cc-itin-inline-node" id="btnItinInlineAdd" title="Add Event">
          <ion-icon name="add-outline"></ion-icon>
        </button>
      </div>
    </div>
  `;

  attachDayHeaderListeners();

  // Attach card edit and delete handlers
  workspace.querySelectorAll('.cc-itin-btn-action.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      openModal(activeDayNumber, btn.dataset.id);
    });
  });

  workspace.querySelectorAll('.cc-itin-btn-action.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteEvent(btn.dataset.id);
    });
  });

  document.getElementById('btnItinInlineAdd')?.addEventListener('click', () => openModal(activeDayNumber));
}

/**
 * Setup Global Event Listeners for Step 7
 */
function setupEventListeners() {
  // Modal Close & Cancel
  document.getElementById('btnItinModalClose')?.addEventListener('click', closeModal);
  document.getElementById('btnItinModalCancel')?.addEventListener('click', closeModal);
  document.getElementById('itinModalOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'itinModalOverlay') closeModal();
  });

  // Escape key closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('itinModalOverlay');
      if (overlay && (overlay.classList.contains('open') || overlay.style.display === 'flex')) {
        closeModal();
      }
    }
  });

  // Conference Day Custom Dropdown Toggle
  const dayTrigger = document.getElementById('itinDayTrigger');
  const dayWrap = document.getElementById('itinDayDropdownWrap');

  dayTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dayWrap?.classList.contains('is-open');
    if (isOpen) {
      closeDayDropdown();
    } else {
      openDayDropdown();
    }
  });

  // Close Day Dropdown on click outside
  document.addEventListener('click', (e) => {
    if (dayWrap && !dayWrap.contains(e.target)) {
      closeDayDropdown();
    }
  });

  // Period Selector Buttons
  document.querySelectorAll('.cc-itin-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cc-itin-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const periodInput = document.getElementById('itinEventPeriod');
      if (periodInput) periodInput.value = btn.dataset.period;
    });
  });

  // Real-time error clearance on input
  ['itinEventTitle', 'itinEventLocation', 'itinEventDescription'].forEach(id => {
    const input = document.getElementById(id);
    input?.addEventListener('input', () => {
      if (input.value.trim()) {
        input.closest('.cc-field')?.classList.remove('has-error');
      }
    });
  });

  // Modal Form Submit
  const form = document.getElementById('itinEventForm');
  form?.addEventListener('submit', handleEventFormSubmit);

  // Initialize Rotating Clock & Wheel TimePicker
  initTimePicker();
}

/**
 * Inline Circular Ring TimePicker Controller (TimePicker03)
 * Exact geometry, 240x240 circular SVG ring with rotating knob, radial labels & center readout
 */
const CENTER = 120;
const RADIUS = 100;
const TRACK = 8;
const LABEL_RADIUS = 74;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // 628.3185307179587

const pad = (value) => String(value).padStart(2, '0');

const pointAt = (fraction, radius) => {
  const angle = fraction * 2 * Math.PI;
  return {
    x: CENTER + radius * Math.sin(angle),
    y: CENTER - radius * Math.cos(angle)
  };
};

let startTimePicker = null;
let endTimePicker = null;

function createInlineRingPicker(cfg) {
  let mode = 'hour'; // 'hour' | 'minute'
  let hour = cfg.defaultHour || 7;
  let minute = cfg.defaultMinute || 0;
  let period = cfg.defaultPeriod || 'AM';
  let initialTime = `${pad(hour)}:${pad(minute)} ${period}`;
  let dragging = false;

  const ringWrap = document.getElementById(cfg.ringWrapId);
  const progressCircle = document.getElementById(cfg.progressId);
  const labelsGroup = document.getElementById(cfg.labelsId);
  const knobLayer = document.getElementById(cfg.knobLayerId);
  const knob = document.getElementById(cfg.knobId);
  const btnHour = document.getElementById(cfg.btnHourId);
  const btnMinute = document.getElementById(cfg.btnMinuteId);
  const btnAM = document.getElementById(cfg.btnAMId);
  const btnPM = document.getElementById(cfg.btnPMId);
  const hint = document.getElementById(cfg.hintId);
  const badge = document.getElementById(cfg.badgeId);
  const btnCancel = document.getElementById(cfg.btnCancelId);
  const btnSet = document.getElementById(cfg.btnSetId);
  const hiddenInput = document.getElementById(cfg.inputId);

  function updateUI() {
    const fraction = mode === 'hour' ? hour / 12 : minute / 60;

    if (progressCircle) {
      progressCircle.style.strokeDashoffset = (CIRCUMFERENCE * (1 - fraction)).toFixed(3);
    }

    if (knobLayer) {
      knobLayer.style.transform = `rotate(${fraction * 360}deg)`;
    }

    if (knob) {
      knob.setAttribute('aria-label', mode === 'hour' ? 'Hour' : 'Minute');
      knob.setAttribute('aria-valuemin', mode === 'hour' ? '1' : '0');
      knob.setAttribute('aria-valuemax', mode === 'hour' ? '12' : '59');
      knob.setAttribute('aria-valuenow', String(mode === 'hour' ? hour : minute));
      knob.setAttribute('aria-valuetext', `${pad(hour)}:${pad(minute)} ${period}`);
    }

    if (labelsGroup) {
      let labelsHtml = '';
      for (let index = 0; index < 12; index++) {
        const val = mode === 'hour' ? (index === 0 ? 12 : index) : index * 5;
        const isActive = mode === 'hour' ? val === hour : val === minute;
        const text = mode === 'hour' ? String(val) : pad(val);
        const pt = pointAt(index / 12, LABEL_RADIUS);
        labelsHtml += `<text x="${pt.x.toFixed(2)}" y="${pt.y.toFixed(2)}" text-anchor="middle" dominant-baseline="central" class="cc-rtp-label ${isActive ? 'active' : ''}">${text}</text>`;
      }
      labelsGroup.innerHTML = labelsHtml;
    }

    if (btnHour) {
      btnHour.textContent = pad(hour);
      btnHour.classList.toggle('active', mode === 'hour');
    }
    if (btnMinute) {
      btnMinute.textContent = pad(minute);
      btnMinute.classList.toggle('active', mode === 'minute');
    }

    if (btnAM) btnAM.classList.toggle('active', period === 'AM');
    if (btnPM) btnPM.classList.toggle('active', period === 'PM');

    if (hint) {
      hint.textContent = mode === 'hour' ? 'Drag the ring to pick the hour' : 'Now drag to pick the minutes';
    }

    const formatted = `${pad(hour)}:${pad(minute)} ${period}`;
    if (badge) badge.textContent = formatted;
    if (btnSet) btnSet.textContent = `Set ${formatted}`;

    if (hiddenInput) {
      hiddenInput.value = formatted;
      hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (typeof cfg.onChange === 'function') {
      cfg.onChange(formatted, hour, minute, period);
    }
  }

  function setFromSteps(steps) {
    let nextHour = hour;
    let nextMinute = minute;
    if (mode === 'hour') {
      const next = ((steps % 12) + 12) % 12;
      nextHour = next === 0 ? 12 : next;
    } else {
      nextMinute = ((steps % 60) + 60) % 60;
    }

    if (typeof cfg.beforeChange === 'function') {
      const validated = cfg.beforeChange(nextHour, nextMinute, period);
      if (validated === false) return;
      if (typeof validated === 'object' && validated !== null) {
        hour = validated.hour;
        minute = validated.minute;
        period = validated.period;
        updateUI();
        return;
      }
    }

    hour = nextHour;
    minute = nextMinute;
    updateUI();
  }

  function updateFromPointer(event) {
    if (!ringWrap) return;
    const rect = ringWrap.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return;

    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const degrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    setFromSteps(Math.round(degrees / (mode === 'hour' ? 30 : 6)));
  }

  function handlePointerDown(event) {
    const center = document.getElementById(cfg.centerId);
    if (center && center.contains(event.target)) return;

    dragging = true;
    if (ringWrap) {
      ringWrap.classList.add('dragging');
      if (ringWrap.setPointerCapture && event.pointerId !== undefined) {
        ringWrap.setPointerCapture(event.pointerId);
      }
    }
    updateFromPointer(event);
  }

  function handlePointerMove(event) {
    if (dragging) updateFromPointer(event);
  }

  function handlePointerUp(event) {
    if (!dragging) return;
    dragging = false;
    if (ringWrap) {
      ringWrap.classList.remove('dragging');
      if (ringWrap.releasePointerCapture && event.pointerId !== undefined && ringWrap.hasPointerCapture && ringWrap.hasPointerCapture(event.pointerId)) {
        ringWrap.releasePointerCapture(event.pointerId);
      }
    }
    if (mode === 'hour') {
      mode = 'minute';
      updateUI();
    }
  }

  function handleKnobKeyDown(event) {
    const current = mode === 'hour' ? hour : minute;
    const steps = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    setFromSteps(current + steps[event.key]);
  }

  function setTime(timeStr) {
    if (timeStr) {
      const m = String(timeStr).trim().match(/^0?([1-9]|1[0-2]):?([0-5][0-9])?\s*(AM|PM)?$/i);
      if (m) {
        let nextHour = parseInt(m[1], 10);
        let nextMinute = m[2] ? parseInt(m[2], 10) : 0;
        let nextPeriod = m[3] ? m[3].toUpperCase() : 'AM';

        if (typeof cfg.beforeChange === 'function') {
          const validated = cfg.beforeChange(nextHour, nextMinute, nextPeriod);
          if (typeof validated === 'object' && validated !== null) {
            nextHour = validated.hour;
            nextMinute = validated.minute;
            nextPeriod = validated.period;
          }
        }

        hour = nextHour;
        minute = nextMinute;
        period = nextPeriod;
      }
    } else {
      hour = cfg.defaultHour || 7;
      minute = cfg.defaultMinute || 0;
      period = cfg.defaultPeriod || 'AM';
    }
    mode = 'hour';
    initialTime = `${pad(hour)}:${pad(minute)} ${period}`;
    updateUI();
  }

  function reset() {
    setTime(initialTime);
  }

  // Bind Events
  if (ringWrap) {
    ringWrap.addEventListener('pointerdown', handlePointerDown);
    ringWrap.addEventListener('pointermove', handlePointerMove);
    ringWrap.addEventListener('pointerup', handlePointerUp);
    ringWrap.addEventListener('pointercancel', handlePointerUp);
  }

  if (knob) {
    knob.addEventListener('keydown', handleKnobKeyDown);
  }

  btnHour?.addEventListener('click', (e) => {
    e.stopPropagation();
    mode = 'hour';
    updateUI();
  });

  btnMinute?.addEventListener('click', (e) => {
    e.stopPropagation();
    mode = 'minute';
    updateUI();
  });

  btnAM?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof cfg.beforeChange === 'function') {
      const validated = cfg.beforeChange(hour, minute, 'AM');
      if (validated === false) return;
      if (typeof validated === 'object' && validated !== null) {
        hour = validated.hour;
        minute = validated.minute;
        period = validated.period;
        updateUI();
        return;
      }
    }
    period = 'AM';
    updateUI();
  });

  btnPM?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof cfg.beforeChange === 'function') {
      const validated = cfg.beforeChange(hour, minute, 'PM');
      if (validated === false) return;
      if (typeof validated === 'object' && validated !== null) {
        hour = validated.hour;
        minute = validated.minute;
        period = validated.period;
        updateUI();
        return;
      }
    }
    period = 'PM';
    updateUI();
  });

  btnCancel?.addEventListener('click', (e) => {
    e.stopPropagation();
    reset();
  });

  btnSet?.addEventListener('click', (e) => {
    e.stopPropagation();
    updateUI();
  });

  // Initial draw
  updateUI();

  return {
    setTime,
    reset,
    getTime: () => `${pad(hour)}:${pad(minute)} ${period}`
  };
}

/**
 * Determine Time Slot (Morning, Afternoon, Evening, Night) from hour and AM/PM
 */
function getSlotFromTime(hour12, ampm) {
  let h = hour12 % 12;
  if (ampm === 'PM') h += 12;
  // 24-hour scale:
  // 05:00 - 11:59 -> Morning
  // 12:00 - 16:59 -> Afternoon
  // 17:00 - 20:59 -> Evening
  // 21:00 - 04:59 -> Night
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function syncSlotFromStartTime(hour12, ampm) {
  const slot = getSlotFromTime(hour12, ampm);
  const periodInput = document.getElementById('itinEventPeriod');
  if (periodInput) periodInput.value = slot;

  document.querySelectorAll('.cc-itin-period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === slot);
  });
}

function timeToTotalMinutes(h, m, p) {
  let h24 = (h % 12) + (p === 'PM' ? 12 : 0);
  return h24 * 60 + m;
}

function getStartTimeComponents() {
  const startInput = document.getElementById('itinEventStartTime');
  const val = (startTimePicker ? startTimePicker.getTime() : startInput?.value) || '07:00 AM';
  const match = String(val).trim().match(/^0?([1-9]|1[0-2]):?([0-5][0-9])?\s*(AM|PM)?$/i);
  if (!match) return { hour: 7, minute: 0, period: 'AM', totalMins: 420 };
  const h = parseInt(match[1], 10);
  const min = match[2] ? parseInt(match[2], 10) : 0;
  const p = match[3] ? match[3].toUpperCase() : 'AM';
  return { hour: h, minute: min, period: p, totalMins: timeToTotalMinutes(h, min, p) };
}

function initTimePicker() {
  startTimePicker = createInlineRingPicker({
    type: 'start',
    inputId: 'itinEventStartTime',
    defaultHour: 7,
    defaultMinute: 0,
    defaultPeriod: 'AM',
    ringWrapId: 'rtpRingWrapStart',
    progressId: 'rtpProgressStart',
    labelsId: 'rtpLabelsStart',
    knobLayerId: 'rtpKnobLayerStart',
    knobId: 'rtpKnobStart',
    centerId: 'rtpCenterStart',
    btnHourId: 'rtpBtnHourStart',
    btnMinuteId: 'rtpBtnMinuteStart',
    btnAMId: 'rtpBtnAMStart',
    btnPMId: 'rtpBtnPMStart',
    hintId: 'rtpHintStart',
    badgeId: 'rtpBadgeStart',
    btnCancelId: 'rtpBtnCancelStart',
    btnSetId: 'rtpBtnSetStart',
    onChange: (formatted, h, m, p) => {
      syncSlotFromStartTime(h, p);
      if (endTimePicker) {
        const startMins = timeToTotalMinutes(h, m, p);
        const endStr = endTimePicker.getTime();
        const em = String(endStr).trim().match(/^0?([1-9]|1[0-2]):?([0-5][0-9])?\s*(AM|PM)?$/i);
        if (em) {
          const eh = parseInt(em[1], 10);
          const emin = em[2] ? parseInt(em[2], 10) : 0;
          const ep = em[3] ? em[3].toUpperCase() : 'AM';
          const endMins = timeToTotalMinutes(eh, emin, ep);
          if (endMins < startMins) {
            endTimePicker.setTime(formatted);
          }
        }
      }
    }
  });

  endTimePicker = createInlineRingPicker({
    type: 'end',
    inputId: 'itinEventEndTime',
    defaultHour: 7,
    defaultMinute: 0,
    defaultPeriod: 'AM',
    ringWrapId: 'rtpRingWrapEnd',
    progressId: 'rtpProgressEnd',
    labelsId: 'rtpLabelsEnd',
    knobLayerId: 'rtpKnobLayerEnd',
    knobId: 'rtpKnobEnd',
    centerId: 'rtpCenterEnd',
    btnHourId: 'rtpBtnHourEnd',
    btnMinuteId: 'rtpBtnMinuteEnd',
    btnAMId: 'rtpBtnAMEnd',
    btnPMId: 'rtpBtnPMEnd',
    hintId: 'rtpHintEnd',
    badgeId: 'rtpBadgeEnd',
    btnCancelId: 'rtpBtnCancelEnd',
    btnSetId: 'rtpBtnSetEnd',
    beforeChange: (candHour, candMinute, candPeriod) => {
      const start = getStartTimeComponents();
      const candMins = timeToTotalMinutes(candHour, candMinute, candPeriod);
      if (candMins < start.totalMins) {
        return {
          hour: start.hour,
          minute: start.minute,
          period: start.period
        };
      }
      return true;
    }
  });
}

function closeTimePicker() {
  // No-op for inline pickers
}

function openDayDropdown() {
  const dayWrap = document.getElementById('itinDayDropdownWrap');
  const dayTrigger = document.getElementById('itinDayTrigger');
  dayWrap?.classList.add('is-open');
  dayTrigger?.setAttribute('aria-expanded', 'true');
}

function closeDayDropdown() {
  const dayWrap = document.getElementById('itinDayDropdownWrap');
  const dayTrigger = document.getElementById('itinDayTrigger');
  dayWrap?.classList.remove('is-open');
  dayTrigger?.setAttribute('aria-expanded', 'false');
}

function populateDayDropdown(selectedDayNumber) {
  const daySelect = document.getElementById('itinEventDaySelect');
  if (daySelect) daySelect.value = String(selectedDayNumber);

  const dayTriggerLabel = document.getElementById('itinDayTriggerLabel');
  const dayPopover = document.getElementById('itinDayPopover');
  if (!dayPopover) return;

  let activeLabel = `Day ${selectedDayNumber}`;

  dayPopover.innerHTML = itineraryData.map(d => {
    const isSelected = Number(d.dayNumber) === Number(selectedDayNumber);
    const dayLabel = d.dayLabel || `Day ${d.dayNumber}`;
    const dateText = d.dateFormatted || d.shortDate || '';
    const fullLabel = dateText ? `${dayLabel} (${dateText})` : dayLabel;
    if (isSelected) activeLabel = fullLabel;

    return `
      <div class="cc-itin-day-item ${isSelected ? 'is-selected' : ''}" data-day="${d.dayNumber}" data-label="${escapeHtml(fullLabel)}" role="option" tabindex="0">
        <div class="cc-itin-day-item-left">
          <div class="cc-itin-day-item-icon">
            <ion-icon name="calendar-outline"></ion-icon>
          </div>
          <div class="cc-itin-day-item-text">
            <span class="cc-itin-day-item-name">${escapeHtml(dayLabel)}</span>
            ${dateText ? `<span class="cc-itin-day-item-date">${escapeHtml(dateText)}</span>` : ''}
          </div>
        </div>
        <svg class="cc-itin-day-check ${isSelected ? '' : 'is-hidden'}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
    `;
  }).join('');

  if (daySelect) daySelect.value = String(selectedDayNumber);
  if (dayTriggerLabel) dayTriggerLabel.textContent = activeLabel;

  // Add click & keyboard handlers to items
  dayPopover.querySelectorAll('.cc-itin-day-item').forEach(item => {
    const selectItem = () => {
      const dayVal = item.dataset.day;
      const labelVal = item.dataset.label;
      if (daySelect) daySelect.value = dayVal;
      if (dayTriggerLabel) dayTriggerLabel.textContent = labelVal;

      dayPopover.querySelectorAll('.cc-itin-day-item').forEach(i => {
        const match = i.dataset.day === dayVal;
        i.classList.toggle('is-selected', match);
        const check = i.querySelector('.cc-itin-day-check');
        if (check) check.classList.toggle('is-hidden', !match);
      });
      closeDayDropdown();
    };

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      selectItem();
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectItem();
      }
    });
  });
}

/**
 * Open Add/Edit Modal
 */
function openModal(dayNumber = 1, eventId = null) {
  const overlay = document.getElementById('itinModalOverlay');
  const modalTitle = document.getElementById('itinModalTitle');
  const daySelect = document.getElementById('itinEventDaySelect');
  const titleInput = document.getElementById('itinEventTitle');
  const startInput = document.getElementById('itinEventStartTime');
  const endInput = document.getElementById('itinEventEndTime');
  const locInput = document.getElementById('itinEventLocation');
  const descInput = document.getElementById('itinEventDescription');
  const periodInput = document.getElementById('itinEventPeriod');

  if (!overlay) return;

  // Clear any existing error highlights
  document.querySelectorAll('#itinEventForm .cc-field').forEach(f => f.classList.remove('has-error'));

  // Teleport to document.body so it is never clipped or trapped by transformed parent containers
  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }

  editingEventId = eventId;

  // Populate custom Shadcn day options
  populateDayDropdown(dayNumber);

  const saveBtn = document.getElementById('btnItinModalSave');

  if (eventId) {
    // Edit existing
    modalTitle.textContent = 'Edit Itinerary Event';
    if (saveBtn) {
      saveBtn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon>';
      saveBtn.title = 'Save Changes';
      saveBtn.setAttribute('aria-label', 'Save Changes');
    }
    let targetEvent = null;
    let foundDay = dayNumber;

    for (const d of itineraryData) {
      const ev = (d.events || []).find(e => e.id === eventId);
      if (ev) {
        targetEvent = ev;
        foundDay = d.dayNumber;
        break;
      }
    }

    if (targetEvent) {
      populateDayDropdown(foundDay);
      if (titleInput) titleInput.value = targetEvent.title || '';
      if (startInput) startInput.value = targetEvent.startTime || '07:00 AM';
      if (endInput) endInput.value = targetEvent.endTime || '07:00 AM';
      if (locInput) locInput.value = targetEvent.location || '';
      if (descInput) descInput.value = targetEvent.description || '';
      if (periodInput) periodInput.value = targetEvent.period || 'morning';

      if (startTimePicker) startTimePicker.setTime(targetEvent.startTime || '07:00 AM');
      if (endTimePicker) endTimePicker.setTime(targetEvent.endTime || '07:00 AM');

      if (targetEvent.period) {
        if (periodInput) periodInput.value = targetEvent.period;
        document.querySelectorAll('.cc-itin-period-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.period === targetEvent.period);
        });
      } else {
        const sm = String(targetEvent.startTime || '07:00 AM').trim().match(/^0?([1-9]|1[0-2]):?([0-5][0-9])?\s*(AM|PM)?$/i);
        const sh = sm ? parseInt(sm[1], 10) : 7;
        const sp = sm && sm[3] ? sm[3].toUpperCase() : 'AM';
        syncSlotFromStartTime(sh, sp);
      }
    }
  } else {
    // Add new
    modalTitle.textContent = 'Add Itinerary Event';
    if (saveBtn) {
      saveBtn.innerHTML = '<ion-icon name="add-outline"></ion-icon>';
      saveBtn.title = 'Add Event';
      saveBtn.setAttribute('aria-label', 'Add Event');
    }
    populateDayDropdown(dayNumber);
    if (titleInput) titleInput.value = '';
    if (startInput) startInput.value = '07:00 AM';
    if (endInput) endInput.value = '07:00 AM';
    if (locInput) locInput.value = '';
    if (descInput) descInput.value = '';
    if (periodInput) periodInput.value = 'morning';

    if (startTimePicker) startTimePicker.setTime('07:00 AM');
    if (endTimePicker) endTimePicker.setTime('07:00 AM');
    syncSlotFromStartTime(7, 'AM');
  }

  overlay.classList.add('open');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(() => titleInput?.focus(), 80);
}

/**
 * Close Modal
 */
function closeModal() {
  closeDayDropdown();
  closeTimePicker();
  const overlay = document.getElementById('itinModalOverlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.style.display = 'none';
  }
  document.body.style.overflow = '';
  editingEventId = null;
}

/**
 * Handle Event Form Submit
 */
function handleEventFormSubmit(e) {
  e?.preventDefault();

  const daySelect = document.getElementById('itinEventDaySelect');
  const titleInput = document.getElementById('itinEventTitle');
  const startInput = document.getElementById('itinEventStartTime');
  const endInput = document.getElementById('itinEventEndTime');
  const locInput = document.getElementById('itinEventLocation');
  const descInput = document.getElementById('itinEventDescription');
  const periodInput = document.getElementById('itinEventPeriod');

  const title = (titleInput?.value || '').trim();
  const location = (locInput?.value || '').trim();
  const desc = (descInput?.value || '').trim();

  // Clear previous error states
  [titleInput, locInput, descInput].forEach(inp => {
    inp?.closest('.cc-field')?.classList.remove('has-error');
  });

  let hasError = false;
  let firstErrorInput = null;

  if (!title) {
    titleInput?.closest('.cc-field')?.classList.add('has-error');
    hasError = true;
    if (!firstErrorInput) firstErrorInput = titleInput;
  }
  if (!location) {
    locInput?.closest('.cc-field')?.classList.add('has-error');
    hasError = true;
    if (!firstErrorInput) firstErrorInput = locInput;
  }
  if (!desc) {
    descInput?.closest('.cc-field')?.classList.add('has-error');
    hasError = true;
    if (!firstErrorInput) firstErrorInput = descInput;
  }

  if (hasError) {
    firstErrorInput?.focus();
    return;
  }

  const dayNum = parseInt(daySelect?.value || activeDayNumber, 10);
  const targetDay = itineraryData.find(d => d.dayNumber === dayNum);
  if (!targetDay) return;
  if (!targetDay.events) targetDay.events = [];

  const startTime = (startInput?.value || '').trim();
  const endTime = (endInput?.value || '').trim();
  const timeFormatted = [startTime, endTime].filter(Boolean).join(' – ') || 'TBA';

  const eventPayload = {
    id: editingEventId || `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    period: periodInput?.value || 'morning',
    title: title,
    startTime: startTime,
    endTime: endTime,
    time: timeFormatted,
    location: location,
    description: desc,
    desc: desc
  };

  if (editingEventId) {
    // Remove old event from wherever it was
    itineraryData.forEach(d => {
      d.events = (d.events || []).filter(ev => ev.id !== editingEventId);
    });
    // Add updated to target day
    targetDay.events.push(eventPayload);
  } else {
    // Add new event
    targetDay.events.push(eventPayload);
  }

  activeDayNumber = dayNum;
  closeModal();
  renderDayTabs();
  renderTimeline();
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Delete an Event
 */
function deleteEvent(eventId) {
  if (!eventId) return;
  itineraryData.forEach(d => {
    d.events = (d.events || []).filter(ev => ev.id !== eventId);
  });
  renderDayTabs();
  renderTimeline();
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}
