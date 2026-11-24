/**
 * Modern United Nations - Shared Firestore Database & Sanitization Helpers
 * Centralizes real-time database operations and XSS-safe rendering across portal pages.
 */

import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from './firebase-config.js';

/**
 * Escapes HTML special characters to safely render database strings into the DOM.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes and formats the 3 portal account types for UI badges.
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role = 'individual') {
  const map = {
    individual: 'Individual Delegate',
    executive: 'Executive & Secretariat',
    institution: 'Institution Organizer'
  };
  return map[role] || 'Individual Delegate';
}

/**
 * Maps a conference status key to a human-readable badge label and CSS class.
 * @param {string} status
 * @returns {{ label: string, cssClass: string }}
 */
export function getStatusMeta(status = 'open') {
  const key = String(status || 'open').toLowerCase();
  const table = {
    auditions: { label: 'EB Auditions', cssClass: 'early' },
    ongoing: { label: 'Ongoing Live', cssClass: 'ongoing' },
    open: { label: 'Open for Registration', cssClass: 'open' },
    early: { label: 'Early Bird', cssClass: 'early' },
    limited: { label: 'Limited Seats', cssClass: 'limited' },
    virtual: { label: '100% Virtual', cssClass: 'virtual' },
    completed: { label: 'Completed', cssClass: 'completed' },
    registered: { label: 'Registered', cssClass: 'registered' }
  };
  return table[key] || { label: escapeHtml(status), cssClass: 'open' };
}

/**
 * Formats Firestore errors cleanly so database connection issues are transparent.
 * @param {Error} err
 * @param {string} context
 * @returns {string}
 */
export function formatDatabaseError(err, context = 'Firestore') {
  const code = err?.code || '';
  if (code === 'permission-denied') {
    return `Database access denied for "${context}". Please ensure Firestore security rules allow authenticated access.`;
  }
  if (code === 'unavailable') {
    return `Currently offline or unable to reach Cloud Firestore for ${context}.`;
  }
  return err?.message || `Unable to sync ${context} with Cloud Firestore.`;
}

/**
 * Registers the authenticated user for a conference in Firestore
 * (`registrations/{uid}_{confId}` and mirrors entry into `users/{uid}.registeredConferences`).
 */
export async function registerUserForConference(user, conf, committee, countryPortfolio, delegateName = '') {
  if (!user || !conf || !conf.id) {
    throw new Error('Authentication and valid conference selection required.');
  }

  const regId = `${user.uid}_${conf.id}`;
  const registrationRecord = {
    id: regId,
    uid: user.uid,
    userName: delegateName || user.displayName || user.email || 'Delegate',
    userEmail: user.email || '',
    confId: conf.id,
    confTitle: conf.title || 'Untitled Conference',
    confDates: conf.dates || '',
    confVenue: conf.venue || '',
    confFormat: conf.format || 'in-person',
    confStatus: conf.status || 'open',
    organizerUid: conf.createdBy || conf.organizerUid || '',
    organizerName: conf.hostSecretariat || conf.organizerName || 'MUN Secretariat',
    committee: committee || (Array.isArray(conf.committees) && conf.committees[0]) || 'General Assembly',
    countryPortfolio: countryPortfolio || 'To Be Assigned',
    registeredAt: new Date().toISOString()
  };

  // Persist to user document first so Home & Profile stay synced immediately
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const existingData = userSnap.exists() ? userSnap.data() : {};
  const currentList = Array.isArray(existingData.registeredConferences)
    ? existingData.registeredConferences
    : [];

  const filteredList = currentList.filter((item) => item && item.confId !== conf.id);
  const updatedList = [...filteredList, registrationRecord];

  await setDoc(userRef, {
    registeredConferences: updatedList,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  // Also persist to top-level registrations collection for conference directory/rosters
  try {
    await setDoc(doc(db, 'registrations', regId), registrationRecord, { merge: true });
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      throw err;
    }
    console.warn('Top-level registrations collection write skipped due to rules; user doc synced.', err);
  }

  return { registrationRecord, updatedList };
}

/**
 * Cancels the user's registration for a conference across Firestore.
 */
export async function cancelUserConferenceRegistration(user, confId) {
  if (!user || !confId) {
    throw new Error('Authentication and conference ID required.');
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const existingData = userSnap.exists() ? userSnap.data() : {};
  const currentList = Array.isArray(existingData.registeredConferences)
    ? existingData.registeredConferences
    : [];

  const updatedList = currentList.filter((item) => item && item.confId !== confId);

  await setDoc(userRef, {
    registeredConferences: updatedList,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  try {
    await deleteDoc(doc(db, 'registrations', `${user.uid}_${confId}`));
  } catch (err) {
    if (err?.code !== 'permission-denied') {
      throw err;
    }
  }

  return updatedList;
}

/**
 * Submits or updates an Executive Board (EB) Audition application for a conference.
 * Stored in `ebApplications/{uid}_{confId}` so Institutions can review & connect Executives.
 */
export async function applyForExecutiveAudition(user, conf, details = {}) {
  if (!user || !conf || !conf.id) {
    throw new Error('Authentication and valid conference selection required.');
  }

  const appId = `${user.uid}_${conf.id}`;
  const payload = {
    id: appId,
    uid: user.uid,
    executiveName: details.executiveName || user.displayName || user.email || 'Executive Applicant',
    executiveEmail: user.email || '',
    experience: details.experience || '',
    preferredRole: details.preferredRole || 'Committee Chairperson',
    preferredCommittee: details.preferredCommittee || (Array.isArray(conf.committees) && conf.committees[0]) || 'General Assembly',
    pitch: details.pitch || '',
    confId: conf.id,
    confTitle: conf.title || 'Untitled Conference',
    confDates: conf.dates || '',
    confVenue: conf.venue || '',
    organizerUid: conf.createdBy || conf.organizerUid || '',
    organizerName: conf.hostSecretariat || conf.organizerName || 'Institution Secretariat',
    status: 'pending',
    assignedRole: '',
    assignedCommittee: '',
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'ebApplications', appId), payload, { merge: true });
  return payload;
}

/**
 * Withdraws a pending Executive Audition application from Firestore.
 */
export async function withdrawExecutiveAudition(user, confId) {
  if (!user || !confId) {
    throw new Error('Authentication and conference ID required.');
  }
  await deleteDoc(doc(db, 'ebApplications', `${user.uid}_${confId}`));
}

/**
 * Allows the organizing Institution to approve (connect) or decline/disconnect an Executive applicant.
 * Updates both `ebApplications/{appId}` and `conferences/{confId}.connectedExecutives`.
 */
export async function reviewExecutiveApplication(organizerUser, conf, app, decision, assignedRole = '', assignedCommittee = '') {
  if (!organizerUser || !conf || !app || !app.id) {
    throw new Error('Organizer authentication, conference, and application record are required.');
  }
  const ownerUid = conf.createdBy || conf.organizerUid;
  if (ownerUid !== organizerUser.uid) {
    throw new Error('Only the organizing institution can review and connect executives for this conference.');
  }

  const normalizedDecision = decision === 'approved' ? 'approved' : 'rejected';
  const finalRole = assignedRole || app.preferredRole || 'Committee Chairperson';
  const finalCommittee = assignedCommittee || app.preferredCommittee || 'General Assembly';
  const now = new Date().toISOString();

  await updateDoc(doc(db, 'ebApplications', app.id), {
    status: normalizedDecision,
    assignedRole: normalizedDecision === 'approved' ? finalRole : '',
    assignedCommittee: normalizedDecision === 'approved' ? finalCommittee : '',
    reviewedBy: organizerUser.uid,
    reviewedAt: now,
    updatedAt: now
  });

  const confRef = doc(db, 'conferences', conf.id);
  const confSnap = await getDoc(confRef);
  const confData = confSnap.exists() ? confSnap.data() : conf;
  const existingExecs = Array.isArray(confData.connectedExecutives) ? confData.connectedExecutives : [];
  const filteredExecs = existingExecs.filter((item) => item && item.uid !== app.uid);

  if (normalizedDecision === 'approved') {
    filteredExecs.push({
      uid: app.uid,
      name: app.executiveName || 'Executive Member',
      email: app.executiveEmail || '',
      roleTitle: finalRole,
      committee: finalCommittee,
      applicationId: app.id,
      connectedAt: now
    });
  }

  const connectedExecutiveUids = filteredExecs.map((item) => item.uid);

  await updateDoc(confRef, {
    connectedExecutives: filteredExecs,
    connectedExecutiveUids,
    updatedAt: now
  });

  return { status: normalizedDecision, connectedExecutives: filteredExecs };
}

