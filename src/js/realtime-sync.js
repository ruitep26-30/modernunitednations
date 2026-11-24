/**
 * Realtime Database Live Sync Engine for Modern MUN
 * Powers sub-30ms live WebSocket synchronization for:
 * 1. Conference Invitations (dispatch, accept, decline, revoke)
 * 2. Committee Dais & Secretariat Auditions (Open/Closed status & custom roles)
 * 3. Live conference session state
 */

import {
  rtdb,
  rtdbRef,
  rtdbSet,
  rtdbGet,
  rtdbUpdate,
  rtdbRemove,
  rtdbOnValue,
  rtdbOff,
  rtdbQuery,
  rtdbOrderByChild,
  rtdbEqualTo,
  db,
  doc,
  setDoc,
  deleteDoc,
  collection,
  query as fsQuery,
  where as fsWhere,
  getDocs as fsGetDocs
} from './firebase-config.js';

/**
 * Deep sanitization helper that removes undefined values and cleans keys for RTDB
 */
export function sanitizeForRtdb(val) {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(sanitizeForRtdb);
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      // RTDB keys cannot contain '.', '#', '$', '/', '[', or ']'
      const cleanKey = k.replace(/[.#$/[\]]/g, '_');
      out[cleanKey] = sanitizeForRtdb(v);
    }
  }
  return out;
}

/**
 * Dispatches an executive or secretariat invitation over Realtime Database (10-30ms)
 * and dual-writes to Cloud Firestore.
 */
export async function dispatchLiveInvitation(inv) {
  if (!inv || !inv.recipientEmail) return;
  const cleanEmail = String(inv.recipientEmail || '').trim().toLowerCase();
  const rawId = inv.id || `inv_${inv.confId || 'conf'}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const safeId = String(rawId).replace(/[.#$/[\]]/g, '_');

  const record = {
    id: safeId,
    confId: inv.confId || '',
    confTitle: inv.confTitle || inv.confName || 'Modern MUN Conference',
    confVenue: inv.confVenue || inv.venue || '',
    confDates: inv.confDates || inv.dates || '',
    organizer: inv.organizer || inv.institution || 'MUN Secretariat',
    organizerEmail: String(inv.organizerEmail || '').trim().toLowerCase(),
    organizerUid: inv.organizerUid || '',
    senderAvatar: inv.senderAvatar || null,
    recipientEmail: cleanEmail,
    email: cleanEmail,
    recipientUid: inv.recipientUid || null,
    recipientName: inv.recipientName || cleanEmail.split('@')[0],
    recipientAvatar: inv.recipientAvatar || null,
    roleType: inv.roleType || 'executive',
    roleId: inv.roleId || 'chair',
    roleLabel: inv.roleLabel || 'Chairperson',
    subject: inv.subject || `Invitation: ${inv.roleLabel || 'Executive'}`,
    committeeCode: inv.committeeCode || null,
    committeeName: inv.committeeName || null,
    status: inv.status || 'pending',
    invitedAt: inv.invitedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDraftConference: Boolean(inv.isDraftConference),
    note: inv.note || ''
  };

  const sanitized = sanitizeForRtdb(record);

  // 1. Instant WebSocket write to Firebase Realtime Database
  try {
    if (rtdb && rtdbRef && rtdbSet) {
      await rtdbSet(rtdbRef(rtdb, `conferenceInvitations/${safeId}`), sanitized);
      console.log('[RTDB Live Sync] Dispatched invitation to Realtime Database:', safeId);
    }
  } catch (rtdbErr) {
    console.warn('[RTDB Live Sync] RTDB dispatch notice:', rtdbErr);
  }

  // 2. Local storage cache for offline / instant same-window access
  try {
    const raw = localStorage.getItem('mun_local_invitations') || '[]';
    const list = JSON.parse(raw);
    const filtered = list.filter(x => x && x.id !== safeId);
    filtered.unshift(record);
    localStorage.setItem('mun_local_invitations', JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('mun:invitation-dispatched', { detail: record }));
  } catch (e) {}

  // 3. Dual-write backup to Cloud Firestore in background
  try {
    if (db && setDoc && doc) {
      setDoc(doc(db, 'conferenceInvitations', safeId), sanitized, { merge: true }).catch(() => {});
    }
  } catch (e) {}

  return record;
}

/**
 * Revokes or deletes an invitation in Realtime Database and Firestore
 */
export async function revokeLiveInvitation(invId, confId, commCode, recipientEmail) {
  const safeId = String(invId || '').replace(/[.#$/[\]]/g, '_');
  const cleanEmail = String(recipientEmail || '').trim().toLowerCase();

  // 1. RTDB removal or status update
  try {
    if (rtdb && rtdbRef && safeId) {
      // Set status to revoked so active listeners see the change immediately
      await rtdbUpdate(rtdbRef(rtdb, `conferenceInvitations/${safeId}`), {
        status: 'revoked',
        revokedAt: new Date().toISOString()
      }).catch(() => {});
      // Also remove after a short grace period
      setTimeout(() => {
        try {
          rtdbRemove(rtdbRef(rtdb, `conferenceInvitations/${safeId}`));
        } catch (e) {}
      }, 2000);
    }
  } catch (e) {}

  // 2. Local storage purge
  try {
    const raw = localStorage.getItem('mun_local_invitations') || '[]';
    const list = JSON.parse(raw);
    const filtered = list.filter(item => {
      if (!item) return false;
      const sameId = safeId && (item.id === safeId || item.id === invId);
      const sameEmail = cleanEmail && (item.recipientEmail || '').trim().toLowerCase() === cleanEmail;
      const sameRole = item.committeeCode === commCode || !commCode;
      return !(sameId || (sameEmail && sameRole));
    });
    localStorage.setItem('mun_local_invitations', JSON.stringify(filtered));
  } catch (e) {}

  // 3. Firestore deletion in background
  try {
    if (db && doc && deleteDoc && safeId) {
      deleteDoc(doc(db, 'conferenceInvitations', safeId)).catch(() => {});
    }
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('mun:invitation-revoked', { detail: { id: safeId, confId } }));
}

/**
 * Updates status of an invitation (e.g. accepted, declined) with sub-30ms live sync
 */
export async function updateLiveInvitationStatus(invId, newStatus, userDetails = {}) {
  const safeId = String(invId || '').replace(/[.#$/[\]]/g, '_');
  if (!safeId) return;

  const nowIso = new Date().toISOString();
  const updatePayload = {
    status: newStatus,
    updatedAt: nowIso
  };

  if (newStatus === 'accepted') {
    updatePayload.acceptedAt = nowIso;
    if (userDetails.uid) updatePayload.acceptedUid = userDetails.uid;
    if (userDetails.email) updatePayload.acceptedEmail = userDetails.email;
    if (userDetails.name) updatePayload.recipientName = userDetails.name;
    if (userDetails.avatar) updatePayload.recipientAvatar = userDetails.avatar;
  } else if (newStatus === 'declined') {
    updatePayload.declinedAt = nowIso;
  }

  // 1. Instant WebSocket write to RTDB
  try {
    if (rtdb && rtdbRef && rtdbUpdate) {
      await rtdbUpdate(rtdbRef(rtdb, `conferenceInvitations/${safeId}`), updatePayload);
      console.log(`[RTDB Live Sync] Updated invitation ${safeId} to status: ${newStatus}`);
    }
  } catch (e) {
    console.warn('[RTDB Live Sync] RTDB update notice:', e);
  }

  // 2. Update local storage cache
  try {
    const raw = localStorage.getItem('mun_local_invitations') || '[]';
    const list = JSON.parse(raw);
    const updated = list.map(item => {
      if (item && (item.id === safeId || item.id === invId)) {
        return { ...item, ...updatePayload };
      }
      return item;
    });
    localStorage.setItem('mun_local_invitations', JSON.stringify(updated));
  } catch (e) {}

  // 3. Update Firestore in background
  try {
    if (db && doc && setDoc) {
      setDoc(doc(db, 'conferenceInvitations', safeId), updatePayload, { merge: true }).catch(() => {});
    }
  } catch (e) {}

  window.dispatchEvent(new CustomEvent('mun:invitation-status-changed', { detail: { id: safeId, status: newStatus, ...updatePayload } }));
}

/**
 * Listens for live invitations for a conference (Organizer's view in Step 5 & Step 6)
 * Triggers callback immediately on any invite dispatch, acceptance, or status change.
 */
export function listenLiveConferenceInvitations(confId, callback) {
  if (!confId || typeof callback !== 'function') return () => {};

  if (!rtdb || !rtdbRef || !rtdbOnValue) {
    return () => {};
  }

  const invRef = rtdbRef(rtdb, 'conferenceInvitations');
  const handleSnapshot = (snapshot) => {
    const val = snapshot.val() || {};
    const matched = [];
    for (const [id, inv] of Object.entries(val)) {
      if (inv && (inv.confId === confId || !confId)) {
        matched.push({ id, ...inv });
      }
    }
    callback(matched);
  };

  rtdbOnValue(invRef, handleSnapshot);

  return () => {
    try {
      if (rtdbOff) rtdbOff(invRef, 'value', handleSnapshot);
    } catch (e) {}
  };
}

/**
 * Listens for live pending invitations received by a specific user (Home screen & Notifications inbox)
 * Subscribes via WebSocket and receives instant updates when new invites arrive or are revoked.
 */
export function listenLiveUserInvitations(userEmail, callback) {
  if (!userEmail || typeof callback !== 'function') return () => {};
  const cleanEmail = String(userEmail || '').trim().toLowerCase();

  if (!rtdb || !rtdbRef || !rtdbOnValue) {
    return () => {};
  }

  const invRef = rtdbRef(rtdb, 'conferenceInvitations');
  const handleSnapshot = (snapshot) => {
    const val = snapshot.val() || {};
    const pendingList = [];
    for (const [id, inv] of Object.entries(val)) {
      if (!inv) continue;
      const recEmail = String(inv.recipientEmail || inv.email || '').trim().toLowerCase();
      if (recEmail === cleanEmail && inv.status === 'pending') {
        pendingList.push({ id, ...inv, _source: 'rtdb' });
      }
    }
    callback(pendingList);
  };

  rtdbOnValue(invRef, handleSnapshot);

  return () => {
    try {
      if (rtdbOff) rtdbOff(invRef, 'value', handleSnapshot);
    } catch (e) {}
  };
}

/**
 * Live Auditions: Save role audition state to Realtime Database
 */
export async function setLiveRoleAudition(confId, scope, commCode, roleId, isOpen) {
  if (!confId || !scope || !roleId) return;
  const cNorm = String(commCode || 'sec').toUpperCase().trim();
  const rNorm = String(roleId || '').toLowerCase().trim();

  const path = scope === 'committee'
    ? `auditions/${confId}/committees/${cNorm}/${rNorm}`
    : `auditions/${confId}/secretariat/${rNorm}`;

  try {
    if (rtdb && rtdbRef && rtdbSet) {
      await rtdbSet(rtdbRef(rtdb, path), Boolean(isOpen));
      console.log(`[RTDB Live Sync] Audition for ${path} set to ${Boolean(isOpen)}`);
    }
  } catch (e) {
    console.warn('[RTDB Live Sync] Audition RTDB write notice:', e);
  }
}

/**
 * Live Auditions: Subscribe to live audition updates for a conference
 */
export function listenLiveAuditions(confId, callback) {
  if (!confId || typeof callback !== 'function') return () => {};

  if (!rtdb || !rtdbRef || !rtdbOnValue) {
    return () => {};
  }

  const audRef = rtdbRef(rtdb, `auditions/${confId}`);
  const handleSnapshot = (snapshot) => {
    const data = snapshot.val() || {};
    callback(data);
  };

  rtdbOnValue(audRef, handleSnapshot);

  return () => {
    try {
      if (rtdbOff) rtdbOff(audRef, 'value', handleSnapshot);
    } catch (e) {}
  };
}
