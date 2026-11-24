/**
 * Modern United Nations - Lucide-based Sidebar (sidebar.js)
 * Vanilla JS implementation of collapsible sidebar with submenus
 * Features: Collapsible, Submenu navigation, Keyboard Nav, Persistent State, Mobile Drawer
 */

// 1. Early state hydration before first paint (sync, no flash)
(function restoreSidebarStateEarly() {
  try {
    const isDesktop = window.innerWidth >= 1024;
    const collapsed = localStorage.getItem('mun_sidebar_collapsed') === 'true';
    const html = document.documentElement;

    if (isDesktop && collapsed) {
      html.classList.add('sidebar-collapsed');
    }

    // Hydrate user avatar/name from cached session
    const sessionStr = localStorage.getItem('mun_user_session') || localStorage.getItem('mun_cached_user');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const applyCached = () => {
        const avatar = document.getElementById('userAvatar');
        const name = document.getElementById('userName');
        const email = document.getElementById('userEmail');
        const initial = session.initial || (session.displayName ? session.displayName[0].toUpperCase() : 'U');
        const displayName = session.displayName || session.name || 'Delegate';
        const userEmail = session.email || 'delegate@example.com';

        if (avatar) {
          if (session.photoURL || session.avatar || session.profile?.photoURL || session.profile?.avatar) {
            const photoURL = session.photoURL || session.avatar || session.profile?.photoURL || session.profile?.avatar;
            avatar.innerHTML = `<img src="${photoURL}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">`;
          } else {
            avatar.textContent = initial;
          }
        }
        if (name) name.textContent = displayName;
        if (email) email.textContent = userEmail;
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyCached);
      } else {
        applyCached();
      }
    }
  } catch (e) {}
})();

// Persistent avatar protector (prevents external scripts from stripping avatar)
function attachAvatarProtector() {
  const avatar = document.getElementById('userAvatar');
  if (!avatar) return;

  const checkAndProtect = () => {
    const sessionStr = localStorage.getItem('mun_user_session') || localStorage.getItem('mun_cached_user');
    if (!sessionStr) return;
    try {
      const session = JSON.parse(sessionStr);
      const photoURL = session.photoURL || session.avatar || session.profile?.photoURL || session.profile?.avatar;
      const displayName = session.displayName || session.name || 'User';
      const initial = session.initial || (displayName ? displayName[0].toUpperCase() : 'U');
      if (photoURL && !avatar.querySelector('img')) {
        avatar.innerHTML = `<img src="${photoURL}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">`;
      }
    } catch (e) {}
  };

  if (!avatar.__mun_protected) {
    avatar.__mun_protected = true;
    checkAndProtect();
    const obs = new MutationObserver(checkAndProtect);
    obs.observe(avatar, { childList: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', attachAvatarProtector);
} else {
  attachAvatarProtector();
}

/**
 * Initialize Sidebar
 * @param {Object} options - Configuration
 * @param {string} options.activeItemId - ID of currently active nav item
 * @param {Function} options.onNavigate - Callback when navigation occurs
 */
export function initSidebar(options = {}) {
  attachAvatarProtector();

  const sidebar = document.getElementById('sidebar');
  const sidebarContent = document.getElementById('sidebarContent');
  const mainContent = document.querySelector('.main-content') || document.querySelector('.home-main-content');
  const backdrop = document.getElementById('sidebarBackdrop');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarToggle = document.getElementById('sidebarToggle');

  // Navigation structure (data-driven with submenus)
  const navigation = [
    {
      label: 'Navigation',
      groups: [
        {
          id: 'playground',
          label: 'Playground',
          icon: 'layout-dashboard',
          href: null, // parent doesn't navigate
          children: [
            { id: 'playground-home', href: 'home.html', label: 'Home' },
            { id: 'playground-conferences', href: 'conferences.html', label: 'Conferences' },
            { id: 'playground-committees', href: 'committees.html', label: 'Committees' },
            { id: 'playground-resolutions', href: 'resolutions.html', label: 'Resolutions' },
          ]
        },
        {
          id: 'models',
          label: 'Models',
          icon: 'database',
          href: null,
          children: [
            { id: 'models-gpt', href: 'models.html#gpt', label: 'GPT Models' },
            { id: 'models-claude', href: 'models.html#claude', label: 'Claude Models' },
            { id: 'models-local', href: 'models.html#local', label: 'Local Models' },
            { id: 'models-compare', href: 'models.html#compare', label: 'Model Comparison' },
          ]
        },
        {
          id: 'documentation',
          label: 'Documentation',
          icon: 'book-open',
          href: null,
          children: [
            { id: 'docs-getting-started', href: 'docs.html#getting-started', label: 'Getting Started' },
            { id: 'docs-api', href: 'docs.html#api', label: 'API Reference' },
            { id: 'docs-guides', href: 'docs.html#guides', label: 'Guides' },
            { id: 'docs-examples', href: 'docs.html#examples', label: 'Examples' },
          ]
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: 'settings',
          href: null,
          children: [
            { id: 'settings-profile', href: 'profile.html', label: 'Profile' },
            { id: 'settings-account', href: 'profile.html#account', label: 'Account' },
            { id: 'settings-billing', href: 'pricing.html', label: 'Billing' },
            { id: 'settings-preferences', href: 'profile.html#preferences', label: 'Preferences' },
          ]
        }
      ]
    },
    {
      label: 'Projects',
      items: [
        { id: 'project-create', href: 'create-conference/index.html', icon: 'plus-circle', label: 'Create Conference' },
        { id: 'project-my-conferences', href: 'conferences.html', icon: 'folder-open', label: 'My Conferences' },
        { id: 'project-templates', href: 'resources.html', icon: 'file-text', label: 'Resources' },
      ]
    },
    {
      label: 'Help',
      items: [
        { id: 'help-docs', href: 'docs.html', icon: 'book-open', label: 'Documentation' },
        { id: 'help-support', href: 'support.html', icon: 'life-buoy', label: 'Support' },
        { id: 'help-community', href: 'community.html', icon: 'users', label: 'Community' },
        { id: 'help-changelog', href: 'changelog.html', icon: 'git-branch', label: 'Changelog' },
      ]
    }
  ];

  // Build sidebar HTML from navigation data
  function buildSidebar() {
    if (!sidebarContent) return;

    let html = '';

    // Primary Navigation Section
    navigation.forEach((section, sectionIndex) => {
      if (section.groups) {
        // Section with submenu groups (Navigation section)
        html += `<div class="section-label">${section.label}</div>`;

        section.groups.forEach((group, groupIndex) => {
          const isActive = group.children.some(child => child.id === options.activeItemId);
          const groupId = `nav-group-${group.id}`;
          html += `
            <div class="nav-group" id="${groupId}" data-group="${group.id}">
              <button type="button" class="nav-link" data-group-toggle="${group.id}" aria-expanded="false" aria-controls="submenu-${group.id}">
                <i data-lucide="${group.icon}" aria-hidden="true"></i>
                <span class="nav-text">${group.label}</span>
                <i data-lucide="chevron-right" class="arrow" aria-hidden="true"></i>
              </button>
              <div class="submenu" id="submenu-${group.id}" role="group" aria-label="${group.label} submenu">
                <div class="submenu-inner">
          `;

          group.children.forEach(child => {
            const activeClass = child.id === options.activeItemId ? ' active' : '';
            html += `
                  <a href="${child.href}" class="${activeClass}" id="${child.id}" data-view="${child.id}">${child.label}</a>
            `;
          });

          html += `
                </div>
              </div>
            </div>
          `;
        });
      } else if (section.items) {
        // Simple items section (Projects, Help)
        // Add margin for secondary sections
        if (sectionIndex > 0) {
          html += `<div class="section-label ${sectionIndex > 1 ? 'secondary-nav' : ''}">${section.label}</div>`;
        }

        section.items.forEach(item => {
          const activeClass = item.id === options.activeItemId ? ' active' : '';
          html += `
            <a href="${item.href}" class="project-link ${activeClass}" id="${item.id}" data-view="${item.id}">
              <i data-lucide="${item.icon}" aria-hidden="true"></i>
              <span class="nav-text">${item.label}</span>
            </a>
          `;
        });
      }
    });

    sidebarContent.innerHTML = html;

    // Initialize Lucide icons
    if (window.lucide) {
      lucide.createIcons();
    }

    // Attach submenu toggle handlers
    attachSubmenuHandlers();
  }

  // Attach click handlers for submenu toggles
  function attachSubmenuHandlers() {
    document.querySelectorAll('[data-group-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const groupId = btn.getAttribute('data-group-toggle');
        const group = document.getElementById(`nav-group-${groupId}`);
        if (group) {
          const isOpen = group.classList.toggle('open');
          btn.setAttribute('aria-expanded', isOpen);
        }
      });
    });
  }

  // 2. State management
  let isCollapsed = false;
  let isMobileOpen = false;

  const isDesktop = () => window.innerWidth >= 700;

  // Load persisted state
  function loadState() {
    try {
      const saved = localStorage.getItem('mun_sidebar_collapsed');
      if (saved !== null) {
        isCollapsed = saved === 'true';
      }
    } catch (e) {}
    applyCollapsedState(false); // No animation on initial load
  }

  // Save state
  function saveState() {
    try {
      localStorage.setItem('mun_sidebar_collapsed', isCollapsed.toString());
    } catch (e) {}
  }

  // Apply collapsed/expanded state
  function applyCollapsedState(animate = true) {
    if (!sidebar) return;

    if (isDesktop()) {
      if (isCollapsed) {
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('expanded');
        // Update toggle icon
        updateToggleIcon(true);
      } else {
        sidebar.classList.add('expanded');
        sidebar.classList.remove('collapsed');
        updateToggleIcon(false);
      }
      // Sync main content margin
      if (mainContent) {
        mainContent.style.marginLeft = isCollapsed
          ? 'calc(var(--sidebar-collapsed-width) + 28px)'
          : 'calc(var(--sidebar-expanded-width) + 28px)';
      }
    } else {
      // Mobile: always expanded when open, no collapsed state
      sidebar.classList.remove('collapsed', 'expanded');
      updateToggleIcon(false);
    }
  }

  // Update toggle button icon
  function updateToggleIcon(collapsed) {
    if (!sidebarToggle) return;
    const icon = sidebarToggle.querySelector('i[data-lucide]');
    if (icon) {
      icon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
      if (window.lucide) {
        lucide.createIcons();
      }
    }
    sidebarToggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    sidebarToggle.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  }

  // Toggle collapsed state (desktop only)
  function toggleCollapsed() {
    if (!isDesktop()) return;
    isCollapsed = !isCollapsed;
    saveState();
    applyCollapsedState(true);
  }

  // Mobile drawer functions
  function openMobile() {
    if (!sidebar || !backdrop) return;
    isMobileOpen = true;
    sidebar.classList.remove('mobile-hidden');
    backdrop.classList.add('visible');
    document.body.style.overflow = 'hidden';
    // Trap focus
    const firstFocusable = sidebar.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
  }

  function closeMobile() {
    if (!sidebar || !backdrop) return;
    isMobileOpen = false;
    sidebar.classList.add('mobile-hidden');
    backdrop.classList.remove('visible');
    document.body.style.overflow = '';
    // Return focus to trigger
    if (mobileMenuBtn) mobileMenuBtn.focus();
  }

  function toggleMobile() {
    if (isMobileOpen) closeMobile();
    else openMobile();
  }

  // 3. Active state management
  function setActiveItem(itemId) {
    document.querySelectorAll('.nav-link, .project-link, .submenu a').forEach(item => {
      item.classList.toggle('active', item.id === itemId);
    });

    // Also open parent group if child is active
    const activeItem = document.getElementById(itemId);
    if (activeItem) {
      const parentGroup = activeItem.closest('.nav-group');
      if (parentGroup) {
        parentGroup.classList.add('open');
        const toggleBtn = parentGroup.querySelector('[data-group-toggle]');
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', 'true');
        }
      }
    }
  }

  // Handle navigation clicks
  function handleNavClick(e) {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return; // Parent group toggles handled separately

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const targetPath = href?.split('#')[0].split('?')[0];

    // If same page, prevent navigation and just update active state
    if (targetPath === currentPath) {
      e.preventDefault();
      const itemId = link.id;
      setActiveItem(itemId);

      // Close mobile drawer on selection
      if (!isDesktop() && isMobileOpen) {
        closeMobile();
      }

      if (options.onNavigate) {
        options.onNavigate(itemId, link);
      }
      return;
    }

    // Different page - update active state for visual feedback before navigation
    setActiveItem(link.id);

    // Close mobile drawer
    if (!isDesktop() && isMobileOpen) {
      closeMobile();
    }

    // Let navigation proceed naturally
  }

  // 4. Keyboard Navigation
  function handleKeydown(e) {
    const items = Array.from(document.querySelectorAll('.nav-link, .project-link, .submenu a:not([tabindex="-1"])'));
    if (items.length === 0) return;

    const activeIndex = items.findIndex(item => item.classList.contains('active') || item === document.activeElement);
    const currentItem = items[activeIndex >= 0 ? activeIndex : 0];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusNext(items, activeIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusPrev(items, activeIndex);
        break;
      case 'Enter':
      case ' ':
        if (e.target.classList.contains('nav-link') && e.target.hasAttribute('data-group-toggle')) {
          e.preventDefault();
          e.target.click();
        } else if (e.target.closest('a')) {
          e.target.closest('a').click();
        }
        break;
      case 'Escape':
        if (!isDesktop() && isMobileOpen) {
          e.preventDefault();
          closeMobile();
        }
        // Close open submenu
        document.querySelectorAll('.nav-group.open').forEach(group => {
          group.classList.remove('open');
          const btn = group.querySelector('[data-group-toggle]');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        });
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case 'ArrowRight':
        // Open submenu if on parent nav-link
        if (e.target.classList.contains('nav-link') && e.target.hasAttribute('data-group-toggle')) {
          e.preventDefault();
          const groupId = e.target.getAttribute('data-group-toggle');
          const group = document.getElementById(`nav-group-${groupId}`);
          if (group && !group.classList.contains('open')) {
            group.classList.add('open');
            e.target.setAttribute('aria-expanded', 'true');
            // Focus first submenu item
            const firstSubmenuItem = group.querySelector('.submenu a');
            if (firstSubmenuItem) firstSubmenuItem.focus();
          }
        }
        break;
      case 'ArrowLeft':
        // Close submenu if in submenu
        if (e.target.closest('.submenu')) {
          e.preventDefault();
          const parentGroup = e.target.closest('.nav-group');
          if (parentGroup) {
            parentGroup.classList.remove('open');
            const btn = parentGroup.querySelector('[data-group-toggle]');
            if (btn) {
              btn.setAttribute('aria-expanded', 'false');
              btn.focus();
            }
          }
        }
        break;
    }
  }

  function focusNext(items, currentIndex) {
    const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    if (nextIndex < items.length) {
      items[nextIndex].focus();
    }
  }

  function focusPrev(items, currentIndex) {
    const prevIndex = currentIndex >= 0 ? currentIndex - 1 : items.length - 1;
    if (prevIndex >= 0) {
      items[prevIndex].focus();
    }
  }

  // 5. Event Listeners
  function attachEvents() {
    // Collapse toggle button (desktop)
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollapsed();
      });
    }

    // Navigation clicks (event delegation)
    if (sidebarContent) {
      sidebarContent.addEventListener('click', handleNavClick);
    }

    // Mobile menu button
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobile();
      });
    }

    // Backdrop click closes mobile drawer
    if (backdrop) {
      backdrop.addEventListener('click', closeMobile);
    }

    // Keyboard navigation
    document.addEventListener('keydown', handleKeydown);

    // Resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const wasDesktop = document.documentElement.classList.contains('sidebar-collapsed');
        const nowDesktop = isDesktop();

        if (nowDesktop && !wasDesktop) {
          // Mobile -> Desktop: close mobile drawer, apply collapsed state
          closeMobile();
          applyCollapsedState(false);
        } else if (!nowDesktop && wasDesktop) {
          // Desktop -> Mobile: remove collapsed classes
          document.documentElement.classList.remove('sidebar-collapsed');
          sidebar?.classList.remove('collapsed', 'expanded');
          sidebar?.classList.add('mobile-hidden');
        } else if (nowDesktop) {
          applyCollapsedState(false);
        }

        // Re-initialize Lucide icons after resize
        if (window.lucide) {
          lucide.createIcons();
        }
      }, 50);
    });

    // User profile click (footer)
    const userProfile = document.getElementById('userProfile');
    if (userProfile) {
      userProfile.addEventListener('click', (e) => {
        // Don't navigate if clicking on action buttons
        if (e.target.closest('.sidebar-user-action')) return;
        window.location.href = 'profile.html';
      });

      userProfile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = 'profile.html';
        }
      });
    }

    // Settings button in footer
    const settingsBtn = document.getElementById('sidebarSettingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = 'profile.html';
      });
    }

    // Logout button in footer
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Trigger logout - this can be customized
        if (window.auth && window.auth.signOut) {
          window.auth.signOut();
        } else {
          // Fallback: clear session and redirect
          localStorage.removeItem('mun_user_session');
          localStorage.removeItem('mun_cached_user');
          window.location.href = 'signin.html';
        }
      });
    }
  }

  // 6. Public API
  const sidebarController = {
    // Navigation
    navigateTo(itemId) {
      const item = document.getElementById(itemId);
      if (item) {
        setActiveItem(itemId);
        if (options.onNavigate) options.onNavigate(itemId, item);
      }
    },

    // Collapse/Expand
    collapse() {
      if (isDesktop() && !isCollapsed) {
        isCollapsed = true;
        saveState();
        applyCollapsedState(true);
      }
    },

    expand() {
      if (isDesktop() && isCollapsed) {
        isCollapsed = false;
        saveState();
        applyCollapsedState(true);
      }
    },

    toggle() {
      if (isDesktop()) toggleCollapsed();
      else toggleMobile();
    },

    isCollapsed: () => isCollapsed,
    isMobileOpen: () => isMobileOpen,

    // Mobile drawer
    openMobile,
    closeMobile,

    // User sync
    syncUser(user) {
      if (!user) return;
      const avatar = document.getElementById('userAvatar');
      const name = document.getElementById('userName');
      const email = document.getElementById('userEmail');

      const displayName = user.displayName || user.name || (user.email ? user.email.split('@')[0] : 'Delegate');
      const initial = user.initial || (displayName[0] || 'U').toUpperCase();
      const userEmail = user.email || 'delegate@example.com';
      const photoURL = user.photoURL || user.avatar || user.profile?.photoURL || user.profile?.avatar || null;

      if (avatar) {
        if (photoURL) {
          avatar.innerHTML = `<img src="${photoURL}" alt="${displayName}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${initial}'">`;
        } else {
          avatar.textContent = initial;
        }
      }
      if (name) name.textContent = displayName;
      if (email) email.textContent = userEmail;
    },

    // Badge updates (for future use)
    setBadge(itemId, count) {
      const item = document.getElementById(itemId);
      if (!item) return;
      // Could add badge element if needed
    }
  };

  // 7. Initialize
  function init() {
    buildSidebar();
    loadState();
    attachEvents();

    // Set initial active state
    let activeItemId = options.activeItemId;

    // Auto-detect active item from current URL if not provided
    if (!activeItemId) {
      activeItemId = detectActiveItemFromUrl();
    }

    if (activeItemId) {
      setActiveItem(activeItemId);
    }

    // Apply role if cached
    try {
      const sessionStr = localStorage.getItem('mun_user_session') || localStorage.getItem('mun_cached_user');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        sidebarController.syncUser(session);
      }
    } catch (e) {}

    console.log('[Sidebar] Initialized', { isDesktop: isDesktop(), isCollapsed, activeItemId });
    return sidebarController;
  }

  // Detect active navigation item from current URL
  function detectActiveItemFromUrl() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    const hash = window.location.hash.slice(1); // Remove #

    // Map URLs to navigation item IDs
    const urlToItemMap = {
      'home.html': 'playground-home',
      'index.html': 'playground-home',
      'conferences.html': 'playground-conferences',
      'committees.html': 'playground-committees',
      'resolutions.html': 'playground-resolutions',
      'models.html': 'models-gpt', // Default to first models tab
      'docs.html': 'docs-getting-started', // Default to first docs tab
      'profile.html': 'settings-profile',
      'create-conference/index.html': 'project-create',
      'resources.html': 'project-templates',
      'support.html': 'help-support',
      'community.html': 'help-community',
      'changelog.html': 'help-changelog',
    };

    // Check hash for specific tabs (, models.html#claude)
    if (hash) {
      const hashMap = {
        'gpt': 'models-gpt',
        'claude': 'models-claude',
        'local': 'models-local',
        'compare': 'models-compare',
        'getting-started': 'docs-getting-started',
        'api': 'docs-api',
        'guides': 'docs-guides',
        'examples': 'docs-examples',
        'account': 'settings-account',
        'billing': 'settings-billing',
        'preferences': 'settings-preferences',
      };
      if (hashMap[hash]) return hashMap[hash];
    }

    return urlToItemMap[path] || null;
  }

  return init();
}

// Auto-initialize if sidebar element exists (for pages that don't manually init)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('sidebar') && !window.__sidebar_initialized) {
      window.__sidebar_initialized = true;
      initSidebar();
    }
  });
} else {
  if (document.getElementById('sidebar') && !window.__sidebar_initialized) {
    window.__sidebar_initialized = true;
    initSidebar();
  }
}