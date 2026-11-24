/**
 * Modern United Nations - Cloudflare R2 Storage Configuration
 * Centralized CDN asset delivery for committee emblems, council seals, and media.
 */

export const R2_CONFIG = {
  // Public Cloudflare R2 bucket endpoint for committee assets
  cdnBaseUrl: 'https://pub-bb97002249104aefa199ab0938792ec2.r2.dev/committees',

  // Default image extension for committee logos ('png', 'webp', or 'svg')
  defaultExtension: 'png',

  // Asset cache version query parameter for instant cache invalidation
  version: '2',

  // In-memory URL cache to avoid redundant string computations
  _urlCache: new Map(),

  /**
   * Registers a client-side Service Worker to cache R2 assets locally.
   * This ensures 0ms image response times and shields the Cloudflare R2 bucket
   * from repeated Class B GET operations, completely preventing billing spikes.
   */
  registerServiceWorker() {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      window.location.protocol.startsWith('http')
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js', { scope: './' })
          .then(() => {
            // Service Worker active and caching Cloudflare R2 committee assets
          })
          .catch((err) => {
            console.debug('Service Worker cache registration notice:', err);
          });
      });
    }
  },

  /**
   * Detects whether the actual website theme is dark or light/white.
   * Checks explicit website theme attributes (data-theme, class) and localStorage.
   * Defaults to false (light/white website theme) so black logos render properly on white cards.
   *
   * @returns {boolean} true if website theme is dark, false if website theme is light/white
   */
  isDarkTheme() {
    try {
      if (typeof document === 'undefined') return false;

      const html = document.documentElement;
      const body = document.body;

      // 1. Explicit theme attribute on <html> or <body>
      const docTheme = html.getAttribute('data-theme') || body?.getAttribute('data-theme');
      if (docTheme === 'dark') return true;
      if (docTheme === 'light' || docTheme === 'white') return false;

      // 2. Explicit theme class on <html> or <body>
      if (html.classList.contains('dark') || html.classList.contains('dark-theme') ||
          body?.classList.contains('dark') || body?.classList.contains('dark-theme')) {
        return true;
      }

      // 3. Stored website theme preference
      const storedTheme = localStorage.getItem('mun_theme') || localStorage.getItem('theme');
      if (storedTheme === 'dark') return true;
      if (storedTheme === 'light' || storedTheme === 'white') return false;

      // 4. Default: The website theme is light (white cards, light canvas)
      return false;
    } catch (e) {
      return false;
    }
  },

  /**
   * Generates the public CDN URL for a committee logo by its unique abbreviation code.
   * Standardizes code to lowercase to prevent case sensitivity issues.
   * Automatically switches between black/white variants for WEF based on website theme:
   * Uses 'wef.black.png' when website theme is white, and 'wef.png' when website theme is dark.
   *
   * @param {string} code - The committee abbreviation code ( 'UNGA', 'DISEC', 'WEF')
   * @param {string} [extension] - Optional override for image format
   * @returns {string} The full CDN URL
   */
  getCommitteeLogoUrl(code, extension) {
    if (!code) return '';
    const safeCode = String(code).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const ext = extension || this.defaultExtension;
    const vParam = this.version ? `?v=${this.version}` : '';
    const cacheKey = `${safeCode}.${ext}${vParam}`;

    if (safeCode !== 'wef' && this._urlCache.has(cacheKey)) {
      return this._urlCache.get(cacheKey);
    }

    // Normalization for Indian Cabinet (use indcn.png)
    if (safeCode === 'indcn' || safeCode === 'indian-cabinet' || safeCode === 'ind-cabinet') {
      const url = `${this.cdnBaseUrl}/indcn.${ext}${vParam}`;
      this._urlCache.set(cacheKey, url);
      return url;
    }

    // Normalization for UN Women (use unwomen.png)
    if (safeCode === 'un-women' || safeCode === 'unwomen') {
      const url = `${this.cdnBaseUrl}/unwomen.${ext}${vParam}`;
      this._urlCache.set(cacheKey, url);
      return url;
    }

    // Normalization for Legal Committee (use legalcommittee.png)
    if (safeCode === 'legal' || safeCode === 'legal-committee' || safeCode === 'legalcommittee') {
      const url = `${this.cdnBaseUrl}/legalcommittee.${ext}${vParam}`;
      this._urlCache.set(cacheKey, url);
      return url;
    }

    // Theme-dependent selection for World Economic Forum (WEF)
    if (safeCode === 'wef') {
      const isDark = this.isDarkTheme();
      const wefFilename = isDark ? 'wef.png' : 'wef.black.png';
      return `${this.cdnBaseUrl}/${wefFilename}${vParam}`;
    }

    const url = `${this.cdnBaseUrl}/${safeCode}.${ext}${vParam}`;
    this._urlCache.set(cacheKey, url);
    return url;
  }
};

// Automatically initiate Service Worker cache shield when loaded in browser
if (typeof window !== 'undefined') {
  R2_CONFIG.registerServiceWorker();
}

export default R2_CONFIG;

