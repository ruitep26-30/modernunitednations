/**
 * Modern United Nations - Canva-Style Navigation Drawer Module (drawer.js)
 * Production-Grade Persistent Engine: Zero Glitch, Zero Lag, Zero Reframe on Reload
 */

// 1. Synchronously hydrate state & cached user profile before first paint
(function restoreDrawerStateEarly() {
  try {
    const isDesktop = window.innerWidth >= 992;
    const isPanelOpen = localStorage.getItem('mun_drawer_panel_open') === 'true';
    if (isDesktop && isPanelOpen) {
      document.documentElement.classList.add('drawer-docked-open');
    }

    const sessionStr = localStorage.getItem('mun_user_session') || localStorage.getItem('mun_cached_user');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const applyCached = () => {
        const navAvatar = document.getElementById('navAvatar');
        const mobileAvatar = document.getElementById('mobileAvatar');
        const navDisplayName = document.getElementById('navDisplayName');
        const navCreateBtn = document.getElementById('navCreateBtn');
        const initial = session.initial || (session.displayName ? session.displayName[0].toUpperCase() : null);
        const name = session.displayName || session.name;
        const role = session.accountType || session.role;
        const photoURL = session.photoURL || session.avatar || session.profile?.photoURL || session.profile?.avatar || null;
        if (navAvatar) {
          if (photoURL) {
            navAvatar.innerHTML = `<img src="${photoURL}" alt="${name || 'User'}">`;
          } else if (initial) {
            navAvatar.textContent = initial;
          }
        }
        if (mobileAvatar) {
          if (photoURL) {
            mobileAvatar.innerHTML = `<img src="${photoURL}" alt="${name || 'User'}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
          } else if (initial) {
            mobileAvatar.textContent = initial;
          }
        }
        if (navDisplayName && name) navDisplayName.textContent = name;
        if (navCreateBtn && role) {
          navCreateBtn.style.display = role === 'institution' ? 'flex' : 'none';
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCached);
      } else {
        applyCached();
      }
    }
  } catch (e) {
    // Fail silently on restricted environments
  }
})();

/**
 * Universal Avatar Renderer - renders photoURL image if available, else initial text
 */
export function renderUserAvatar(userData) {
  if (!userData) return;
  const navAvatar = document.getElementById('navAvatar');
  const mobileAvatar = document.getElementById('mobileAvatar');
  const navDisplayName = document.getElementById('navDisplayName');
  const displayName = userData.displayName || userData.name || (userData.email ? userData.email.split('@')[0] : 'Delegate');
  const initial = userData.initial || (displayName[0] || 'D').toUpperCase();
  const providerPhoto = Array.isArray(userData.providerData)
    ? userData.providerData.find(p => p && p.photoURL)?.photoURL
    : null;
  const photoURL =
    userData.photoURL ||
    userData.photoUrl ||
    userData.avatar ||
    userData.avatarUrl ||
    userData.picture ||
    providerPhoto ||
    userData.profile?.photoURL ||
    userData.profile?.photoUrl ||
    userData.profile?.avatar ||
    userData.profile?.avatarUrl ||
    userData.profile?.picture ||
    null;

  if (navDisplayName) navDisplayName.textContent = displayName;
  if (navAvatar) {
    if (photoURL) {
      navAvatar.innerHTML = `<img src="${photoURL}" alt="${displayName}" onerror="this.parentElement.textContent='${initial}'">`;
    } else {
      navAvatar.textContent = initial;
    }
  }
  if (mobileAvatar) {
    if (photoURL) {
      mobileAvatar.innerHTML = `<img src="${photoURL}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">`;
    } else {
      mobileAvatar.textContent = initial;
    }
  }
}

/**
 * Persistent Avatar Mutation Safeguard
 * Prevents legacy or external scripts from stripping out the user's avatar image
 */
function attachAvatarProtector() {
  const navAvatar = document.getElementById('navAvatar');
  const mobileAvatar = document.getElementById('mobileAvatar');

  const checkAndProtect = (el, isMobile) => {
    if (!el) return;
    const sessionStr = localStorage.getItem('mun_user_session') || localStorage.getItem('mun_cached_user');
    if (!sessionStr) return;
    try {
      const session = JSON.parse(sessionStr);
      const photoURL =
        session.photoURL ||
        session.photoUrl ||
        session.avatar ||
        session.avatarUrl ||
        session.picture ||
        session.profile?.photoURL ||
        session.profile?.photoUrl ||
        session.profile?.avatar ||
        session.profile?.avatarUrl;
      const displayName = session.displayName || session.name || 'User';
      const initial = session.initial || (displayName ? displayName[0].toUpperCase() : 'U');
      if (photoURL && !el.querySelector('img')) {
        if (isMobile) {
          el.innerHTML = `<img src="${photoURL}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">`;
        } else {
          el.innerHTML = `<img src="${photoURL}" alt="${displayName}" onerror="this.parentElement.textContent='${initial}'">`;
        }
      }
    } catch (e) {}
  };

  if (navAvatar && !navAvatar.__mun_protected) {
    navAvatar.__mun_protected = true;
    checkAndProtect(navAvatar, false);
    const obs = new MutationObserver(() => checkAndProtect(navAvatar, false));
    obs.observe(navAvatar, { childList: true });
  }

  if (mobileAvatar && !mobileAvatar.__mun_protected) {
    mobileAvatar.__mun_protected = true;
    checkAndProtect(mobileAvatar, true);
    const obs = new MutationObserver(() => checkAndProtect(mobileAvatar, true));
    obs.observe(mobileAvatar, { childList: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachAvatarProtector);
} else {
  attachAvatarProtector();
}

/**
 * Universal Right-End Notification Panel Component (Single Root Engine)
 */
function setupUniversalNotificationDrawer() {
  // Remove legacy sliding drawer and backdrop if present in DOM
  try {
    document.getElementById('drawerOverlay')?.remove();
    document.getElementById('notificationDrawer')?.remove();
  } catch (e) {}

  function getReadNotifIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem('mun_read_notifs') || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function getDismissedNotifIds() {
    try {
      return new Set(JSON.parse(localStorage.getItem('mun_dismissed_notifs') || '[]'));
    } catch (e) {
      return new Set();
    }
  }

  function loadInvitations() {
    let pending = [];
    let sent = [];
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('mun_user_session') || '{}');
      const userEmail = (user.email || '').toLowerCase().trim();
      const local = JSON.parse(localStorage.getItem('mun_local_invitations') || '[]');
      const cloud = JSON.parse(localStorage.getItem('mun_cloud_invitations') || '[]');

      const mergedMap = new Map();
      [...cloud, ...local].forEach(item => {
        if (!item) return;
        const key = item.id || `${item.confId}_${item.roleLabel}_${item.recipientEmail}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
        }
      });

      mergedMap.forEach(inv => {
        const rEmail = (inv.recipientEmail || '').toLowerCase().trim();
        const oEmail = (inv.organizerEmail || '').toLowerCase().trim();
        const oUid = inv.organizerUid || inv.createdBy;
        const status = (inv.status || 'pending').toLowerCase();

        if (rEmail === userEmail && status === 'pending') {
          pending.push(inv);
        } else if (oEmail === userEmail || (user.uid && oUid === user.uid)) {
          sent.push(inv);
        }
      });
    } catch (e) {}
    return { pending, sent, user };
  }

  function updateNotificationBadges() {
    const { pending } = loadInvitations();
    const readSet = getReadNotifIds();
    const dismissedSet = getDismissedNotifIds();
    const visiblePending = pending.filter(inv => !dismissedSet.has(String(inv.id)));
    const unreadCount = visiblePending.filter(inv => !readSet.has(String(inv.id))).length;

    // Badges on sidebar, mobile, and desktop buttons
    const sidebarBadge = document.getElementById('homeNotifBadge');
    const mobileBadge = document.getElementById('mobileNotifBadge');
    const desktopBadge = document.getElementById('notificationCount');

    [sidebarBadge, mobileBadge, desktopBadge].forEach(badge => {
      if (!badge) return;
      badge.textContent = String(unreadCount);
      badge.setAttribute('data-count', String(unreadCount));
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    });
  }

  function openNotificationDrawer(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!window.location.pathname.endsWith('notifications.html')) {
      window.location.href = 'notifications.html';
    }
  }

  function closeNotificationDrawer() {
    // No-op
  }

  // Real-time synchronization across tabs and pages
  try {
    const bc = new BroadcastChannel('mun_invitations_channel');
    bc.onmessage = () => {
      updateNotificationBadges();
    };
  } catch (e) {}

  window.addEventListener('storage', (e) => {
    if (e.key && (e.key.startsWith('mun_') || e.key === 'mun_local_invitations')) {
      updateNotificationBadges();
    }
  });

  window.addEventListener('mun:invitation-accepted', updateNotificationBadges);
  window.addEventListener('mun:invitation-declined', updateNotificationBadges);
  window.addEventListener('mun:invitation-dispatched', updateNotificationBadges);

  // Initial badge update
  updateNotificationBadges();

  return {
    open: openNotificationDrawer,
    close: closeNotificationDrawer,
    render: () => {},
    updateBadges: updateNotificationBadges,
    sync(invList) {
      if (Array.isArray(invList)) {
        try {
          localStorage.setItem('mun_cloud_invitations', JSON.stringify(invList));
        } catch (e) {}
      }
      updateNotificationBadges();
    }
  };
}

export function initDrawer(options = {}) {
  attachAvatarProtector();

  const notifEngine = setupUniversalNotificationDrawer();

  // Expose on window for universal access across any script
  window.munOpenNotificationDrawer = notifEngine.open;
  window.munCloseNotificationDrawer = notifEngine.close;
  window.munRenderNotificationDrawer = notifEngine.render;
  window.munUpdateNotificationBadges = notifEngine.updateBadges;
  window.munSyncNotifications = notifEngine.sync;

  const sideDrawer = document.getElementById('sideDrawer');
  const drawerToggleBtn = document.getElementById('drawerToggleBtn');
  const unifiedFlyoutPanel = document.getElementById('unifiedFlyoutPanel');
  const flyoutTitleText = document.getElementById('flyoutTitleText');
  const mobileDrawerOpenBtn = document.getElementById('drawerOpenBtn');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const homeMainContent = document.querySelector('.home-main-content');
  const userProfileNav = document.getElementById('userProfileNav');
  const sidebarBottom = sideDrawer?.querySelector('.canva-sidebar-bottom');
  const sidebarNotifItem = document.getElementById('sidebarNotifItem');

  // Open right-hand notification drawer when clicking notification buttons
  const triggerNotif = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    notifEngine.open();
  };

  if (sidebarNotifItem && !sidebarNotifItem.__mun_notif_bound) {
    sidebarNotifItem.__mun_notif_bound = true;
    sidebarNotifItem.removeAttribute('data-view');
    sidebarNotifItem.style.cursor = 'pointer';
    const notifBtn = sidebarNotifItem.querySelector('#homeNotifBtn');
    if (notifBtn) {
      notifBtn.removeAttribute('data-view');
      notifBtn.addEventListener('click', triggerNotif);
    }
    sidebarNotifItem.addEventListener('click', triggerNotif);
  }

  const openNotifDesktop = document.getElementById('openNotifications');
  if (openNotifDesktop && !openNotifDesktop.__mun_notif_bound) {
    openNotifDesktop.__mun_notif_bound = true;
    openNotifDesktop.addEventListener('click', triggerNotif);
  }

  const mobileNotif = document.getElementById('mobileNotifBtn');
  if (mobileNotif && !mobileNotif.__mun_notif_bound) {
    mobileNotif.__mun_notif_bound = true;
    mobileNotif.addEventListener('click', triggerNotif);
  }

  // Ensure old #view-alerts is removed from left drawer
  document.getElementById('view-alerts')?.remove();

  const navItemsWithViews = document.querySelectorAll('[data-view]');
  const panelViews = document.querySelectorAll('.canva-panel-view');
  const navCreateBtn = document.getElementById('navCreateBtn');
  const munDrawerSearch = document.getElementById('munDrawerSearch');

  const defaultPageTitle = options.title !== undefined ? options.title : ((flyoutTitleText ? flyoutTitleText.textContent.trim() : '') || 'Modern United Nations');

  const viewMeta = {
    mainMenu: { title: defaultPageTitle },
    conferences: { title: 'Conferences' },
    committees: { title: 'Committees' },
    resources: { title: 'Research' },
    resolutions: { title: 'Resolutions' },
    ngos: { title: 'NGOs' },
    pricing: { title: 'Pricing' },
    profile: { title: options.profileTitle !== undefined ? options.profileTitle : '' }
  };

  const isDesktop = () => window.innerWidth >= 992;
  let activeViewKey = null;
  let activeSourceBtn = null;

  function resetRailActiveStates() {
    document.querySelectorAll('.canva-nav-item, .canva-sidebar-toggle-btn').forEach(el => {
      el.classList.remove('is-active');
    });
  }

  const getAutoTabId = () => {
    if (options.activeTabId !== undefined) return options.activeTabId;
    const path = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase().split('?')[0].split('#')[0];
    if (path === 'home.html' || path === 'index.html' || path === '') return 'navTabHome';
    if (path.startsWith('conference')) return 'navTabConferences';
    if (path.startsWith('committee')) return 'navTabCommittees';
    if (path.startsWith('resource') || path.startsWith('country')) return 'navTabResources';
    if (path.startsWith('resolution')) return 'navTabResolutions';
    if (path.startsWith('ngo')) return 'navTabNGOs';
    if (path.startsWith('notification')) return 'sidebarNotifItem';
    if (path.startsWith('profile')) return 'userProfileNav';
    return null;
  };

  function updateRailActiveState(activeTarget = null) {
    const currentActivePageTabId = getAutoTabId();
    resetRailActiveStates();

    // Determine target active tab:
    // If an explicit target tab was passed (and it's not the drawer toggle button), activate that;
    // otherwise activate the page's own active tab.
    let targetTabId = currentActivePageTabId;
    if (activeTarget && activeTarget !== drawerToggleBtn && activeTarget !== 'drawerToggleBtn') {
      if (typeof activeTarget === 'string') {
        targetTabId = activeTarget;
      } else if (activeTarget.id) {
        targetTabId = activeTarget.id;
      }
    }

    if (targetTabId) {
      const activeTab = document.getElementById(targetTabId);
      if (activeTab) {
        activeTab.classList.add('is-active');
      }
    }

    // Toggle button itself must NEVER hold a permanent active state
    if (drawerToggleBtn) {
      drawerToggleBtn.classList.remove('is-active');
    }
  }

  function openFlyout(viewKey, persist = true, sourceBtn = null) {
    if (!unifiedFlyoutPanel) return;

    panelViews.forEach(v => v.classList.remove('is-active'));
    let targetView = document.getElementById(`view-${viewKey}`);
    if (!targetView) {
      targetView = document.getElementById('view-mainMenu') || panelViews[0];
    }
    if (targetView) targetView.classList.add('is-active');

    const meta = viewMeta[viewKey] || viewMeta.mainMenu;
    if (flyoutTitleText) flyoutTitleText.textContent = meta.title;

    // Toggle search wrap visibility for profile settings view
    const searchWrap = document.querySelector('.canva-panel-search-wrap');
    if (searchWrap) {
      searchWrap.style.display = (viewKey === 'profile') ? 'none' : '';
    }

    if (!sourceBtn) {
      if (viewKey === 'profile') {
        sourceBtn = document.getElementById('userProfileNav');
      }
    }

    updateRailActiveState(sourceBtn);

    if (drawerToggleBtn) {
      drawerToggleBtn.setAttribute('title', 'Close navigation panel');
    }

    unifiedFlyoutPanel.classList.add('is-open');
    if (homeMainContent && isDesktop()) {
      homeMainContent.classList.add('panel-expanded');
    }
    if (!isDesktop() && drawerBackdrop) {
      drawerBackdrop.classList.add('is-open');
    }

    if (persist && isDesktop()) {
      try {
        localStorage.setItem('mun_drawer_panel_open', 'true');
        localStorage.setItem('mun_drawer_active_view', viewKey);
        document.documentElement.classList.add('drawer-docked-open');
      } catch (e) { }
    }

    activeViewKey = viewKey;
    activeSourceBtn = sourceBtn;
  }

  function closeFlyout(persist = true) {
    if (!unifiedFlyoutPanel) return;
    unifiedFlyoutPanel.classList.remove('is-open');
    if (homeMainContent) homeMainContent.classList.remove('panel-expanded');

    updateRailActiveState(null);
    if (flyoutTitleText) flyoutTitleText.textContent = defaultPageTitle;

    if (drawerToggleBtn) {
      drawerToggleBtn.setAttribute('title', 'Toggle navigation panel');
    }

    activeViewKey = null;
    activeSourceBtn = null;
    if (!isDesktop() && drawerBackdrop) {
      drawerBackdrop.classList.remove('is-open');
    }

    if (persist && isDesktop()) {
      try {
        localStorage.setItem('mun_drawer_panel_open', 'false');
        document.documentElement.classList.remove('drawer-docked-open');
      } catch (e) { }
    }
  }

  function switchView(viewKey, sourceBtn = null) {
    if (!unifiedFlyoutPanel) return;
    const isPanelOpen = unifiedFlyoutPanel.classList.contains('is-open');

    // Toggle closed if clicking the currently open view button
    if (isPanelOpen && activeViewKey === viewKey && (sourceBtn === activeSourceBtn || (!sourceBtn && !activeSourceBtn))) {
      closeFlyout(true);
      return;
    }

    openFlyout(viewKey, true, sourceBtn);
  }

  // Restore saved state without animation glitch on load
  const isProfilePage = options.activeTabId === 'userProfileNav' || options.defaultView === 'profile';
  const savedIsOpen = isProfilePage ? true : (localStorage.getItem('mun_drawer_panel_open') === 'true');
  const savedViewKey = isProfilePage ? 'profile' : ((localStorage.getItem('mun_drawer_active_view') === 'alerts' ? 'mainMenu' : localStorage.getItem('mun_drawer_active_view')) || 'mainMenu');

  if (isDesktop() && savedIsOpen && unifiedFlyoutPanel) {
    openFlyout(savedViewKey, false, null);
  } else {
    updateRailActiveState(null);
    if (flyoutTitleText) flyoutTitleText.textContent = defaultPageTitle;
  }

  // Smoothly remove preload class after initial paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.remove('preload');
    });
  });

  // Dedicated click handler for top Drawer Toggle Icon
  if (drawerToggleBtn) {
    drawerToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!unifiedFlyoutPanel) return;
      if (unifiedFlyoutPanel.classList.contains('is-open')) {
        closeFlyout(true);
      } else {
        openFlyout('mainMenu', true, drawerToggleBtn);
      }
    });
  }

  // Attach rail view buttons (excluding drawerToggleBtn)
  navItemsWithViews.forEach(btn => {
    if (btn === drawerToggleBtn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const viewKey = btn.getAttribute('data-view');
      switchView(viewKey, btn);
    });
  });

  // Back to Main Menu buttons
  document.querySelectorAll('.canva-back-to-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openFlyout('mainMenu', true, null);
    });
  });

  // Accordion Expand / Collapse
  document.querySelectorAll('.canva-accordion-header').forEach(header => {
    header.addEventListener('click', (e) => {
      e.preventDefault();
      const group = header.closest('.canva-accordion-group');
      if (!group) return;
      const isCollapsed = group.classList.toggle('is-collapsed');
      header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    });
  });

  // Real-time Search Filter in Drawer
  if (munDrawerSearch) {
    munDrawerSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const groups = document.querySelectorAll('#view-mainMenu .canva-accordion-group');

      groups.forEach(group => {
        const items = group.querySelectorAll('.canva-sub-item');
        let groupHasMatch = false;

        items.forEach(item => {
          const title = item.querySelector('.canva-sub-title')?.textContent.toLowerCase() || '';
          const desc = item.querySelector('.canva-sub-desc')?.textContent.toLowerCase() || '';
          const match = !query || title.includes(query) || desc.includes(query);

          if (match) {
            item.classList.remove('is-hidden');
            if (query) item.classList.add('is-match');
            else item.classList.remove('is-match');
            groupHasMatch = true;
          } else {
            item.classList.add('is-hidden');
            item.classList.remove('is-match');
          }
        });

        if (query && groupHasMatch) {
          group.classList.remove('is-collapsed');
          const hdr = group.querySelector('.canva-accordion-header');
          if (hdr) hdr.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  // Mobile drawer controls
  function openMobileDrawer() {
    if (sideDrawer) sideDrawer.classList.add('is-open');
    if (drawerBackdrop) drawerBackdrop.classList.add('is-open');
  }

  function closeAllMobileDrawers() {
    if (sideDrawer && !isDesktop()) {
      sideDrawer.classList.remove('is-open');
    }
    if (!isDesktop()) {
      closeFlyout(false);
    }
    if (drawerBackdrop) drawerBackdrop.classList.remove('is-open');
  }

  if (mobileDrawerOpenBtn) mobileDrawerOpenBtn.addEventListener('click', openMobileDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeAllMobileDrawers);

  // Outside click ONLY closes on mobile / small screens, keeping docked layout pinned on desktop
  document.addEventListener('click', (e) => {
    if (!isDesktop()) {
      if (!e.target.closest('.canva-sidebar') && !e.target.closest('#unifiedFlyoutPanel') && !e.target.closest('.mobile-drawer-toggle')) {
        closeAllMobileDrawers();
      }
    }
  });

  // Prevent full-page reload when clicking link to the current active page
  document.querySelectorAll('.canva-sidebar-nav a[href]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const currentPath = window.location.pathname.split('/').pop() || 'index.html';
      const targetPath = href.split('#')[0].split('?')[0];

      if (targetPath === currentPath) {
        e.preventDefault();
        const hash = href.split('#')[1];
        if (hash) {
          const targetEl = document.getElementById(hash);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
            return;
          }
        }
        // Smoothly toggle subpanel if already on current page
        if (unifiedFlyoutPanel) {
          if (unifiedFlyoutPanel.classList.contains('is-open')) {
            closeFlyout(true);
          } else {
            switchView('mainMenu');
          }
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          const mainContent = document.querySelector('.home-main-content');
          if (mainContent) {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      } else {
        // Navigating to another page: on mobile close overlay; on desktop keep docked state saved
        if (!isDesktop()) {
          closeAllMobileDrawers();
        }
      }
    });
  });

  // Clicking links inside the flyout panel on mobile closes the overlay
  document.querySelectorAll('.canva-sub-item').forEach(link => {
    link.addEventListener('click', () => {
      if (!isDesktop()) {
        closeAllMobileDrawers();
      }
    });
  });

  const drawerController = {
    switchView,
    closeFlyout,
    openFlyout,
    renderUserAvatar(user) {
      renderUserAvatar(user);
    },
    applyRole(role) {
      try {
        const cached = JSON.parse(localStorage.getItem('mun_cached_user') || '{}');
        cached.role = role;
        localStorage.setItem('mun_cached_user', JSON.stringify(cached));
      } catch (e) { }
      if (navCreateBtn) {
        if (role === 'individual' || role === 'executive') {
          navCreateBtn.style.display = 'none';
        } else if (role === 'institution') {
          navCreateBtn.style.display = 'flex';
        }
      }
    },
    syncUser(user, role) {
      if (!user) return;
      renderUserAvatar(user);
      if (role) this.applyRole(role);
      notifEngine.updateBadges();
    },
    openNotifications() {
      notifEngine.open();
    },
    closeNotifications() {
      notifEngine.close();
    },
    renderNotifications() {
      notifEngine.render();
    },
    syncNotifications(invList) {
      notifEngine.sync(invList);
    },
    getNotificationEngine() {
      return notifEngine;
    }
  };

  return drawerController;
}
