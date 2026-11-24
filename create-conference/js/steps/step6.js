/**
 * Step 6 - Conference Secretariat (Invitation-Based Architecture)
 * Predefined roles and custom roles with invitation modal:
 * - Each role is invited via their registered account email address.
 * - Shows role title, invited email, "Pending Invitation" status badge, and Resend / Revoke actions.
 * - The individual accepts or manages the invitation on their individual account.
 */

import { db, auth, doc, getDoc, collection, query, where, getDocs, limit, getSession, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from '../../../js/firebase-config.js';
import {
  dispatchLiveInvitation,
  revokeLiveInvitation,
  listenLiveConferenceInvitations
} from '../../../js/realtime-sync.js';
import {
  isAuditionsOpen,
  isCommitteeAuditionOpen,
  setAllCommitteesAuditions,
  isSecRoleAuditionOpen,
  setSecRoleAudition,
  enableAuditionsInDraft,
  promptAuditionsModal
} from '../auditions-modal.js';

// BroadcastChannel safe dispatcher that keeps channel open long enough for browser IPC
function safePostBroadcast(channelName, data) {
  try {
    const bc = new BroadcastChannel(channelName);
    bc.postMessage(data);
    setTimeout(() => {
      try { bc.close(); } catch (e) { }
    }, 2500);
  } catch (e) { }
}

/**
 * Deeply sanitize payloads for Firestore (removes undefined values to prevent crashes)
 */
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

let secretariatData = {};
let customSecretariatRoles = [];
let modalListenersAttached = false;
let currentVerifiedSec = null;
let secLookupTimeout = null;

const DEFAULT_SECRETARIAT_ROLES = [
  { id: 'sg', label: 'Secretary-General (SG)', icon: 'globe-outline' },
  { id: 'dsg', label: 'Deputy Secretary-General (DSG)', icon: 'shield-checkmark-outline' },
  { id: 'dg', label: 'Director-General (DG)', icon: 'business-outline' },
  { id: 'usg-ga', label: 'USG for General Assembly', icon: 'library-outline' },
  { id: 'usg-ecosoc', label: 'USG for ECOSOC Affairs', icon: 'earth-outline' },
  { id: 'usg-dgacm', label: 'USG for DGACM & Operations', icon: 'calendar-outline' },
  { id: 'chief-of-staff', label: 'Chief of Staff', icon: 'key-outline' },
  { id: 'press-chief', label: 'Head of Press & Media', icon: 'megaphone-outline' },
  { id: 'logistics-head', label: 'Head of Logistics & Venues', icon: 'cube-outline' },
  { id: 'delegate-affairs', label: 'Head of Delegate Affairs', icon: 'id-card-outline' },
  { id: 'finance-head', label: 'Head of Finance & Sponsorships', icon: 'cash-outline' }
];

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format custom role title:
 * - Only allows letters, spaces, and hyphens (disallows numbers and symbols)
 * - Single word: first letter capital (e.g. Chair)
 * - Double or multi-word: all first letters capital (e.g. Vice Chair, Co-Chairperson)
 */
function formatRoleTitleCase(str) {
  if (!str) return '';
  let clean = str.replace(/[^a-zA-Z\s-]/g, '');
  clean = clean.replace(/\s+/g, ' ');
  return clean.replace(/\b([a-zA-Z])([a-zA-Z]*)/g, (match, first, rest) => {
    return first.toUpperCase() + rest.toLowerCase();
  });
}

/**
 * Helper to check if a resolved name is a generic placeholder or entity label
 */
function isGenericName(str) {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim().toLowerCase();
  return (
    !s ||
    s === 'entity' ||
    s === 'the entity' ||
    s === 'an entity' ||
    s === 'institution' ||
    s === 'the institution' ||
    s === 'organisation' ||
    s === 'organization' ||
    s === 'delegate' ||
    s === 'member' ||
    s === 'new member' ||
    s === 'verified member' ||
    s === 'user' ||
    s === 'admin' ||
    s === 'colleague' ||
    s === 'unknown' ||
    s === 'test'
  );
}

/**
 * Helper to derive a clean display name from an email address
 */
function formatDisplayNameFromEmail(email) {
  if (!email || typeof email !== 'string') return 'Colleague';
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === 'lovisiousv21@gmail.com' || cleanEmail === 'loviisiousv21@gmail.com') {
    return 'Lovisious';
  }
  const local = cleanEmail.split('@')[0] || 'Member';
  const cleaned = local.replace(/[0-9]+$/, '');
  const base = cleaned.length >= 2 ? cleaned : local;
  const parts = base.split(/[._-]+/).filter(Boolean);
  if (parts.length > 0) {
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  }
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Helper to extract best personal display name from user document and profile objects
 */
function extractUserDisplayName(data = {}, profile = {}, email = '') {
  const candidates = [
    profile.fullName,
    data.fullName,
    profile.headOfDelegation,
    profile.name,
    data.name,
    profile.contactName,
    data.contactName,
    data.displayName,
    profile.displayName,
    data.username
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
      const trimmed = candidate.trim();
      if (!isGenericName(trimmed)) {
        return trimmed;
      }
    }
  }
  if (email) {
    return formatDisplayNameFromEmail(email);
  }
  return '';
}

/**
 * Builds the comprehensive, official secretariat invitation letter
 */
function buildSecretariatInvitationMessage(account, roleLabel) {
  let inviteeName = (account?.name || account?.fullName || '').trim();
  if (!inviteeName || isGenericName(inviteeName)) {
    inviteeName = account?.email ? formatDisplayNameFromEmail(account.email) : 'Colleague';
  }
  const confCtx = getDraftConferenceContext();
  const confName = confCtx.title || 'Modern United Nations';
  let organizer = confCtx.institution || 'MUN Secretariat';
  if (!organizer || isGenericName(organizer)) {
    organizer = 'Conference Organizing Committee';
  }
  const dates = confCtx.dates || 'the upcoming conference session';
  const venue = confCtx.venue || 'our conference venue';
  const role = roleLabel || 'Secretariat Member';

  return `Dear ${inviteeName},

On behalf of the Organizing Committee of ${confName}, we are pleased to invite you to join the conference Secretariat as ${role}.

${confName} will be hosted by ${organizer} on ${dates} at ${venue}.

In this vital executive leadership capacity, you will work closely with the Secretariat to coordinate conference operations, guide substantive preparation, and deliver an exceptional simulation experience for all participating delegations and committees.

Please confirm your acceptance of this appointment through your Modern United Nations portal to finalize the secretariat roster and access the administrative workspace.

Warm regards,
${organizer} Secretariat
${confName}`;
}

/**
 * Builds the official secretariat invitation email subject line
 */
function buildSecretariatInvitationSubject(roleLabel) {
  const role = roleLabel || 'Secretariat Member';
  const confCtx = getDraftConferenceContext();
  const confName = confCtx.title || 'Modern United Nations';
  return `Invitation: ${role} – ${confName}`;
}

/**
 * Retrieve the current logged-in user's email to prevent self-invitations
 */
function getCurrentUserEmail() {
  try {
    if (auth && auth.currentUser && auth.currentUser.email) {
      return auth.currentUser.email.trim().toLowerCase();
    }
  } catch (e) { }

  try {
    const session = typeof getSession === 'function' ? getSession() : null;
    if (session && session.email) {
      return session.email.trim().toLowerCase();
    }
  } catch (e) { }

  try {
    const rawS = localStorage.getItem('mun_user_session');
    if (rawS) {
      const s = JSON.parse(rawS);
      if (s && s.email) return s.email.trim().toLowerCase();
    }
  } catch (e) { }

  try {
    const rawC = localStorage.getItem('mun_cached_user');
    if (rawC) {
      const c = JSON.parse(rawC);
      if (c && c.email) return c.email.trim().toLowerCase();
    }
  } catch (e) { }

  return '';
}

/**
 * Verify email address against active session, cached user, and Firestore users collection
 */
/**
 * Helper to safely extract any available avatar URL from user and profile objects
 */
function resolveAvatarFromData(obj, prof) {
  if (!obj && !prof) return null;
  const o = obj || {};
  const p = prof || o.profile || {};
  return (
    p.photoURL ||
    p.photoUrl ||
    o.photoURL ||
    o.photoUrl ||
    p.avatar ||
    o.avatar ||
    p.avatarUrl ||
    o.avatarUrl ||
    p.picture ||
    o.picture ||
    p.profileImage ||
    o.profileImage ||
    p.image ||
    o.image ||
    p.photo ||
    o.photo ||
    null
  );
}

/**
 * Universal Account & Avatar Lookup by Email
 * Checks:
 * 1. Active Firebase Auth user and providerData (Google Sign-In)
 * 2. Cached session in getSession() and localStorage
 * 3. Existing invitations in mun_local_invitations
 * 4. Firestore users collection with case variants and profile aliases
 * 5. High-resolution branded UI Avatars fallback
 */
async function lookupAccount(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return null;
  }

  // 1. Check active Firebase Auth user and Google Provider Data
  try {
    if (auth && auth.currentUser) {
      const u = auth.currentUser;
      if (u.email && u.email.toLowerCase() === cleanEmail) {
        let name = '';
        const providerPhoto = Array.isArray(u.providerData)
          ? u.providerData.find(pr => pr && pr.photoURL)?.photoURL
          : null;
        let photo = u.photoURL || providerPhoto || null;

        // Fetch full profile doc if possible
        if (db && doc && getDoc) {
          try {
            const uSnap = await getDoc(doc(db, 'users', u.uid));
            if (uSnap.exists()) {
              const uData = uSnap.data() || {};
              const p = uData.profile || {};
              const resolved = extractUserDisplayName(uData, p, cleanEmail);
              if (resolved && !isGenericName(resolved)) name = resolved;
              const docPhoto = resolveAvatarFromData(uData, p);
              if (docPhoto) photo = docPhoto;
            }
          } catch (e) { }
        }

        if (!name && u.displayName && !isGenericName(u.displayName)) {
          name = u.displayName.trim();
        }

        if (!name || isGenericName(name)) {
          name = formatDisplayNameFromEmail(cleanEmail);
        }

        if (!photo) {
          photo = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || cleanEmail.split('@')[0])}&background=0091FF&color=fff&size=128&bold=true`;
        }

        return {
          uid: u.uid,
          email: cleanEmail,
          name,
          handle: cleanEmail.split('@')[0],
          avatar: photo,
          isRegistered: true,
          accountType: 'Verified Member'
        };
      }
    }
  } catch (err) {
    console.warn('Auth user lookup notice:', err);
  }

  // 2. Check getSession() and localStorage cached sessions
  try {
    const session = typeof getSession === 'function' ? getSession() : null;
    if (session && session.email && session.email.toLowerCase() === cleanEmail) {
      const p = session.profile || {};
      const resolved = extractUserDisplayName(session, p, cleanEmail);
      const name = (resolved && !isGenericName(resolved)) ? resolved : formatDisplayNameFromEmail(cleanEmail);
      const handle = p.handle || session.handle || cleanEmail.split('@')[0];
      let avatar = resolveAvatarFromData(session, p);
      if (!avatar) {
        avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0091FF&color=fff&size=128&bold=true`;
      }
      return {
        uid: session.uid || null,
        email: cleanEmail,
        name,
        handle,
        avatar,
        isRegistered: true,
        accountType: session.accountType || 'Verified Member'
      };
    }
  } catch (err) { }

  try {
    const rawS = localStorage.getItem('mun_user_session');
    if (rawS) {
      const s = JSON.parse(rawS);
      if (s && s.email && s.email.toLowerCase() === cleanEmail) {
        const p = s.profile || {};
        const resolved = extractUserDisplayName(s, p, cleanEmail);
        const name = (resolved && !isGenericName(resolved)) ? resolved : formatDisplayNameFromEmail(cleanEmail);
        let avatar = resolveAvatarFromData(s, p);
        if (!avatar) {
          avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0091FF&color=fff&size=128&bold=true`;
        }
        return {
          uid: s.uid || null,
          email: cleanEmail,
          name,
          handle: p.handle || s.handle || cleanEmail.split('@')[0],
          avatar,
          isRegistered: true,
          accountType: s.accountType || 'Verified Member'
        };
      }
    }
  } catch (err) { }

  try {
    const rawC = localStorage.getItem('mun_cached_user');
    if (rawC) {
      const c = JSON.parse(rawC);
      if (c && c.email && c.email.toLowerCase() === cleanEmail && c.name && !isGenericName(c.name)) {
        let avatar = resolveAvatarFromData(c, c.profile);
        if (!avatar) {
          avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=0091FF&color=fff&size=128&bold=true`;
        }
        return {
          uid: c.uid || null,
          email: cleanEmail,
          name: c.name.trim(),
          handle: cleanEmail.split('@')[0],
          avatar,
          isRegistered: true,
          accountType: c.role || 'Verified Member'
        };
      }
    }
  } catch (err) { }

  try {
    const rawP = localStorage.getItem('user_profile');
    if (rawP) {
      const p = JSON.parse(rawP);
      if (p && p.email && p.email.toLowerCase() === cleanEmail) {
        const resolved = extractUserDisplayName(p, p.profile || {}, cleanEmail);
        const name = (resolved && !isGenericName(resolved)) ? resolved : formatDisplayNameFromEmail(cleanEmail);
        let avatar = resolveAvatarFromData(p, p.profile);
        if (!avatar) {
          avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0091FF&color=fff&size=128&bold=true`;
        }
        return {
          uid: p.uid || null,
          email: cleanEmail,
          name,
          handle: cleanEmail.split('@')[0],
          avatar,
          isRegistered: true,
          accountType: 'Verified Member'
        };
      }
    }
  } catch (err) { }

  // 3. Check existing invitations in mun_local_invitations
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const match = stored.find(inv => (inv.recipientEmail || '').trim().toLowerCase() === cleanEmail && (inv.recipientAvatar || inv.avatar));
    if (match) {
      const name = match.recipientName || formatDisplayNameFromEmail(cleanEmail);
      return {
        uid: match.recipientUid || null,
        email: cleanEmail,
        name,
        handle: cleanEmail.split('@')[0],
        avatar: match.recipientAvatar || match.avatar,
        isRegistered: true,
        accountType: 'Verified Member'
      };
    }
  } catch (err) { }

  // 4. Query Firestore users collection with case variants and profile aliases
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const match = stored.find(inv => (inv.recipientEmail || '').trim().toLowerCase() === cleanEmail && (inv.recipientAvatar || inv.avatar));
    if (match) {
      const name = match.recipientName || formatDisplayNameFromEmail(cleanEmail);
      return {
        email: cleanEmail,
        name,
        handle: cleanEmail.split('@')[0],
        avatar: match.recipientAvatar || match.avatar,
        isRegistered: true,
        accountType: 'Verified Member'
      };
    }
  } catch (err) { }

  // 4. Query Firestore users collection with case variants and profile aliases
  try {
    if (db && collection && query && where && getDocs) {
      let snap = null;

      // Query 4a: where email == cleanEmail
      try {
        const q1 = query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1));
        snap = await getDocs(q1);
      } catch (e) { }

      // Query 4b: where email == original trimmed email (case-preserved)
      if ((!snap || snap.empty) && email.trim() !== cleanEmail) {
        try {
          const q2 = query(collection(db, 'users'), where('email', '==', email.trim()), limit(1));
          snap = await getDocs(q2);
        } catch (e) { }
      }

      // Query 4c: where profile.email == cleanEmail
      if (!snap || snap.empty) {
        try {
          const q3 = query(collection(db, 'users'), where('profile.email', '==', cleanEmail), limit(1));
          snap = await getDocs(q3);
        } catch (e) { }
      }

      // Query 4d: where profile.contactEmail == cleanEmail
      if (!snap || snap.empty) {
        try {
          const q4 = query(collection(db, 'users'), where('profile.contactEmail', '==', cleanEmail), limit(1));
          snap = await getDocs(q4);
        } catch (e) { }
      }

      // Query 4e: where handle == cleanEmail local part
      if (!snap || snap.empty) {
        try {
          const q5 = query(collection(db, 'users'), where('handle', '==', cleanEmail.split('@')[0]), limit(1));
          snap = await getDocs(q5);
        } catch (e) { }
      }

      if (snap && !snap.empty) {
        const uDoc = snap.docs[0].data();
        const p = uDoc.profile || {};
        const resolved = extractUserDisplayName(uDoc, p, cleanEmail);
        const name = (resolved && !isGenericName(resolved)) ? resolved : formatDisplayNameFromEmail(cleanEmail);
        const handle = p.handle || uDoc.handle || cleanEmail.split('@')[0];
        let avatar = resolveAvatarFromData(uDoc, p);
        if (!avatar) {
          avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0091FF&color=fff&size=128&bold=true`;
        }
        return {
          uid: snap.docs[0].id || uDoc.uid || null,
          email: cleanEmail,
          name,
          handle,
          avatar,
          isRegistered: true,
          accountType: uDoc.accountType || 'Verified Member'
        };
      }
    }
  } catch (err) {
    console.warn('Firestore user lookup notice:', err);
  }

  // 5. Fallback: valid email format with branded avatar
  const fallbackName = formatDisplayNameFromEmail(cleanEmail);
  return {
    uid: null,
    email: cleanEmail,
    name: fallbackName,
    handle: cleanEmail.split('@')[0],
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=0091FF&color=fff&size=128&bold=true`,
    isRegistered: false,
    accountType: 'New Member'
  };
}

/**
 * Retrieve metadata from the current conference creation draft
 */
function getDraftConferenceContext() {
  let draftData = {};
  let confId = '';
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const parsed = JSON.parse(raw);
      draftData = parsed.data || {};
      if (parsed.id) confId = parsed.id;
      if (draftData.id) confId = draftData.id;
    }
  } catch (e) { }

  if (!confId) {
    try {
      confId = localStorage.getItem('cc_draft_conference_id') || '';
    } catch (e) { }
  }
  if (!confId) {
    confId = 'draft_conf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    try {
      localStorage.setItem('cc_draft_conference_id', confId);
    } catch (e) { }
  }

  const title = (draftData.title || draftData.name || 'Modern United Nations').trim();
  const institution = (draftData.institution || draftData.hostedBy || 'Conference Secretariat').trim();
  const dates = [draftData.startDate, draftData.endDate].filter(Boolean).join(' - ') || draftData.date || draftData.dates || 'Dates TBA';
  const venue = [draftData.city, draftData.country].filter(Boolean).join(', ') || draftData.venue || (draftData.format === 'virtual' ? 'Virtual' : 'Venue TBA');
  const logoUrl = draftData.logoUrl || draftData.logoDataUrl || '';

  let senderEmail = '';
  let senderUid = '';
  let senderName = '';
  let senderAvatar = null;
  try {
    const session = typeof getSession === 'function' ? getSession() : null;
    if (session) {
      senderEmail = session.email || '';
      senderUid = session.uid || '';
      senderName = session.profile?.fullName || session.displayName || session.name || (senderEmail ? senderEmail.split('@')[0] : '');
      senderAvatar = session.photoURL || session.avatar || session.profile?.photoURL || session.profile?.avatar || null;
    }
  } catch (e) { }

  if (!senderEmail && auth && auth.currentUser) {
    senderEmail = auth.currentUser.email || '';
    senderUid = auth.currentUser.uid || '';
    senderName = auth.currentUser.displayName || (senderEmail ? senderEmail.split('@')[0] : '');
    senderAvatar = senderAvatar || auth.currentUser.photoURL || null;
  }

  return {
    confId,
    title,
    institution,
    dates,
    venue,
    logoUrl,
    senderEmail,
    senderUid,
    senderName,
    senderAvatar,
    draftData
  };
}

/**
 * Dispatches a secretariat invitation record immediately to local storage and Firestore
 * so the invitee can see it on their home screen even while the conference is in draft steps.
 */
async function dispatchInvitationRecord(inv) {
  if (!inv || !inv.recipientEmail) return;
  const ctx = getDraftConferenceContext();
  const cleanEmail = inv.recipientEmail.toLowerCase().trim();

  // Strip multi-megabyte base64 images to avoid Firestore 1MB document limit
  const safeLogoUrl = (ctx.logoUrl && ctx.logoUrl.startsWith('data:image/') && ctx.logoUrl.length > 2048)
    ? ''
    : (ctx.logoUrl || '');

  const safeRecipientAvatar = (inv.recipientAvatar && inv.recipientAvatar.startsWith('data:image/') && inv.recipientAvatar.length > 2048)
    ? null
    : (inv.recipientAvatar || null);

  const safeSenderAvatar = (ctx.senderAvatar && ctx.senderAvatar.startsWith('data:image/') && ctx.senderAvatar.length > 2048)
    ? null
    : (ctx.senderAvatar || null);

  const invId = inv.id && (inv.id.startsWith('inv_sec_') || inv.id.startsWith('sec-inv-') || inv.id.startsWith('custom-sec-'))
    ? inv.id
    : `inv_sec_${ctx.confId}_${inv.roleId || 'sec'}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const safeId = String(invId).replace(/\//g, '_');

  const recipientUid = inv.recipientUid || currentVerifiedSec?.uid || null;

  const record = {
    id: safeId,
    confId: ctx.confId,
    confTitle: ctx.title,
    confVenue: ctx.venue,
    confDates: ctx.dates,
    organizer: ctx.institution || ctx.senderName || 'MUN Secretariat',
    organizerEmail: (ctx.senderEmail || '').toLowerCase().trim(),
    organizerUid: ctx.senderUid || '',
    senderAvatar: safeSenderAvatar,
    recipientEmail: cleanEmail,
    email: cleanEmail,
    recipientUid: recipientUid,
    recipientName: inv.recipientName || formatDisplayNameFromEmail(cleanEmail),
    recipientAvatar: safeRecipientAvatar,
    roleType: 'secretariat',
    roleId: inv.roleId || 'custom',
    roleLabel: inv.roleLabel || 'Secretariat Member',
    subject: inv.subject || buildSecretariatInvitationSubject(inv.roleLabel || 'Secretariat Member'),
    committeeCode: null,
    committeeName: null,
    status: 'pending',
    invitedAt: inv.invitedAt || new Date().toISOString(),
    createdAt: inv.invitedAt || new Date().toISOString(),
    isDraftConference: true,
    note: inv.note || '',
    draftConferenceData: {
      id: ctx.confId,
      title: ctx.title,
      institution: ctx.institution,
      dates: ctx.dates,
      venue: ctx.venue,
      logoUrl: safeLogoUrl,
      committees: Array.isArray(ctx.draftData.committees)
        ? ctx.draftData.committees.map(c => typeof c === 'string' ? c : (c.code || c.name || ''))
        : [],
      description: ctx.draftData.description || '',
      isDraft: true,
      status: 'draft'
    }
  };

  // 1. Write to local storage `mun_local_invitations`
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const filtered = stored.filter(item => {
      if (!item) return false;
      const sameConf = item.confId === record.confId;
      const sameRecipient = (item.recipientEmail || '').toLowerCase().trim() === record.recipientEmail;
      const sameRole = item.roleType === 'secretariat' && (item.roleId === record.roleId || item.id === record.id);
      return !(sameConf && sameRecipient && sameRole);
    });
    filtered.unshift(record);
    localStorage.setItem('mun_local_invitations', JSON.stringify(filtered));

    // Instant cross-tab & in-window event dispatch
    window.dispatchEvent(new CustomEvent('mun:invitation-dispatched', { detail: record }));
    safePostBroadcast('mun_invitations_channel', { type: 'invitation_dispatched', record });
  } catch (err) {
    console.warn('Local secretariat invitation dispatch notice:', err);
  }

  // 2. Dispatch to Firestore and Realtime Database with deterministic document ID and sub-30ms live sync
  try {
    await dispatchLiveInvitation(record);
    console.log('[Invitations] Successfully dispatched secretariat invitation over RTDB Live Sync:', record.id);
  } catch (rtdbErr) {
    console.warn('[Invitations] RTDB Live Sync secretariat dispatch notice:', rtdbErr);
    try {
      if (db && setDoc && doc) {
        const sanitized = sanitizeForFirestore(record);
        await setDoc(doc(db, 'conferenceInvitations', record.id), sanitized, { merge: true });
      }
    } catch (fsErr) {
      console.warn('Firestore secretariat invitation fallback notice:', fsErr);
    }
  }
}

/**
 * Completely revokes a secretariat member's access to the conference:
 * 1. Removes from local storage `mun_local_invitations`
 * 2. Purges from local `mun_accepted_conferences` if stored locally
 * 3. Removes from Cloud Firestore `conferences/{confId}` (connectedExecutives & connectedExecutiveUids)
 * 4. Removes from Cloud Firestore organizer's cloud draft `conference_drafts/{organizerUid}`
 * 5. Permanently deletes/revokes from Cloud Firestore `conferenceInvitations`
 * 6. Broadcasts revocation across BroadcastChannel and window events
 */
async function revokeInvitationRecord(roleId, isCustom, targetSec) {
  const ctx = getDraftConferenceContext();
  const secEmail = (targetSec?.email || targetSec?.recipientEmail || '').trim().toLowerCase();
  const secUid = targetSec?.acceptedUid || targetSec?.uid || targetSec?.recipientUid || null;
  const secRoleLabel = targetSec?.label || targetSec?.roleLabel || '';
  const nowIso = new Date().toISOString();

  // 1. Remove from local storage `mun_local_invitations`
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const filtered = stored.filter(item => {
      if (!item) return false;
      const sameConf = item.confId === ctx.confId;
      const itemEmail = (item.recipientEmail || item.email || '').trim().toLowerCase();
      const sameRole = item.roleType === 'secretariat' && (item.roleId === roleId || item.id === roleId || (secEmail && itemEmail === secEmail));
      return !(sameConf && sameRole);
    });
    localStorage.setItem('mun_local_invitations', JSON.stringify(filtered));
  } catch (e) { }

  // 2. Purge from local `mun_accepted_conferences`
  try {
    const rawAcc = localStorage.getItem('mun_accepted_conferences');
    if (rawAcc) {
      const list = JSON.parse(rawAcc) || [];
      const filtered = list.filter(c => {
        if (c.id === ctx.confId) {
          if (c.acceptedRole && (c.acceptedRole.roleLabel === secRoleLabel || c.acceptedRole.roleType === 'secretariat')) {
            return false;
          }
        }
        return true;
      });
      localStorage.setItem('mun_accepted_conferences', JSON.stringify(filtered));
    }
  } catch (e) { }

  // 3. Revoke access from Cloud Firestore `conferences/{confId}`
  if (ctx.confId && db && doc) {
    try {
      const confRef = doc(db, 'conferences', ctx.confId);
      const confSnap = await getDoc(confRef).catch(() => null);
      if (confSnap && confSnap.exists()) {
        const cData = confSnap.data() || {};
        const currentExecs = Array.isArray(cData.connectedExecutives) ? cData.connectedExecutives : [];
        const currentUids = Array.isArray(cData.connectedExecutiveUids) ? cData.connectedExecutiveUids : [];
        const newExecs = currentExecs.filter(e => {
          const eEmail = (e.email || '').trim().toLowerCase();
          const eUid = e.uid;
          if (secUid && eUid === secUid) return false;
          if (secEmail && eEmail === secEmail) return false;
          if (e.roleType === 'secretariat' && (!secRoleLabel || e.roleLabel === secRoleLabel)) return false;
          return true;
        });
        const newUids = currentUids.filter(uid => {
          if (secUid && uid === secUid) return false;
          return true;
        });
        await updateDoc(confRef, {
          connectedExecutives: newExecs,
          connectedExecutiveUids: newUids,
          updatedAt: nowIso
        }).catch(() => { });
        console.log('[Revoke Sec] Removed secretariat member from conferences document:', ctx.confId);
      }
    } catch (confErr) {
      console.warn('[Revoke Sec] Conference doc update note:', confErr);
    }
  }

  // 4. Update organizer cloud draft in Firestore `conference_drafts/{organizerUid}`
  const orgUid = ctx.senderUid || localStorage.getItem('mun_cloud_draft_uid');
  if (orgUid && db && doc && getDoc && setDoc) {
    try {
      const dRef = doc(db, 'conference_drafts', orgUid);
      const dSnap = await getDoc(dRef).catch(() => null);
      if (dSnap && dSnap.exists()) {
        const draftData = dSnap.data() || {};
        let draftChanged = false;
        if (draftData.data?.secretariat && typeof draftData.data.secretariat === 'object') {
          if (draftData.data.secretariat[roleId]) {
            delete draftData.data.secretariat[roleId];
            draftChanged = true;
          }
        }
        if (Array.isArray(draftData.data?.customSecretariatRoles)) {
          const beforeLen = draftData.data.customSecretariatRoles.length;
          draftData.data.customSecretariatRoles = draftData.data.customSecretariatRoles.filter(cr => cr.id !== roleId && (!secEmail || (cr.email || '').toLowerCase() !== secEmail));
          if (draftData.data.customSecretariatRoles.length !== beforeLen) draftChanged = true;
        }
        if (draftChanged) {
          draftData.updatedAt = nowIso;
          draftData.timestamp = Date.now();
          await setDoc(dRef, draftData, { merge: true }).catch(() => { });
          console.log('[Revoke Sec] Removed secretariat from organizer cloud draft:', orgUid);
        }
      }
    } catch (dErr) {
      console.warn('[Revoke Sec] Cloud draft update note:', dErr);
    }
  }

  // 5. Permanently delete from RTDB and Firestore `conferenceInvitations`
  const secInvId = (isCustom || String(roleId).startsWith('custom-sec-')) ? roleId : (String(roleId).startsWith('sec-inv-') ? roleId : `sec-inv-${roleId}`);
  try {
    revokeLiveInvitation(secInvId, ctx.confId, null, secEmail).catch(() => {});
  } catch (rtdbRevokeErr) { }

  try {
    if (db && doc) {
      try {
        if (deleteDoc) await deleteDoc(doc(db, 'conferenceInvitations', secInvId)).catch(() => { });
      } catch (errSingle) { }

      if (collection && query && where && getDocs && deleteDoc) {
        const q = query(
          collection(db, 'conferenceInvitations'),
          where('confId', '==', ctx.confId),
          where('roleType', '==', 'secretariat')
        );
        const snap = await getDocs(q);
        const deletes = [];
        snap.forEach(dSnap => {
          const dData = dSnap.data();
          const dEmail = (dData.recipientEmail || dData.email || '').trim().toLowerCase();
          if (dSnap.id === secInvId || dData.roleId === roleId || (secEmail && dEmail === secEmail)) {
            deletes.push(deleteDoc(doc(db, 'conferenceInvitations', dSnap.id)).catch(() => { }));
          }
        });
        await Promise.all(deletes);
      }
    }
  } catch (err) { }

  // 6. Broadcast revocation across all open tabs & windows
  const revokePayload = {
    action: 'revoked',
    status: 'revoked',
    type: 'invitation_revoked',
    confId: ctx.confId,
    invId: roleId,
    roleId: roleId,
    recipientEmail: secEmail,
    recipientUid: secUid,
    roleType: 'secretariat',
    roleLabel: secRoleLabel,
    timestamp: Date.now()
  };
  try {
    safePostBroadcast('mun_invitations_channel', revokePayload);
  } catch (e) { }
  window.dispatchEvent(new CustomEvent('mun:invitation-revoked', { detail: revokePayload }));
  window.dispatchEvent(new CustomEvent('mun:invitation-dispatched', { detail: revokePayload }));
}

/**
 * Central helper to revoke and remove a secretariat invitation
 */
function removeSecretariatInvitation(roleId, isCustom) {
  let targetSec = null;
  if (isCustom) {
    targetSec = customSecretariatRoles.find(r => r.id === roleId);
    customSecretariatRoles = customSecretariatRoles.filter(r => r.id !== roleId);
  } else if (secretariatData[roleId]) {
    targetSec = { ...secretariatData[roleId], roleId };
    secretariatData[roleId].email = '';
    secretariatData[roleId].name = '';
    secretariatData[roleId].avatar = null;
    secretariatData[roleId].handle = '';
    secretariatData[roleId].note = '';
    secretariatData[roleId].assigned = false;
    secretariatData[roleId].status = 'unassigned';
  }
  revokeInvitationRecord(roleId, isCustom, targetSec);
  if (typeof window.saveConferenceDraft === 'function') {
    try { window.saveConferenceDraft(); } catch (e) { }
  }
  window.__wizardData = window.__wizardData || {};
  window.__wizardData.secretariat = { ...getStep6Data().secretariat };
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const draft = JSON.parse(raw);
      draft.data = draft.data || {};
      draft.data.secretariat = { ...getStep6Data().secretariat };
      draft.updatedAt = new Date().toISOString();
      localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
    }
  } catch (e) { }
  renderSecretariatDeck();
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Check if an email already holds any assigned or invited role in this conference
 * (Prevents assigning double roles to the same email address)
 */
function findExistingRoleForEmail(email, excludeId = null) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Check in-memory Secretariat roles (predefined)
  if (typeof secretariatData === 'object' && secretariatData) {
    for (const [k, sec] of Object.entries(secretariatData)) {
      if (sec && sec.id !== excludeId && k !== excludeId && (sec.email || '').trim().toLowerCase() === cleanEmail) {
        return `Secretariat (${sec.label || 'Member'})`;
      }
    }
  }

  // 2. Check in-memory Custom Secretariat roles
  if (Array.isArray(customSecretariatRoles)) {
    for (const cr of customSecretariatRoles) {
      if (cr && cr.id !== excludeId && (cr.email || '').trim().toLowerCase() === cleanEmail) {
        return `Secretariat (${cr.label || 'Custom Role'})`;
      }
    }
  }

  // 3. Check draft conference for EB roles
  try {
    const rawDraft = localStorage.getItem('cc_conference_draft');
    if (rawDraft) {
      const draft = JSON.parse(rawDraft);
      const prevEb = draft.data?.ebRoles || draft.data?.ebRolesData || {};
      for (const [commCode, list] of Object.entries(prevEb)) {
        if (Array.isArray(list)) {
          for (const ex of list) {
            if (ex && ex.id !== excludeId && (ex.email || '').trim().toLowerCase() === cleanEmail) {
              const role = ex.roleLabel || ex.role || 'Executive Member';
              return `Executive Board (${role} - ${commCode})`;
            }
          }
        }
      }
    }
  } catch (e) { }

  // 4. Check mun_local_invitations for active invitations in this conference
  try {
    const ctx = getDraftConferenceContext();
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    for (const inv of stored) {
      if (inv && inv.confId === ctx.confId && inv.status !== 'revoked' && inv.status !== 'declined') {
        if (inv.id !== excludeId && inv.roleId !== excludeId && (inv.recipientEmail || '').trim().toLowerCase() === cleanEmail) {
          return inv.roleType === 'secretariat'
            ? `Secretariat (${inv.roleLabel || 'Member'})`
            : `Executive Board (${inv.roleLabel || 'Member'} - ${inv.committeeCode || ''})`;
        }
      }
    }
  } catch (e) { }

  return null;
}

/**
 * Update the real-time verified account blue tick and personalized invitation message inside Secretariat mail modal
 */
function updateSecAccountPreview(account, isVerifying = false) {
  const blueTick = document.getElementById('modalSecBlueTick');
  const noteEl = document.getElementById('modalSecNote');
  const avatarImg = document.getElementById('modalSecAvatarImg');

  if (isVerifying) {
    if (blueTick) {
      blueTick.classList.remove('is-visible');
      blueTick.style.display = 'none';
    }
    if (avatarImg) {
      avatarImg.style.display = 'none';
      avatarImg.src = '';
    }
    return;
  }

  const isCustom = document.getElementById('modalSecIsCustom')?.value === 'true';
  const secRoleLabel = isCustom
    ? (document.getElementById('modalSecCustomRoleInput')?.value?.trim() || 'Secretariat Member')
    : (document.getElementById('modalSecRoleDisplay')?.textContent?.trim() || 'Secretariat Member');

  if (!account) {
    if (blueTick) {
      blueTick.classList.remove('is-visible');
      blueTick.style.display = 'none';
    }
    if (avatarImg) {
      avatarImg.style.display = 'none';
      avatarImg.src = '';
    }
    currentVerifiedSec = null;
    if (noteEl && noteEl.dataset.autoGenerated === 'true') {
      noteEl.value = buildSecretariatInvitationMessage(null, secRoleLabel);
    }
    return;
  }

  currentVerifiedSec = account;
  if (blueTick) {
    const isReg = Boolean(account.isRegistered);
    blueTick.classList.toggle('is-visible', isReg);
    blueTick.style.display = isReg ? 'inline-flex' : 'none';
  }

  if (avatarImg) {
    if (account.avatar) {
      avatarImg.src = account.avatar;
      avatarImg.style.display = 'inline-block';
      avatarImg.onerror = () => {
        avatarImg.style.display = 'none';
      };
    } else {
      avatarImg.style.display = 'none';
      avatarImg.src = '';
    }
  }

  // Auto-populate comprehensive invitation message if currently empty or was auto-generated
  if (noteEl && (!noteEl.value.trim() || noteEl.dataset.autoGenerated === 'true')) {
    noteEl.value = buildSecretariatInvitationMessage(account, secRoleLabel);
    noteEl.dataset.autoGenerated = 'true';
  }
}

/**
 * Toast Notification for Secretariat Invitations
 */
function showSecToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('wizard:toast', {
    detail: { message, type }
  }));
}

/**
 * Initialize Step 6
 */
export async function initStep6(existingData = {}) {
  let rawSec = existingData.secretariat || (window.__wizardData && window.__wizardData.secretariat) || {};

  if (!rawSec || Object.keys(rawSec).length === 0) {
    try {
      const rawDraft = localStorage.getItem('cc_conference_draft');
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed.data?.secretariat && Object.keys(parsed.data.secretariat).length > 0) {
          rawSec = parsed.data.secretariat;
        }
      }
    } catch (e) { }
  }

  // Merge any active secretariat invitations dispatched for this conference from local storage
  try {
    const ctx = getDraftConferenceContext();
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const confInvs = stored.filter(item =>
      item &&
      item.confId === ctx.confId &&
      item.roleType === 'secretariat' &&
      item.status !== 'revoked' &&
      item.status !== 'deleted'
    );

    confInvs.forEach(inv => {
      const rId = inv.roleId;
      if (rId && DEFAULT_SECRETARIAT_ROLES.some(r => r.id === rId)) {
        if (!rawSec[rId] || !rawSec[rId].email) {
          rawSec[rId] = {
            id: rId,
            label: inv.roleLabel || 'Secretariat Member',
            email: inv.recipientEmail,
            name: inv.recipientName || '',
            avatar: inv.recipientAvatar || '',
            note: inv.note || '',
            status: inv.status || 'pending',
            assigned: true,
            invitedAt: inv.invitedAt || new Date().toISOString()
          };
        }
      } else {
        rawSec.customRoles = rawSec.customRoles || [];
        const exists = rawSec.customRoles.some(cr =>
          (cr.id && inv.id && cr.id === inv.id) ||
          ((cr.email || '').trim().toLowerCase() === (inv.recipientEmail || '').trim().toLowerCase() && cr.label === inv.roleLabel)
        );
        if (!exists) {
          rawSec.customRoles.push({
            id: inv.id || `custom-sec-${Date.now()}`,
            label: inv.roleLabel || 'Custom Role',
            email: inv.recipientEmail,
            name: inv.recipientName || '',
            avatar: inv.recipientAvatar || '',
            note: inv.note || '',
            status: inv.status || 'pending',
            isCustom: true,
            assigned: true,
            invitedAt: inv.invitedAt || new Date().toISOString()
          });
        }
      }
    });
  } catch (e) { }

  // Restore predefined roles
  secretariatData = {};
  DEFAULT_SECRETARIAT_ROLES.forEach(role => {
    const prev = rawSec[role.id] || {};
    const email = prev.email || prev.recipientEmail || prev.name || '';
    secretariatData[role.id] = {
      id: role.id,
      label: role.label,
      icon: role.icon,
      email: email,
      note: prev.note || '',
      status: prev.status || 'pending',
      assigned: Boolean(email && email.trim()),
      invitedAt: prev.invitedAt || new Date().toISOString()
    };
  });

  // Restore custom roles
  const rawCustom = Array.isArray(rawSec.customRoles) ? rawSec.customRoles : [];
  customSecretariatRoles = rawCustom.map(cr => ({
    id: cr.id || `custom-sec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    label: cr.label || 'Custom Role',
    email: cr.email || cr.recipientEmail || cr.name || '',
    note: cr.note || '',
    status: cr.status || 'pending',
    isCustom: true,
    assigned: Boolean(cr.email && cr.email.trim()),
    invitedAt: cr.invitedAt || new Date().toISOString()
  })).filter(x => Boolean(x.email && x.email.trim()));

  syncStatusFromStorage();
  listenForConferenceInvitations();
  renderSecretariatDeck();
  setupSecretariatModalListeners();
}

/**
 * Cleanup Step 6
 */
export function cleanupStep6() {
  closeSecretariatModal();
  modalListenersAttached = false;
  if (unsubscribeSecInvitations) {
    try { unsubscribeSecInvitations(); } catch (e) { }
    unsubscribeSecInvitations = null;
  }
  if (unsubscribeRtdbSecInvitations) {
    try { unsubscribeRtdbSecInvitations(); } catch (e) { }
    unsubscribeRtdbSecInvitations = null;
  }
}

/**
 * Get Step 6 Data
 */
export function getStep6Data() {
  return {
    secretariat: {
      ...secretariatData,
      customRoles: [...customSecretariatRoles]
    },
    ebAuditionsOpen: isAuditionsOpen()
  };
}

/**
 * Validate Step 6
 */
export function validateStep6(showErrors = false) {
  // Check total executives from Step 5 / draft
  let execCount = 0;
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const p = JSON.parse(raw);
      const eb = p.data?.ebRoles || {};
      for (const list of Object.values(eb)) {
        if (Array.isArray(list)) {
          execCount += list.filter(x => x && x.email && x.status !== 'revoked' && x.status !== 'deleted').length;
        }
      }
    }
  } catch (e) {}

  // Check total secretariat members
  let secCount = 0;
  for (const [id, r] of Object.entries(secretariatData)) {
    if (r && r.assigned && r.email && r.email.trim() && r.status !== 'revoked' && r.status !== 'deleted') {
      secCount++;
    }
  }
  for (const cr of customSecretariatRoles) {
    if (cr && cr.email && cr.email.trim() && cr.status !== 'revoked' && cr.status !== 'deleted') {
      secCount++;
    }
  }

  // Case 1: User adds NO executive and NO secretariat: prompt modal alert to turn on auditions accessibility and move forward
  if (execCount === 0 && secCount === 0) {
    if (isAuditionsOpen()) {
      return true; // Auditions accessibility is already turned on!
    }
    if (showErrors) {
      promptAuditionsModal({
        title: 'Turn On Auditions Accessibility?',
        subtitle: "You haven't assigned any Executive Board or Secretariat members yet.",
        description: "Turning on Auditions Accessibility allows executive chairs and secretariat candidates across Modern MUN to discover and apply for your summit's committees and dais roles.",
        confirmText: 'Turn On Auditions & Continue',
        skipText: 'Continue Without Auditions',
        onConfirm: () => {
          enableAuditionsInDraft();
          window.dispatchEvent(new CustomEvent('wizard:force-next'));
        },
        onSkip: () => {
          window.dispatchEvent(new CustomEvent('wizard:force-next'));
        }
      });
    }
    return false;
  }

  // Case 2: Executive invited, but no SG
  const sg = secretariatData['sg'];
  const sgAssigned = Boolean(sg && sg.assigned && sg.email && sg.email.trim());
  if (!sgAssigned) {
    if (isAuditionsOpen()) {
      return true; // Auditions are open, so candidates can audition for SG
    }
    if (showErrors) {
      promptAuditionsModal({
        title: 'Turn On Auditions Accessibility?',
        subtitle: 'No Secretary-General (SG) has been assigned yet.',
        description: 'Turning on Auditions Accessibility allows qualified candidates across Modern MUN to apply for Secretary-General and open positions.',
        confirmText: 'Turn On Auditions & Continue',
        skipText: 'Continue Without SG',
        onConfirm: () => {
          enableAuditionsInDraft();
          window.dispatchEvent(new CustomEvent('wizard:force-next'));
        },
        onSkip: () => {
          window.dispatchEvent(new CustomEvent('wizard:force-next'));
        }
      });
    }
    return false;
  }

  return true;
}

function getInitials(name) {
  if (!name) return 'SC';
  const clean = String(name).trim();
  if (clean.includes(' ')) {
    const parts = clean.split(/\s+/);
    return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function formatRelativeTime(isoStringOrTimestamp) {
  if (!isoStringOrTimestamp) return 'Recently';
  try {
    const timestamp = typeof isoStringOrTimestamp === 'number'
      ? isoStringOrTimestamp
      : new Date(isoStringOrTimestamp).getTime();
    if (isNaN(timestamp)) return 'Recently';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

function formatOrdinalDate(isoStringOrTimestamp) {
  if (!isoStringOrTimestamp) return 'Recently';
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const dateObj = new Date(isoStringOrTimestamp);
  if (isNaN(dateObj.getTime())) return 'Recently';

  const day = dateObj.getDate();
  const month = months[dateObj.getMonth()];

  let suffix = 'th';
  if (day % 10 === 1 && day !== 11) suffix = 'st';
  else if (day % 10 === 2 && day !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day !== 13) suffix = 'rd';

  return `${day}${suffix} ${month}`;
}

/**
 * Sync status of secretariat invitations from local storage (e.g. accepted in notifications or home)
 */
function syncStatusFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    if (!Array.isArray(stored) || stored.length === 0) return;
    let hasChanged = false;
    const ctx = getDraftConferenceContext();

    stored.forEach(inv => {
      if (!inv || !inv.status) return;
      if (inv.confId && ctx.confId && inv.confId !== ctx.confId) return;
      if (inv.roleType !== 'secretariat') return;

      const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();
      const rId = inv.roleId;

      if (rId && secretariatData[rId]) {
        const item = secretariatData[rId];
        if (item.status !== inv.status) {
          item.status = inv.status;
          hasChanged = true;
        }
        if (inv.recipientName && (!item.name || item.name === item.email)) {
          item.name = inv.recipientName;
          hasChanged = true;
        }
        if (inv.recipientAvatar && !item.avatar) {
          item.avatar = inv.recipientAvatar;
          hasChanged = true;
        }
      }

      customSecretariatRoles.forEach(cr => {
        const crEmail = (cr.email || '').trim().toLowerCase();
        if ((cr.id && inv.id && cr.id === inv.id) || (invEmail && crEmail && invEmail === crEmail)) {
          if (cr.status !== inv.status) {
            cr.status = inv.status;
            hasChanged = true;
          }
          if (inv.recipientName && (!cr.name || cr.name === cr.email)) {
            cr.name = inv.recipientName;
            hasChanged = true;
          }
          if (inv.recipientAvatar && !cr.avatar) {
            cr.avatar = inv.recipientAvatar;
            hasChanged = true;
          }
        }
      });
    });

    if (hasChanged) {
      window.__wizardData = window.__wizardData || {};
      window.__wizardData.secretariat = { ...getStep6Data().secretariat };
    }
  } catch (e) { }
}

let unsubscribeSecInvitations = null;
let unsubscribeRtdbSecInvitations = null;
function listenForConferenceInvitations() {
  if (unsubscribeSecInvitations) {
    try { unsubscribeSecInvitations(); } catch (e) { }
    unsubscribeSecInvitations = null;
  }
  if (unsubscribeRtdbSecInvitations) {
    try { unsubscribeRtdbSecInvitations(); } catch (e) { }
    unsubscribeRtdbSecInvitations = null;
  }
  try {
    const ctx = getDraftConferenceContext();
    if (!ctx.confId) return;

    // 1. Attach sub-30ms Realtime Database WebSocket listener
    unsubscribeRtdbSecInvitations = listenLiveConferenceInvitations(ctx.confId, (invsList) => {
      let changed = false;
      invsList.forEach(inv => {
        if (!inv || inv.roleType !== 'secretariat') return;
        const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();
        const rId = inv.roleId;

        if (inv.status === 'revoked' || inv.status === 'deleted') {
          if (rId && secretariatData[rId]) {
            secretariatData[rId].assigned = false;
            secretariatData[rId].email = '';
            secretariatData[rId].status = 'unassigned';
            changed = true;
          }
          const beforeCustom = customSecretariatRoles.length;
          customSecretariatRoles = customSecretariatRoles.filter(cr => cr.id !== inv.id && cr.roleId !== rId && (!invEmail || (cr.email || '').trim().toLowerCase() !== invEmail));
          if (customSecretariatRoles.length !== beforeCustom) changed = true;
          return;
        }

        if (rId && secretariatData[rId]) {
          const sec = secretariatData[rId];
          if (sec.status !== inv.status) {
            sec.status = inv.status;
            changed = true;
          }
          if (inv.recipientName && (!sec.name || sec.name === sec.email)) {
            sec.name = inv.recipientName;
            changed = true;
          }
          if (inv.recipientAvatar && !sec.avatar) {
            sec.avatar = inv.recipientAvatar;
            changed = true;
          }
        }

        customSecretariatRoles.forEach(cr => {
          const crEmail = (cr.email || '').trim().toLowerCase();
          if ((cr.id && cr.id === inv.id) || (rId && cr.id === rId) || (invEmail && crEmail && invEmail === crEmail)) {
            if (cr.status !== inv.status) {
              cr.status = inv.status;
              changed = true;
            }
            if (inv.recipientName && (!cr.name || cr.name === cr.email)) {
              cr.name = inv.recipientName;
              changed = true;
            }
            if (inv.recipientAvatar && !cr.avatar) {
              cr.avatar = inv.recipientAvatar;
              changed = true;
            }
          }
        });
      });

      if (changed) {
        window.__wizardData = window.__wizardData || {};
        window.__wizardData.secretariat = { ...getStep6Data().secretariat };
        try {
          const raw = localStorage.getItem('cc_conference_draft');
          if (raw) {
            const draft = JSON.parse(raw);
            draft.data = draft.data || {};
            draft.data.secretariat = { ...getStep6Data().secretariat };
            draft.updatedAt = new Date().toISOString();
            localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
          }
        } catch (e) { }
        if (typeof window.saveConferenceDraft === 'function') {
          try { window.saveConferenceDraft(); } catch (e) { }
        }
        renderSecretariatDeck();
      }
    });

    // 2. Fallback / supplementary Firestore listener
    if (!db || !collection || !query || !where || !onSnapshot) return;
    const q = query(
      collection(db, 'conferenceInvitations'),
      where('confId', '==', ctx.confId),
      where('roleType', '==', 'secretariat')
    );
    unsubscribeSecInvitations = onSnapshot(q, (snapshot) => {
      let changed = false;

      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          const removedId = change.doc.id;
          for (const [rId, sec] of Object.entries(secretariatData)) {
            if (sec && (sec.id === removedId || sec.roleId === removedId)) {
              secretariatData[rId].assigned = false;
              secretariatData[rId].email = '';
              secretariatData[rId].status = 'unassigned';
              changed = true;
            }
          }
          const beforeCustom = customSecretariatRoles.length;
          customSecretariatRoles = customSecretariatRoles.filter(cr => cr.id !== removedId);
          if (customSecretariatRoles.length !== beforeCustom) changed = true;
        }
      });

      snapshot.forEach(docSnap => {
        const inv = docSnap.data();
        if (!inv || !inv.status) return;
        const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();
        const rId = inv.roleId;

        if (inv.status === 'revoked' || inv.status === 'deleted') {
          if (rId && secretariatData[rId]) {
            secretariatData[rId].assigned = false;
            secretariatData[rId].email = '';
            secretariatData[rId].status = 'unassigned';
            changed = true;
          }
          customSecretariatRoles = customSecretariatRoles.filter(cr => cr.id !== docSnap.id && cr.id !== inv.id);
          return;
        }

        if (rId && secretariatData[rId]) {
          const sec = secretariatData[rId];
          if (sec.status !== inv.status) {
            sec.status = inv.status;
            changed = true;
          }
          if (inv.recipientName && (!sec.name || sec.name === sec.email)) {
            sec.name = inv.recipientName;
            changed = true;
          }
          if (inv.recipientAvatar && !sec.avatar) {
            sec.avatar = inv.recipientAvatar;
            changed = true;
          }
        }

        customSecretariatRoles.forEach(cr => {
          const crEmail = (cr.email || '').trim().toLowerCase();
          if ((cr.id && (cr.id === docSnap.id || cr.id === inv.id)) || (invEmail && crEmail && invEmail === crEmail)) {
            if (cr.status !== inv.status) {
              cr.status = inv.status;
              changed = true;
            }
            if (inv.recipientName && (!cr.name || cr.name === cr.email)) {
              cr.name = inv.recipientName;
              changed = true;
            }
            if (inv.recipientAvatar && !cr.avatar) {
              cr.avatar = inv.recipientAvatar;
              changed = true;
            }
          }
        });
      });

      if (changed) {
        window.__wizardData = window.__wizardData || {};
        window.__wizardData.secretariat = { ...getStep6Data().secretariat };
        try {
          const raw = localStorage.getItem('cc_conference_draft');
          if (raw) {
            const draft = JSON.parse(raw);
            draft.data = draft.data || {};
            draft.data.secretariat = { ...getStep6Data().secretariat };
            draft.updatedAt = new Date().toISOString();
            localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
          }
        } catch (e) { }
        if (typeof window.saveConferenceDraft === 'function') {
          try { window.saveConferenceDraft(); } catch (e) { }
        }
        renderSecretariatDeck();
      }
    }, (err) => {
      console.warn('Secretariat invitations snapshot notice:', err);
    });
  } catch (err) {
    console.warn('Secretariat listener notice:', err);
  }
}

if (typeof window !== 'undefined' && !window.__secBroadcastListenerAttached) {
  window.__secBroadcastListenerAttached = true;
  try {
    const bc = new BroadcastChannel('mun_invitations_channel');
    bc.onmessage = (ev) => {
      if (ev.data && (ev.data.action === 'deleted' || ev.data.status === 'deleted' || ev.data.status === 'revoked')) {
        const delRole = ev.data.roleId;
        if (delRole && secretariatData[delRole]) {
          secretariatData[delRole].assigned = false;
          secretariatData[delRole].email = '';
          secretariatData[delRole].status = 'unassigned';
        }
        if (delRole) {
          customSecretariatRoles = customSecretariatRoles.filter(cr => cr.id !== delRole);
        }
        renderSecretariatDeck();
      } else if (ev.data && (ev.data.action === 'accepted' || ev.data.action === 'declined' || ev.data.status === 'accepted' || ev.data.status === 'declined')) {
        const evEmail = (ev.data.recipientEmail || '').trim().toLowerCase();
        const evId = ev.data.invId;
        const evRoleId = ev.data.roleId;
        const newStatus = ev.data.status || ev.data.action;
        if (evRoleId && secretariatData[evRoleId]) {
          secretariatData[evRoleId].status = newStatus;
          if (ev.data.acceptedName) secretariatData[evRoleId].name = ev.data.acceptedName;
          if (ev.data.acceptedAvatar) secretariatData[evRoleId].avatar = ev.data.acceptedAvatar;
        }
        for (const [rId, sec] of Object.entries(secretariatData)) {
          if (sec && ((evId && sec.id === evId) || (evEmail && (sec.email || '').trim().toLowerCase() === evEmail))) {
            sec.status = newStatus;
            if (ev.data.acceptedName) sec.name = ev.data.acceptedName;
            if (ev.data.acceptedAvatar) sec.avatar = ev.data.acceptedAvatar;
          }
        }
        customSecretariatRoles.forEach(cr => {
          if ((evId && cr.id === evId) || (evEmail && (cr.email || '').trim().toLowerCase() === evEmail)) {
            cr.status = newStatus;
            if (ev.data.acceptedName) cr.name = ev.data.acceptedName;
            if (ev.data.acceptedAvatar) cr.avatar = ev.data.acceptedAvatar;
          }
        });
        syncStatusFromStorage();
        renderSecretariatDeck();
      }
    };
  } catch (e) { }

  window.addEventListener('storage', (e) => {
    if (e.key === 'mun_local_invitations' || e.key === 'cc_conference_draft') {
      syncStatusFromStorage();
      renderSecretariatDeck();
    }
  });
}

function findOpenMailRecord(id) {
  if (!id) return null;
  for (const role of DEFAULT_SECRETARIAT_ROLES) {
    if ((role.id === id || String(role.id) === String(id)) && secretariatData[role.id]?.email) {
      return { data: secretariatData[role.id], roleId: role.id, label: role.label, isCustom: false };
    }
  }
  for (const cr of customSecretariatRoles) {
    if (cr.id === id || String(cr.id) === String(id)) {
      return { data: cr, roleId: cr.id, label: cr.label, isCustom: true };
    }
  }
  return null;
}

/**
 * Render Secretariat Mail Reading Pane (matches Step 5 Executive Board)
 */
function renderMailReadingPane(data, roleId, roleLabel, isCustom) {
  const email = data.email ? escapeHtml(data.email) : 'No email provided';
  const displayName = data.name || formatDisplayNameFromEmail(data.email);
  const initials = getInitials(displayName || data.email);
  let subject = data.subject || buildSecretariatInvitationSubject(roleLabel);
  subject = subject.replace(/official\s*/gi, '').trim();
  const bodyText = data.note || buildSecretariatInvitationMessage({ email: data.email, name: data.name }, roleLabel);
  const timeStr = formatRelativeTime(data.invitedAt || Date.now());
  const status = (data.status || 'pending').toLowerCase();
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined' || status === 'rejected';
  const isRevoked = status === 'revoked';
  const statusClass = isAccepted ? 'is-accepted' : (isDeclined ? 'is-rejected' : 'is-pending');
  const avatarBgColor = isAccepted ? '0091FF' : (isDeclined ? 'ef4444' : '94a3b8');
  const avatarUrl = data.avatar || data.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${avatarBgColor}&color=fff&size=128&bold=true`;

  return `
    <div class="cc-mail-read-pane" id="secMailReadPane">
      <div class="cc-mail-read-toolbar">
        <button type="button" class="cc-mail-read-back" id="btnSecMailReadBack" title="Back to inbox" aria-label="Back to inbox">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <div class="cc-mail-read-actions">
          <button type="button" class="cc-mail-read-action-btn cc-mail-read-delete" data-role-id="${escapeHtml(roleId)}" data-is-custom="${isCustom ? 'true' : 'false'}" title="Delete invitation" aria-label="Delete invitation">
            <ion-icon name="trash-outline"></ion-icon>
          </button>
        </div>
      </div>
      <div class="cc-mail-read-subject-row">
        <h2 class="cc-mail-read-subject">${escapeHtml(subject)}</h2>
        ${isAccepted ? '<span class="cc-mail-status-text is-accepted">Accepted</span>' : (isDeclined ? '<span class="cc-mail-status-text is-rejected">Declined</span>' : (isRevoked ? '<span class="cc-mail-status-text is-revoked">Revoked</span>' : ''))}
      </div>
      <div class="cc-mail-read-meta-row">
        <div class="cc-gmail-avatar ${statusClass}"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="cc-gmail-avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.classList.add('has-img-error');" /><span class="cc-gmail-avatar-initials">${escapeHtml(initials)}</span></div>
        <div class="cc-mail-read-sender-info">
          <div class="cc-mail-read-from-name">${escapeHtml(displayName)}</div>
          <div class="cc-mail-read-to-row">
            <span class="cc-mail-read-to-prefix">to:</span>
            <span class="cc-mail-read-to-email">${email}</span>
          </div>
        </div>
        <div class="cc-mail-read-date">${escapeHtml(timeStr)}</div>
      </div>
      <div class="cc-mail-read-body">
        <pre class="cc-mail-read-body-text">${escapeHtml(bodyText)}</pre>
      </div>
    </div>
  `;
}

/**
 * Render Confirmed Secretariat Member Row in Secretariat Tab
 * Avatar -> Name & Role on right -> Accepted text on right end
 */
function renderConfirmedSecretariatRow(data, roleId, roleLabel, isCustom) {
  const email = data.email ? escapeHtml(data.email) : '';
  const displayName = data.name || formatDisplayNameFromEmail(data.email);
  const initials = getInitials(displayName || email);
  const avatarBgColor = '0091FF';
  const avatarUrl = data.avatar || data.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${avatarBgColor}&color=fff&size=128&bold=true`;

  return `
    <div
      class="cc-gmail-row cc-sec-confirmed-row"
      data-role-id="${escapeHtml(roleId)}"
      data-is-custom="${isCustom ? 'true' : 'false'}"
      role="button"
      tabindex="0"
      title="View secretariat appointment"
    >
      <div class="cc-gmail-avatar is-accepted"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="cc-gmail-avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.classList.add('has-img-error');" /><span class="cc-gmail-avatar-initials">${escapeHtml(initials)}</span></div>
      <div class="cc-sec-confirmed-info">
        <div class="cc-sec-confirmed-name">
          ${escapeHtml(displayName)}
          ${email ? `<span class="cc-gmail-line-email">&lt;${email}&gt;</span>` : ''}
        </div>
        <div class="cc-sec-confirmed-role">${escapeHtml(roleLabel)}</div>
      </div>
      <div class="cc-sec-confirmed-right">
        <span class="cc-sec-confirmed-status is-accepted">Accepted</span>
      </div>
    </div>
  `;
}

/**
 * Render an individual Secretariat Role Invitation as a clean Google Mail row
 */
function renderGmailSecretariatRow(data, roleId, roleLabel, isCustom) {
  const email = data.email ? escapeHtml(data.email) : 'No email provided';
  const status = (data.status || 'pending').toLowerCase();
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined' || status === 'rejected';
  const isRevoked = status === 'revoked';
  const statusClass = isAccepted ? 'is-accepted' : (isDeclined ? 'is-rejected' : 'is-pending');
  const avatarBgColor = isAccepted ? '0091FF' : (isDeclined ? 'ef4444' : '94a3b8');
  const displayName = data.name || formatDisplayNameFromEmail(data.email);
  const initials = getInitials(displayName || data.email);
  const subject = data.subject || `Appointment Invitation: ${roleLabel}`;
  const snippet = (data.note || `Letter of appointment for the position of ${roleLabel}.`).trim().replace(/\n+/g, ' ');
  const ordinalDate = formatOrdinalDate(data.invitedAt || Date.now());
  const avatarUrl = data.avatar || data.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${avatarBgColor}&color=fff&size=128&bold=true`;

  return `
    <div
      class="cc-gmail-row cc-sec-role-card"
      data-role-id="${escapeHtml(roleId)}"
      data-is-custom="${isCustom ? 'true' : 'false'}"
      role="button"
      tabindex="0"
      title="Open invitation"
    >
      <div class="cc-gmail-avatar ${statusClass}"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="cc-gmail-avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.classList.add('has-img-error');" /><span class="cc-gmail-avatar-initials">${escapeHtml(initials)}</span></div>
      <div class="cc-gmail-content-col">
        <div class="cc-gmail-line-name">${escapeHtml(displayName)} <span class="cc-gmail-line-email">&lt;${email}&gt;</span></div>
        <div class="cc-gmail-line-subject">${escapeHtml(subject)}</div>
        <div class="cc-gmail-line-message">${escapeHtml(snippet)}</div>
      </div>
      <div class="cc-gmail-col-right">
        <span class="cc-gmail-date">${escapeHtml(ordinalDate)}</span>
        <div class="cc-sec-right-status-actions">
          ${isAccepted ? '<span class="cc-gmail-status-text is-accepted">Accepted</span>' : (isDeclined ? '<span class="cc-gmail-status-text is-rejected">Declined</span>' : (isRevoked ? '<span class="cc-gmail-status-text is-revoked">Revoked</span>' : ''))}
          <div class="cc-gmail-actions">
            <button
              type="button"
              class="cc-gmail-action-btn cc-gmail-btn-edit cc-inv-card-edit-btn"
              data-action="sec-edit"
              data-role-id="${escapeHtml(roleId)}"
              data-is-custom="${isCustom ? 'true' : 'false'}"
              title="Edit Message"
              aria-label="Edit Message"
            >
              <ion-icon name="create-outline"></ion-icon>
            </button>
            <button
              type="button"
              class="cc-gmail-action-btn cc-gmail-btn-delete cc-inv-card-revoke-btn"
              data-action="sec-revoke"
              data-role-id="${escapeHtml(roleId)}"
              data-is-custom="${isCustom ? 'true' : 'false'}"
              title="Delete Invitation"
              aria-label="Delete Invitation"
            >
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render an unassigned Secretariat position as a clean Gmail row
 */
function renderGmailSecretariatUnassignedRow(role) {
  const isSG = role.id === 'sg';
  return `
    <div
      class="cc-gmail-row is-unassigned cc-sec-role-card"
      data-role-id="${escapeHtml(role.id)}"
      data-is-custom="false"
      role="button"
      tabindex="0"
      title="Click to invite individual for ${escapeHtml(role.label)}"
    >
      <div class="cc-gmail-avatar is-unassigned">
        <ion-icon name="${escapeHtml(role.icon || 'person-outline')}"></ion-icon>
      </div>
      <div class="cc-gmail-content-col">
        <div class="cc-gmail-line-name">${escapeHtml(role.label)} <span class="cc-gmail-line-email">&lt;Unassigned&gt;</span></div>
        <div class="cc-gmail-line-subject">${isSG ? 'Secretary-General (Required Position)' : 'Secretariat Leadership Position'}</div>
        <div class="cc-gmail-line-message">Click to compose and dispatch an appointment invitation for this role</div>
      </div>
      <div class="cc-gmail-col-right">
        <span class="cc-gmail-date">Available</span>
        <button
          type="button"
          class="cc-gmail-row-invite-btn cc-sec-invite-trigger-btn"
          data-role-id="${escapeHtml(role.id)}"
          title="Compose invitation for ${escapeHtml(role.label)}"
        >
          <ion-icon name="person-add-outline"></ion-icon>
          <span>Invite</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Render Secretariat Deck with Google Mail Outbox List View
 * (Replaces square cards with pure Gmail list view, toolbar tabs, confirmed secretariat, and reading pane)
 */
function renderSecretariatDeck() {
  const container = document.getElementById('secretariatDeckContainer');
  if (!container) return;

  syncStatusFromStorage();
  window.__secActiveTab = window.__secActiveTab || 'secretariat';

  const assignedPredefined = DEFAULT_SECRETARIAT_ROLES.filter(r => {
    const d = secretariatData[r.id];
    return Boolean(d && d.assigned && d.email && d.email.trim());
  });

  const assignedCustom = customSecretariatRoles.filter(cr => {
    return Boolean(cr.email && cr.email.trim());
  });

  const totalDispatched = assignedPredefined.length + assignedCustom.length;
  const sgData = secretariatData['sg'];
  const hasSG = Boolean(sgData && sgData.assigned && sgData.email && sgData.email.trim());

  const unassignedPredefined = DEFAULT_SECRETARIAT_ROLES.filter(r => {
    const d = secretariatData[r.id];
    return !(d && d.assigned && d.email && d.email.trim());
  });

  const acceptedPredefined = assignedPredefined.filter(r => {
    const d = secretariatData[r.id];
    return d && (d.status || '').toLowerCase() === 'accepted';
  });
  const acceptedCustom = assignedCustom.filter(cr => {
    return (cr.status || '').toLowerCase() === 'accepted';
  });
  const totalAccepted = acceptedPredefined.length + acceptedCustom.length;

  const openMailRole = window.__secOpenMailId ? findOpenMailRecord(window.__secOpenMailId) : null;

  if (openMailRole) {
    container.innerHTML = `
      <div class="cc-gmail-container" id="secDeckContainer">
        ${renderMailReadingPane(openMailRole.data, openMailRole.roleId, openMailRole.label, openMailRole.isCustom)}
      </div>
    `;
    attachSecretariatEvents();
    return;
  }

  const isConfAuditionsOpen = isAuditionsOpen();

  container.innerHTML = `
    <!-- Google Mail Outbox Section -->
    <div class="cc-gmail-container" id="secDeckContainer">
      <!-- Gmail Toolbar with Tabs (Secretariat, Invitations, Auditions) -->
      <div class="cc-gmail-toolbar">
        <div class="cc-gmail-toolbar-left">
          <button type="button" class="cc-eb-toolbar-tab ${window.__secActiveTab === 'secretariat' ? 'is-active' : ''}" id="btnSecTabSecretariat" title="View confirmed secretariat">
            Secretariat
          </button>
          <button type="button" class="cc-eb-toolbar-tab ${window.__secActiveTab === 'invitations' ? 'is-active' : ''}" id="btnSecTabInvitations" title="View sent invitations">
            Invitations
          </button>
          <button type="button" class="cc-eb-toolbar-tab ${window.__secActiveTab === 'auditions' ? 'is-active' : ''}" id="btnSecTabAuditions" title="Auditions">
            Auditions
          </button>
        </div>
        <div class="cc-gmail-toolbar-right">
          <span class="cc-gmail-sg-pill ${hasSG ? 'is-assigned' : 'is-required'}">
            <ion-icon name="${hasSG ? 'checkmark-circle' : 'alert-circle'}"></ion-icon>
            <span>${hasSG ? 'Secretary-General Assigned' : 'SG Invitation Required'}</span>
          </span>
        </div>
      </div>

      <!-- Gmail Outbox List -->
      <div class="cc-gmail-list ${window.__secActiveTab === 'auditions' ? 'is-auditions-mode' : ''}" id="secGmailList">
        ${window.__secActiveTab === 'auditions' ? renderConferenceAuditionsWorkspace() : (window.__secActiveTab === 'secretariat' ? `
          ${totalAccepted > 0 ? `
            ${acceptedPredefined.map(role => renderConfirmedSecretariatRow(secretariatData[role.id], role.id, role.label, false)).join('')}
            ${acceptedCustom.map(cr => renderConfirmedSecretariatRow(cr, cr.id, cr.label, true)).join('')}
          ` : `
            <div class="cc-gmail-empty-state">
              <div class="cc-gmail-empty-icon-wrap"><ion-icon name="people-outline"></ion-icon></div>
              <h4 class="cc-gmail-empty-title">No confirmed secretariat members yet</h4>
              <p class="cc-gmail-empty-desc">When invited members accept their appointment, they will appear here as confirmed secretariat members.</p>
            </div>
          `}
        ` : `
          ${totalDispatched > 0 ? `
            <div class="cc-gmail-section-header">
              <span>Dispatched Invitations (${totalDispatched})</span>
            </div>
            ${assignedPredefined.map(role => renderGmailSecretariatRow(secretariatData[role.id], role.id, role.label, false)).join('')}
            ${assignedCustom.map(cr => renderGmailSecretariatRow(cr, cr.id, cr.label, true)).join('')}
          ` : `
            <div class="cc-gmail-empty-state">
              <div class="cc-gmail-empty-icon-wrap">
                <ion-icon name="mail-unread-outline"></ion-icon>
              </div>
              <h4 class="cc-gmail-empty-title">No Secretariat Invitations Sent Yet</h4>
              <p class="cc-gmail-empty-desc">Dispatch an invitation to assign the Secretary-General (SG) and leadership team. Click below or use the floating Compose button.</p>
              <button type="button" class="cc-gmail-empty-compose-btn" id="btnEmptyComposeSec">
                <ion-icon name="create-outline"></ion-icon>
                <span>Compose SG Invitation</span>
              </button>
            </div>
          `}

          ${unassignedPredefined.length > 0 ? `
            <div class="cc-gmail-section-header">
              <span>Available Positions (${unassignedPredefined.length})</span>
            </div>
            ${unassignedPredefined.map(role => renderGmailSecretariatUnassignedRow(role)).join('')}
          ` : ''}
        `)}
      </div>
    </div>

    <!-- Gmail Floating Compose Button (Bottom-Right) -->
    <button type="button" class="cc-gmail-compose-fab" id="btnGmailComposeSec" title="Compose New Secretariat Invitation">
      <ion-icon name="create-outline"></ion-icon>
      <span>Compose</span>
    </button>
  `;

  attachSecretariatEvents();
}

function renderConferenceAuditionsWorkspace() {
  const allSecRoles = [
    ...DEFAULT_SECRETARIAT_ROLES.map(r => ({ ...r, isCustom: false })),
    ...customSecretariatRoles.map(cr => ({ ...cr, isCustom: true }))
  ];

  return `
    <div class="cc-auditions-hint">
      <ion-icon name="information-circle-outline" class="cc-auditions-hint-icon"></ion-icon>
      <span class="cc-auditions-hint-text">Opening auditions allows qualified candidates across Modern MUN to discover and apply for vacant secretariat positions.</span>
    </div>
    <div class="cc-auditions-roles-list">
      ${allSecRoles.map(role => {
        let isFilled = false;
        if (role.isCustom) {
          const cr = customSecretariatRoles.find(x => x.id === role.id);
          if (cr && (cr.status === 'accepted' || cr.acceptedUid)) isFilled = true;
        } else {
          const d = secretariatData[role.id];
          if (d && (d.status === 'accepted' || d.acceptedUid)) isFilled = true;
        }
        const isRoleOpen = !isFilled && isSecRoleAuditionOpen(role.id, isFilled);

        return `
          <div class="cc-audition-role-row ${isFilled ? 'is-filled' : ''}">
            <div class="cc-audition-role-name">
              ${escapeHtml(role.label)}
            </div>
            <div class="cc-audition-role-action">
              ${isFilled ? `
                <span class="cc-audition-text-filled">Filled</span>
              ` : `
                <button type="button" class="cc-audition-text-toggle ${isRoleOpen ? 'is-open' : 'is-closed'}" data-toggle-sec-role="${escapeHtml(role.id)}" title="Click to toggle Open / Closed">
                  ${isRoleOpen ? 'Open' : 'Closed'}
                </button>
              `}
              ${role.isCustom ? `
                <button type="button" class="cc-audition-delete-role-btn" data-delete-sec-role="${escapeHtml(role.id)}" title="Delete custom role" aria-label="Delete custom role">
                  <ion-icon name="trash-outline"></ion-icon>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
      <div class="cc-audition-custom-row">
        <div class="cc-audition-custom-input-wrap">
          <input
            type="text"
            class="cc-audition-custom-input"
            id="inputSecAuditionCustomRole"
            placeholder="Add custom role..."
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <button type="button" class="cc-audition-add-btn" id="btnAddSecAuditionCustomRole" title="Add custom role">
          Add
        </button>
      </div>
    </div>
  `;
}

function attachConferenceAuditionsEvents(switchTabFn) {
  document.querySelectorAll('[data-toggle-sec-role]')?.forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const roleId = el.getAttribute('data-toggle-sec-role');
      if (!roleId) return;
      const current = isSecRoleAuditionOpen(roleId, false);
      const newOpen = !current;
      setSecRoleAudition(roleId, newOpen, false);
      el.classList.toggle('is-open', newOpen);
      el.classList.toggle('is-closed', !newOpen);
      el.textContent = newOpen ? 'Open' : 'Closed';
    });
  });

  document.querySelectorAll('[data-delete-sec-role]')?.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const roleId = btn.getAttribute('data-delete-sec-role');
      if (!roleId) return;
      customSecretariatRoles = customSecretariatRoles.filter(r => r.id !== roleId);
      if (window.__secRoleAuditions) {
        delete window.__secRoleAuditions[roleId];
      }
      try {
        const raw = localStorage.getItem('cc_conference_draft');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.data?.secRoleAuditions && parsed.data.secRoleAuditions[roleId] !== undefined) {
            delete parsed.data.secRoleAuditions[roleId];
          }
          if (Array.isArray(parsed.data?.secretariat?.customRoles)) {
            parsed.data.secretariat.customRoles = parsed.data.secretariat.customRoles.filter(r => r.id !== roleId);
          }
          localStorage.setItem('cc_conference_draft', JSON.stringify(parsed));
        }
      } catch (err) {}

      const list = document.getElementById('secGmailList');
      if (list) {
        list.innerHTML = renderConferenceAuditionsWorkspace();
        attachConferenceAuditionsEvents(switchTabFn);
      }
    });
  });

  const customInput = document.getElementById('inputSecAuditionCustomRole');
  const addBtn = document.getElementById('btnAddSecAuditionCustomRole');

  const handleAddCustom = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const raw = (customInput?.value || '').trim();
    const formatted = formatRoleTitleCase(raw);
    if (!formatted || formatted.length < 2) {
      customInput?.focus();
      return;
    }
    const newId = `custom-sec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const newCustom = {
      id: newId,
      label: formatted,
      isCustom: true,
      status: 'unassigned',
      assigned: false
    };
    customSecretariatRoles.push(newCustom);
    setSecRoleAudition(newId, true, false);

    const list = document.getElementById('secGmailList');
    if (list) {
      list.innerHTML = renderConferenceAuditionsWorkspace();
      attachConferenceAuditionsEvents(switchTabFn);
      const nextInput = document.getElementById('inputSecAuditionCustomRole');
      nextInput?.focus();
    }
  };

  customInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustom(e);
    }
  });

  addBtn?.addEventListener('click', handleAddCustom);
}

/**
 * In-place switch between Secretariat, Invitations, and Auditions tabs
 */
function switchSecTab(newTab) {
  if (window.__secActiveTab === newTab && !window.__secOpenMailId) return;
  window.__secActiveTab = newTab;
  window.__secOpenMailId = null;

  const tabSec = document.getElementById('btnSecTabSecretariat');
  const tabInv = document.getElementById('btnSecTabInvitations');
  const tabAud = document.getElementById('btnSecTabAuditions');
  const list = document.getElementById('secGmailList');
  const fabBtn = document.getElementById('btnGmailComposeSec');

  if (fabBtn) {
    fabBtn.style.display = newTab === 'auditions' ? 'none' : 'flex';
  }

  if (tabSec && tabInv && tabAud && list) {
    list.classList.toggle('is-auditions-mode', newTab === 'auditions');
    tabSec.classList.toggle('is-active', newTab === 'secretariat');
    tabInv.classList.toggle('is-active', newTab === 'invitations');
    tabAud.classList.toggle('is-active', newTab === 'auditions');

    const assignedPredefined = DEFAULT_SECRETARIAT_ROLES.filter(r => {
      const d = secretariatData[r.id];
      return Boolean(d && d.assigned && d.email && d.email.trim());
    });
    const assignedCustom = customSecretariatRoles.filter(cr => Boolean(cr.email && cr.email.trim()));
    const totalDispatched = assignedPredefined.length + assignedCustom.length;
    const unassignedPredefined = DEFAULT_SECRETARIAT_ROLES.filter(r => {
      const d = secretariatData[r.id];
      return !(d && d.assigned && d.email && d.email.trim());
    });
    const acceptedPredefined = assignedPredefined.filter(r => {
      const d = secretariatData[r.id];
      return d && (d.status || '').toLowerCase() === 'accepted';
    });
    const acceptedCustom = assignedCustom.filter(cr => (cr.status || '').toLowerCase() === 'accepted');
    const totalAccepted = acceptedPredefined.length + acceptedCustom.length;

    if (newTab === 'auditions') {
      list.innerHTML = renderConferenceAuditionsWorkspace();
      attachConferenceAuditionsEvents(switchSecTab);
    } else if (newTab === 'secretariat') {
      list.innerHTML = totalAccepted > 0
        ? `${acceptedPredefined.map(role => renderConfirmedSecretariatRow(secretariatData[role.id], role.id, role.label, false)).join('')}
           ${acceptedCustom.map(cr => renderConfirmedSecretariatRow(cr, cr.id, cr.label, true)).join('')}`
        : `<div class="cc-gmail-empty-state">
            <div class="cc-gmail-empty-icon-wrap"><ion-icon name="people-outline"></ion-icon></div>
            <h4 class="cc-gmail-empty-title">No confirmed secretariat members yet</h4>
            <p class="cc-gmail-empty-desc">When invited members accept their appointment, they will appear here as confirmed secretariat members.</p>
          </div>`;
      attachSecretariatListRowEvents(list);
    } else {
      list.innerHTML = `
        ${totalDispatched > 0 ? `
          <div class="cc-gmail-section-header">
            <span>Dispatched Invitations (${totalDispatched})</span>
          </div>
          ${assignedPredefined.map(role => renderGmailSecretariatRow(secretariatData[role.id], role.id, role.label, false)).join('')}
          ${assignedCustom.map(cr => renderGmailSecretariatRow(cr, cr.id, cr.label, true)).join('')}
        ` : `
          <div class="cc-gmail-empty-state">
            <div class="cc-gmail-empty-icon-wrap">
              <ion-icon name="mail-unread-outline"></ion-icon>
            </div>
            <h4 class="cc-gmail-empty-title">No Secretariat Invitations Sent Yet</h4>
            <p class="cc-gmail-empty-desc">Dispatch an invitation to assign the Secretary-General (SG) and leadership team. Click below or use the floating Compose button.</p>
            <button type="button" class="cc-gmail-empty-compose-btn" id="btnEmptyComposeSec">
              <ion-icon name="create-outline"></ion-icon>
              <span>Compose SG Invitation</span>
            </button>
          </div>
        `}

        ${unassignedPredefined.length > 0 ? `
          <div class="cc-gmail-section-header">
            <span>Available Positions (${unassignedPredefined.length})</span>
          </div>
          ${unassignedPredefined.map(role => renderGmailSecretariatUnassignedRow(role)).join('')}
        ` : ''}
      `;
      attachSecretariatListRowEvents(list);
    }
  } else {
    renderSecretariatDeck();
  }
}

/**
 * Attach card/row click and navigation events
 */
function attachSecretariatEvents() {
  const container = document.getElementById('secretariatDeckContainer');
  if (!container) return;

  // Reading Pane events
  const readPane = document.getElementById('secMailReadPane');
  if (readPane) {
    document.getElementById('btnSecMailReadBack')?.addEventListener('click', () => {
      window.__secOpenMailId = null;
      renderSecretariatDeck();
    });

    readPane.querySelectorAll('.cc-mail-read-delete').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const roleId = btn.dataset.roleId;
        const isCustom = btn.dataset.isCustom === 'true';
        if (confirm('Delete this invitation?')) {
          removeSecretariatInvitation(roleId, isCustom);
          window.__secOpenMailId = null;
          showSecToast('Invitation deleted.');
          renderSecretariatDeck();
        }
      });
    });
    return;
  }

  // Toolbar tab switching: Secretariat, Invitations, Auditions
  document.getElementById('btnSecTabSecretariat')?.addEventListener('click', () => {
    switchSecTab('secretariat');
  });
  document.getElementById('btnSecTabInvitations')?.addEventListener('click', () => {
    switchSecTab('invitations');
  });
  document.getElementById('btnSecTabAuditions')?.addEventListener('click', () => {
    switchSecTab('auditions');
  });

  if (window.__secActiveTab === 'auditions') {
    attachConferenceAuditionsEvents(switchSecTab);
  }

  if (window.__secActiveTab === 'auditions') {
    attachConferenceAuditionsEvents(switchSecTab);
  }

  // Floating Compose Button (#btnGmailComposeSec)
  const fabBtn = document.getElementById('btnGmailComposeSec');
  fabBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const sgData = secretariatData['sg'];
    const hasSG = Boolean(sgData && sgData.assigned && sgData.email && sgData.email.trim());
    if (!hasSG) {
      openSecretariatModal('sg', false);
      return;
    }
    const firstUnassigned = DEFAULT_SECRETARIAT_ROLES.find(r => {
      const d = secretariatData[r.id];
      return !(d && d.assigned && d.email && d.email.trim());
    });
    if (firstUnassigned) {
      openSecretariatModal(firstUnassigned.id, false);
      return;
    }
    openSecretariatModal(null, true);
  });

  // Attach row events for initial render
  const list = document.getElementById('secGmailList');
  if (list) {
    attachSecretariatListRowEvents(list);
  }
}

function attachSecretariatListRowEvents(listContainer) {
  if (!listContainer) return;

  // Empty state compose button
  listContainer.querySelector('#btnEmptyComposeSec')?.addEventListener('click', (e) => {
    e.preventDefault();
    openSecretariatModal('sg', false);
  });

  // Row clicks -> open reading pane for dispatched / confirmed, or modal for unassigned
  listContainer.querySelectorAll('.cc-gmail-row[data-role-id], .cc-sec-role-card[data-role-id], .cc-sec-confirmed-row[data-role-id]').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.cc-gmail-action-btn') || e.target.closest('.cc-sec-invite-trigger-btn') || e.target.closest('.cc-inv-card-action-btn')) return;
      const roleId = row.dataset.roleId;
      const isCustom = row.dataset.isCustom === 'true';
      const isUnassigned = row.classList.contains('is-unassigned');

      if (isUnassigned) {
        if (roleId) openSecretariatModal(roleId, false);
      } else if (roleId) {
        window.__secOpenMailId = roleId;
        renderSecretariatDeck();
      }
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('.cc-gmail-action-btn') || e.target.closest('.cc-sec-invite-trigger-btn') || e.target.closest('.cc-inv-card-action-btn')) return;
        e.preventDefault();
        const roleId = row.dataset.roleId;
        const isCustom = row.dataset.isCustom === 'true';
        const isUnassigned = row.classList.contains('is-unassigned');

        if (isUnassigned) {
          if (roleId) openSecretariatModal(roleId, false);
        } else if (roleId) {
          window.__secOpenMailId = roleId;
          renderSecretariatDeck();
        }
      }
    });
  });

  // Edit buttons
  listContainer.querySelectorAll('.cc-gmail-btn-edit, .cc-inv-card-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const roleId = btn.dataset.roleId;
      const isCustom = btn.dataset.isCustom === 'true';
      if (roleId) {
        openSecretariatModal(roleId, isCustom);
      }
    });
  });

  // Revoke / Delete buttons
  listContainer.querySelectorAll('.cc-gmail-btn-delete, .cc-inv-card-revoke-btn, .cc-inv-btn[data-action="sec-revoke"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const roleId = btn.dataset.roleId;
      const isCustom = btn.dataset.isCustom === 'true';

      if (confirm('Delete this invitation?')) {
        removeSecretariatInvitation(roleId, isCustom);
        showSecToast('Invitation deleted.');
      }
    });
  });

  // Direct click on "Invite" button inside unassigned row
  listContainer.querySelectorAll('.cc-sec-invite-trigger-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const roleId = btn.dataset.roleId;
      if (roleId) {
        openSecretariatModal(roleId, false);
      }
    });
  });
}

/**
 * Select role in Secretariat custom dropdown
 */
function selectSecRole(val, label) {
  const roleInput = document.getElementById('modalSecRoleSelect');
  const triggerLabel = document.getElementById('modalSecRoleTriggerLabel');
  const rolePopover = document.getElementById('modalSecRolePopover');
  const idInput = document.getElementById('modalSecRoleId');
  const isCustomInput = document.getElementById('modalSecIsCustom');
  const customRoleInput = document.getElementById('modalSecCustomRoleInput');

  if (roleInput) roleInput.value = val;
  if (triggerLabel) triggerLabel.textContent = label;
  if (idInput) idInput.value = val;
  if (customRoleInput) customRoleInput.value = label;

  const isCustom = !DEFAULT_SECRETARIAT_ROLES.some(r => r.id === val);
  if (isCustomInput) isCustomInput.value = isCustom ? 'true' : 'false';

  // Update selection highlight and checkmarks
  rolePopover?.querySelectorAll('.cc-eb-role-item').forEach(item => {
    const isSelected = item.dataset.value === val;
    item.classList.toggle('is-selected', isSelected);
    item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    const check = item.querySelector('.cc-eb-role-check');
    if (check) {
      check.classList.toggle('is-hidden', !isSelected);
    }
  });

  // Update subject line and auto-generated invitation message
  const subjInput = document.getElementById('modalSecSubject');
  const rLabel = label || 'Secretariat Member';
  if (subjInput) subjInput.value = buildSecretariatInvitationSubject(rLabel);

  const noteEl = document.getElementById('modalSecNote');
  if (noteEl && noteEl.dataset.autoGenerated === 'true') {
    noteEl.value = buildSecretariatInvitationMessage(currentVerifiedSec, rLabel);
  }
}

/**
 * Render Secretariat Role Popover List
 */
function renderSecRoleDropdown(selectedVal = null) {
  const popover = document.getElementById('modalSecRolePopover');
  if (!popover) return;

  const defaultRolesHtml = DEFAULT_SECRETARIAT_ROLES.map(role => `
    <div class="cc-eb-role-item ${role.id === selectedVal ? 'is-selected' : ''}" data-value="${role.id}" data-label="${escapeHtml(role.label)}" role="option" aria-selected="${role.id === selectedVal}" tabindex="0">
      <span class="cc-eb-role-item-name">${escapeHtml(role.label)}</span>
      <ion-icon name="checkmark-outline" class="cc-eb-role-check ${role.id === selectedVal ? '' : 'is-hidden'}"></ion-icon>
    </div>
  `).join('');

  const customRolesHtml = (customSecretariatRoles || []).map(cr => `
    <div class="cc-eb-role-item ${cr.id === selectedVal ? 'is-selected' : ''}" data-value="${cr.id}" data-label="${escapeHtml(cr.label)}" role="option" aria-selected="${cr.id === selectedVal}" tabindex="0">
      <span class="cc-eb-role-item-name">${escapeHtml(cr.label)}</span>
      <ion-icon name="checkmark-outline" class="cc-eb-role-check ${cr.id === selectedVal ? '' : 'is-hidden'}"></ion-icon>
    </div>
  `).join('');

  const addOptionHtml = `
    <div class="cc-eb-role-item cc-eb-role-item-add" data-value="__add_custom__" data-label="+ Add Custom Role" role="option" aria-selected="false" tabindex="0">
      <span class="cc-eb-role-item-name cc-eb-role-add-name">
        <ion-icon name="add-outline" class="cc-eb-role-add-icon"></ion-icon>
        <span>Add Custom Role</span>
      </span>
    </div>
  `;

  popover.innerHTML = defaultRolesHtml + customRolesHtml + addOptionHtml;
  bindSecRoleItemEvents();
}

function bindSecRoleItemEvents() {
  const popover = document.getElementById('modalSecRolePopover');
  popover?.querySelectorAll('.cc-eb-role-item').forEach(item => {
    if (item.__bound) return;
    item.__bound = true;
    const handleSelect = (e) => {
      e.stopPropagation();
      const val = item.dataset.value;
      const label = item.dataset.label;
      if (val === '__add_custom__') {
        closeSecRoleDropdown();
        openSecCustomRoleModal();
        return;
      }
      selectSecRole(val, label);
      closeSecRoleDropdown();
    };
    item.addEventListener('click', handleSelect);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(e);
      }
    });
  });
}

function openSecRoleDropdown() {
  const roleWrap = document.getElementById('modalSecRoleDropdownWrap');
  const trigger = document.getElementById('modalSecRoleTrigger');
  roleWrap?.classList.add('is-open');
  trigger?.setAttribute('aria-expanded', 'true');
}

function closeSecRoleDropdown() {
  const roleWrap = document.getElementById('modalSecRoleDropdownWrap');
  const trigger = document.getElementById('modalSecRoleTrigger');
  roleWrap?.classList.remove('is-open');
  trigger?.setAttribute('aria-expanded', 'false');
}

function openSecCustomRoleModal() {
  const modal = document.getElementById('secCustomRoleModal');
  const input = document.getElementById('secCustomRoleNameInput');
  const err = document.getElementById('err-secCustomRoleName');
  if (!modal || !input) return;
  input.value = '';
  if (err) err.style.display = 'none';
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('is-open');
    input.focus();
  });
}

function closeSecCustomRoleModal() {
  const modal = document.getElementById('secCustomRoleModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 180);
}

/**
 * Open Secretariat Modal in Add or Edit Mode
 * @param {string|null} roleId
 * @param {boolean} isCustom
 */
function openSecretariatModal(roleId = null, isCustom = false) {
  const modal = document.getElementById('secretariatModal');
  if (!modal) return;

  setupSecretariatModalListeners();

  const titleEl = document.getElementById('secretariatModalTitle');
  const subtitleEl = document.getElementById('secretariatModalSubtitle');
  const emailInput = document.getElementById('modalSecEmail');
  const emailErr = document.getElementById('err-modalSecEmail');
  const noteInput = document.getElementById('modalSecNote');
  const subjInput = document.getElementById('modalSecSubject');
  const btnDelete = document.getElementById('btnDeleteModalSec');
  const submitBtn = document.getElementById('btnSubmitSecretariatModal');
  const submitText = document.getElementById('btnSubmitSecretariatModalText');

  if (emailErr) emailErr.style.display = 'none';
  emailInput?.closest('.cc-field')?.classList.remove('has-error');

  // Determine target role ID
  let targetId = roleId;
  if (!targetId) {
    if (isCustom) {
      targetId = 'custom';
    } else {
      const firstUnassigned = DEFAULT_SECRETARIAT_ROLES.find(r => {
        const d = secretariatData[r.id];
        return !(d && d.assigned && d.email && d.email.trim());
      });
      targetId = firstUnassigned ? firstUnassigned.id : 'sg';
    }
  }

  // Populate dropdown with roles
  renderSecRoleDropdown(targetId);

  // Determine role details
  let resolvedLabel = 'Secretary-General (SG)';
  let roleData = null;
  const isPredefined = DEFAULT_SECRETARIAT_ROLES.some(r => r.id === targetId);

  if (isPredefined) {
    const preRole = DEFAULT_SECRETARIAT_ROLES.find(r => r.id === targetId);
    resolvedLabel = preRole ? preRole.label : targetId;
    roleData = secretariatData[targetId];
  } else {
    const customRole = customSecretariatRoles.find(r => r.id === targetId);
    if (customRole) {
      resolvedLabel = customRole.label;
      roleData = customRole;
    } else {
      resolvedLabel = 'Custom Secretariat Role';
    }
  }

  selectSecRole(targetId, resolvedLabel);

  const isAssigned = Boolean(roleData && roleData.assigned && roleData.email && roleData.email.trim());

  if (isAssigned) {
    // Edit Mode
    if (titleEl) titleEl.textContent = 'Edit Invitation';
    if (subtitleEl) subtitleEl.textContent = `Update invitation for ${resolvedLabel}.`;
    if (submitText) submitText.textContent = 'Save';
    if (submitBtn) {
      submitBtn.setAttribute('title', 'Save');
      submitBtn.setAttribute('aria-label', 'Save');
    }
    if (btnDelete) btnDelete.style.display = 'inline-flex';

    if (subjInput) subjInput.value = buildSecretariatInvitationSubject(resolvedLabel);
    if (emailInput) {
      emailInput.value = roleData.email || '';
      if (roleData.email) {
        updateSecAccountPreview(null, true);
        lookupAccount(roleData.email).then(acc => {
          if (acc) {
            if (roleData.avatar) acc.avatar = roleData.avatar;
            if (roleData.name) acc.name = roleData.name;
            updateSecAccountPreview(acc);
          }
        });
      } else {
        updateSecAccountPreview(null);
      }
    }
    if (noteInput) {
      noteInput.value = roleData.note || buildSecretariatInvitationMessage(currentVerifiedSec, resolvedLabel);
      noteInput.dataset.autoGenerated = roleData.note ? 'false' : 'true';
    }
  } else {
    // New Invitation Mode
    if (titleEl) titleEl.textContent = 'New Invitation';
    if (subtitleEl) subtitleEl.textContent = 'Compose and dispatch an invitation to a registered account.';
    if (submitText) submitText.textContent = 'Send';
    if (submitBtn) {
      submitBtn.setAttribute('title', 'Send');
      submitBtn.setAttribute('aria-label', 'Send');
    }
    if (btnDelete) btnDelete.style.display = 'none';

    if (subjInput) subjInput.value = buildSecretariatInvitationSubject(resolvedLabel);
    if (emailInput) emailInput.value = '';
    if (noteInput) {
      noteInput.value = buildSecretariatInvitationMessage(null, resolvedLabel);
      noteInput.dataset.autoGenerated = 'true';
    }
    updateSecAccountPreview(null);
    currentVerifiedSec = null;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  setTimeout(() => {
    emailInput?.focus();
  }, 100);
}

/**
 * Close Secretariat Modal
 */
function closeSecretariatModal() {
  const modal = document.getElementById('secretariatModal');
  clearTimeout(secLookupTimeout);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  const blueTick = document.getElementById('modalSecBlueTick');
  if (blueTick) {
    blueTick.classList.remove('is-visible');
    blueTick.style.display = 'none';
  }
  const noteInput = document.getElementById('modalSecNote');
  if (noteInput) noteInput.dataset.autoGenerated = 'false';
  updateSecAccountPreview(null);
  closeSecRoleDropdown();
}

/**
 * Setup Secretariat Modal Listeners (once)
 */
function setupSecretariatModalListeners() {
  if (modalListenersAttached) return;
  modalListenersAttached = true;

  const modal = document.getElementById('secretariatModal');
  const form = document.getElementById('secretariatModalForm');
  const btnCloseTop = document.getElementById('btnCancelSecretariatModalTop');
  const btnDelete = document.getElementById('btnDeleteModalSec');
  const roleTrigger = document.getElementById('modalSecRoleTrigger');
  const roleWrap = document.getElementById('modalSecRoleDropdownWrap');

  if (!modal || !form) return;

  // Role Dropdown Toggle
  roleTrigger?.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = roleWrap?.classList.contains('is-open');
    if (isOpen) {
      closeSecRoleDropdown();
    } else {
      openSecRoleDropdown();
    }
  });

  // Close dropdown on click outside
  document.addEventListener('click', e => {
    if (roleWrap && !roleWrap.contains(e.target)) {
      closeSecRoleDropdown();
    }
  });

  // Minimalist Custom Role Modal handlers
  const secCustomModal = document.getElementById('secCustomRoleModal');
  const secCustomForm = document.getElementById('secCustomRoleModalForm');
  const secCustomInput = document.getElementById('secCustomRoleNameInput');
  const secCustomErr = document.getElementById('err-secCustomRoleName');
  const btnCloseSecCustom = document.getElementById('btnCloseSecCustomRoleModal');
  const btnCancelSecCustom = document.getElementById('btnCancelSecCustomRoleModal');

  btnCloseSecCustom?.addEventListener('click', closeSecCustomRoleModal);
  btnCancelSecCustom?.addEventListener('click', closeSecCustomRoleModal);
  secCustomModal?.addEventListener('click', e => {
    if (e.target === secCustomModal) closeSecCustomRoleModal();
  });

  // Strict keyboard filter: block numbers and symbols immediately
  secCustomInput?.addEventListener('keydown', e => {
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'Tab' || e.key === 'Enter' || e.key === 'Home' || e.key === 'End' || e.key === 'Escape') {
      if (e.key === 'Escape') closeSecCustomRoleModal();
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (!/^[a-zA-Z\s-]$/.test(e.key)) {
      e.preventDefault();
    }
  });

  // Input listener: cleans non-letters, automatically capitalizes every word in Title Case
  secCustomInput?.addEventListener('input', () => {
    const formatted = formatRoleTitleCase(secCustomInput.value);
    secCustomInput.value = formatted;
    if (secCustomErr && formatted.trim()) {
      secCustomErr.style.display = 'none';
    }
  });

  // Submit custom role
  const handleSecCustomSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const raw = (secCustomInput?.value || '').trim();
    const formatted = formatRoleTitleCase(raw);
    if (!formatted || formatted.length < 2) {
      if (secCustomErr) {
        secCustomErr.textContent = 'Please enter a valid role title (letters only)';
        secCustomErr.style.display = 'block';
      }
      secCustomInput?.focus();
      return;
    }

    // Add to customSecretariatRoles if not exists
    let roleObj = customSecretariatRoles.find(r => r.label.toLowerCase() === formatted.toLowerCase());
    if (!roleObj) {
      const newId = 'custom_' + formatted.toLowerCase().replace(/[^a-z0-9]/g, '_');
      roleObj = { id: newId, label: formatted, short: formatted, email: '', note: '', assigned: false, status: 'pending' };
      customSecretariatRoles.push(roleObj);
    }

    renderSecRoleDropdown(roleObj.id);
    selectSecRole(roleObj.id, roleObj.label);
    closeSecCustomRoleModal();
  };

  secCustomForm?.addEventListener('submit', handleSecCustomSubmit);
  document.getElementById('btnSaveSecCustomRoleModal')?.addEventListener('click', handleSecCustomSubmit);

  // Close modal
  btnCloseTop?.addEventListener('click', closeSecretariatModal);
  modal.querySelector('.cc-mail-dot-close')?.addEventListener('click', closeSecretariatModal);
  modal.querySelector('.cc-mail-window-close-btn')?.addEventListener('click', closeSecretariatModal);

  // Message body focus & auto-generated tracking
  const noteInput = document.getElementById('modalSecNote');
  noteInput?.addEventListener('input', () => {
    noteInput.dataset.autoGenerated = 'false';
  });
  document.getElementById('f-modalSecNote')?.addEventListener('click', () => {
    noteInput?.focus();
  });

  // Live Email Verification & Details Lookup
  const emailInput = document.getElementById('modalSecEmail');
  const emailErr = document.getElementById('err-modalSecEmail');
  document.getElementById('f-modalSecEmail')?.addEventListener('click', e => {
    if (e.target !== emailInput) {
      emailInput?.focus();
    }
  });
  emailInput?.addEventListener('input', () => {
    const val = (emailInput.value || '').trim();
    clearTimeout(secLookupTimeout);
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      updateSecAccountPreview(null);
      return;
    }

    const currentRoleId = document.getElementById('modalSecRoleId')?.value;
    const existingRole = findExistingRoleForEmail(val, currentRoleId);
    if (existingRole) {
      if (emailErr) {
        emailErr.textContent = `This user already holds a role: ${existingRole}`;
        emailErr.style.display = 'block';
      }
      emailInput.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
      updateSecAccountPreview(null);
      return;
    }

    if (emailErr) {
      emailErr.style.display = 'none';
      emailInput.closest('.cc-field, .cc-mail-row')?.classList.remove('has-error');
    }

    updateSecAccountPreview(null, true);
    secLookupTimeout = setTimeout(async () => {
      const acc = await lookupAccount(val);
      if ((emailInput.value || '').trim().toLowerCase() === (acc?.email || '')) {
        updateSecAccountPreview(acc);
      }
    }, 280);
  });

  emailInput?.addEventListener('change', async () => {
    const val = (emailInput.value || '').trim();
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      clearTimeout(secLookupTimeout);
      const currentRoleId = document.getElementById('modalSecRoleId')?.value;
      const existingRole = findExistingRoleForEmail(val, currentRoleId);
      if (existingRole) {
        if (emailErr) {
          emailErr.textContent = `This user already holds a role: ${existingRole}`;
          emailErr.style.display = 'block';
        }
        emailInput.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
        updateSecAccountPreview(null);
        return;
      }

      updateSecAccountPreview(null, true);
      const acc = await lookupAccount(val);
      if ((emailInput.value || '').trim().toLowerCase() === (acc?.email || '')) {
        updateSecAccountPreview(acc);
      }
    }
  });

  // Backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeSecretariatModal();
    }
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeSecretariatModal();
    }
  });

  // Revoke from modal
  btnDelete?.addEventListener('click', () => {
    const roleId = document.getElementById('modalSecRoleId')?.value;
    const isCustom = document.getElementById('modalSecIsCustom')?.value === 'true';

    if (confirm('Are you sure you want to revoke this invitation?')) {
      removeSecretariatInvitation(roleId, isCustom);
      showSecToast('Invitation revoked.');
      closeSecretariatModal();
    }
  });

  // Submit modal form logic
  async function handleSecretariatFormSubmit() {
    const roleId = document.getElementById('modalSecRoleId')?.value;
    const isCustom = document.getElementById('modalSecIsCustom')?.value === 'true';
    const customRoleInput = document.getElementById('modalSecCustomRoleInput');
    const errCustomRole = document.getElementById('err-modalSecCustomRole');
    const emailInput = document.getElementById('modalSecEmail');
    const emailErr = document.getElementById('err-modalSecEmail');
    const noteInput = document.getElementById('modalSecNote');
    const submitBtn = document.getElementById('btnSubmitSecretariatModal');
    const submitText = document.getElementById('btnSubmitSecretariatModalText');

    // Validate Custom Role Title if custom
    let customLabel = '';
    if (isCustom) {
      customLabel = (customRoleInput?.value || document.getElementById('modalSecRoleTriggerLabel')?.textContent || '').trim();
      if (!customLabel) {
        if (errCustomRole) errCustomRole.style.display = 'block';
        return;
      }
      if (errCustomRole) errCustomRole.style.display = 'none';
      if (customRoleInput) customRoleInput.value = customLabel;
    }

    // Validate Email
    const emailVal = (emailInput?.value || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailRegex.test(emailVal)) {
      if (emailErr) {
        emailErr.textContent = 'Please enter a valid registered email address';
        emailErr.style.display = 'block';
      }
      emailInput?.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
      emailInput?.focus();
      return;
    }

    const currentRoleId = document.getElementById('modalSecRoleId')?.value;
    const existingRole = findExistingRoleForEmail(emailVal, currentRoleId);
    if (existingRole) {
      if (emailErr) {
        emailErr.textContent = `Cannot assign double roles: This user already holds a role (${existingRole})`;
        emailErr.style.display = 'block';
      }
      emailInput?.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
      emailInput?.focus();
      showSecToast(`Cannot assign double roles: This user already holds a role (${existingRole})`, 'error');
      return;
    }

    if (emailErr) emailErr.style.display = 'none';
    emailInput?.closest('.cc-field, .cc-mail-row')?.classList.remove('has-error');

    // Quick lookup if verification hasn't finished
    if (!currentVerifiedSec) {
      try {
        const acc = await lookupAccount(emailVal);
        if (acc) currentVerifiedSec = acc;
      } catch (e) { }
    }

    const noteVal = (noteInput?.value || '').trim();
    const verifiedName = currentVerifiedSec?.name || formatDisplayNameFromEmail(emailVal);
    const verifiedAvatar = currentVerifiedSec?.avatar || null;
    const verifiedHandle = currentVerifiedSec?.handle || emailVal.split('@')[0];

    // Extract Subject line
    const subjInput = document.getElementById('modalSecSubject');
    const roleTitleForSubject = isCustom ? customLabel : (secretariatData[roleId]?.label || 'Secretariat Member');
    const subjectVal = (subjInput?.value || '').trim() || buildSecretariatInvitationSubject(roleTitleForSubject);

    // Visual button feedback
    const originalText = submitText?.textContent || 'Send';
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = (roleId && isCustom) ? 'Saving...' : 'Sending...';

    try {
      if (isCustom) {
        if (roleId) {
          // Update existing custom role
          const target = customSecretariatRoles.find(r => r.id === roleId);
          if (target) {
            target.label = customLabel;
            target.email = emailVal;
            target.name = verifiedName;
            target.avatar = verifiedAvatar;
            target.handle = verifiedHandle;
            target.note = noteVal;
            target.invitedAt = new Date().toISOString();
          }
          // Automatically close audition for this role if it was open
          setSecRoleAudition(roleId, false, false);
          await dispatchInvitationRecord({
            id: roleId,
            roleId,
            roleLabel: customLabel,
            subject: subjectVal,
            recipientEmail: emailVal,
            recipientUid: currentVerifiedSec?.uid || null,
            recipientName: verifiedName,
            recipientAvatar: verifiedAvatar,
            roleType: 'secretariat',
            note: noteVal,
            invitedAt: new Date().toISOString()
          });
          showSecToast(`Web invitation dispatched to ${verifiedName} (${emailVal})! It has arrived in their conference inbox.`);
        } else {
          // Add new custom role
          const newSec = {
            id: `custom-sec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            label: customLabel,
            email: emailVal,
            uid: currentVerifiedSec?.uid || null,
            name: verifiedName,
            avatar: verifiedAvatar,
            handle: verifiedHandle,
            note: noteVal,
            status: 'pending',
            isCustom: true,
            assigned: true,
            invitedAt: new Date().toISOString()
          };
          customSecretariatRoles.push(newSec);
          // Automatically close audition for this role if it was open
          setSecRoleAudition(newSec.id, false, false);
          await dispatchInvitationRecord({
            id: newSec.id,
            roleId: newSec.id,
            roleLabel: customLabel,
            subject: subjectVal,
            recipientEmail: emailVal,
            recipientUid: currentVerifiedSec?.uid || null,
            recipientName: verifiedName,
            recipientAvatar: verifiedAvatar,
            roleType: 'secretariat',
            note: noteVal,
            invitedAt: newSec.invitedAt
          });
          showSecToast(`Web invitation dispatched to ${verifiedName} (${emailVal})! It has arrived in their conference inbox.`);
        }
      } else {
        // Predefined role
        if (secretariatData[roleId]) {
          secretariatData[roleId].email = emailVal;
          secretariatData[roleId].uid = currentVerifiedSec?.uid || null;
          secretariatData[roleId].name = verifiedName;
          secretariatData[roleId].avatar = verifiedAvatar;
          secretariatData[roleId].handle = verifiedHandle;
          secretariatData[roleId].note = noteVal;
          secretariatData[roleId].assigned = true;
          secretariatData[roleId].status = 'pending';
          secretariatData[roleId].invitedAt = new Date().toISOString();
          // Automatically close audition for this role if it was open
          setSecRoleAudition(roleId, false, false);
          await dispatchInvitationRecord({
            id: `sec-inv-${roleId}`,
            roleId,
            roleLabel: secretariatData[roleId].label,
            subject: subjectVal,
            recipientEmail: emailVal,
            recipientUid: currentVerifiedSec?.uid || null,
            recipientName: verifiedName,
            recipientAvatar: verifiedAvatar,
            roleType: 'secretariat',
            note: noteVal,
            invitedAt: secretariatData[roleId].invitedAt
          });
          showSecToast(`Web invitation dispatched to ${verifiedName} (${emailVal})! It has arrived in their conference inbox.`);
        }
      }

      // Synchronously sync to global wizardData and localStorage draft
      window.__wizardData = window.__wizardData || {};
      window.__wizardData.secretariat = { ...getStep6Data().secretariat };
      try {
        const raw = localStorage.getItem('cc_conference_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          draft.data = draft.data || {};
          draft.data.secretariat = { ...getStep6Data().secretariat };
          draft.updatedAt = new Date().toISOString();
          localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
        }
      } catch (e) { }

      renderSecretariatDeck();
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
      closeSecretariatModal();
    } catch (submitErr) {
      console.error('Failed to dispatch secretariat invitation:', submitErr);
      showSecToast('Invitation registered locally.', 'info');
      window.__wizardData = window.__wizardData || {};
      window.__wizardData.secretariat = { ...getStep6Data().secretariat };
      try {
        const raw = localStorage.getItem('cc_conference_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          draft.data = draft.data || {};
          draft.data.secretariat = { ...getStep6Data().secretariat };
          draft.updatedAt = new Date().toISOString();
          localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
        }
      } catch (e) { }
      renderSecretariatDeck();
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
      closeSecretariatModal();
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.textContent = originalText;
    }
  }

  // Attach submit listeners to both form and direct button click
  const doSubmit = e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    handleSecretariatFormSubmit();
  };

  form.addEventListener('submit', doSubmit);
  const submitBtnEl = document.getElementById('btnSubmitSecretariatModal');
  submitBtnEl?.addEventListener('click', doSubmit);
}
