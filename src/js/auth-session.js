/**
 * Modern United Nations - Production-Grade Auth & Session Management (auth-session.js)
 * Manages JWT storage, cached user profile details, and prevents redundant Firestore fetches.
 */

const SESSION_KEY = 'mun_user_session';
const JWT_KEY = 'mun_jwt_token';
const CACHED_USER_KEY = 'mun_cached_user';

/**
 * Persists the user's JWT and complete profile details into localStorage
 * @param {Object} user - Firebase User object
 * @param {Object} userData - Firestore user document data
 * @param {string} [jwtToken] - Optional JWT ID token (will fetch if omitted)
 */
export async function saveSession(user, userData = {}, jwtToken = null) {
  if (!user) return null;

  try {
    const token = jwtToken || (await user.getIdToken());
    const displayName = userData.displayName || user.displayName || (user.email ? user.email.split('@')[0] : 'Delegate');
    const initial = (displayName[0] || 'U').toUpperCase();
    const role = userData.accountType || 'individual';
    const profile = userData.profile || {};
    const stats = userData.stats || {};
    const preferences = userData.preferences || {};
    const registeredConferences = Array.isArray(userData.registeredConferences) ? userData.registeredConferences : [];
    const membershipTier = userData.membershipTier || 'Individual Scholar';
    const isProfileComplete = userData.isProfileComplete ?? (role !== undefined && Boolean(profile.fullName || profile.institutionName));

    const country = userData.country || profile.country || '';
    const state = userData.state || profile.state || '';
    const city = userData.city || profile.city || '';
    if (country && !profile.country) profile.country = country;
    if (state && !profile.state) profile.state = state;
    if (city && !profile.city) profile.city = city;

    const providerPhoto = Array.isArray(user.providerData)
      ? user.providerData.find(p => p && p.photoURL)?.photoURL
      : null;
    const photoURL =
      userData.photoURL ||
      userData.photoUrl ||
      user.photoURL ||
      providerPhoto ||
      profile.photoURL ||
      profile.photoUrl ||
      profile.avatar ||
      profile.avatarUrl ||
      userData.avatar ||
      userData.avatarUrl ||
      userData.profileImage ||
      userData.picture ||
      null;

    const sessionData = {
      uid: user.uid,
      email: user.email,
      displayName,
      initial,
      photoURL,
      avatar: photoURL,
      accountType: role,
      role,
      country,
      state,
      city,
      profile,
      stats,
      preferences,
      registeredConferences,
      membershipTier,
      isProfileComplete,
      jwtToken: token,
      updatedAt: userData.updatedAt || new Date().toISOString(),
      savedAt: Date.now()
    };

    localStorage.setItem(JWT_KEY, token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify({
      name: displayName,
      initial,
      email: user.email,
      role,
      photoURL,
      avatar: photoURL
    }));

    return sessionData;
  } catch (err) {
    console.warn('Failed to save session to localStorage:', err);
    return null;
  }
}

/**
 * Synchronously retrieves the active user session from localStorage
 * @returns {Object|null} Cached session object or null
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.uid) return null;
    return session;
  } catch (e) {
    return null;
  }
}

/**
 * Synchronously retrieves the stored JWT string
 * @returns {string|null} JWT token string or null
 */
export function getJwtToken() {
  return localStorage.getItem(JWT_KEY) || null;
}

/**
 * Updates partial profile data in the cached session
 * @param {Object} partialData - Fields to update ( { profile: {...}, displayName: '...' })
 */
export function updateSessionProfile(partialData = {}) {
  try {
    const session = getSession();
    if (!session) return;

    const updated = {
      ...session,
      ...partialData,
      profile: { ...(session.profile || {}), ...(partialData.profile || {}) },
      stats: { ...(session.stats || {}), ...(partialData.stats || {}) },
      preferences: { ...(session.preferences || {}), ...(partialData.preferences || {}) },
      updatedAt: new Date().toISOString()
    };

    if (partialData.displayName) {
      updated.displayName = partialData.displayName;
      updated.initial = (partialData.displayName[0] || 'U').toUpperCase();
    }
    if (partialData.country || partialData.profile?.country) {
      updated.country = partialData.country || partialData.profile?.country;
    }
    if (partialData.state || partialData.profile?.state) {
      updated.state = partialData.state || partialData.profile?.state;
    }
    if (partialData.city || partialData.profile?.city) {
      updated.city = partialData.city || partialData.profile?.city;
    }
    if (partialData.accountType) {
      updated.accountType = partialData.accountType;
      updated.role = partialData.accountType;
    }
    if (partialData.photoURL !== undefined || partialData.avatar !== undefined || partialData.profile?.photoURL !== undefined) {
      const pUrl = partialData.photoURL || partialData.avatar || partialData.profile?.photoURL || null;
      updated.photoURL = pUrl;
      updated.avatar = pUrl;
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify({
      name: updated.displayName,
      initial: updated.initial,
      email: updated.email,
      role: updated.role,
      photoURL: updated.photoURL || null
    }));
  } catch (e) {
    console.warn('Failed to update session profile in localStorage:', e);
  }
}

/**
 * Clears all user session and JWT keys from localStorage
 */
export function clearSession() {
  try {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CACHED_USER_KEY);
    localStorage.removeItem('mun_auth_token');
  } catch (e) {}
}

/**
 * Ensures user data is available WITHOUT fetching from Firestore if already cached.
 * If session is missing or for a different UID, it fetches from Firestore once and caches it.
 * @param {Object} auth - Firebase Auth instance
 * @param {Object} db - Firestore instance
 * @param {Object} user - Firebase User object
 * @param {Function} getDocFn - Firestore getDoc function
 * @param {Function} docFn - Firestore doc function
 * @returns {Promise<Object>} The resolved session data
 */
export async function ensureUserSession(auth, db, user, getDocFn, docFn) {
  if (!user) {
    clearSession();
    return null;
  }

  const existingSession = getSession();

  // If we already have a valid session matching this user's UID:
  // USE CACHED DATA IMMEDIATELY - DO NOT FETCH FROM FIRESTORE!
  if (existingSession && existingSession.uid === user.uid) {
    // Check if user or Google providerData has fresh photo not yet cached
    const providerPhoto = Array.isArray(user.providerData)
      ? user.providerData.find(p => p && p.photoURL)?.photoURL
      : null;
    const freshPhoto = user.photoURL || providerPhoto || null;
    if (freshPhoto && (!existingSession.photoURL || existingSession.photoURL !== freshPhoto)) {
      existingSession.photoURL = freshPhoto;
      existingSession.avatar = freshPhoto;
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(existingSession));
        const cached = JSON.parse(localStorage.getItem(CACHED_USER_KEY) || '{}');
        cached.photoURL = freshPhoto;
        cached.avatar = freshPhoto;
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(cached));
      } catch (e) {}
    }

    // Silently refresh token in background without blocking UI
    user.getIdToken().then(freshToken => {
      if (freshToken && freshToken !== existingSession.jwtToken) {
        localStorage.setItem(JWT_KEY, freshToken);
        existingSession.jwtToken = freshToken;
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(existingSession));
        } catch (e) {}
      }
    }).catch(() => {});

    return existingSession;
  }

  // Cache miss or user mismatch: Fetch from Firestore once and cache
  try {
    const [token, snap] = await Promise.all([
      user.getIdToken(),
      getDocFn(docFn(db, 'users', user.uid))
    ]);

    const userData = snap.exists() ? snap.data() : { isProfileComplete: false };
    const saved = await saveSession(user, userData, token);
    return saved;
  } catch (err) {
    console.warn('Could not fetch user profile from Firestore:', err);
    // Fallback minimal session
    return await saveSession(user, { isProfileComplete: true });
  }
}

