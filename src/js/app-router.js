/**
 * Modern United Nations - Persistent App Router
 * Handles SPA-like navigation while keeping the drawer/shell persistent
 * Uses View Transitions API for smooth cross-page transitions
 */

import { initializePage } from './page-controller.js';

// Configuration
const CONTENT_SELECTOR = '#pageContent';
const SHELL_SELECTOR = '#appShell';
const LOADING_CLASS = 'is-loading';
const TRANSITION_DURATION = 200;

// State
let currentPath = window.location.pathname;
let isNavigating = false;
let transitionSupported = false;
let currentCleanup = null;

// Check View Transitions support
try {
  transitionSupported = 'startViewTransition' in document;
} catch (e) {
  transitionSupported = false;
}

/**
 * Extract page content from HTML response
 */
function extractPageContent(html, targetPath) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Check if this is already a pure fragment (no DOCTYPE, no html, no sideDrawer)
  const isFragment = !html.includes('<!DOCTYPE') && !html.includes('<!doctype') && !doc.querySelector('.canva-sidebar');
  if (isFragment) {
    const clone = doc.body.cloneNode(true);
    clone.querySelectorAll('script').forEach(el => el.remove());
    const trimmed = clone.innerHTML.trim();
    if (trimmed) return trimmed;
  }

  // Try to find the main content area
  // Pages may have content in different containers
  const selectors = [
    '#pageContent',
    '.home-main-content',
    '.cc-wrap',
    'main',
    '.page-content',
    '#mainContent'
  ];

  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el && el.innerHTML.trim()) {
      return el.innerHTML;
    }
  }

  // Fallback: use body content minus scripts/styles/nav
  const body = doc.querySelector('body');
  if (body) {
    const clone = body.cloneNode(true);
    clone.querySelectorAll('script, style, link, .canva-sidebar, .canva-flyout-panel, .drawer-backdrop, .notification-drawer, .drawer-overlay, header.navbar, .mobile-drawer').forEach(el => el.remove());
    const trimmed = clone.innerHTML.trim();
    if (trimmed) return trimmed;
  }

  return '<div class="mun-db-empty-card"><p>Content not found</p></div>';
}

/**
 * Extract scripts from HTML response
 */
function extractPageScripts(html, targetPath) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const scriptEls = doc.querySelectorAll('script');
  const scripts = [];
  scriptEls.forEach(s => {
    const src = s.getAttribute('src') || '';
    if (src.includes('ionicons') || src.includes('app-router.js') || src.includes('page-controller.js')) {
      return;
    }
    scripts.push({
      src: s.src || '',
      type: s.type || 'text/javascript',
      content: s.textContent || ''
    });
  });
  return scripts;
}

/**
 * Execute extracted scripts
 * Note: ES modules cannot be executed via Function constructor.
 * Page logic is now centralized in page-controller.js
 */
function executeScripts(scripts) {
  // Scripts from fetched pages are ES modules - they won't work via Function()
  // Page logic is handled by page-controller.js initializePage()
  // This function is kept for any inline non-module scripts
  scripts.forEach(script => {
    if (script.src) {
      const s = document.createElement('script');
      s.src = script.src;
      s.type = script.type;
      document.head.appendChild(s);
    } else if (script.content && !script.content.includes('import ') && !script.content.includes('export ')) {
      try {
        new Function(script.content)();
      } catch (e) {
        console.warn('Script execution error:', e);
      }
    }
  });
}

/**
 * Update active navigation state in persistent drawer
 */
function updateActiveNav(targetPath) {
  const cleanPath = (targetPath.split('/').pop() || 'index.html').split('?')[0].split('#')[0];
  const hash = targetPath.split('#')[1] || '';

  // Map paths to nav IDs
  const navMap = {
    'home.html': 'navTabHome',
    'index.html': 'navTabHome',
    'home': 'navTabHome',
    'conferences.html': 'navTabConferences',
    'conferences': 'navTabConferences',
    'committees.html': 'navTabCommittees',
    'committees': 'navTabCommittees',
    'resources.html': 'navTabResources',
    'resources': 'navTabResources',
    'country.html': 'navTabResources',
    'country': 'navTabResources',
    'country-detail.html': 'navTabResources',
    'country-detail': 'navTabResources',
    'resolutions.html': 'navTabResolutions',
    'resolutions': 'navTabResolutions',
    'ngos.html': 'navTabNGOs',
    'ngos': 'navTabNGOs',
    'pricing.html': 'navTabNGOs',
    'profile.html': 'userProfileNav',
    'profile': 'userProfileNav',
    'notifications.html': 'sidebarNotifItem',
    'notifications': 'sidebarNotifItem',
    'conference-detail.html': 'navTabConferences',
    'committee-detail.html': 'navTabCommittees',
    'onboarding.html': 'navTabHome',
    'signin.html': 'navTabHome',
    'signup.html': 'navTabHome',
    '404.html': 'navTabHome'
  };

  // Handle profile tabs
  let activeNavId = navMap[cleanPath] || 'navTabHome';
  if (cleanPath === 'profile.html' && hash) {
    activeNavId = 'userProfileNav';
  }

  // Update rail active states
  document.querySelectorAll('.canva-nav-item, .canva-sidebar-toggle-btn').forEach(el => {
    el.classList.remove('is-active');
  });

  const activeEl = document.getElementById(activeNavId);
  if (activeEl) {
    activeEl.classList.add('is-active');
  }

  // Update flyout panel title
  const flyoutTitle = document.getElementById('flyoutTitleText');
  const titleMap = {
    'home.html': 'Modern United Nations',
    'index.html': 'Modern United Nations',
    'conferences.html': 'Conferences',
    'committees.html': 'Committees',
    'resources.html': 'Research & Prep',
    'country.html': 'Country Directory',
    'country-detail.html': 'Country Details',
    'resolutions.html': 'Resolutions',
    'ngos.html': 'NGOs',
    'pricing.html': 'Pricing',
    'profile.html': 'Profile & Settings',
    'notifications.html': 'Notifications',
    'conference-detail.html': 'Conference Details',
    'committee-detail.html': 'Committee Details',
    'onboarding.html': 'Welcome',
    'signin.html': 'Sign In',
    'signup.html': 'Sign Up',
    '404.html': 'Page Not Found',
  };
  if (flyoutTitle) {
    flyoutTitle.textContent = titleMap[cleanPath] || 'Modern United Nations';
  }

  // Update search wrap visibility for profile and auth pages
  const searchWrap = document.querySelector('.canva-panel-search-wrap');
  if (searchWrap) {
    const hideSearch = ['profile.html', 'onboarding.html', 'signin.html', 'signup.html', '404.html'].includes(cleanPath);
    searchWrap.style.display = hideSearch ? 'none' : '';
  }

  // Close flyout on navigation (desktop keeps docked state)
  const flyout = document.getElementById('unifiedFlyoutPanel');
  const isDesktop = window.innerWidth >= 992;
  if (flyout && flyout.classList.contains('is-open') && !isDesktop) {
    flyout.classList.remove('is-open');
    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) backdrop.classList.remove('is-open');
  }
}

/**
 * Show loading state
 */
function showLoading() {
  const content = document.querySelector(CONTENT_SELECTOR);
  const shell = document.querySelector(SHELL_SELECTOR);
  if (content) content.classList.add(LOADING_CLASS);
  if (shell) shell.classList.add(LOADING_CLASS);
}

/**
 * Hide loading state
 */
function hideLoading() {
  const content = document.querySelector(CONTENT_SELECTOR);
  const shell = document.querySelector(SHELL_SELECTOR);
  if (content) content.classList.remove(LOADING_CLASS);
  if (shell) shell.classList.remove(LOADING_CLASS);
}

/**
 * Perform the content swap with optional View Transition
 */
async function swapContent(newContent, newPath, scripts) {
  const contentEl = document.querySelector(CONTENT_SELECTOR);
  if (!contentEl) return;

  // Scroll to top
  window.scrollTo(0, 0);
  const mainContent = document.querySelector('.home-main-content');
  if (mainContent) mainContent.scrollTo(0, 0);

  const performSwap = () => {
    contentEl.innerHTML = newContent;
    // Execute page-specific scripts
    if (scripts && scripts.length > 0) {
      executeScripts(scripts);
    }
    // Re-initialize Ionicons
    if (window.lucide) {
      lucide.createIcons();
    }
    // Trigger custom event for content-loaded
    window.dispatchEvent(new CustomEvent('app:content-loaded', {
      detail: { path: newPath }
    }));
  };

  if (transitionSupported && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    try {
      await document.startViewTransition(performSwap).finished;
    } catch (e) {
      performSwap();
    }
  } else {
    performSwap();
  }
}

/**
 * Main navigation handler
 */
async function navigateTo(url, options = {}) {
  const { pushState = true, replace = false } = options;

  if (isNavigating) return;
  isNavigating = true;

  try {
    // Normalize URL
    const targetUrl = new URL(url, window.location.origin);
    const targetPath = targetUrl.pathname + targetUrl.search + targetUrl.hash;

    // Skip if same page
    if (targetPath === currentPath && !options.force) {
      isNavigating = false;
      return;
    }

    showLoading();

    // Determine content candidate URLs
    const rawFile = (targetUrl.pathname.split('/').pop() || 'home.html').split('?')[0].split('#')[0];
    const cleanName = rawFile.endsWith('.html') ? rawFile : (rawFile ? `${rawFile}.html` : 'home.html');

    const ROUTE_CONTENT_MAP = {
      'resources.html': 'content/resources/resources.html',
      'resources': 'content/resources/resources.html',
      'country.html': 'content/resources/country.html',
      'country': 'content/resources/country.html',
      'country-detail.html': 'content/resources/country-detail.html',
      'country-detail': 'content/resources/country-detail.html',
      'home.html': 'content/home.html',
      'home': 'content/home.html',
      'index.html': 'content/home.html',
      '': 'content/home.html',
      'conferences.html': 'content/conferences.html',
      'conference-detail.html': 'content/conference-detail.html',
      'committees.html': 'content/committees.html',
      'committee-detail.html': 'content/committee-detail.html',
      'profile.html': 'content/profile.html',
      'notifications.html': 'content/notifications.html',
      'pricing.html': 'content/pricing.html',
      'resolutions.html': 'content/resolutions.html',
      'ngos.html': 'content/ngos.html',
      'onboarding.html': 'content/onboarding.html',
      'signin.html': 'content/signin.html',
      'signup.html': 'content/signup.html',
      '404.html': 'content/404.html'
    };

    const candidateUrls = [
      ROUTE_CONTENT_MAP[cleanName],
      `content/resources/${cleanName}`,
      `/content/resources/${cleanName}`,
      `content/${cleanName}`,
      `/content/${cleanName}`,
      cleanName,
      `/${cleanName}`,
      targetUrl.pathname
    ].filter(Boolean);

    let response = null;
    for (const testUrl of candidateUrls) {
      try {
        const res = await fetch(testUrl, {
          headers: {
            'X-Requested-With': 'app-router',
            'Accept': 'text/html'
          },
          credentials: 'same-origin'
        });
        if (res.ok) {
          response = res;
          break;
        }
      } catch (e) { }
    }

    if (!response || !response.ok) {
      throw new Error(`Content not found for ${targetPath}`);
    }

    const html = await response.text();
    const newContent = extractPageContent(html, targetPath);
    const scripts = extractPageScripts(html, targetPath);

    // Update URL
    if (pushState) {
      if (replace) {
        history.replaceState({ path: targetPath }, '', targetPath);
      } else {
        history.pushState({ path: targetPath }, '', targetPath);
      }
    }
    currentPath = targetPath;

    // Swap content
    await swapContent(newContent, targetPath, scripts);

    // Initialize page-specific logic
    const { getSession } = await import('./firebase-config.js');
    const session = getSession();
    if (currentCleanup && typeof currentCleanup === 'function') {
      try { currentCleanup(); } catch (e) { }
      currentCleanup = null;
    }
    currentCleanup = await initializePage(cleanName, session);

    // Update active nav
    updateActiveNav(targetPath);

    // Update document title
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newTitle = doc.title;
    if (newTitle) {
      document.title = newTitle;
    } else {
      const titles = {
        'resources.html': 'Research & Prep | Modern United Nations',
        'country.html': 'Country Directory | Modern United Nations',
        'country-detail.html': 'Country Details | Modern United Nations',
        'home.html': 'Modern United Nations Dashboard'
      };
      if (titles[cleanName]) document.title = titles[cleanName];
    }

    // Scroll to section if hash present
    if (targetUrl.hash) {
      const targetEl = document.querySelector(targetUrl.hash);
      if (targetEl) {
        setTimeout(() => targetEl.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    }

    // Dispatch navigation event
    window.dispatchEvent(new CustomEvent('app:navigate', {
      detail: { path: targetPath, url: targetUrl.href }
    }));

    return;

  } catch (error) {
    console.error('Navigation error:', error);
    // Fallback to full navigation
    window.location.href = url;
  } finally {
    hideLoading();
    isNavigating = false;
  }
}

/**
 * Intercept link clicks for SPA navigation
 */
function interceptLinks() {
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Skip external links, anchors, mailto, tel, download, target=_blank
    if (
      href.startsWith('http') && !href.startsWith(window.location.origin) ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      link.hasAttribute('download') ||
      link.target === '_blank' ||
      link.hasAttribute('data-no-router') ||
      link.closest('[data-no-router]')
    ) {
      return;
    }

    // Skip if modifier keys pressed (open in new tab)
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return;
    }

    // Handle same-page hash navigation
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    e.preventDefault();
    await navigateTo(href);
  });
}

/**
 * Handle browser back/forward
 */
function handlePopState() {
  window.addEventListener('popstate', async (e) => {
    if (e.state && e.state.path) {
      await navigateTo(e.state.path, { pushState: false });
    } else {
      // Initial load or unknown state - reload
      window.location.reload();
    }
  });
}

/**
 * Initialize router
 */
export function initAppRouter() {
  // Set initial state
  currentPath = window.location.pathname + window.location.search + window.location.hash;
  history.replaceState({ path: currentPath }, '', currentPath);

  // Intercept links
  interceptLinks();

  // Handle popstate
  handlePopState();

  // Initial nav update
  updateActiveNav(currentPath);

  // Expose navigateTo globally
  window.appNavigate = navigateTo;

  console.log('[AppRouter] Initialized', { transitionSupported, currentPath });
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppRouter);
} else {
  initAppRouter();
}

// Export for manual use
export { navigateTo, updateActiveNav };