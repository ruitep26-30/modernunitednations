/**
 * Country Dossier Live Integration Service
 * Connects Modern United Nations Sovereign Dossiers to live Google Apps Script endpoint:
 * https://script.google.com/macros/s/AKfycbwXGSS3rvWOGsWj7NT-DWxxwv8XwimfQXH0JRzHMkSC36garGRfJc8XotNPZxndCxTY8w/exec
 * 
 * Features:
 * - Dynamic Live Fetching from Google Apps Script Web App
 * - Deep Key Normalization (Handles Google Sheets Title/CamelCase/Spaced headers)
 * - Intelligent Local Storage Caching (`mun_country_dossiers_live_cache`)
 * - Graceful Fallback to static COUNTRIES_DATABASE (Zero flickering/zero broken UI)
 * - Real-time listeners and sync events (`mun:dossier-synced`)
 */

import { COUNTRIES_DATABASE } from './countries-database.js';

export const DOSSIER_ENDPOINT_URL = 'https://script.google.com/macros/s/AKfycbwXGSS3rvWOGsWj7NT-DWxxwv8XwimfQXH0JRzHMkSC36garGRfJc8XotNPZxndCxTY8w/exec';
export const CACHE_STORAGE_KEY = 'mun_country_dossiers_live_cache';
export const CACHE_TIME_KEY = 'mun_country_dossiers_cache_time';
export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 Hour

// Key mapping aliases from various Google Sheet header styles to standard property names
const FIELD_ALIASES = {
  country: ['country', 'countryname', 'sovereignstate', 'name', 'nation', 'state'],
  iso2: ['iso2', 'iso2code', 'code', 'alpha2', 'countrycode', 'iso'],
  iso3: ['iso3', 'iso3code', 'alpha3'],
  id: ['id', 'countryid', 'slug'],
  capital: ['capital', 'capitalcity'],
  region: ['region', 'unregion', 'macroregion'],
  continent: ['continent'],
  areaKm2: ['areakm2', 'area', 'totalarea', 'landsurface', 'areakm'],
  population: ['population', 'totalpopulation', 'pop'],
  popGrowth: ['popgrowth', 'populationgrowth', 'annualpopgrowth'],
  urbanPop: ['urbanpop', 'urbanpopulation'],
  urbanPopPct: ['urbanpoppct', 'urbanpercent', 'urbanpct', 'urbanrate'],
  ruralPop: ['ruralpop', 'ruralpopulation'],
  ruralPopPct: ['ruralpoppct', 'ruralpercent', 'ruralpct', 'ruralrate'],
  timeZones: ['timezones', 'timezone', 'timeoffset', 'utc'],
  currency: ['currency', 'nationalcurrency'],
  govType: ['govtype', 'governmenttype', 'systemofgovernment', 'regimetype'],
  constitution: ['constitution', 'constitutionalframework', 'basiclaw'],
  headOfState: ['headofstate', 'sovereignhead', 'president', 'monarch'],
  headOfGov: ['headofgov', 'headofgovernment', 'primeminister'],
  foreignMinisters: ['foreignministers', 'foreignminister', 'foreignaffairs', 'externalaffairs'],
  rulingParty: ['rulingparty', 'governingparty', 'rulingcoalition'],
  opposition: ['opposition', 'oppositionparty', 'oppositioncoalition'],
  stabilityLevel: ['stabilitylevel', 'politicalstability', 'stability', 'fragilestatesindex'],
  stabilityRank: ['stabilityrank', 'stabilityranking'],
  corruptionLevel: ['corruptionlevel', 'anticorruptionindex', 'cpi', 'corruptionperceptionsindex'],
  corruptionRank: ['corruptionrank', 'cpirank'],
  pressFreedomLevel: ['pressfreedomlevel', 'pressfreedom', 'rsfindicator'],
  pressFreedomRank: ['pressfreedomrank', 'rsfrank'],
  humanRightsStatus: ['humanrightsstatus', 'humanrightsrating', 'humanrights'],
  humanRightsRank: ['humanrightsrank'],
  sanctions: ['sanctions', 'activesanctions', 'unsanctions', 'embargoes'],
  unMembershipYear: ['unmembershipyear', 'unmembership', 'unaccession', 'accessionyear'],
  unscStatus: ['unscstatus', 'securitycouncilstatus', 'securitycouncil'],
  isP5: ['isp5', 'p5', 'p5member'],
  isUNSC: ['isunsc', 'unscmember'],
  peacekeeping: ['peacekeeping', 'peacekeepingmissions', 'unpeacekeeping', 'dpo'],
  climateCommitments: ['climatecommitments', 'ndc', 'parisagreement', 'emissionspledge'],
  nuclearPolicy: ['nuclearpolicy', 'npt', 'nuclearcapabilitypolicy'],
  alliances: ['alliances', 'diplomaticalliances', 'securitypacts', 'treatyblocs'],
  gdpNominal: ['gdpnominal', 'nominalgdp', 'gdp'],
  gdpPpp: ['gdpppp', 'pppgdp'],
  gdpPerCapita: ['gdppercapita', 'percapitagdp'],
  growthRate: ['growthrate', 'annualgrowthrate', 'gdpgrowth'],
  inflation: ['inflation', 'inflationrate', 'cpiinflation'],
  unemployment: ['unemployment', 'unemploymentrate'],
  povertyRate: ['povertyrate', 'povertyheadcount'],
  hdi: ['hdi', 'humandevelopmentindex'],
  hdiRanking: ['hdiranking', 'hdirank'],
  nationalDebt: ['nationaldebt', 'publicnationaldebt', 'publicdebt', 'govdebt'],
  energyProduction: ['energyproduction', 'primaryenergysources', 'energy'],
  defenseBudget: ['defensebudget', 'annualdefensebudget', 'militaryexpenditure', 'sipri'],
  activePersonnel: ['activepersonnel', 'activemilitarypersonnel', 'troopstrength'],
  nuclearCapability: ['nuclearcapability', 'nuclearstrategiccapability', 'warheads'],
  weaponsSuppliers: ['weaponssuppliers', 'primaryarmssuppliers', 'armssuppliers'],
  internalConflicts: ['internalconflicts', 'internalsecurityconflicts', 'insurgency'],
  terrorismRisks: ['terrorismrisks', 'transnationalterrorismrisk', 'terrorismrisk'],
  cyberCapability: ['cybercapability', 'sovereigncybercapability', 'cyberdefense'],
  borderSecurity: ['bordersecurity', 'territorialbordersecurity'],
  languages: ['languages', 'officiallanguages'],
  religions: ['religions', 'majorreligions'],
  ethnicGroups: ['ethnicgroups', 'predominantethnicgroups', 'ethnicity'],
  literacyRate: ['literacyrate', 'adultliteracyrate'],
  educationLevel: ['educationlevel', 'educationinfrastructure', 'schooling'],
  lifeExpectancy: ['lifeexpectancy', 'averagelifeexpectancy'],
  healthcareQuality: ['healthcarequality', 'healthcareindex', 'healthsystem'],
  genderEquality: ['genderEquality', 'genderequality', 'genderequalityrating', 'wefgendergap'],
  internetPenetration: ['internetpenetration', 'digitalinternetaccess', 'internetaccess'],
  socialTensions: ['socialtensions', 'socialharmonytensions', 'groupgrievance'],
  summary: ['summary', 'brief', 'overview', 'description'],
  flag: ['flag', 'flagurl', 'flagimage'],
  flagSvg: ['flagsvg', 'svgflag']
};

/**
 * Normalizes an arbitrary raw row/record from Google Sheet / Apps Script into a standard country dossier object
 */
export function normalizeCountryRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Build a lookup map of sanitized key -> value
  const cleanLookup = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k && v !== undefined && v !== null) {
      const cleanKey = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      cleanLookup[cleanKey] = typeof v === 'string' ? v.trim() : v;
    }
  }

  const normalized = {};

  for (const [targetProp, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (cleanLookup[alias] !== undefined && cleanLookup[alias] !== '') {
        normalized[targetProp] = cleanLookup[alias];
        break;
      }
    }
  }

  // Preserve any additional fields that weren't matched in standard aliases
  for (const [k, v] of Object.entries(raw)) {
    if (normalized[k] === undefined && v !== undefined && v !== null) {
      normalized[k] = v;
    }
  }

  // Ensure primary keys
  const iso2 = (normalized.iso2 || raw.code || raw.iso || '').toUpperCase();
  const countryName = normalized.country || raw.country || raw.name || 'Unknown Sovereign State';
  const id = normalized.id || (iso2 ? iso2.toLowerCase() : countryName.toLowerCase().replace(/\s+/g, '-'));

  normalized.id = id;
  normalized.iso2 = iso2;
  normalized.country = countryName;

  // Auto-generate flags if missing
  if (!normalized.flag && iso2) {
    normalized.flag = `https://flagcdn.com/w160/${iso2.toLowerCase()}.png`;
  }
  if (!normalized.flagSvg && iso2) {
    normalized.flagSvg = `https://flagcdn.com/${iso2.toLowerCase()}.svg`;
  }

  return normalized;
}

/**
 * Parses raw JSON response from Google Apps Script which may be:
 * - Array of objects
 * - Object with `.data`, `.countries`, `.items`, `.records` array
 * - 2D Array with `.values` (Google Sheets format)
 * - Single country object
 */
export function parseGoogleScriptResponse(json) {
  if (!json) return [];

  // Case 1: Direct Array
  if (Array.isArray(json)) {
    return json.map(normalizeCountryRecord).filter(Boolean);
  }

  // Case 2: 2D array of rows
  if (Array.isArray(json.values) && json.values.length > 1) {
    const headers = json.values[0].map(h => String(h || '').trim());
    const rows = json.values.slice(1);
    const result = [];
    for (const r of rows) {
      if (!Array.isArray(r) || !r.length) continue;
      const obj = {};
      headers.forEach((h, i) => {
        if (h && r[i] !== undefined) obj[h] = r[i];
      });
      const norm = normalizeCountryRecord(obj);
      if (norm) result.push(norm);
    }
    return result;
  }

  // Case 3: Wrapped array in data, countries, results, etc.
  const possibleLists = [json.data, json.countries, json.items, json.records, json.rows, json.dossiers];
  for (const list of possibleLists) {
    if (Array.isArray(list)) {
      return list.map(normalizeCountryRecord).filter(Boolean);
    }
  }

  // Case 4: Single country object
  if (typeof json === 'object') {
    const single = normalizeCountryRecord(json);
    if (single && (single.country || single.iso2)) {
      return [single];
    }
  }

  return [];
}

/**
 * Get cached live country dossier data from localStorage if available
 */
export function getCachedDossierData() {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Dossier Service] Cache read error:', e);
  }
  return null;
}

/**
 * Save live country dossier data to localStorage
 */
export function setCachedDossierData(data) {
  if (!Array.isArray(data) || data.length === 0) return;
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
  } catch (e) {
    console.warn('[Dossier Service] Cache write error:', e);
  }
}

/**
 * Merged country database:
 * Combines static baseline COUNTRIES_DATABASE with any live cached overrides from Google Apps Script.
 */
export function getMergedCountriesDatabase() {
  const cached = getCachedDossierData();
  if (!cached || cached.length === 0) {
    return COUNTRIES_DATABASE;
  }

  // Build a lookup map of cached items by iso2, iso3, id, or country name
  const liveMap = new Map();
  cached.forEach(c => {
    if (c.iso2) liveMap.set(c.iso2.toUpperCase(), c);
    if (c.iso3) liveMap.set(c.iso3.toUpperCase(), c);
    if (c.id) liveMap.set(c.id.toLowerCase(), c);
    if (c.country) liveMap.set(c.country.toLowerCase(), c);
  });

  // Merge live fields over baseline countries
  const merged = COUNTRIES_DATABASE.map(base => {
    const override = (base.iso2 && liveMap.get(base.iso2.toUpperCase())) ||
      (base.iso3 && liveMap.get(base.iso3.toUpperCase())) ||
      (base.id && liveMap.get(base.id.toLowerCase())) ||
      (base.country && liveMap.get(base.country.toLowerCase()));

    return override ? { ...base, ...override } : base;
  });

  // Add any new sovereign countries from Google Apps Script that aren't in baseline
  const knownIso2s = new Set(COUNTRIES_DATABASE.map(c => (c.iso2 || '').toUpperCase()));
  cached.forEach(liveCountry => {
    const iso = (liveCountry.iso2 || '').toUpperCase();
    if (iso && !knownIso2s.has(iso)) {
      merged.push(liveCountry);
      knownIso2s.add(iso);
    }
  });

  return merged;
}

/**
 * Lookup a country dossier by code, ISO, ID, or name from the active merged database
 */
export function getCountryByCode(codeParam) {
  if (!codeParam) return null;
  const q = String(codeParam).trim().toUpperCase();
  const db = getMergedCountriesDatabase();

  return db.find(c =>
    (c.iso2 && c.iso2.toUpperCase() === q) ||
    (c.iso3 && c.iso3.toUpperCase() === q) ||
    (c.id && c.id.toUpperCase() === q) ||
    (c.country && c.country.toUpperCase() === q)
  ) || null;
}

/**
 * Asynchronously fetch live country dossier resources from Google Apps Script Web App.
 * Updates local cache and fires a `mun:dossier-synced` event when complete.
 * 
 * @param {string} [countryCode] Optional specific country to request
 * @returns {Promise<{success: boolean, data: Array, source: string, error?: string}>}
 */
export async function fetchCountryDossierData(countryCode = null) {
  let url = DOSSIER_ENDPOINT_URL;
  if (countryCode) {
    const clean = encodeURIComponent(countryCode.trim());
    url += (url.includes('?') ? '&' : '?') + `code=${clean}&country=${clean}`;
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    });

    // Check if redirected to Google Accounts login (Apps script permissions issue)
    if (res.redirected && res.url.includes('accounts.google.com')) {
      console.warn(
        '[Dossier Service] Google Apps Script requires permission adjustment:\n' +
        'Please deploy the Apps Script with "Who has access: Anyone" so requests can fetch without Google Login.\n' +
        'Using local and baseline country dossier data.'
      );
      return {
        success: false,
        source: 'cached-baseline',
        data: getMergedCountriesDatabase(),
        error: 'AUTH_REQUIRED'
      };
    }

    if (!res.ok) {
      console.warn(`[Dossier Service] Endpoint returned HTTP ${res.status}. Using cached/baseline data.`);
      return {
        success: false,
        source: 'cached-baseline',
        data: getMergedCountriesDatabase(),
        error: `HTTP_${res.status}`
      };
    }

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      // If response was HTML ( login page returned with 200 or proxy)
      if (text.includes('accounts.google.com') || text.includes('<!DOCTYPE html>')) {
        console.warn(
          '[Dossier Service] Received HTML instead of JSON from Google Apps Script endpoint.\n' +
          'Ensure the Web App deployment has "Who has access: Anyone". Using baseline data.'
        );
        return {
          success: false,
          source: 'cached-baseline',
          data: getMergedCountriesDatabase(),
          error: 'AUTH_REQUIRED'
        };
      }
      throw parseErr;
    }

    const liveCountries = parseGoogleScriptResponse(json);

    if (liveCountries.length > 0) {
      // Merge with existing cached items
      const existing = getCachedDossierData() || [];
      const mergedMap = new Map();
      existing.forEach(c => {
        const key = c.iso2 || c.id || c.country;
        if (key) mergedMap.set(key.toLowerCase(), c);
      });
      liveCountries.forEach(c => {
        const key = c.iso2 || c.id || c.country;
        if (key) mergedMap.set(key.toLowerCase(), { ...(mergedMap.get(key.toLowerCase()) || {}), ...c });
      });

      const updatedList = Array.from(mergedMap.values());
      setCachedDossierData(updatedList);

      // Dispatch global sync event
      window.dispatchEvent(new CustomEvent('mun:dossier-synced', {
        detail: {
          countries: updatedList,
          count: updatedList.length,
          timestamp: Date.now()
        }
      }));

      console.log(`[Dossier Service] Successfully synced ${liveCountries.length} country dossiers from Google Apps Script.`);
      return {
        success: true,
        source: 'google-apps-script',
        data: getMergedCountriesDatabase()
      };
    } else {
      console.info('[Dossier Service] No country records found in response. Using baseline data.');
      return {
        success: true,
        source: 'cached-baseline',
        data: getMergedCountriesDatabase()
      };
    }
  } catch (err) {
    console.warn('[Dossier Service] Network or parsing notice when fetching from Google Apps Script:', err);
    return {
      success: false,
      source: 'cached-baseline',
      data: getMergedCountriesDatabase(),
      error: err.message
    };
  }
}
