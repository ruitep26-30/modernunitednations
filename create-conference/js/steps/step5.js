/**
 * Step 5 - Executive Board & Chairs (Invitation-Based Architecture)
 * Unified Workspace Interface:
 * - Left Sidebar: 2x2 grid of committees (no scroll, compact cards hugging logo & abbreviation in Poppins Medium)
 * - Right Main Workspace:
 *   - Committee Header: Logo, short code in Poppins Medium, full committee name,
 *     invited executive count, and "+ Invite Executive" button linking to the modal.
 *   - Main Deck: Role cards for invited executives showing Role Title, Invited Account Email,
 *     "Pending Invitation" status badge, Resend and Revoke actions, and "+ Invite Executive" dashed card.
 *   - Executive Modal: Comprehensive role invitation modal with role dropdown (Chairperson, Vice Chair, etc.
 *     or Custom Role), Registered Account Email input, and optional invitation message.
 */

import { R2_CONFIG } from '../r2-config.js';
import { isWideCommittee, getCommitteeIcon, formatCategory } from './step2.js';
import { db, auth, onAuthStateChanged, doc, getDoc, collection, query, where, getDocs, limit, getSession, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from '../../../js/firebase-config.js';
import {
  isAuditionsOpen,
  isCommitteeAuditionOpen,
  setCommitteeAudition,
  setAllCommitteesAuditions,
  promptAuditionsModal,
  getRoleSelectedExecutive,
  getCommitteeDaisRoles,
  isRoleAuditionOpen,
  setRoleAudition,
  addCustomCommitteeRole,
  deleteCustomCommitteeRole
} from '../auditions-modal.js';
import {
  dispatchLiveInvitation,
  revokeLiveInvitation,
  listenLiveConferenceInvitations,
  setLiveRoleAudition
} from '../../../js/realtime-sync.js';

/**
 * Deeply sanitize payloads for Firestore (removes undefined values to prevent crashes)
 */
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

let selectedCommittees = [];
let ebRolesData = {};
let activeCommitteeIndex = 0;
let modalListenersAttached = false;
let currentVerifiedExec = null;
let execLookupTimeout = null;

const AVAILABLE_ROLES = [
  { id: 'chair', label: 'Chairperson' },
  { id: 'vice-chair', label: 'Vice Chair' },
  { id: 'rapporteur', label: 'Rapporteur' },
  { id: 'director', label: 'Director' },
  { id: 'moderator', label: 'Moderator' },
  { id: 'crisis-director', label: 'Crisis Director' },
  { id: 'assistant-director', label: 'Assistant Director' },
  { id: 'under-secretary-general', label: 'Under-Secretary-General' },
  { id: 'deputy-secretary-general', label: 'Deputy Secretary-General' },
  { id: 'president', label: 'President' },
  { id: 'vice-president', label: 'Vice President' },
  { id: 'legal-counsel', label: 'Legal Counsel' },
  { id: 'special-advisor', label: 'Special Advisor' }
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
 * Format clean display name from email ( john.doe@gmail.com -> John Doe)
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
 * Builds the comprehensive, official executive board invitation letter
 */
function buildExecutiveInvitationMessage(account, roleLabel, commFullName) {
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
  const committee = commFullName || 'the committee';
  const role = roleLabel || 'Executive Board Member';

  return `Dear ${inviteeName},

On behalf of the Secretariat and Organizing Committee of ${confName}, we are pleased to invite you to serve as ${role} for ${committee}.

${confName} will be hosted by ${organizer} on ${dates} at ${venue}.

Given your leadership and diplomatic acumen, we believe your guidance from the dais will ensure high-level debate, foster rigorous engagement, and uphold the highest academic standards of committee deliberations. As a presiding officer, you will play an integral role in directing proceedings and mentoring participating delegates.

Please confirm your acceptance of this appointment through your Modern United Nations portal so we may finalize dais appointments and grant you administrative access to committee materials.

Warm regards,
${organizer} Secretariat
${confName}`;
}

/**
 * Builds the official executive invitation email subject line
 */
function buildExecutiveInvitationSubject(roleLabel, commCode, commName) {
  const role = roleLabel || 'Executive Board Member';
  const comm = (commName && commName !== commCode) ? `${commName} (${commCode})` : (commCode || 'Committee');
  const confCtx = getDraftConferenceContext();
  const confName = confCtx.title || 'Modern United Nations';
  return `Invitation: ${role} for ${comm} – ${confName}`;
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
      if (draftData.confId) confId = draftData.confId;
    }
  } catch (e) { }

  if (!confId && window.__wizardData) {
    confId = window.__wizardData.confId || window.__wizardData.id || '';
  }

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

  // Resilient multi-layer fallbacks for draft organizer identification
  if (!senderUid) {
    senderUid = draftData.organizerUid || draftData.draftOwnerUid || draftData.userId ||
      localStorage.getItem('mun_cloud_draft_uid') || localStorage.getItem('mun_user_uid') || '';
  }
  if (!senderEmail) {
    senderEmail = draftData.organizerEmail || draftData.ownerEmail ||
      localStorage.getItem('mun_user_email') || '';
  }
  if (!senderName) {
    senderName = draftData.organizerName || draftData.ownerName ||
      localStorage.getItem('mun_user_name') || (senderEmail ? senderEmail.split('@')[0] : '');
  }
  if (!senderAvatar) {
    senderAvatar = draftData.organizerAvatar || draftData.ownerAvatar ||
      localStorage.getItem('mun_user_avatar') || null;
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
 * Dispatches an executive invitation record immediately to local storage and Firestore
 * so the invitee can see it on their home screen even while the conference is in draft steps.
 */
async function dispatchInvitationRecord(inv) {
  if (!inv || !inv.recipientEmail) return;
  const ctx = getDraftConferenceContext();
  const cleanEmail = inv.recipientEmail.toLowerCase().trim();

  // Strip multi-megabyte base64 images to prevent Firestore 1MB document size limit failures
  const safeLogoUrl = (ctx.logoUrl && ctx.logoUrl.startsWith('data:image/') && ctx.logoUrl.length > 2048)
    ? ''
    : (ctx.logoUrl || '');

  const safeRecipientAvatar = (inv.recipientAvatar && inv.recipientAvatar.startsWith('data:image/') && inv.recipientAvatar.length > 2048)
    ? null
    : (inv.recipientAvatar || null);

  const safeSenderAvatar = (ctx.senderAvatar && ctx.senderAvatar.startsWith('data:image/') && ctx.senderAvatar.length > 2048)
    ? null
    : (ctx.senderAvatar || null);

  const invId = inv.id && (inv.id.startsWith('inv_eb_') || inv.id.startsWith('exec-inv-'))
    ? inv.id
    : `inv_eb_${ctx.confId}_${inv.committeeCode || 'eb'}_${inv.roleId || 'exec'}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const safeId = String(invId).replace(/\//g, '_');

  const recipientUid = inv.recipientUid || currentVerifiedExec?.uid || null;

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
    roleType: 'executive',
    roleId: inv.roleId || 'chair',
    roleLabel: inv.roleLabel || 'Chairperson',
    subject: inv.subject || buildExecutiveInvitationSubject(inv.roleLabel || 'Chairperson', inv.committeeCode, inv.committeeName),
    committeeCode: inv.committeeCode || null,
    committeeName: inv.committeeName || null,
    status: 'pending',
    invitedAt: inv.invitedAt || new Date().toISOString(),
    createdAt: inv.invitedAt || new Date().toISOString(),
    isDraftConference: true,
    note: inv.note || '',
    draftConferenceData: {
      id: ctx.confId,
      confId: ctx.confId,
      title: ctx.title,
      institution: ctx.institution,
      dates: ctx.dates,
      venue: ctx.venue,
      logoUrl: safeLogoUrl,
      committees: Array.isArray(ctx.draftData.committees)
        ? ctx.draftData.committees.map(c => typeof c === 'string' ? c : (c.code || c.name || ''))
        : (inv.committeeCode ? [inv.committeeCode] : ['DISEC']),
      description: ctx.draftData.description || '',
      ebRoles: { ...ebRolesData },
      connectedExecutives: [],
      connectedExecutiveUids: [],
      organizerUid: ctx.senderUid || '',
      draftOwnerUid: ctx.senderUid || '',
      userId: ctx.senderUid || '',
      isDraft: true,
      status: 'draft'
    }
  };

  // 1. Dispatch over Realtime Database with sub-30ms sync and Firestore dual-write
  try {
    await dispatchLiveInvitation(record);
  } catch (err) {
    console.warn('[Invitations] Live sync dispatch notice:', err);
  }
}

/**
 * Completely revokes an executive's access to the committee & conference:
 * 1. Removes from local storage `mun_local_invitations`
 * 2. Purges from local `mun_accepted_conferences` if stored locally
 * 3. Removes from Cloud Firestore `conferences/{confId}` (connectedExecutives & connectedExecutiveUids)
 * 4. Removes from Cloud Firestore organizer's cloud draft `conference_drafts/{organizerUid}`
 * 5. Permanently deletes/revokes from Cloud Firestore `conferenceInvitations`
 * 6. Broadcasts revocation across BroadcastChannel and window events
 */
async function revokeInvitationRecord(execId, commCode, targetExec) {
  const ctx = getDraftConferenceContext();
  const execEmail = (targetExec?.email || targetExec?.recipientEmail || '').trim().toLowerCase();
  const execUid = targetExec?.acceptedUid || targetExec?.uid || targetExec?.recipientUid || null;
  const execRoleLabel = targetExec?.roleLabel || '';
  const nowIso = new Date().toISOString();

  // 1. Remove from local storage `mun_local_invitations`
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const filtered = stored.filter(item => {
      if (!item) return false;
      const sameConf = item.confId === ctx.confId;
      const itemEmail = (item.recipientEmail || item.email || '').trim().toLowerCase();
      const matchesExec = !execId || item.id === execId || item.roleId === execId || (execEmail && itemEmail === execEmail);
      const sameRole = item.roleType === 'executive' && (item.committeeCode === commCode || !commCode);
      return !(sameConf && matchesExec && sameRole);
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
          if (!commCode || (c.acceptedRole && c.acceptedRole.committeeCode === commCode)) {
            return false;
          }
        }
        return true;
      });
      localStorage.setItem('mun_accepted_conferences', JSON.stringify(filtered));
    }
  } catch (e) { }

  // 3. Revoke access from Cloud Firestore `conferences/{confId}` if conference exists in Firestore
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
          if (execUid && eUid === execUid && (!commCode || e.committeeCode === commCode)) return false;
          if (execEmail && eEmail === execEmail && (!commCode || e.committeeCode === commCode)) return false;
          if (commCode && e.committeeCode === commCode && (!execRoleLabel || e.roleLabel === execRoleLabel)) return false;
          return true;
        });
        const newUids = currentUids.filter(uid => {
          if (execUid && uid === execUid) return false;
          return true;
        });
        await updateDoc(confRef, {
          connectedExecutives: newExecs,
          connectedExecutiveUids: newUids,
          updatedAt: nowIso
        }).catch(() => { });
        console.log('[Revoke] Removed executive from conferences document:', ctx.confId);
      }
    } catch (confErr) {
      console.warn('[Revoke] Conference doc update note:', confErr);
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
        if (draftData.data?.ebRoles?.[commCode]) {
          draftData.data.ebRoles[commCode] = draftData.data.ebRoles[commCode].filter(x => {
            const xEmail = (x.email || x.recipientEmail || '').trim().toLowerCase();
            if (x.id === execId || (execEmail && xEmail === execEmail)) return false;
            return true;
          });
          draftData.updatedAt = nowIso;
          draftData.timestamp = Date.now();
          await setDoc(dRef, draftData, { merge: true }).catch(() => { });
          console.log('[Revoke] Removed executive from organizer cloud draft:', orgUid);
        }
      }
    } catch (dErr) {
      console.warn('[Revoke] Cloud draft update note:', dErr);
    }
  }

  // 5. Permanently revoke from Realtime Database and Firestore
  try {
    await revokeLiveInvitation(execId, ctx.confId, commCode, execEmail);
    if (db && collection && query && where && getDocs && deleteDoc) {
      const q = query(
        collection(db, 'conferenceInvitations'),
        where('confId', '==', ctx.confId),
        where('roleType', '==', 'executive'),
        where('committeeCode', '==', commCode)
      );
      const snap = await getDocs(q);
      const deletes = [];
      snap.forEach(dSnap => {
        const dData = dSnap.data();
        const dEmail = (dData.recipientEmail || dData.email || '').trim().toLowerCase();
        if (!execId || dSnap.id === execId || (execEmail && dEmail === execEmail)) {
          deletes.push(deleteDoc(doc(db, 'conferenceInvitations', dSnap.id)).catch(() => { }));
        }
      });
      await Promise.all(deletes);
    }
  } catch (err) { }

  // 6. Broadcast revocation across all open tabs & windows
  const revokePayload = {
    action: 'revoked',
    status: 'revoked',
    type: 'invitation_revoked',
    confId: ctx.confId,
    invId: execId,
    commCode: commCode,
    committeeCode: commCode,
    recipientEmail: execEmail,
    recipientUid: execUid,
    roleType: 'executive',
    roleLabel: execRoleLabel,
    timestamp: Date.now()
  };
  try {
    safePostBroadcast('mun_invitations_channel', revokePayload);
  } catch (e) { }
  window.dispatchEvent(new CustomEvent('mun:invitation-revoked', { detail: revokePayload }));
  window.dispatchEvent(new CustomEvent('mun:invitation-dispatched', { detail: revokePayload }));
}

/**
 * Check if an email already holds any assigned or invited role in this conference
 * (Prevents assigning double roles to the same email address)
 */
function findExistingRoleForEmail(email, excludeId = null) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Check Executive Board roles across all committees in memory
  if (typeof ebRolesData === 'object' && ebRolesData) {
    for (const [commCode, list] of Object.entries(ebRolesData)) {
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

  // Also check draft storage for EB roles
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

  // 2. Check Secretariat roles (predefined and custom)
  try {
    const rawDraft = localStorage.getItem('cc_conference_draft');
    if (rawDraft) {
      const draft = JSON.parse(rawDraft);
      const prevSec = draft.data?.secretariat || {};
      for (const [k, sec] of Object.entries(prevSec)) {
        if (sec && sec.id !== excludeId && k !== excludeId && (sec.email || '').trim().toLowerCase() === cleanEmail) {
          return `Secretariat (${sec.label || 'Member'})`;
        }
      }
      const prevCustom = draft.data?.customSecretariatRoles || [];
      if (Array.isArray(prevCustom)) {
        for (const cr of prevCustom) {
          if (cr && cr.id !== excludeId && (cr.email || '').trim().toLowerCase() === cleanEmail) {
            return `Secretariat (${cr.label || cr.title || 'Custom Role'})`;
          }
        }
      }
    }
  } catch (e) { }

  // 3. Check mun_local_invitations for active invitations in this conference
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
 * Update the real-time verified account blue tick, avatar chip, and personalized invitation message
 */
function updateExecAccountPreview(account, isVerifying = false) {
  const blueTick = document.getElementById('modalExecBlueTick');
  const avatarImg = document.getElementById('modalExecAvatarImg');
  const noteEl = document.getElementById('modalExecNote');

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

  if (!account) {
    if (blueTick) {
      blueTick.classList.remove('is-visible');
      blueTick.style.display = 'none';
    }
    if (avatarImg) {
      avatarImg.style.display = 'none';
      avatarImg.src = '';
    }
    currentVerifiedExec = null;
    if (noteEl && noteEl.dataset.autoGenerated === 'true') {
      const commFullName = document.getElementById('modalExecCommFullName')?.textContent?.trim() || 'the committee';
      const roleVal = document.getElementById('modalExecRoleSelect')?.value;
      const roleLabel = roleVal === 'custom'
        ? (document.getElementById('modalCustomRoleInput')?.value?.trim() || 'Executive Member')
        : (document.getElementById('modalRoleTriggerLabel')?.textContent?.trim() || 'Chairperson');
      noteEl.value = buildExecutiveInvitationMessage(null, roleLabel, commFullName);
    }
    return;
  }

  currentVerifiedExec = account;
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

  // Auto-populate comprehensive personalized invitation message if empty or previously auto-generated
  if (noteEl && (!noteEl.value.trim() || noteEl.dataset.autoGenerated === 'true')) {
    const commFullName = document.getElementById('modalExecCommFullName')?.textContent?.trim() || 'the committee';
    const roleVal = document.getElementById('modalExecRoleSelect')?.value;
    const roleLabel = roleVal === 'custom'
      ? (document.getElementById('modalCustomRoleInput')?.value?.trim() || 'Executive Member')
      : (document.getElementById('modalRoleTriggerLabel')?.textContent?.trim() || 'Chairperson');

    noteEl.value = buildExecutiveInvitationMessage(account, roleLabel, commFullName);
    noteEl.dataset.autoGenerated = 'true';
  }
}

/**
 * Toast Notification for Invitation feedback
 */
function showInvitationToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('wizard:toast', {
    detail: { message, type }
  }));
}

/**
 * Initialize Step 5
 */
export async function initStep5(existingData = {}) {
  // Normalize selected committees from Step 2 with robust fallback
  let rawCommittees = existingData.committees || (window.__wizardData && window.__wizardData.committees) || [];
  if (!Array.isArray(rawCommittees) || rawCommittees.length === 0) {
    try {
      const rawDraft = localStorage.getItem('cc_conference_draft');
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed.data && Array.isArray(parsed.data.committees) && parsed.data.committees.length > 0) {
          rawCommittees = parsed.data.committees;
        }
      }
    } catch (e) { }
  }
  if (!Array.isArray(rawCommittees) || rawCommittees.length === 0) {
    rawCommittees = [
      { code: 'UNSC', name: 'United Nations Security Council', category: 'unga', isCustom: false }
    ];
  }
  selectedCommittees = rawCommittees.map(item => {
    const obj = typeof item === 'string'
      ? { code: item, name: item, category: 'unga', isCustom: false }
      : { ...item };
    const cCode = (obj.code || '').toUpperCase().trim();
    obj.auditionsOpen = isCommitteeAuditionOpen(cCode, true);
    return obj;
  });

  // Restore or init EB roles data as role invitations with multi-tier fallback
  ebRolesData = {};
  let prevEbRoles = existingData.ebRoles || (window.__wizardData && window.__wizardData.ebRoles) || {};

  if (!prevEbRoles || Object.keys(prevEbRoles).length === 0) {
    try {
      const rawDraft = localStorage.getItem('cc_conference_draft');
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (parsed.data?.ebRoles && Object.keys(parsed.data.ebRoles).length > 0) {
          prevEbRoles = parsed.data.ebRoles;
        }
      }
    } catch (e) { }
  }

  // Merge any active executive invitations dispatched for this conference from local storage
  try {
    const ctx = getDraftConferenceContext();
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    const confInvs = stored.filter(item =>
      item &&
      (item.confId === ctx.confId || (ctx.senderUid && item.organizerUid === ctx.senderUid) || (ctx.senderEmail && item.organizerEmail === ctx.senderEmail)) &&
      item.roleType === 'executive' &&
      item.status !== 'revoked' &&
      item.status !== 'deleted' &&
      Boolean(item.status)
    );
    confInvs.forEach(inv => {
      const cCode = (inv.committeeCode || (selectedCommittees[0] ? selectedCommittees[0].code : 'UNSC')).toUpperCase().trim();
      if (!prevEbRoles[cCode]) prevEbRoles[cCode] = [];
      const existing = prevEbRoles[cCode].find(ex =>
        (ex.id && inv.id && ex.id === inv.id) ||
        ((ex.email || '').trim().toLowerCase() === (inv.recipientEmail || '').trim().toLowerCase())
      );
      if (existing) {
        if (inv.status === 'accepted') {
          existing.status = 'accepted';
          if (inv.acceptedUid) existing.acceptedUid = inv.acceptedUid;
        } else if (existing.status !== 'accepted') {
          existing.status = inv.status;
        }
        if (inv.recipientName) existing.name = inv.recipientName;
        if (inv.recipientAvatar) existing.avatar = inv.recipientAvatar;
        if (inv.roleLabel) existing.roleLabel = inv.roleLabel;
      } else {
        prevEbRoles[cCode].push({
          id: inv.id,
          roleId: inv.roleId || 'chair',
          roleLabel: inv.roleLabel || 'Chairperson',
          email: inv.recipientEmail,
          name: inv.recipientName || '',
          avatar: inv.recipientAvatar || '',
          handle: inv.recipientName || '',
          subject: inv.subject || '',
          note: inv.note || '',
          status: inv.status || 'pending',
          acceptedUid: inv.acceptedUid || null,
          invitedAt: inv.invitedAt || new Date().toISOString()
        });
      }
    });
  } catch (e) { }

  selectedCommittees.forEach(comm => {
    const rawList = prevEbRoles[comm.code] || prevEbRoles[comm.code.toUpperCase()] || [];
    if (Array.isArray(rawList)) {
      ebRolesData[comm.code] = rawList.map(item => ({
        id: item.id || `exec-inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        roleId: item.roleId || 'chair',
        roleLabel: (item.roleLabel === 'Chair' || !item.roleLabel) ? 'Chairperson' : item.roleLabel,
        icon: item.icon || 'ribbon-outline',
        email: item.email || item.recipientEmail || '',
        name: item.name || '',
        avatar: item.avatar || '',
        handle: item.handle || '',
        subject: item.subject || '',
        note: item.note || '',
        status: item.status || 'pending',
        acceptedUid: item.acceptedUid || null,
        invitedAt: item.invitedAt || new Date().toISOString()
      })).filter(x => Boolean(x.email && x.email.trim() && x.status !== 'revoked' && x.status !== 'deleted'));
    } else {
      ebRolesData[comm.code] = [];
    }
  });

  // Clamp active index
  if (activeCommitteeIndex >= selectedCommittees.length) {
    activeCommitteeIndex = Math.max(0, selectedCommittees.length - 1);
  }

  document.body.classList.add('cc-step5-active');
  window.__ebOpenMailId = null;
  setupExecutiveModalListeners();
  renderExecutiveWorkspace();
  listenForConferenceInvitations();
  window.addEventListener('resize', syncExecutiveScrollHeight);
}

/**
 * Cleanup Step 5
 */
export function cleanupStep5() {
  document.body.classList.remove('cc-step5-active');
  window.__ebOpenMailId = null;
  window.removeEventListener('resize', syncExecutiveScrollHeight);
  closeExecutiveModal();
  modalListenersAttached = false;
  if (unsubscribeEbRtdb) {
    try { unsubscribeEbRtdb(); } catch (e) {}
    unsubscribeEbRtdb = null;
  }
  if (unsubscribeEbInvitations) {
    try { unsubscribeEbInvitations(); } catch (e) {}
    unsubscribeEbInvitations = null;
  }
  if (unsubscribeEbDraft) {
    try { unsubscribeEbDraft(); } catch (e) {}
    unsubscribeEbDraft = null;
  }
}

/**
 * Get Step 5 Data
 */
export function getStep5Data() {
  return {
    ebRoles: { ...ebRolesData },
    ebAuditionsOpen: isAuditionsOpen(),
    committeeAuditions: { ...(window.__committeeAuditions || {}) }
  };
}

/**
 * Validate Step 5
 */
export function validateStep5(showErrors = false) {
  if (selectedCommittees.length === 0) {
    if (showErrors) {
      showInvitationToast('Please select committees in Step 2 before assigning executive board members.', 'error');
    }
    return false;
  }

  let totalExecCount = 0;
  for (let i = 0; i < selectedCommittees.length; i++) {
    const comm = selectedCommittees[i];
    const execs = ebRolesData[comm.code] || [];
    const validExecs = Array.isArray(execs) ? execs.filter(ex => ex && ex.email && ex.email.trim() && ex.status !== 'revoked' && ex.status !== 'deleted') : [];
    totalExecCount += validExecs.length;
  }

  // If at least one executive member is invited, validation succeeds
  if (totalExecCount > 0) {
    return true;
  }

  // If auditions are already enabled, user can proceed without invited executives
  if (isAuditionsOpen()) {
    return true;
  }

  // If no executive has been added and auditions are closed, prompt modal alert to turn on auditions accessibility
  if (showErrors) {
    promptAuditionsModal({
      title: 'Turn On Auditions for Committees?',
      subtitle: 'No Executive Board members have been invited yet.',
      description: 'Turning on Auditions Accessibility allows executive chairs and candidates across Modern MUN to discover and apply for your summit’s committees.',
      confirmText: 'Turn On Auditions & Continue',
      skipText: 'Continue to Secretariat',
      onConfirm: () => {
        setAllCommitteesAuditions(selectedCommittees, true);
        window.dispatchEvent(new CustomEvent('wizard:force-next'));
      },
      onSkip: () => {
        window.dispatchEvent(new CustomEvent('wizard:force-next'));
      }
    });
  }

  return false;
}

/**
 * Sync status of invitations from local storage (e.g. accepted in notifications or home)
 */
function syncStatusFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
    if (!Array.isArray(stored) || stored.length === 0) return;
    let hasChanged = false;
    let storageChanged = false;
    const ctx = getDraftConferenceContext();

    stored.forEach(inv => {
      if (!inv || !inv.status) return;
      if (inv.confId && ctx.confId && inv.confId !== ctx.confId) {
        const isOrganizerMatch = (ctx.senderUid && inv.organizerUid && ctx.senderUid === inv.organizerUid) ||
                                (ctx.senderEmail && inv.organizerEmail && ctx.senderEmail === inv.organizerEmail);
        const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();
        let emailExistsInRoles = false;
        if (invEmail) {
          for (const list of Object.values(ebRolesData)) {
            if (Array.isArray(list) && list.some(x => (x.email || x.recipientEmail || '').trim().toLowerCase() === invEmail)) {
              emailExistsInRoles = true;
              break;
            }
          }
        }
        if (!isOrganizerMatch && !emailExistsInRoles) return;
      }

      const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();
      let matched = false;

      // Search through ALL committees in ebRolesData
      for (const [cCode, list] of Object.entries(ebRolesData)) {
        if (!Array.isArray(list)) continue;
        list.forEach(item => {
          const itemEmail = (item.email || item.recipientEmail || '').trim().toLowerCase();
          const isMatch = (item.id && inv.id && item.id === inv.id) ||
                          (invEmail && itemEmail && invEmail === itemEmail);
          if (isMatch) {
            matched = true;
            // CRITICAL: Prevent downgrading 'accepted' back to 'pending'
            if (item.status === 'accepted' && inv.status === 'pending') {
              inv.status = 'accepted';
              if (item.acceptedUid && !inv.acceptedUid) inv.acceptedUid = item.acceptedUid;
              if (item.name && !inv.recipientName) inv.recipientName = item.name;
              if (item.avatar && !inv.recipientAvatar) inv.recipientAvatar = item.avatar;
              storageChanged = true;
            } else if (inv.status === 'accepted' && item.status !== 'accepted') {
              item.status = 'accepted';
              if (inv.recipientName) item.name = inv.recipientName;
              if (inv.acceptedName) item.name = inv.acceptedName;
              if (inv.recipientAvatar) item.avatar = inv.recipientAvatar;
              if (inv.acceptedAvatar) item.avatar = inv.acceptedAvatar;
              if (inv.acceptedUid) item.acceptedUid = inv.acceptedUid;
              hasChanged = true;
            } else if ((inv.status === 'declined' || inv.status === 'revoked' || inv.status === 'deleted') && item.status !== inv.status) {
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
            if (inv.acceptedUid && !item.acceptedUid) {
              item.acceptedUid = inv.acceptedUid;
              hasChanged = true;
            }
          }
        });
      }

      // If invitation belongs to this conference but not yet in ebRolesData, add it (only if active)
      if (!matched && invEmail && inv.roleType === 'executive' && inv.status !== 'revoked' && inv.status !== 'deleted') {
        const targetComm = (inv.committeeCode || (selectedCommittees[activeCommitteeIndex] ? selectedCommittees[activeCommitteeIndex].code : (selectedCommittees[0] ? selectedCommittees[0].code : 'DISEC'))).toUpperCase().trim();
        if (!ebRolesData[targetComm]) ebRolesData[targetComm] = [];
        ebRolesData[targetComm].push({
          id: inv.id,
          roleId: inv.roleId || 'chair',
          roleLabel: inv.roleLabel || 'Chairperson',
          email: inv.recipientEmail || inv.email,
          name: inv.recipientName || '',
          avatar: inv.recipientAvatar || '',
          handle: inv.recipientName || '',
          subject: inv.subject || '',
          note: inv.note || '',
          status: inv.status || 'pending',
          acceptedUid: inv.acceptedUid || null,
          invitedAt: inv.invitedAt || new Date().toISOString()
        });
        hasChanged = true;
      }
    });

    if (storageChanged) {
      try {
        localStorage.setItem('mun_local_invitations', JSON.stringify(stored));
      } catch (e) { }
    }

    if (hasChanged) {
      window.__wizardData = window.__wizardData || {};
      window.__wizardData.ebRoles = { ...ebRolesData };
      try {
        const raw = localStorage.getItem('cc_conference_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          draft.data = draft.data || {};
          draft.data.ebRoles = { ...ebRolesData };
          draft.updatedAt = new Date().toISOString();
          localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
        }
      } catch (e) { }
    }
  } catch (e) { }
}

let unsubscribeEbInvitations = null;
let unsubscribeEbDraft = null;
let unsubscribeEbRtdb = null;
function listenForConferenceInvitations() {
  if (unsubscribeEbRtdb) {
    try { unsubscribeEbRtdb(); } catch (e) {}
    unsubscribeEbRtdb = null;
  }
  if (unsubscribeEbInvitations) {
    try { unsubscribeEbInvitations(); } catch (e) {}
    unsubscribeEbInvitations = null;
  }
  if (unsubscribeEbDraft) {
    try { unsubscribeEbDraft(); } catch (e) {}
    unsubscribeEbDraft = null;
  }
  try {
    const ctx = getDraftConferenceContext();
    if (!ctx.confId) return;

    // 1. Instant WebSocket Realtime Database listener (sub-30ms sync)
    unsubscribeEbRtdb = listenLiveConferenceInvitations(ctx.confId, (invsList) => {
      let changed = false;
      invsList.forEach(inv => {
        if (!inv || !inv.status) return;
        const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();

        if (inv.status === 'revoked' || inv.status === 'deleted') {
          for (const [cCode, list] of Object.entries(ebRolesData)) {
            if (!Array.isArray(list)) continue;
            const before = list.length;
            ebRolesData[cCode] = list.filter(item => item.id !== inv.id);
            if (ebRolesData[cCode].length !== before) changed = true;
          }
          return;
        }

        let invMatched = false;
        for (const [cCode, list] of Object.entries(ebRolesData)) {
          if (!Array.isArray(list)) continue;
          list.forEach(item => {
            const itemEmail = (item.email || item.recipientEmail || '').trim().toLowerCase();
            const isMatch = (item.id && item.id === inv.id) || (invEmail && itemEmail && invEmail === itemEmail);
            if (isMatch) {
              invMatched = true;
              if (inv.status === 'accepted' && item.status !== 'accepted') {
                item.status = 'accepted';
                changed = true;
              } else if (item.status !== inv.status && inv.status !== 'pending') {
                item.status = inv.status;
                changed = true;
              }
              if (inv.recipientName && (!item.name || item.name === item.email)) {
                item.name = inv.recipientName;
                changed = true;
              }
              if (inv.recipientAvatar && !item.avatar) {
                item.avatar = inv.recipientAvatar;
                changed = true;
              }
              if (inv.acceptedUid && !item.acceptedUid) {
                item.acceptedUid = inv.acceptedUid;
                changed = true;
              }
            }
          });
        }

        if (!invMatched && invEmail && inv.roleType === 'executive') {
          const targetComm = (inv.committeeCode || (selectedCommittees[activeCommitteeIndex] ? selectedCommittees[activeCommitteeIndex].code : (selectedCommittees[0] ? selectedCommittees[0].code : 'DISEC'))).toUpperCase().trim();
          if (!ebRolesData[targetComm]) ebRolesData[targetComm] = [];
          ebRolesData[targetComm].push({
            id: inv.id,
            roleId: inv.roleId || 'chair',
            roleLabel: inv.roleLabel || 'Chairperson',
            email: inv.recipientEmail || inv.email,
            name: inv.recipientName || '',
            avatar: inv.recipientAvatar || '',
            handle: inv.recipientName || '',
            subject: inv.subject || '',
            note: inv.note || '',
            status: inv.status || 'pending',
            acceptedUid: inv.acceptedUid || null,
            invitedAt: inv.invitedAt || new Date().toISOString()
          });
          changed = true;
        }
      });

      if (changed) {
        window.__wizardData = window.__wizardData || {};
        window.__wizardData.ebRoles = { ...ebRolesData };
        try {
          const raw = localStorage.getItem('cc_conference_draft');
          if (raw) {
            const draft = JSON.parse(raw);
            draft.data = draft.data || {};
            draft.data.ebRoles = { ...ebRolesData };
            draft.updatedAt = new Date().toISOString();
            localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
          }
        } catch (e) {}
        renderExecutiveWorkspace();
      }
    });

    if (!db || !collection || !query || !where || !onSnapshot) return;
    const q = query(
      collection(db, 'conferenceInvitations'),
      where('confId', '==', ctx.confId)
    );
    unsubscribeEbInvitations = onSnapshot(q, (snapshot) => {
      let changed = false;

      // Handle removed documents immediately
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          const removedId = change.doc.id;
          for (const [cCode, list] of Object.entries(ebRolesData)) {
            if (!Array.isArray(list)) continue;
            const before = list.length;
            ebRolesData[cCode] = list.filter(item => item.id !== removedId);
            if (ebRolesData[cCode].length !== before) changed = true;
          }
        }
      });

      snapshot.forEach(docSnap => {
        const inv = docSnap.data();
        if (!inv || !inv.status) return;
        const invEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();

        // If revoked/deleted in Firestore, remove from local ebRolesData
        if (inv.status === 'revoked' || inv.status === 'deleted') {
          for (const [cCode, list] of Object.entries(ebRolesData)) {
            if (!Array.isArray(list)) continue;
            const before = list.length;
            ebRolesData[cCode] = list.filter(item => item.id !== docSnap.id && item.id !== inv.id);
            if (ebRolesData[cCode].length !== before) changed = true;
          }
          return;
        }

        let invMatched = false;
        for (const [cCode, list] of Object.entries(ebRolesData)) {
          if (!Array.isArray(list)) continue;
          list.forEach(item => {
            const itemEmail = (item.email || item.recipientEmail || '').trim().toLowerCase();
            const isMatch = (item.id && (item.id === docSnap.id || item.id === inv.id)) ||
                            (invEmail && itemEmail && invEmail === itemEmail);
            if (isMatch) {
              invMatched = true;
              if (inv.status === 'accepted') {
                if (item.status !== 'accepted') {
                  item.status = 'accepted';
                  changed = true;
                }
              } else if (item.status !== inv.status && inv.status !== 'pending') {
                item.status = inv.status;
                changed = true;
              }
              if (inv.recipientName && (!item.name || item.name === item.email)) {
                item.name = inv.recipientName;
                changed = true;
              }
              if (inv.recipientAvatar && !item.avatar) {
                item.avatar = inv.recipientAvatar;
                changed = true;
              }
              if (inv.acceptedUid && !item.acceptedUid) {
                item.acceptedUid = inv.acceptedUid;
                changed = true;
              }
            }
          });
        }

        // If not matched, but it's an executive invitation for this conference, add to targeted committee
        if (!invMatched && invEmail && inv.roleType === 'executive') {
          const targetComm = (inv.committeeCode || (selectedCommittees[activeCommitteeIndex] ? selectedCommittees[activeCommitteeIndex].code : (selectedCommittees[0] ? selectedCommittees[0].code : 'DISEC'))).toUpperCase().trim();
          if (!ebRolesData[targetComm]) ebRolesData[targetComm] = [];
          ebRolesData[targetComm].push({
            id: docSnap.id || inv.id,
            roleId: inv.roleId || 'chair',
            roleLabel: inv.roleLabel || 'Chairperson',
            email: inv.recipientEmail || inv.email,
            name: inv.recipientName || '',
            avatar: inv.recipientAvatar || '',
            handle: inv.recipientName || '',
            subject: inv.subject || '',
            note: inv.note || '',
            status: inv.status || 'pending',
            acceptedUid: inv.acceptedUid || null,
            invitedAt: inv.invitedAt || new Date().toISOString()
          });
          changed = true;
        }
      });
      if (changed) {
        window.__wizardData = window.__wizardData || {};
        window.__wizardData.ebRoles = { ...ebRolesData };
        try {
          const raw = localStorage.getItem('cc_conference_draft');
          if (raw) {
            const draft = JSON.parse(raw);
            draft.data = draft.data || {};
            draft.data.ebRoles = { ...ebRolesData };
            draft.updatedAt = new Date().toISOString();
            localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
          }
        } catch (e) {}
        if (typeof window.saveConferenceDraft === 'function') {
          try { window.saveConferenceDraft(); } catch (e) { }
        }
        renderExecutiveWorkspace();
      }
    }, (err) => {
      console.warn('Invitations snapshot notice:', err);
    });

    // Also attach real-time listener to organizer's cloud draft in Firestore
    const orgUid = ctx.senderUid || localStorage.getItem('mun_cloud_draft_uid') || localStorage.getItem('mun_user_uid');
    if (orgUid && db && doc && onSnapshot) {
      unsubscribeEbDraft = onSnapshot(doc(db, 'conference_drafts', orgUid), (dSnap) => {
        if (!dSnap || !dSnap.exists()) return;
        const dData = dSnap.data() || {};
        const inner = dData.data || {};
        if (inner.ebRoles && typeof inner.ebRoles === 'object') {
          let cloudChanged = false;
          for (const [commCode, list] of Object.entries(inner.ebRoles)) {
            if (!Array.isArray(list)) continue;
            const normComm = commCode.toUpperCase().trim();
            if (!ebRolesData[normComm]) ebRolesData[normComm] = [];
            list.forEach(cloudItem => {
              const cloudEmail = (cloudItem.email || cloudItem.recipientEmail || '').trim().toLowerCase();
              const existing = ebRolesData[normComm].find(x =>
                (x.id && cloudItem.id && x.id === cloudItem.id) ||
                ((x.email || '').trim().toLowerCase() === cloudEmail)
              );
              if (existing) {
                if (cloudItem.status === 'accepted' && existing.status !== 'accepted') {
                  existing.status = 'accepted';
                  cloudChanged = true;
                } else if (cloudItem.status && existing.status !== cloudItem.status && cloudItem.status !== 'pending') {
                  existing.status = cloudItem.status;
                  cloudChanged = true;
                }
                if (cloudItem.name && (!existing.name || existing.name === existing.email)) {
                  existing.name = cloudItem.name;
                  cloudChanged = true;
                }
                if (cloudItem.avatar && !existing.avatar) {
                  existing.avatar = cloudItem.avatar;
                  cloudChanged = true;
                }
                if (cloudItem.acceptedUid && !existing.acceptedUid) {
                  existing.acceptedUid = cloudItem.acceptedUid;
                  cloudChanged = true;
                }
              } else if (cloudItem.status !== 'revoked' && cloudItem.status !== 'deleted') {
                ebRolesData[normComm].push({ ...cloudItem });
                cloudChanged = true;
              }
            });
          }
          if (cloudChanged) {
            window.__wizardData = window.__wizardData || {};
            window.__wizardData.ebRoles = { ...ebRolesData };
            try {
              const raw = localStorage.getItem('cc_conference_draft');
              if (raw) {
                const draft = JSON.parse(raw);
                draft.data = draft.data || {};
                draft.data.ebRoles = { ...ebRolesData };
                draft.updatedAt = new Date().toISOString();
                localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
              }
            } catch (e) {}
            renderExecutiveWorkspace();
          }
        }
      }, (dErr) => {
        console.warn('Cloud draft snapshot notice:', dErr);
      });
    }
  } catch (err) {
    console.warn('Invitations listener notice:', err);
  }
}

// Attach persistent auth listener so listeners re-attach immediately when user signs in
if (auth && typeof onAuthStateChanged === 'function' && !window.__ebAuthSubscribed) {
  window.__ebAuthSubscribed = true;
  try {
    onAuthStateChanged(auth, (user) => {
      if (user && user.uid) {
        try {
          localStorage.setItem('mun_cloud_draft_uid', user.uid);
          localStorage.setItem('mun_user_uid', user.uid);
          if (user.email) localStorage.setItem('mun_user_email', user.email);
        } catch (e) {}
        listenForConferenceInvitations();
      }
    });
  } catch (e) { }
}

if (typeof window !== 'undefined' && !window.__ebBroadcastListenerAttached) {
  window.__ebBroadcastListenerAttached = true;
  try {
    const bc = new BroadcastChannel('mun_invitations_channel');
    bc.onmessage = (ev) => {
      if (ev.data && (ev.data.action === 'deleted' || ev.data.status === 'deleted' || ev.data.status === 'revoked')) {
        const delId = ev.data.invId;
        if (delId) {
          for (const [cCode, list] of Object.entries(ebRolesData)) {
            if (Array.isArray(list)) {
              ebRolesData[cCode] = list.filter(item => item.id !== delId);
            }
          }
        }
        syncStatusFromStorage();
        if (typeof renderExecutiveWorkspace === 'function') {
          renderExecutiveWorkspace();
        }
        return;
      }
      if (ev.data && (ev.data.action === 'accepted' || ev.data.status === 'accepted' || ev.data.action === 'declined' || ev.data.status === 'declined' || ev.data.type === 'invitation_dispatched')) {
        const evEmail = (ev.data.recipientEmail || '').trim().toLowerCase();
        const evId = ev.data.invId;
        const newStatus = ev.data.status || ev.data.action;
        let matchedBc = false;
        if (newStatus === 'accepted' || newStatus === 'declined') {
          for (const [cCode, list] of Object.entries(ebRolesData)) {
            if (Array.isArray(list)) {
              list.forEach(item => {
                const itemEmail = (item.email || item.recipientEmail || '').trim().toLowerCase();
                if ((evId && item.id === evId) || (evEmail && itemEmail && evEmail === itemEmail)) {
                  matchedBc = true;
                  item.status = newStatus;
                  if (ev.data.acceptedName) item.name = ev.data.acceptedName;
                  if (ev.data.acceptedAvatar) item.avatar = ev.data.acceptedAvatar;
                  if (ev.data.acceptedUid) item.acceptedUid = ev.data.acceptedUid;
                }
              });
            }
          }
          if (!matchedBc && newStatus === 'accepted' && (ev.data.roleType === 'executive' || ev.data.committeeCode)) {
            const targetComm = (ev.data.committeeCode || (selectedCommittees[activeCommitteeIndex] ? selectedCommittees[activeCommitteeIndex].code : 'DISEC')).toUpperCase().trim();
            if (!ebRolesData[targetComm]) ebRolesData[targetComm] = [];
            ebRolesData[targetComm].push({
              id: evId || `exec-inv-${Date.now()}`,
              roleId: ev.data.roleId || 'chair',
              roleLabel: ev.data.roleLabel || 'Chairperson',
              email: evEmail,
              name: ev.data.acceptedName || '',
              avatar: ev.data.acceptedAvatar || '',
              status: 'accepted',
              acceptedUid: ev.data.acceptedUid || null,
              invitedAt: new Date().toISOString()
            });
          }

          // Also update mun_local_invitations immediately
          try {
            const locStored = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
            let locChanged = false;
            locStored.forEach(inv => {
              const iEmail = (inv.recipientEmail || inv.email || '').trim().toLowerCase();
              if ((evId && inv.id === evId) || (evEmail && iEmail && evEmail === iEmail)) {
                inv.status = newStatus;
                if (ev.data.acceptedName) inv.recipientName = ev.data.acceptedName;
                if (ev.data.acceptedAvatar) inv.recipientAvatar = ev.data.acceptedAvatar;
                if (ev.data.acceptedUid) inv.acceptedUid = ev.data.acceptedUid;
                locChanged = true;
              }
            });
            if (locChanged) {
              localStorage.setItem('mun_local_invitations', JSON.stringify(locStored));
            }
          } catch (e) { }

          // If the event targeted a specific committee, switch activeCommitteeIndex so user immediately sees it
          if (ev.data.committeeCode) {
            const cCodeNorm = ev.data.committeeCode.toUpperCase().trim();
            const idx = selectedCommittees.findIndex(c => (c.code || '').toUpperCase().trim() === cCodeNorm);
            if (idx !== -1) {
              activeCommitteeIndex = idx;
            }
          }
        }
        syncStatusFromStorage();
        if (typeof renderExecutiveWorkspace === 'function') {
          renderExecutiveWorkspace();
        }
      }
    };
  } catch (e) { }

  window.addEventListener('storage', (e) => {
    if (e.key === 'mun_local_invitations' || e.key === 'cc_conference_draft') {
      syncStatusFromStorage();
      if (typeof renderExecutiveWorkspace === 'function') {
        renderExecutiveWorkspace();
      }
    }
  });

  window.addEventListener('mun:invitation-dispatched', () => {
    syncStatusFromStorage();
    if (typeof renderExecutiveWorkspace === 'function') {
      renderExecutiveWorkspace();
    }
  });
}

/**
 * Render the complete Executive Workspace Layout matching Step 3
 */
function renderExecutiveWorkspace() {
  const container = document.getElementById('ebDeckContainer');
  if (!container) return;

  const prevScrollTop = document.getElementById('ebGridContainer')?.scrollTop || 0;

  if (selectedCommittees.length === 0) {
    container.innerHTML = `
      <div class="cc-eb-empty-state">
        <div class="cc-eb-empty-icon-box">
          <ion-icon name="alert-circle-outline"></ion-icon>
        </div>
        <h3 class="cc-eb-empty-title">No Committees Selected</h3>
        <p class="cc-eb-empty-desc">Please go back to Step 2 and choose committees before inviting executive board members.</p>
        <button type="button" class="cc-btn-primary" id="btnGoBackToStep2">
          <ion-icon name="arrow-back-outline"></ion-icon> Go to Step 2
        </button>
      </div>
    `;
    document.getElementById('btnGoBackToStep2')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('wizard:prev'));
    });
    return;
  }

  const activeComm = selectedCommittees[activeCommitteeIndex] || selectedCommittees[0];
  window.__ebActiveTab = window.__ebActiveTab || 'executives';
  syncStatusFromStorage();
  const activeExecs = ebRolesData[activeComm.code] || [];
  const acceptedExecs = activeExecs.filter(e => (e.status || '').toLowerCase() === 'accepted');
  const isCustom = Boolean(activeComm.isCustom);
  const isWide = isWideCommittee(activeComm.code);
  const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(activeComm.code) : (activeComm.logoUrl || '');

  const isCommAuditionsOpen = isCommitteeAuditionOpen(activeComm.code, true);
  const openCount = selectedCommittees.filter(c => isCommitteeAuditionOpen(c.code, true)).length;

  const countText = window.__ebActiveTab === 'auditions'
    ? ''
    : (window.__ebActiveTab === 'executives'
      ? `${acceptedExecs.length} ${acceptedExecs.length === 1 ? 'Executive' : 'Executives'}`
      : `${activeExecs.length} ${activeExecs.length === 1 ? 'Invitation Sent' : 'Invitations Sent'}`);

  // Render mail reading pane if an email is open
  const openMailId = window.__ebOpenMailId;
  const openMail = openMailId ? (ebRolesData[activeComm.code] || []).find(x => x.id === openMailId) : null;

  container.innerHTML = `
    <div class="cc-eb-workspace">
      <!-- Left Sidebar: Committees list -->
      <aside class="cc-eb-committees-sidebar">
        <div class="cc-eb-sidebar-sticky-inner">
          <div class="cc-eb-sidebar-header">
            <span class="cc-eb-sidebar-title">Committees</span>
            <span class="cc-eb-sidebar-count">${selectedCommittees.length} ${selectedCommittees.length === 1 ? 'Committee' : 'Committees'}</span>
          </div>
          <div class="cc-eb-sidebar-list" id="ebSidebarList">
            ${renderVerticalCommittees()}
          </div>
        </div>
      </aside>

      <!-- Right Main Workspace -->
      <main class="cc-eb-main-workspace" id="ebMainWorkspace">
        <!-- Committee Header -->
        <div class="cc-eb-main-header">
          <div class="cc-eb-comm-logo-wrap ${isWide ? 'is-wide' : ''}">
            ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(activeComm.code)}" />` : `<div class="cc-eb-comm-logo-fallback"><ion-icon name="${getCommitteeIcon(activeComm.category)}"></ion-icon></div>`}
          </div>
          <div class="cc-eb-comm-meta">
            <div class="cc-eb-comm-code-row">
              <span class="cc-eb-comm-code">${escapeHtml(activeComm.code)}</span>
            </div>
            <div class="cc-eb-comm-bottom-row">
              <div class="cc-eb-comm-name" title="${escapeHtml(activeComm.name || activeComm.code)}">${escapeHtml(activeComm.name || activeComm.code)}</div>
              <div class="cc-eb-main-header-right">
                <span class="cc-eb-selected-count-text" id="commEbSelectedCountText">${countText}</span>
              </div>
            </div>
          </div>
        </div>

        ${openMail ? renderMailReadingPane(openMail, activeComm.code) : `
        <!-- Gmail inbox list -->
        <div class="cc-gmail-container" id="ebGridContainer">
          <div class="cc-gmail-toolbar">
            <div class="cc-gmail-toolbar-left">
              <button type="button" class="cc-eb-toolbar-tab ${window.__ebActiveTab === 'executives' ? 'is-active' : ''}" id="btnEbTabExecutives" title="View confirmed executives">
                Executives
              </button>
              <button type="button" class="cc-eb-toolbar-tab ${window.__ebActiveTab === 'invitations' ? 'is-active' : ''}" id="btnEbTabInvitations" title="View sent invitations">
                Invitations
              </button>
              <button type="button" class="cc-eb-toolbar-tab ${window.__ebActiveTab === 'auditions' ? 'is-active' : ''}" id="btnEbTabAuditions" title="Auditions">
                Auditions
              </button>
            </div>
          </div>
          <div class="cc-gmail-list ${window.__ebActiveTab === 'auditions' ? 'is-auditions-mode' : ''}" id="ebExecutivesGrid">
            ${window.__ebActiveTab === 'auditions'
              ? renderCommitteeAuditionsWorkspace(activeComm)
              : (window.__ebActiveTab === 'executives'
                ? (acceptedExecs.length > 0
                    ? acceptedExecs.map((exec, idx) => renderConfirmedExecutiveRow(exec, idx, activeComm.code)).join('')
                    : `<div class="cc-gmail-empty-state">
                        <div class="cc-gmail-empty-icon-wrap"><ion-icon name="people-outline"></ion-icon></div>
                        <h4 class="cc-gmail-empty-title">No confirmed executives for ${escapeHtml(activeComm.code)} yet</h4>
                        <p class="cc-gmail-empty-desc">When invited members accept their appointment, they will appear here as confirmed executives.</p>
                      </div>`
                  )
                : (activeExecs.length > 0
                    ? activeExecs.map((exec, idx) => renderGmailExecutiveRow(exec, idx, activeComm.code)).join('')
                    : `<div class="cc-gmail-empty-state">
                        <div class="cc-gmail-empty-icon-wrap"><ion-icon name="mail-unread-outline"></ion-icon></div>
                        <h4 class="cc-gmail-empty-title">No invitations sent for ${escapeHtml(activeComm.code)} yet</h4>
                        <p class="cc-gmail-empty-desc">Click the Compose button at the bottom right to dispatch an executive appointment invitation.</p>
                      </div>`
                  )
              )
            }
          </div>
        </div>

        <!-- Floating Compose Button inside canvas (only shown on inbox, hidden on auditions or when mail is open) -->
        <button type="button" class="cc-gmail-compose-fab cc-canvas-compose-fab" id="btnGmailComposeExec" title="Compose New Executive Invitation" style="display: ${window.__ebActiveTab === 'auditions' ? 'none' : 'flex'};">
          <ion-icon name="create-outline"></ion-icon>
          <span>Compose</span>
        </button>
        `}
      </main>
    </div>
  `;

  attachWorkspaceInteractions();
  syncExecutiveScrollHeight();
  requestAnimationFrame(() => {
    syncExecutiveScrollHeight();
    const grid = document.getElementById('ebGridContainer');
    if (grid && prevScrollTop > 0) {
      grid.scrollTop = prevScrollTop;
    }
  });
}

/**
 * Render the vertical committees list for the left column (2x2 grid, identical to Step 3)
 */
function renderVerticalCommittees() {
  return selectedCommittees.map((comm, idx) => {
    const isActive = idx === activeCommitteeIndex;
    const isCustom = Boolean(comm.isCustom);
    const isWide = isWideCommittee(comm.code);
    const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(comm.code) : (comm.logoUrl || '');

    return `
      <div
        class="cc-eb-sidebar-comm-item ${isActive ? 'is-active' : ''}"
        data-index="${idx}"
        data-comm-code="${escapeHtml(comm.code)}"
        title="${escapeHtml(comm.name || comm.code)}"
      >
        <div class="cc-eb-sidebar-comm-logo ${isWide ? 'is-wide' : ''}">
          ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(comm.code)}" />` : `<ion-icon name="${getCommitteeIcon(comm.category)}"></ion-icon>`}
        </div>
        <span class="cc-eb-sidebar-comm-code">${escapeHtml(comm.code || comm.name)}</span>
      </div>
    `;
  }).join('');
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

function getInitials(name) {
  if (!name) return 'EX';
  const clean = String(name).trim();
  if (clean.includes(' ')) {
    const parts = clean.split(/\s+/);
    return ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
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
 * Render an individual Executive Role Invitation as a clean Google Mail row
 */
function renderMailReadingPane(exec, commCode) {
  let roleLabel = exec.roleLabel || 'Executive';
  if (roleLabel === 'Chair') roleLabel = 'Chairperson';
  const email = exec.email ? escapeHtml(exec.email) : 'No email provided';
  const displayName = exec.name || formatDisplayNameFromEmail(exec.email);
  const initials = getInitials(displayName || exec.email);
  let subject = exec.subject || buildExecutiveInvitationSubject(roleLabel, commCode, commCode);
  subject = subject.replace(/official\s*/gi, '').trim();
  const bodyText = exec.note || buildExecutiveInvitationMessage({ email: exec.email, name: exec.name }, roleLabel, commCode);
  const timeStr = formatRelativeTime(exec.invitedAt || Date.now());
  const status = (exec.status || 'pending').toLowerCase();
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined' || status === 'rejected';
  const isRevoked = status === 'revoked';
  const statusClass = isAccepted ? 'is-accepted' : (isDeclined ? 'is-rejected' : 'is-pending');
  const avatarBgColor = isAccepted ? '0091FF' : (isDeclined ? 'ef4444' : '94a3b8');
  const avatarUrl = exec.avatar || exec.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${avatarBgColor}&color=fff&size=128&bold=true`;

  return `
    <div class="cc-mail-read-pane" id="ebMailReadPane">
      <div class="cc-mail-read-toolbar">
        <button type="button" class="cc-mail-read-back" id="btnMailReadBack" title="Back to inbox" aria-label="Back to inbox">
          <ion-icon name="chevron-back-outline"></ion-icon>
        </button>
        <div class="cc-mail-read-actions">
          <button type="button" class="cc-mail-read-action-btn cc-mail-read-delete" data-exec-id="${escapeHtml(exec.id)}" data-comm-code="${escapeHtml(commCode)}" title="Delete invitation" aria-label="Delete invitation">
            <ion-icon name="trash-outline"></ion-icon>
          </button>
        </div>
      </div>
      <div class="cc-mail-read-subject-row">
        <h2 class="cc-mail-read-subject">${escapeHtml(subject)}</h2>
        ${isAccepted ? '<span class="cc-mail-status-text is-accepted">Accepted</span>' : (isDeclined ? '<span class="cc-mail-status-text is-rejected">Declined</span>' : (isRevoked ? '<span class="cc-mail-status-text is-revoked">Revoked</span>' : ''))}
      </div>
      <div class="cc-mail-read-meta-row">
        <div class="cc-mail-read-avatar ${statusClass}"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="cc-mail-read-avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.classList.add('has-img-error');" /><span class="cc-mail-read-avatar-initials">${escapeHtml(initials)}</span></div>
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
 * Render Confirmed Executive Member Row in Executives Tab
 * Avatar -> Name (Poppins 500) & Role (Poppins 400) on right -> Accepted text on right end
 */
function renderConfirmedExecutiveRow(exec, idx, commCode) {
  let roleLabel = exec.roleLabel || 'Executive';
  if (roleLabel === 'Chair') roleLabel = 'Chairperson';
  const displayName = exec.name || formatDisplayNameFromEmail(exec.email);
  const initials = getInitials(displayName || exec.email);
  const avatarBgColor = '0091FF';
  const avatarUrl = exec.avatar || exec.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${avatarBgColor}&color=fff&size=128&bold=true`;

  return `
    <div
      class="cc-gmail-row cc-eb-confirmed-row"
      data-exec-id="${escapeHtml(exec.id)}"
      data-comm-code="${escapeHtml(commCode)}"
      role="button"
      tabindex="0"
      title="View executive appointment"
    >
      <div class="cc-mail-read-avatar is-accepted"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="cc-mail-read-avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.classList.add('has-img-error');" /><span class="cc-mail-read-avatar-initials">${escapeHtml(initials)}</span></div>
      <div class="cc-eb-confirmed-info">
        <div class="cc-eb-confirmed-name">${escapeHtml(displayName)}</div>
        <div class="cc-eb-confirmed-role">${escapeHtml(roleLabel)}</div>
      </div>
      <div class="cc-eb-confirmed-right">
        <span class="cc-eb-confirmed-status is-accepted">Accepted</span>
      </div>
    </div>
  `;
}

function renderGmailExecutiveRow(exec, idx, commCode) {
  let roleLabel = exec.roleLabel || 'Executive';
  if (roleLabel === 'Chair') roleLabel = 'Chairperson';
  const email = exec.email ? escapeHtml(exec.email) : 'No email provided';
  const status = (exec.status || 'pending').toLowerCase();
  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined' || status === 'rejected';
  const isRevoked = status === 'revoked';
  const statusClass = isAccepted ? 'is-accepted' : (isDeclined ? 'is-rejected' : 'is-pending');
  const avatarBgColor = isAccepted ? '0091FF' : (isDeclined ? 'ef4444' : '94a3b8');
  const displayName = exec.name || formatDisplayNameFromEmail(exec.email);
  const initials = getInitials(displayName || exec.email);
  let subject = exec.subject || buildExecutiveInvitationSubject(roleLabel, commCode, commCode);
  subject = subject.replace(/official\s*/gi, '').trim();
  const snippet = (exec.note || 'You are invited to serve on the executive board.').trim().replace(/\n+/g, ' ');
  const ordinalDate = formatOrdinalDate(exec.invitedAt || Date.now());
  const avatarUrl = exec.avatar || exec.recipientAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${avatarBgColor}&color=fff&size=128&bold=true`;

  return `
    <div
      class="cc-gmail-row cc-eb-exec-row"
      data-exec-id="${escapeHtml(exec.id)}"
      data-comm-code="${escapeHtml(commCode)}"
      role="button"
      tabindex="0"
      title="Open invitation"
    >
      <div class="cc-mail-read-avatar ${statusClass}"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" class="cc-mail-read-avatar-img" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.classList.add('has-img-error');" /><span class="cc-mail-read-avatar-initials">${escapeHtml(initials)}</span></div>
      <div class="cc-gmail-content-col">
        <div class="cc-gmail-line-name">${escapeHtml(displayName)}</div>
        <div class="cc-gmail-line-subject">${escapeHtml(subject)}</div>
        <div class="cc-gmail-line-message">${escapeHtml(snippet)}</div>
      </div>
      <div class="cc-gmail-col-right">
        <span class="cc-gmail-date">${escapeHtml(ordinalDate)}</span>
        ${isAccepted ? '<span class="cc-gmail-status-text is-accepted">Accepted</span>' : (isDeclined ? '<span class="cc-gmail-status-text is-rejected">Declined</span>' : (isRevoked ? '<span class="cc-gmail-status-text is-revoked">Revoked</span>' : ''))}
      </div>
    </div>
  `;
}

function renderExecutiveCard(exec, idx, commCode) {
  return renderGmailExecutiveRow(exec, idx, commCode);
}

/**
 * Render Committee Auditions Workspace (Role by role, borderless, simple Open/Closed text)
 */
function renderCommitteeAuditionsWorkspace(activeComm) {
  const activeExecs = ebRolesData[activeComm.code] || [];
  const daisRoles = getCommitteeDaisRoles(activeComm.code, activeExecs);

  return `
    <div class="cc-auditions-hint">
      <ion-icon name="information-circle-outline" class="cc-auditions-hint-icon"></ion-icon>
      <span class="cc-auditions-hint-text">Opening auditions allows aspiring delegates and executives across Modern MUN to discover and apply for vacant dais roles.</span>
    </div>
    <div class="cc-auditions-roles-list">
      ${daisRoles.map(role => {
        const selectedExec = getRoleSelectedExecutive(role.id, activeExecs);
        const isFilled = Boolean(selectedExec);
        const isRoleOpen = !isFilled && isRoleAuditionOpen(activeComm.code, role.id, activeExecs);
        return `
          <div class="cc-audition-role-row ${isFilled ? 'is-filled' : ''}">
            <div class="cc-audition-role-name">
              ${escapeHtml(role.label)}
            </div>
            <div class="cc-audition-role-action">
              ${isFilled ? `
                <span class="cc-audition-text-filled">Filled</span>
              ` : `
                <button type="button" class="cc-audition-text-toggle ${isRoleOpen ? 'is-open' : 'is-closed'}" data-toggle-role="${escapeHtml(role.id)}" title="Click to toggle Open / Closed">
                  ${isRoleOpen ? 'Open' : 'Closed'}
                </button>
              `}
              ${role.isCustom ? `
                <button type="button" class="cc-audition-delete-role-btn" data-delete-role="${escapeHtml(role.id)}" title="Delete custom role" aria-label="Delete custom role">
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
            id="inputAuditionCustomRole"
            placeholder="Add custom role..."
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <button type="button" class="cc-audition-add-btn" id="btnAddAuditionCustomRole" title="Add custom role">
          Add
        </button>
      </div>
    </div>
  `;
}

/**
 * Attach Committee Auditions Events (Toggle Open/Closed per role + Custom role inline adder)
 */
function attachCommitteeAuditionsEvents(activeComm, switchTabFn) {
  const activeExecs = ebRolesData[activeComm.code] || [];

  document.querySelectorAll('[data-toggle-role]')?.forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const roleId = el.getAttribute('data-toggle-role');
      if (!roleId) return;
      if (getRoleSelectedExecutive(roleId, activeExecs)) return;
      const current = isRoleAuditionOpen(activeComm.code, roleId, activeExecs);
      const newOpen = !current;
      setRoleAudition(activeComm.code, roleId, newOpen, activeExecs);
      el.classList.toggle('is-open', newOpen);
      el.classList.toggle('is-closed', !newOpen);
      el.textContent = newOpen ? 'Open' : 'Closed';
    });
  });

  document.querySelectorAll('[data-delete-role]')?.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const roleId = btn.getAttribute('data-delete-role');
      if (!roleId) return;
      deleteCustomCommitteeRole(activeComm.code, roleId);
      const aIdx = AVAILABLE_ROLES.findIndex(r => r.id === roleId);
      if (aIdx !== -1) AVAILABLE_ROLES.splice(aIdx, 1);
      if (ebRolesData[activeComm.code]) {
        ebRolesData[activeComm.code] = ebRolesData[activeComm.code].filter(x => x.roleId !== roleId && x.id !== roleId);
      }
      const grid = document.getElementById('ebExecutivesGrid');
      if (grid) {
        grid.innerHTML = renderCommitteeAuditionsWorkspace(activeComm);
        attachCommitteeAuditionsEvents(activeComm, switchTabFn);
        syncExecutiveScrollHeight();
      }
    });
  });

  const customInput = document.getElementById('inputAuditionCustomRole');
  const addBtn = document.getElementById('btnAddAuditionCustomRole');

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
    const newRole = addCustomCommitteeRole(activeComm.code, formatted);
    if (newRole) {
      setRoleAudition(activeComm.code, newRole.id, true, ebRolesData[activeComm.code]);
      if (!AVAILABLE_ROLES.some(r => r.id === newRole.id)) {
        AVAILABLE_ROLES.push({ id: newRole.id, label: newRole.label, isCustom: true });
      }
    }
    const grid = document.getElementById('ebExecutivesGrid');
    if (grid) {
      grid.innerHTML = renderCommitteeAuditionsWorkspace(activeComm);
      attachCommitteeAuditionsEvents(activeComm, switchTabFn);
      syncExecutiveScrollHeight();
      const nextInput = document.getElementById('inputAuditionCustomRole');
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
 * Attach Event Listeners to Workspace Elements
 */
function attachWorkspaceInteractions() {
  const container = document.getElementById('ebDeckContainer');
  if (!container) return;

  const activeComm = selectedCommittees[activeCommitteeIndex];
  if (!activeComm) return;

  // 1. Sidebar Committee Selection
  container.querySelectorAll('.cc-eb-sidebar-comm-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx) && idx !== activeCommitteeIndex) {
        window.__ebOpenMailId = null;
        activeCommitteeIndex = idx;
        renderExecutiveWorkspace();
        scrollSidebarItemIntoView(idx);
      }
    });
  });

  // Helper to attach event listeners to grid rows without full workspace re-render
  function attachGridRowListeners(gridElement, commCode) {
    if (!gridElement) return;

    // Row click → open reading pane (not edit modal) for both invitation and confirmed rows
    gridElement.querySelectorAll('.cc-eb-exec-row, .cc-eb-confirmed-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.cc-eb-row-delete-btn')) return;
        const execId = row.dataset.execId;
        if (execId) {
          window.__ebOpenMailId = execId;
          renderExecutiveWorkspace();
        }
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target.closest('.cc-eb-row-delete-btn')) return;
          e.preventDefault();
          const execId = row.dataset.execId;
          if (execId) {
            window.__ebOpenMailId = execId;
            renderExecutiveWorkspace();
          }
        }
      });
    });

    // Delete button on row (hover action)
    gridElement.querySelectorAll('.cc-eb-row-delete-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const execId = btn.dataset.execId;
        const cCode = btn.dataset.commCode || commCode;
        if (confirm('Delete this invitation?')) {
          deleteExecutive(cCode, execId);
          showInvitationToast('Invitation deleted.');
        }
      });
    });

    // Empty state compose button
    gridElement.querySelector('#btnEmptyComposeExec')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.__ebOpenMailId = null;
      openExecutiveModal(commCode, null);
    });
  }

  // 1b. Toolbar Tabs: Executives / Invitations / Auditions with zero layout shift / instant DOM update
  function switchEbTab(newTab) {
    if (window.__ebActiveTab === newTab && !window.__ebOpenMailId) return;
    window.__ebActiveTab = newTab;
    window.__ebOpenMailId = null;

    const tabExec = document.getElementById('btnEbTabExecutives');
    const tabInv = document.getElementById('btnEbTabInvitations');
    const tabAud = document.getElementById('btnEbTabAuditions');
    const grid = document.getElementById('ebExecutivesGrid');
    const countEl = document.getElementById('commEbSelectedCountText');
    const composeFab = document.getElementById('btnGmailComposeExec');

    if (composeFab) {
      composeFab.style.display = newTab === 'auditions' ? 'none' : 'flex';
    }

    if (tabExec && tabInv && tabAud && grid && countEl) {
      tabExec.classList.toggle('is-active', newTab === 'executives');
      tabInv.classList.toggle('is-active', newTab === 'invitations');
      tabAud.classList.toggle('is-active', newTab === 'auditions');

      const activeExecs = ebRolesData[activeComm.code] || [];
      const acceptedExecs = activeExecs.filter(e => (e.status || '').toLowerCase() === 'accepted');
      const daisRoles = getCommitteeDaisRoles(activeComm.code, activeExecs);

      countEl.textContent = newTab === 'auditions'
        ? ''
        : (newTab === 'executives'
          ? `${acceptedExecs.length} ${acceptedExecs.length === 1 ? 'Executive' : 'Executives'}`
          : `${activeExecs.length} ${activeExecs.length === 1 ? 'Invitation Sent' : 'Invitations Sent'}`);

      grid.classList.toggle('is-auditions-mode', newTab === 'auditions');

      if (newTab === 'auditions') {
        grid.innerHTML = renderCommitteeAuditionsWorkspace(activeComm);
        attachCommitteeAuditionsEvents(activeComm, switchEbTab);
      } else if (newTab === 'executives') {
        grid.innerHTML = acceptedExecs.length > 0
          ? acceptedExecs.map((exec, idx) => renderConfirmedExecutiveRow(exec, idx, activeComm.code)).join('')
          : `<div class="cc-gmail-empty-state">
              <div class="cc-gmail-empty-icon-wrap"><ion-icon name="people-outline"></ion-icon></div>
              <h4 class="cc-gmail-empty-title">No confirmed executives for ${escapeHtml(activeComm.code)} yet</h4>
              <p class="cc-gmail-empty-desc">When invited members accept their appointment, they will appear here as confirmed executives.</p>
            </div>`;
        attachGridRowListeners(grid, activeComm.code);
      } else {
        grid.innerHTML = activeExecs.length > 0
          ? activeExecs.map((exec, idx) => renderGmailExecutiveRow(exec, idx, activeComm.code)).join('')
          : `<div class="cc-gmail-empty-state">
              <div class="cc-gmail-empty-icon-wrap"><ion-icon name="mail-unread-outline"></ion-icon></div>
              <h4 class="cc-gmail-empty-title">No invitations sent for ${escapeHtml(activeComm.code)} yet</h4>
              <p class="cc-gmail-empty-desc">Click the Compose button at the bottom right to dispatch an executive appointment invitation.</p>
            </div>`;
        attachGridRowListeners(grid, activeComm.code);
      }

      syncExecutiveScrollHeight();
    } else {
      renderExecutiveWorkspace();
    }
  }

  document.getElementById('btnEbTabExecutives')?.addEventListener('click', () => {
    switchEbTab('executives');
  });
  document.getElementById('btnEbTabInvitations')?.addEventListener('click', () => {
    switchEbTab('invitations');
  });
  document.getElementById('btnEbTabAuditions')?.addEventListener('click', () => {
    switchEbTab('auditions');
  });

  if (window.__ebActiveTab === 'auditions') {
    attachCommitteeAuditionsEvents(activeComm, switchEbTab);
  }

  // Attach initial grid row listeners
  attachGridRowListeners(document.getElementById('ebExecutivesGrid'), activeComm.code);

  // 2. Compose button (global FAB in index.html)
  document.getElementById('btnGmailComposeExec')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.__ebOpenMailId = null;
    openExecutiveModal(activeComm.code, null);
  });

  // 5. Reading pane: Back button
  document.getElementById('btnMailReadBack')?.addEventListener('click', () => {
    window.__ebOpenMailId = null;
    renderExecutiveWorkspace();
  });

  // 6. Reading pane: Delete button
  container.querySelectorAll('.cc-mail-read-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const execId = btn.dataset.execId;
      const commCode = btn.dataset.commCode;
      if (confirm('Delete this invitation?')) {
        window.__ebOpenMailId = null;
        deleteExecutive(commCode, execId);
        showInvitationToast('Invitation deleted.');
      }
    });
  });
}

/**
 * Setup Executive Modal Event Listeners
 */
function setupExecutiveModalListeners() {
  if (modalListenersAttached) return;

  const modal = document.getElementById('executiveModal');
  const form = document.getElementById('executiveModalForm');
  const roleWrap = document.getElementById('modalRoleDropdownWrap');
  const roleTrigger = document.getElementById('modalRoleTrigger');
  const rolePopover = document.getElementById('modalRolePopover');
  const customRoleField = document.getElementById('modalCustomRoleField');
  const customRoleInput = document.getElementById('modalCustomRoleInput');
  const btnCloseTop = document.getElementById('btnCancelExecutiveModalTop');
  const btnDelete = document.getElementById('btnDeleteModalExec');

  if (!modal || !form) return;

  // Custom Shadcn Dropdown UI toggle
  roleTrigger?.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = roleWrap?.classList.contains('is-open');
    if (isOpen) {
      closeRoleDropdown();
    } else {
      openRoleDropdown();
    }
  });

  // Select item from role dropdown popover
  function handleRoleItemClick(item) {
    const val = item.dataset.value;
    const label = item.dataset.label;
    if (val === '__add_custom__') {
      closeRoleDropdown();
      openEbCustomRoleModal();
      return;
    }
    selectRole(val, label);
    closeRoleDropdown();
  }

  function bindRoleItemEvents() {
    rolePopover?.querySelectorAll('.cc-eb-role-item').forEach(item => {
      if (item.__bound) return;
      item.__bound = true;
      item.addEventListener('click', e => {
        e.stopPropagation();
        handleRoleItemClick(item);
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRoleItemClick(item);
        }
      });
    });
  }
  bindRoleItemEvents();

  // Minimalist Custom Role Modal handlers
  const ebCustomModal = document.getElementById('ebCustomRoleModal');
  const ebCustomForm = document.getElementById('ebCustomRoleModalForm');
  const ebCustomInput = document.getElementById('ebCustomRoleNameInput');
  const ebCustomErr = document.getElementById('err-ebCustomRoleName');
  const btnCloseEbCustom = document.getElementById('btnCloseEbCustomRoleModal');
  const btnCancelEbCustom = document.getElementById('btnCancelEbCustomRoleModal');

  function openEbCustomRoleModal() {
    if (!ebCustomModal || !ebCustomInput) return;
    ebCustomInput.value = '';
    if (ebCustomErr) ebCustomErr.style.display = 'none';
    ebCustomModal.style.display = 'flex';
    requestAnimationFrame(() => {
      ebCustomModal.classList.add('is-open');
      ebCustomInput.focus();
    });
  }

  function closeEbCustomRoleModal() {
    if (!ebCustomModal) return;
    ebCustomModal.classList.remove('is-open');
    setTimeout(() => {
      ebCustomModal.style.display = 'none';
    }, 180);
  }

  btnCloseEbCustom?.addEventListener('click', closeEbCustomRoleModal);
  btnCancelEbCustom?.addEventListener('click', closeEbCustomRoleModal);
  ebCustomModal?.addEventListener('click', e => {
    if (e.target === ebCustomModal) closeEbCustomRoleModal();
  });

  // Strict keyboard filter: block numbers and symbols immediately
  ebCustomInput?.addEventListener('keydown', e => {
    if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'Tab' || e.key === 'Enter' || e.key === 'Home' || e.key === 'End' || e.key === 'Escape') {
      if (e.key === 'Escape') closeEbCustomRoleModal();
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (!/^[a-zA-Z\s-]$/.test(e.key)) {
      e.preventDefault();
    }
  });

  // Input listener: cleans non-letters, automatically capitalizes every word in Title Case
  ebCustomInput?.addEventListener('input', () => {
    const formatted = formatRoleTitleCase(ebCustomInput.value);
    ebCustomInput.value = formatted;
    if (ebCustomErr && formatted.trim()) {
      ebCustomErr.style.display = 'none';
    }
  });

  // Submit custom role
  const handleEbCustomSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const raw = (ebCustomInput?.value || '').trim();
    const formatted = formatRoleTitleCase(raw);
    if (!formatted || formatted.length < 2) {
      if (ebCustomErr) {
        ebCustomErr.textContent = 'Please enter a valid role title (letters only)';
        ebCustomErr.style.display = 'block';
      }
      ebCustomInput?.focus();
      return;
    }

    // Add to AVAILABLE_ROLES if not exists
    let roleObj = AVAILABLE_ROLES.find(r => r.label.toLowerCase() === formatted.toLowerCase());
    if (!roleObj) {
      const newId = 'custom_' + formatted.toLowerCase().replace(/[^a-z0-9]/g, '_');
      roleObj = { id: newId, label: formatted, isCustom: true };
      AVAILABLE_ROLES.push(roleObj);
    }

    // Ensure item exists in popover DOM right before the __add_custom__ item
    if (rolePopover) {
      let domItem = rolePopover.querySelector(`.cc-eb-role-item[data-value="${roleObj.id}"]`);
      if (!domItem) {
        const addOption = rolePopover.querySelector('.cc-eb-role-item-add');
        domItem = document.createElement('div');
        domItem.className = 'cc-eb-role-item';
        domItem.dataset.value = roleObj.id;
        domItem.dataset.label = roleObj.label;
        domItem.setAttribute('role', 'option');
        domItem.setAttribute('aria-selected', 'false');
        domItem.setAttribute('tabindex', '0');
        domItem.innerHTML = `
          <span class="cc-eb-role-item-name">${escapeHtml(roleObj.label)}</span>
          <ion-icon name="checkmark-outline" class="cc-eb-role-check is-hidden"></ion-icon>
        `;
        if (addOption) {
          rolePopover.insertBefore(domItem, addOption);
        } else {
          rolePopover.appendChild(domItem);
        }
        bindRoleItemEvents();
      }
    }

    selectRole(roleObj.id, roleObj.label);
    closeEbCustomRoleModal();
  };

  ebCustomForm?.addEventListener('submit', handleEbCustomSubmit);
  document.getElementById('btnSaveEbCustomRoleModal')?.addEventListener('click', handleEbCustomSubmit);

  function openRoleDropdown() {
    roleWrap?.classList.add('is-open');
    roleTrigger?.setAttribute('aria-expanded', 'true');
  }

  function closeRoleDropdown() {
    roleWrap?.classList.remove('is-open');
    roleTrigger?.setAttribute('aria-expanded', 'false');
  }

  // Close dropdown on click outside
  document.addEventListener('click', e => {
    if (roleWrap && !roleWrap.contains(e.target)) {
      closeRoleDropdown();
    }
  });

  // Close modal buttons
  btnCloseTop?.addEventListener('click', closeExecutiveModal);
  modal.querySelector('.cc-mail-dot-close')?.addEventListener('click', closeExecutiveModal);
  modal.querySelector('.cc-mail-window-close-btn')?.addEventListener('click', closeExecutiveModal);

  // Focus message body when clicking in note area
  const noteInput = document.getElementById('modalExecNote');
  noteInput?.addEventListener('input', () => {
    noteInput.dataset.autoGenerated = 'false';
  });
  document.getElementById('f-modalExecNote')?.addEventListener('click', () => {
    noteInput?.focus();
  });

  // Dynamic custom role change updates auto-generated message and subject line
  customRoleInput?.addEventListener('input', () => {
    const subjInput = document.getElementById('modalExecSubject');
    const commCode = document.getElementById('modalExecCommCode')?.value || 'UNSC';
    const commFullName = document.getElementById('modalExecCommFullName')?.textContent?.trim() || 'the committee';
    const rLabel = customRoleInput.value.trim() || 'Custom Role';
    if (subjInput) subjInput.value = buildExecutiveInvitationSubject(rLabel, commCode, commFullName);

    const noteEl = document.getElementById('modalExecNote');
    if (noteEl && noteEl.dataset.autoGenerated === 'true') {
      noteEl.value = buildExecutiveInvitationMessage(currentVerifiedExec, rLabel, commFullName);
    }
  });

  // Live Email Verification & Details Lookup
  const emailInput = document.getElementById('modalExecEmail');
  const emailErr = document.getElementById('err-modalExecEmail');
  document.getElementById('f-modalExecEmail')?.addEventListener('click', e => {
    if (e.target !== emailInput) {
      emailInput?.focus();
    }
  });
  emailInput?.addEventListener('input', () => {
    const val = (emailInput.value || '').trim();
    clearTimeout(execLookupTimeout);
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      updateExecAccountPreview(null);
      return;
    }

    const execId = document.getElementById('modalExecId')?.value;
    const existingRole = findExistingRoleForEmail(val, execId);
    if (existingRole) {
      if (emailErr) {
        emailErr.textContent = `This user already holds a role: ${existingRole}`;
        emailErr.style.display = 'block';
      }
      emailInput.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
      updateExecAccountPreview(null);
      return;
    } else {
      if (emailErr && emailErr.textContent?.includes('already holds a role')) {
        emailErr.style.display = 'none';
        emailInput.closest('.cc-field, .cc-mail-row')?.classList.remove('has-error');
      }
    }

    updateExecAccountPreview(null, true);
    execLookupTimeout = setTimeout(async () => {
      const acc = await lookupAccount(val);
      if ((emailInput.value || '').trim().toLowerCase() === (acc?.email || '')) {
        updateExecAccountPreview(acc);
      }
    }, 280);
  });

  emailInput?.addEventListener('change', async () => {
    const val = (emailInput.value || '').trim();
    if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      clearTimeout(execLookupTimeout);
      const execId = document.getElementById('modalExecId')?.value;
      const existingRole = findExistingRoleForEmail(val, execId);
      if (existingRole) {
        if (emailErr) {
          emailErr.textContent = `This user already holds a role: ${existingRole}`;
          emailErr.style.display = 'block';
        }
        emailInput.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
        updateExecAccountPreview(null);
        return;
      }

      updateExecAccountPreview(null, true);
      const acc = await lookupAccount(val);
      if ((emailInput.value || '').trim().toLowerCase() === (acc?.email || '')) {
        updateExecAccountPreview(acc);
      }
    }
  });

  // Backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeExecutiveModal();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeExecutiveModal();
    }
  });

  // Delete/Revoke executive from modal
  btnDelete?.addEventListener('click', () => {
    const commCode = document.getElementById('modalExecCommCode')?.value;
    const execId = document.getElementById('modalExecId')?.value;

    if (commCode && execId) {
      if (confirm('Are you sure you want to revoke this invitation?')) {
        deleteExecutive(commCode, execId);
        showInvitationToast('Invitation revoked.');
        closeExecutiveModal();
      }
    } else {
      closeExecutiveModal();
    }
  });

  // Submit modal form logic
  async function handleExecutiveFormSubmit() {
    let commCode = document.getElementById('modalExecCommCode')?.value;
    const activeComm = selectedCommittees.find(c => c.code === commCode) || selectedCommittees[activeCommitteeIndex] || selectedCommittees[0];
    if (!commCode) {
      commCode = activeComm?.code || 'UNSC';
    }

    const execId = document.getElementById('modalExecId')?.value;
    const emailInput = document.getElementById('modalExecEmail');
    const emailErr = document.getElementById('err-modalExecEmail');
    const noteInput = document.getElementById('modalExecNote');
    const roleInput = document.getElementById('modalExecRoleSelect');
    const submitBtn = document.getElementById('btnSubmitExecutiveModal');
    const submitText = document.getElementById('btnSubmitExecutiveModalText');

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

    const existingRole = findExistingRoleForEmail(emailVal, execId);
    if (existingRole) {
      if (emailErr) {
        emailErr.textContent = `Cannot assign double roles: User already holds ${existingRole}`;
        emailErr.style.display = 'block';
      }
      emailInput?.closest('.cc-field, .cc-mail-row')?.classList.add('has-error');
      emailInput?.focus();
      showInvitationToast(`Cannot assign double roles: User is already assigned to ${existingRole}.`, 'error');
      return;
    }

    if (emailErr) emailErr.style.display = 'none';
    emailInput?.closest('.cc-field, .cc-mail-row')?.classList.remove('has-error');

    // Quick lookup if verification hasn't completed yet
    if (!currentVerifiedExec) {
      try {
        const acc = await lookupAccount(emailVal);
        if (acc) currentVerifiedExec = acc;
      } catch (e) { }
    }

    // Determine role label
    const roleId = roleInput?.value || 'chair';
    let roleLabel = 'Chairperson';

    const found = AVAILABLE_ROLES.find(r => r.id === roleId);
    if (found) {
      roleLabel = found.label;
    } else if (roleId === 'custom') {
      const customVal = (customRoleInput?.value || '').trim();
      roleLabel = customVal || 'Custom Executive';
    } else {
      const triggerLabel = document.getElementById('modalRoleTriggerLabel');
      roleLabel = triggerLabel?.textContent?.trim() || roleId;
    }

    const noteVal = (noteInput?.value || '').trim();

    if (!ebRolesData[commCode]) {
      ebRolesData[commCode] = [];
    }

    const verifiedName = currentVerifiedExec?.name || formatDisplayNameFromEmail(emailVal);
    const verifiedAvatar = currentVerifiedExec?.avatar || null;
    const verifiedHandle = currentVerifiedExec?.handle || emailVal.split('@')[0];
    const commFullName = activeComm?.name || commCode;

    // Visual button feedback
    const originalText = submitText?.textContent || 'Send';
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = execId ? 'Saving...' : 'Sending...';

    try {
      if (execId) {
        // Update existing invitation
        const target = ebRolesData[commCode].find(x => x.id === execId);
        if (target) {
          target.roleId = roleId;
          target.roleLabel = roleLabel;
          target.email = emailVal;
          target.name = verifiedName;
          target.avatar = verifiedAvatar;
          target.handle = verifiedHandle;
          target.note = noteVal;
          target.invitedAt = new Date().toISOString();
        }
        const subjInput = document.getElementById('modalExecSubject');
        const subjectVal = (subjInput?.value || '').trim() || buildExecutiveInvitationSubject(roleLabel, commCode, commFullName);

        await dispatchInvitationRecord({
          id: execId,
          roleId,
          roleLabel,
          subject: subjectVal,
          recipientEmail: emailVal,
          recipientUid: currentVerifiedExec?.uid || null,
          recipientName: verifiedName,
          recipientAvatar: verifiedAvatar,
          roleType: 'executive',
          committeeCode: commCode,
          committeeName: commFullName,
          note: noteVal,
          invitedAt: new Date().toISOString()
        });
        // Automatically close audition for this role if it was open
        setRoleAudition(commCode, roleId, false, ebRolesData[commCode]);
        showInvitationToast(`Web invitation updated for ${verifiedName} (${emailVal})! It has arrived in their conference inbox.`);
      } else {
        // Add new invitation
        const newExec = {
          id: `exec-inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          roleId,
          roleLabel,
          email: emailVal,
          uid: currentVerifiedExec?.uid || null,
          name: verifiedName,
          avatar: verifiedAvatar,
          handle: verifiedHandle,
          note: noteVal,
          status: 'pending',
          invitedAt: new Date().toISOString()
        };
        ebRolesData[commCode].push(newExec);
        // Automatically close audition for this role if it was open
        setRoleAudition(commCode, roleId, false, ebRolesData[commCode]);

        const subjInput = document.getElementById('modalExecSubject');
        const subjectVal = (subjInput?.value || '').trim() || buildExecutiveInvitationSubject(roleLabel, commCode, commFullName);

        await dispatchInvitationRecord({
          id: newExec.id,
          roleId,
          roleLabel,
          subject: subjectVal,
          recipientEmail: emailVal,
          recipientUid: currentVerifiedExec?.uid || null,
          recipientName: verifiedName,
          recipientAvatar: verifiedAvatar,
          roleType: 'executive',
          committeeCode: commCode,
          committeeName: commFullName,
          note: noteVal,
          invitedAt: newExec.invitedAt
        });
        showInvitationToast(`Web invitation dispatched to ${verifiedName} (${emailVal}) for ${roleLabel}! It has arrived in their conference inbox.`);
      }

      // Immediately switch view to the committee the invitation was just dispatched for
      const targetCommIdx = selectedCommittees.findIndex(c => (c.code || '').toUpperCase().trim() === commCode.toUpperCase().trim());
      if (targetCommIdx !== -1) {
        activeCommitteeIndex = targetCommIdx;
      }

      // Synchronously sync to global wizardData and localStorage draft
      window.__wizardData = window.__wizardData || {};
      window.__wizardData.ebRoles = { ...ebRolesData };
      try {
        const raw = localStorage.getItem('cc_conference_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          draft.data = draft.data || {};
          draft.data.ebRoles = { ...ebRolesData };
          draft.updatedAt = new Date().toISOString();
          localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
        }
      } catch (e) { }

      renderExecutiveWorkspace();
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
      closeExecutiveModal();
    } catch (submitErr) {
      console.error('Failed to dispatch executive invitation:', submitErr);
      showInvitationToast('Invitation registered locally.', 'info');
      const targetCommIdx = selectedCommittees.findIndex(c => (c.code || '').toUpperCase().trim() === commCode.toUpperCase().trim());
      if (targetCommIdx !== -1) {
        activeCommitteeIndex = targetCommIdx;
      }
      window.__wizardData = window.__wizardData || {};
      window.__wizardData.ebRoles = { ...ebRolesData };
      try {
        const raw = localStorage.getItem('cc_conference_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          draft.data = draft.data || {};
          draft.data.ebRoles = { ...ebRolesData };
          draft.updatedAt = new Date().toISOString();
          localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
        }
      } catch (e) { }
      renderExecutiveWorkspace();
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
      closeExecutiveModal();
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
    handleExecutiveFormSubmit();
  };

  form.addEventListener('submit', doSubmit);
  const submitBtnEl = document.getElementById('btnSubmitExecutiveModal');
  submitBtnEl?.addEventListener('click', doSubmit);

  modalListenersAttached = true;
}

/**
 * Select role in custom Shadcn dropdown
 */
function selectRole(val, label) {
  const roleInput = document.getElementById('modalExecRoleSelect');
  const triggerLabel = document.getElementById('modalRoleTriggerLabel');
  const rolePopover = document.getElementById('modalRolePopover');
  const customRoleField = document.getElementById('modalCustomRoleField');
  const customRoleInput = document.getElementById('modalCustomRoleInput');

  if (roleInput) roleInput.value = val;
  if (triggerLabel) triggerLabel.textContent = label;
  if (customRoleInput) customRoleInput.value = label;

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

  if (customRoleField) customRoleField.style.display = 'none';

  // Update subject line and auto-generated invitation message
  const subjInput = document.getElementById('modalExecSubject');
  const commCode = document.getElementById('modalExecCommCode')?.value || 'UNSC';
  const commFullName = document.getElementById('modalExecCommFullName')?.textContent?.trim() || commCode;
  const rLabel = label || 'Executive Member';
  if (subjInput) subjInput.value = buildExecutiveInvitationSubject(rLabel, commCode, commFullName);

  const noteEl = document.getElementById('modalExecNote');
  if (noteEl && noteEl.dataset.autoGenerated === 'true') {
    noteEl.value = buildExecutiveInvitationMessage(currentVerifiedExec, rLabel, commFullName);
  }
}

/**
 * Open Executive Modal in Add or Edit Mode
 */
function openExecutiveModal(commCode, execId = null) {
  const modal = document.getElementById('executiveModal');
  if (!modal) return;

  const titleEl = document.getElementById('executiveModalTitle');
  const subtitleEl = document.getElementById('executiveModalSubtitle');
  const submitBtn = document.getElementById('btnSubmitExecutiveModal');
  const btnDelete = document.getElementById('btnDeleteModalExec');
  const idInput = document.getElementById('modalExecId');
  const commInput = document.getElementById('modalExecCommCode');
  const customRoleInput = document.getElementById('modalCustomRoleInput');
  const emailInput = document.getElementById('modalExecEmail');
  const emailErr = document.getElementById('err-modalExecEmail');
  const noteInput = document.getElementById('modalExecNote');
  const subjInput = document.getElementById('modalExecSubject');

  // Committee details in mail composer header
  const commBadge = document.getElementById('modalExecCommBadge');
  const commFullName = document.getElementById('modalExecCommFullName');
  const activeComm = selectedCommittees.find(c => c.code === commCode) || selectedCommittees[activeCommitteeIndex] || selectedCommittees[0];
  const resolvedCommCode = commCode || activeComm?.code || 'UNSC';
  if (commBadge) commBadge.textContent = resolvedCommCode;
  if (commFullName) {
    const code = resolvedCommCode;
    const name = activeComm?.name || code || 'Committee';
    commFullName.textContent = (name && code && name !== code) ? `${name} (${code})` : (name || code || 'Committee');
  }

  const activeCommName = activeComm?.name || resolvedCommCode;
  if (commInput) commInput.value = resolvedCommCode;
  if (idInput) idInput.value = execId || '';
  if (emailErr) emailErr.style.display = 'none';
  emailInput?.closest('.cc-field')?.classList.remove('has-error');

  if (execId) {
    // Edit Mode
    const list = ebRolesData[commCode] || [];
    const exec = list.find(x => x.id === execId);

    if (titleEl) titleEl.textContent = 'Edit Invitation';
    if (subtitleEl) subtitleEl.textContent = `Update invitation for ${commCode}.`;
    const submitText = document.getElementById('btnSubmitExecutiveModalText');
    if (submitText) submitText.textContent = 'Save';
    if (submitBtn) {
      submitBtn.setAttribute('title', 'Save');
      submitBtn.setAttribute('aria-label', 'Save');
    }
    if (btnDelete) {
      btnDelete.style.display = 'inline-flex';
    }

    if (exec) {
      const rLabel = (exec.roleLabel === 'Chair' || !exec.roleLabel) ? 'Chairperson' : exec.roleLabel;
      let roleObj = AVAILABLE_ROLES.find(r => r.id === exec.roleId || r.label.toLowerCase() === rLabel.toLowerCase());
      if (!roleObj) {
        roleObj = { id: exec.roleId || ('custom_' + rLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')), label: rLabel, isCustom: true };
        AVAILABLE_ROLES.push(roleObj);
      }
      const rolePopover = document.getElementById('modalRolePopover');
      if (rolePopover && !rolePopover.querySelector(`.cc-eb-role-item[data-value="${roleObj.id}"]`)) {
        const addOption = rolePopover.querySelector('.cc-eb-role-item-add');
        const domItem = document.createElement('div');
        domItem.className = 'cc-eb-role-item';
        domItem.dataset.value = roleObj.id;
        domItem.dataset.label = roleObj.label;
        domItem.setAttribute('role', 'option');
        domItem.setAttribute('aria-selected', 'false');
        domItem.setAttribute('tabindex', '0');
        domItem.innerHTML = `
          <span class="cc-eb-role-item-name">${escapeHtml(roleObj.label)}</span>
          <ion-icon name="checkmark-outline" class="cc-eb-role-check is-hidden"></ion-icon>
        `;
        if (addOption) {
          rolePopover.insertBefore(domItem, addOption);
        } else {
          rolePopover.appendChild(domItem);
        }
      }
      selectRole(roleObj.id, rLabel);
      if (customRoleInput) customRoleInput.value = rLabel;
      if (subjInput) subjInput.value = buildExecutiveInvitationSubject(rLabel, resolvedCommCode, activeCommName);

      if (emailInput) {
        emailInput.value = exec.email || '';
        if (exec.email) {
          updateExecAccountPreview(null, true);
          lookupAccount(exec.email).then(acc => {
            if (acc) {
              if (exec.avatar) acc.avatar = exec.avatar;
              if (exec.name) acc.name = exec.name;
              updateExecAccountPreview(acc);
            }
          });
        } else {
          updateExecAccountPreview(null);
        }
      }
      if (noteInput) {
        noteInput.value = exec.note || buildExecutiveInvitationMessage(currentVerifiedExec, exec.roleLabel, activeCommName);
        noteInput.dataset.autoGenerated = exec.note ? 'false' : 'true';
      }
    }
  } else {
    // Add Mode
    if (titleEl) titleEl.textContent = 'New Invitation';
    if (subtitleEl) subtitleEl.textContent = 'Compose and dispatch an invitation to a registered account.';
    const submitText = document.getElementById('btnSubmitExecutiveModalText');
    if (submitText) submitText.textContent = 'Send';
    if (submitBtn) {
      submitBtn.setAttribute('title', 'Send');
      submitBtn.setAttribute('aria-label', 'Send');
    }
    if (btnDelete) {
      btnDelete.style.display = 'none';
    }

    selectRole('chair', 'Chairperson');
    if (subjInput) subjInput.value = buildExecutiveInvitationSubject('Chairperson', resolvedCommCode, activeCommName);
    if (customRoleInput) customRoleInput.value = '';
    if (emailInput) emailInput.value = '';
    if (noteInput) {
      noteInput.value = buildExecutiveInvitationMessage(null, 'Chairperson', activeCommName);
      noteInput.dataset.autoGenerated = 'true';
    }
    const blueTick = document.getElementById('modalExecBlueTick');
    if (blueTick) {
      blueTick.classList.remove('is-visible');
      blueTick.style.display = 'none';
    }
    updateExecAccountPreview(null);
    currentVerifiedExec = null;
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  setTimeout(() => {
    emailInput?.focus();
  }, 100);
}

/**
 * Close Executive Modal
 */
function closeExecutiveModal() {
  const modal = document.getElementById('executiveModal');
  const roleWrap = document.getElementById('modalRoleDropdownWrap');
  if (roleWrap) {
    roleWrap.classList.remove('is-open');
    const roleTrigger = document.getElementById('modalRoleTrigger');
    roleTrigger?.setAttribute('aria-expanded', 'false');
  }
  clearTimeout(execLookupTimeout);
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
  const blueTick = document.getElementById('modalExecBlueTick');
  if (blueTick) {
    blueTick.classList.remove('is-visible');
    blueTick.style.display = 'none';
  }
  const noteInput = document.getElementById('modalExecNote');
  if (noteInput) noteInput.dataset.autoGenerated = 'false';
  updateExecAccountPreview(null);
}

/**
 * Delete an executive invitation card
 */
function deleteExecutive(commCode, execId) {
  if (!ebRolesData[commCode]) return;
  const targetExec = ebRolesData[commCode].find(x => x.id === execId || x.roleId === execId);
  ebRolesData[commCode] = ebRolesData[commCode].filter(x => x.id !== execId);
  window.__wizardData = window.__wizardData || {};
  window.__wizardData.ebRoles = { ...ebRolesData };
  try {
    const raw = localStorage.getItem('cc_conference_draft');
    if (raw) {
      const draft = JSON.parse(raw);
      draft.data = draft.data || {};
      draft.data.ebRoles = { ...ebRolesData };
      draft.updatedAt = new Date().toISOString();
      localStorage.setItem('cc_conference_draft', JSON.stringify(draft));
    }
  } catch (e) { }
  revokeInvitationRecord(execId, commCode, targetExec);
  if (typeof window.saveConferenceDraft === 'function') {
    try { window.saveConferenceDraft(); } catch (e) { }
  }
  renderExecutiveWorkspace();
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Scroll active sidebar item into view
 */
function scrollSidebarItemIntoView(idx) {
  setTimeout(() => {
    const list = document.getElementById('ebSidebarList');
    const item = list?.querySelector(`.cc-eb-sidebar-comm-item[data-index="${idx}"]`);
    if (item && list) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 40);
}

/**
 * Synchronize executive grid scroll height dynamically with the committees row
 * Keeps the vertical gray divider line and workspace height perfectly identical
 * whether viewing the inbox or reading an opened mail.
 */
export function syncExecutiveScrollHeight() {
  const sidebar = document.querySelector('.cc-eb-committees-sidebar');
  const activePane = document.getElementById('ebGridContainer') || document.getElementById('ebMailReadPane');
  const header = document.querySelector('.cc-eb-main-header');

  if (!sidebar || !activePane) return;

  if (window.innerWidth <= 960) {
    activePane.style.height = '';
    activePane.style.maxHeight = '65vh';
    activePane.style.minHeight = '';
    return;
  }

  // Use the unstretched inner content of the sidebar to get true natural height
  const sidebarInner = document.querySelector('.cc-eb-sidebar-sticky-inner');
  const sidebarNaturalHeight = sidebarInner ? (sidebarInner.offsetHeight + 40) : (sidebar.offsetHeight || 0);
  const headerHeight = header ? header.offsetHeight : 60;
  const paddingOffset = 42;

  const heightMatchingCommittees = Math.max(0, sidebarNaturalHeight - headerHeight - paddingOffset);
  const minViewportScroll = Math.max(560, window.innerHeight - 280);
  const dynamicHeight = Math.max(heightMatchingCommittees, minViewportScroll);

  if (window.__ebActiveTab === 'auditions') {
    activePane.style.height = 'auto';
    activePane.style.maxHeight = `${dynamicHeight}px`;
    activePane.style.minHeight = '0';
  } else {
    activePane.style.height = `${dynamicHeight}px`;
    activePane.style.maxHeight = `${dynamicHeight}px`;
    activePane.style.minHeight = `${dynamicHeight}px`;
  }
}
