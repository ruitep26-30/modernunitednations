/**
 * Step 3 - Country & Position Allotment
 * 2-Column Workspace:
 * - Left Sidebar: Vertical committees list with real-time allotment counters
 * - Main Area: 7x7 Grid of all countries for manual selection, presets, search,
 *   and custom portfolios/positions per committee.
 */

import { R2_CONFIG } from '../r2-config.js';
import { COUNTRIES_LIST } from '../location-data.js';
import { isWideCommittee, getCommitteeIcon, formatCategory } from './step2.js';

let selectedCommittees = [];
let countryMatrixData = {};
let activeCommitteeIndex = 0;
let searchQuery = '';

const P5_NAMES = ['United States', 'United Kingdom', 'France', 'Russia', 'China'];
const G20_NAMES = [
  'Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany',
  'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'Russia', 'Saudi Arabia',
  'South Africa', 'South Korea', 'Turkey', 'United Kingdom', 'United States'
];

// Regional & Special Organizations and their recognized member states
const REGIONAL_ORGS = {
  EU: {
    name: 'EU Member States',
    members: [
      'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
      'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
      'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
      'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden'
    ]
  },
  ASEAN: {
    name: 'ASEAN Member States',
    members: [
      'Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar',
      'Philippines', 'Singapore', 'Thailand', 'Vietnam', 'Timor-Leste'
    ]
  },
  AU: {
    name: 'African Union Member States',
    members: [
      'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi',
      'Cabo Verde', 'Cameroon', 'Central African Republic', 'Chad', 'Comoros',
      'Congo', 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea',
      'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau',
      'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar',
      'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique',
      'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal',
      'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan',
      'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
    ]
  },
  NATO: {
    name: 'NATO Allies',
    members: [
      'Albania', 'Belgium', 'Bulgaria', 'Canada', 'Croatia', 'Czech Republic',
      'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
      'Iceland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Montenegro',
      'Netherlands', 'North Macedonia', 'Norway', 'Poland', 'Portugal', 'Romania',
      'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Turkey', 'United Kingdom', 'United States'
    ]
  },
  BRICS: {
    name: 'BRICS Member States',
    members: [
      'Brazil', 'Russia', 'India', 'China', 'South Africa', 'Egypt', 'Ethiopia',
      'Iran', 'United Arab Emirates', 'Saudi Arabia'
    ]
  },
  SAARC: {
    name: 'SAARC Member States',
    members: [
      'Afghanistan', 'Bangladesh', 'Bhutan', 'India', 'Maldives', 'Nepal',
      'Pakistan', 'Sri Lanka'
    ]
  },
  OECD: {
    name: 'OECD Member States',
    members: [
      'Australia', 'Austria', 'Belgium', 'Canada', 'Chile', 'Colombia', 'Costa Rica',
      'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
      'Greece', 'Hungary', 'Iceland', 'Ireland', 'Israel', 'Italy', 'Japan',
      'South Korea', 'Latvia', 'Lithuania', 'Luxembourg', 'Mexico', 'Netherlands',
      'New Zealand', 'Norway', 'Poland', 'Portugal', 'Slovakia', 'Slovenia',
      'Spain', 'Sweden', 'Switzerland', 'Turkey', 'United Kingdom', 'United States'
    ]
  },
  AC: {
    name: 'Arctic Council Member States',
    members: [
      'Canada', 'Denmark', 'Finland', 'Iceland', 'Norway', 'Russia', 'Sweden', 'United States'
    ]
  },
  G20: {
    name: 'G20 Members',
    members: [
      'Argentina', 'Australia', 'Brazil', 'Canada', 'China', 'France', 'Germany',
      'India', 'Indonesia', 'Italy', 'Japan', 'Mexico', 'Russia', 'Saudi Arabia',
      'South Africa', 'South Korea', 'Turkey', 'United Kingdom', 'United States'
    ]
  },
  UNSC: {
    name: 'UNSC Members (P5 & Non-Permanent)',
    members: [
      'China', 'France', 'Russia', 'United Kingdom', 'United States',
      'Algeria', 'Ecuador', 'Guyana', 'Japan', 'Malta', 'Mozambique',
      'South Korea', 'Sierra Leone', 'Slovenia', 'Switzerland'
    ]
  },
  SC: {
    name: 'UNSC Members (P5 & Non-Permanent)',
    members: [
      'China', 'France', 'Russia', 'United Kingdom', 'United States',
      'Algeria', 'Ecuador', 'Guyana', 'Japan', 'Malta', 'Mozambique',
      'South Korea', 'Sierra Leone', 'Slovenia', 'Switzerland'
    ]
  }
};

// Indian & National Committees Portfolios
const INDIAN_COMMITTEE_CODES = ['INDCN', 'AIPPM', 'NITI', 'INC', 'BJP'];

// International Press (IP) — 3 Dedicated Role Types: Journalists, Reporters, Photographers
export const IP_ROLES = [
  { key: 'journalists', name: 'Journalists', icon: 'newspaper-outline', desc: 'Articles, editorial coverage, op-eds, and written proceedings.' },
  { key: 'reporters', name: 'Reporters', icon: 'mic-outline', desc: 'Field reporting, interviews, breaking news, and live press briefings.' },
  { key: 'photographers', name: 'Photographers', icon: 'camera-outline', desc: 'Photojournalism, live council captures, and visual media documentation.' }
];

export function isIPCommittee(comm) {
  if (!comm) return false;
  const code = (comm.code || '').toUpperCase().trim();
  const name = (comm.name || '').toLowerCase().trim();
  return (
    code === 'IP' ||
    code === 'IPC' ||
    name === 'ip' ||
    name.includes('press') ||
    name.includes('journalist')
  );
}

/**
 * Retrieve current IP role counts from countryMatrixData
 */
export function getIPRoleCounts(commCode) {
  const allot = countryMatrixData[commCode];
  if (!allot) return { journalists: 5, reporters: 4, photographers: 2 };

  if (allot.pressCounts && typeof allot.pressCounts === 'object') {
    return {
      journalists: Math.max(0, parseInt(allot.pressCounts.journalists, 10) || 0),
      reporters: Math.max(0, parseInt(allot.pressCounts.reporters, 10) || 0),
      photographers: Math.max(0, parseInt(allot.pressCounts.photographers, 10) || 0)
    };
  }

  if (Array.isArray(allot.positions) && allot.positions.length > 0) {
    const jPos = allot.positions.find(p => /journalist/i.test(p.name));
    const rPos = allot.positions.find(p => /reporter/i.test(p.name));
    const pPos = allot.positions.find(p => /photographer/i.test(p.name));
    if (jPos || rPos || pPos) {
      return {
        journalists: Math.max(0, parseInt(jPos?.count, 10) || 0),
        reporters: Math.max(0, parseInt(rPos?.count, 10) || 0),
        photographers: Math.max(0, parseInt(pPos?.count, 10) || 0)
      };
    }
  }

  if (Array.isArray(allot.countries) && allot.countries.length > 0) {
    let j = 0, r = 0, p = 0;
    allot.countries.forEach(name => {
      const lower = String(name || '').toLowerCase();
      if (lower.includes('photo')) p++;
      else if (lower.includes('report')) r++;
      else if (lower.includes('journalist')) j++;
    });
    if (j > 0 || r > 0 || p > 0) {
      return { journalists: j, reporters: r, photographers: p };
    }
  }

  return { journalists: 5, reporters: 4, photographers: 2 };
}

/**
 * Update IP role counts in countryMatrixData and regenerate countries seat list
 */
export function setIPRoleCounts(commCode, counts) {
  const j = Math.max(0, parseInt(counts.journalists, 10) || 0);
  const r = Math.max(0, parseInt(counts.reporters, 10) || 0);
  const p = Math.max(0, parseInt(counts.photographers, 10) || 0);

  const countriesList = [];
  for (let i = 1; i <= j; i++) countriesList.push(j > 1 ? `Journalist ${i}` : 'Journalist');
  for (let i = 1; i <= r; i++) countriesList.push(r > 1 ? `Reporter ${i}` : 'Reporter');
  for (let i = 1; i <= p; i++) countriesList.push(p > 1 ? `Photographer ${i}` : 'Photographer');

  countryMatrixData[commCode] = {
    countries: countriesList,
    pressCounts: { journalists: j, reporters: r, photographers: p },
    positions: []
  };

  return { journalists: j, reporters: r, photographers: p, total: j + r + p };
}

const INDIAN_PORTFOLIOS = {
  INDCN: [
    // Prime Minister
    'Prime Minister — Shri Narendra Modi',

    // Cabinet Ministers
    'Minister of Defence — Shri Raj Nath Singh',
    'Minister of Home Affairs & Cooperation — Shri Amit Shah',
    'Minister of Road Transport & Highways — Shri Nitin Jairam Gadkari',
    'Minister of Health & Family Welfare & Chemicals & Fertilizers — Shri Jagat Prakash Nadda',
    'Minister of Agriculture & Farmers Welfare & Rural Development — Shri Shivraj Singh Chouhan',
    'Minister of Finance & Corporate Affairs — Smt. Nirmala Sitharaman',
    'Minister of External Affairs — Dr. Subrahmanyam Jaishankar',
    'Minister of Housing & Urban Affairs & Power — Shri Manohar Lal',
    'Minister of Heavy Industries & Steel — Shri H. D. Kumaraswamy',
    'Minister of Commerce & Industry — Shri Piyush Goyal',
    'Minister of Micro, Small & Medium Enterprises — Shri Jitan Ram Manjhi',
    'Minister of Panchayati Raj, Fisheries, Animal Husbandry & Dairying — Shri Rajiv Ranjan Singh (Lalan Singh)',
    'Minister of Ports, Shipping & Waterways — Shri Sarbananda Sonowal',
    'Minister of Social Justice & Empowerment — Dr. Virendra Kumar',
    'Minister of Civil Aviation — Shri Kinjarapu Rammohan Naidu',
    'Minister of Consumer Affairs, Food & Public Distribution, New & Renewable Energy & Education — Shri Pralhad Joshi',
    'Minister of Tribal Affairs — Shri Jual Oram',
    'Minister of Textiles — Shri Giriraj Singh',
    'Minister of Railways, Information & Broadcasting & Electronics & IT — Shri Ashwini Vaishnaw',
    'Minister of Communications & Development of North Eastern Region — Shri Jyotiraditya M. Scindia',
    'Minister of Environment, Forest & Climate Change — Shri Bhupender Yadav',
    'Minister of Culture & Tourism — Shri Gajendra Singh Shekhawat',
    'Minister of Women & Child Development — Smt. Annpurna Devi',
    'Minister of Parliamentary Affairs & Minority Affairs — Shri Kiren Rijiju',
    'Minister of Petroleum & Natural Gas — Shri Hardeep Singh Puri',
    'Minister of Labour & Employment & Youth Affairs & Sports — Dr. Mansukh Mandaviya',
    'Minister of Coal & Mines — Shri G. Kishan Reddy',
    'Minister of Food Processing Industries — Shri Chirag Paswan',
    'Minister of Jal Shakti — Shri C R Patil',

    // Ministers of State (Independent Charge)
    'MoS (IC) Statistics & Programme Implementation, Planning & MoS Culture — Rao Inderjit Singh',
    'MoS (IC) Science & Technology, Earth Sciences, MoS PMO, Personnel, Atomic Energy & Space — Dr. Jitendra Singh',
    'MoS (IC) Law & Justice & MoS Parliamentary Affairs — Shri Arjun Ram Meghwal',
    'MoS (IC) Ayush & MoS Health & Family Welfare — Shri Prataprao Jadhav',
    'MoS (IC) Skill Development & Entrepreneurship & MoS Education — Shri Jayant Chaudhary',

    // Ministers of State
    'MoS Commerce & Industry & Electronics & IT — Shri Jitin Prasada',
    'MoS Power & New & Renewable Energy — Shri Shripad Yesso Naik',
    'MoS Finance — Shri Pankaj Chaudhary',
    'MoS Cooperation — Shri Krishan Pal',
    'MoS Social Justice & Empowerment — Shri Ramdas Athawale',
    'MoS Agriculture & Farmers Welfare — Shri Ram Nath Thakur',
    'MoS Home Affairs — Shri Nityanand Rai',
    'MoS Health & Family Welfare & Chemicals & Fertilizers — Smt. Anupriya Patel',
    'MoS Jal Shakti & Railways — Shri V. Somanna',
    'MoS Rural Development & Communications — Dr. Chandra Sekhar Pemmasani',
    'MoS Fisheries, Animal Husbandry & Dairying & Panchayati Raj — Prof. S. P. Singh Baghel',
    'MoS Micro, Small & Medium Enterprises & Labour & Employment — Sushri Shobha Karandlaje',
    'MoS Environment, Forest & Climate Change & External Affairs — Shri Kirti Vardhan Singh',
    'MoS Consumer Affairs, Food & Public Distribution & Social Justice — Shri B. L. Verma',
    'MoS Ports, Shipping & Waterways — Shri Shantanu Thakur',
    'MoS Petroleum & Natural Gas & Tourism — Shri Suresh Gopi',
    'MoS Information & Broadcasting & Parliamentary Affairs — Dr. L. Murugan',
    'MoS Road Transport & Highways — Shri Ajay Tamta',
    'MoS Home Affairs — Shri Bandi Sanjay Kumar',
    'MoS Rural Development — Shri Kamlesh Paswan',
    'MoS Agriculture & Farmers Welfare — Shri Bhagirath Choudhary',
    'MoS Coal & Mines — Shri Satish Chandra Dubey',
    'MoS Defence — Shri Sanjay Seth',
    'MoS Tribal Affairs — Shri Durgadas Uikey',
    'MoS Youth Affairs & Sports — Smt. Raksha Nikhil Khadse',
    'MoS Education & Development of North Eastern Region — Shri Sukanta Majumdar',
    'MoS Women & Child Development — Smt. Savitri Thakur',
    'MoS Housing & Urban Affairs — Shri Tokhan Sahu',
    'MoS Jal Shakti — Shri Raj Bhushan Choudhary',
    'MoS Heavy Industries & Steel — Shri Bhupathi Raju Srinivasa Varma',
    'MoS Corporate Affairs & Road Transport & Highways — Shri Harsh Malhotra',
    'MoS Consumer Affairs, Food & Public Distribution — Smt. Nimuben Jayantibhai Bambhaniya',
    'MoS Cooperation & Civil Aviation — Shri Murlidhar Mohol',
    'MoS External Affairs & Textiles — Shri Pabitra Margherita',

    // Principal Advisory & Strategic Cabinet Positions
    'National Security Advisor (NSA) — Shri Ajit Doval',
    'Cabinet Secretary of India — Shri T. V. Somanathan',
    'Principal Secretary to the Prime Minister — Dr. P. K. Mishra'
  ]
};

function isIndianCommittee(comm) {
  if (!comm) return false;
  const code = (comm.code || '').toUpperCase().trim();
  const cat = (comm.category || '').toLowerCase().trim();
  const name = (comm.name || '').toLowerCase();

  return (
    code === 'INDCN' ||
    cat === 'national' ||
    INDIAN_COMMITTEE_CODES.includes(code) ||
    name.includes('cabinet') ||
    name.includes('aippm') ||
    name.includes('all india')
  );
}

function getRegionalOrg(commCode) {
  const code = (commCode || '').toUpperCase().trim();
  return REGIONAL_ORGS[code] || null;
}

function getIndianPortfoliosForComm(comm) {
  const code = (comm.code || '').toUpperCase().trim();
  const defaults = INDIAN_PORTFOLIOS[code] || INDIAN_PORTFOLIOS.INDCN || [];
  return [...defaults];
}

/**
 * Partition Indian portfolios into official ministerial rank sections:
 * 1. Cabinet Ministers (Prime Minister & Cabinet Ministers)
 * 2. Ministers of State (Independent Charge)
 * 3. Ministers of State
 * 4. Strategic Advisors & Additional Portfolios
 */
function getIndianPortfolioSections(portfolios) {
  const cabinet = [];
  const mosIc = [];
  const mos = [];
  const advisors = [];

  portfolios.forEach(name => {
    const lower = name.toLowerCase().trim();
    if (lower.startsWith('mos (ic)') || lower.includes('(independent charge)')) {
      mosIc.push(name);
    } else if (lower.startsWith('mos ') || lower.startsWith('minister of state ')) {
      mos.push(name);
    } else if (lower.startsWith('prime minister') || lower.startsWith('minister of ')) {
      cabinet.push(name);
    } else {
      advisors.push(name);
    }
  });

  const sections = [];
  if (cabinet.length > 0) {
    sections.push({ id: 'cabinet', title: 'Cabinet Ministers', items: cabinet });
  }
  if (mosIc.length > 0) {
    sections.push({ id: 'mos_ic', title: 'Ministers of State (Independent Charge)', items: mosIc });
  }
  if (mos.length > 0) {
    sections.push({ id: 'mos', title: 'Ministers of State', items: mos });
  }
  if (advisors.length > 0) {
    const title = (cabinet.length === 0 && mosIc.length === 0 && mos.length === 0)
      ? 'Portfolios'
      : 'Strategic Advisors & Additional Portfolios';
    sections.push({ id: 'advisors', title, items: advisors });
  }

  return sections;
}

function getIndianPortfolioIcon(name, commCode) {
  const n = (name || '').toLowerCase();
  if (n.includes('prime minister') || n.includes('home') || n.includes('defence') || n.includes('finance') || n.includes('external') || n.includes('security advisor') || n.includes('cabinet secretary')) {
    return 'shield-checkmark-outline';
  }
  if (n.includes('speaker') || n.includes('chairman') || n.includes('leader') || n.includes('parliamentary')) {
    return 'podium-outline';
  }
  if (n.includes('justice') || n.includes('judge') || n.includes('law')) {
    return 'hammer-outline';
  }
  if (n.includes('railways') || n.includes('transport') || n.includes('aviation') || n.includes('shipping') || n.includes('ports')) {
    return 'navigate-outline';
  }
  if (n.includes('health') || n.includes('ayush') || n.includes('chemicals')) {
    return 'medkit-outline';
  }
  if (n.includes('agriculture') || n.includes('farmers') || n.includes('environment') || n.includes('forest') || n.includes('fisheries') || n.includes('animal')) {
    return 'leaf-outline';
  }
  if (n.includes('education') || n.includes('skill')) {
    return 'school-outline';
  }
  if (n.includes('science') || n.includes('technology') || n.includes('electronics') || n.includes('atomic') || n.includes('space') || n.includes('information')) {
    return 'hardware-chip-outline';
  }
  if (n.includes('commerce') || n.includes('industry') || n.includes('steel') || n.includes('mines') || n.includes('coal') || n.includes('petroleum') || n.includes('power') || n.includes('corporate') || n.includes('housing')) {
    return 'business-outline';
  }
  return 'person-outline';
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return '🌐';
  }
}

/**
 * Initialize Step 3
 */
export async function initStep3(existingData = {}) {
  // Normalize selected committees from Step 2
  const rawCommittees = existingData.committees || (window.__wizardData && window.__wizardData.committees) || [];
  selectedCommittees = rawCommittees.map(item => {
    if (typeof item === 'string') {
      return { code: item, name: item, category: 'unga', isCustom: false };
    }
    return item;
  });

  // Restore or initialize countryMatrixData
  countryMatrixData = existingData.countryMatrix ? { ...existingData.countryMatrix } : {};

  // Ensure default allotment for each selected committee if not already present
  selectedCommittees.forEach(comm => {
    if (!countryMatrixData[comm.code]) {
      countryMatrixData[comm.code] = getDefaultCommitteeAllotment(comm);
    } else if (isIPCommittee(comm)) {
      // Ensure IP data uses the 3-role counter model
      const allot = countryMatrixData[comm.code];
      const hasPressCounts = allot && allot.pressCounts && typeof allot.pressCounts === 'object';
      if (!hasPressCounts) {
        const counts = getIPRoleCounts(comm.code);
        setIPRoleCounts(comm.code, counts);
      }
    }
  });

  // Clamp active committee index
  if (activeCommitteeIndex >= selectedCommittees.length) {
    activeCommitteeIndex = Math.max(0, selectedCommittees.length - 1);
  }

  searchQuery = '';
  document.body.classList.add('cc-step3-active');
  renderCpWorkspace();
  window.addEventListener('resize', syncCountryScrollHeight);
}

/**
 * Cleanup Step 3
 */
export function cleanupStep3() {
  searchQuery = '';
  document.body.classList.remove('cc-step3-active');
  window.removeEventListener('resize', syncCountryScrollHeight);
}

/**
 * Get Step 3 Data
 */
export function getStep3Data() {
  return {
    countryMatrix: { ...countryMatrixData }
  };
}

/**
 * Validate Step 3
 */
export function validateStep3(showErrors = false) {
  if (selectedCommittees.length === 0) {
    if (showErrors) {
      window.dispatchEvent(new CustomEvent('wizard:toast', {
        detail: { message: 'Please select committees in Step 2 before assigning allotments.', type: 'error' }
      }));
    }
    return false;
  }

  // Helper to get total allotted countries or portfolios for a committee
  const getCommCount = comm => {
    const data = countryMatrixData[comm.code] || {};
    if (Array.isArray(data.countries)) {
      return data.countries.length;
    }
    if (Array.isArray(data.positions)) {
      return data.positions.length;
    }
    return 0;
  };

  // Find all committees missing at least 5 countries
  const missingCommittees = [];
  let firstMissingIndex = -1;

  for (let i = 0; i < selectedCommittees.length; i++) {
    const comm = selectedCommittees[i];
    const count = getCommCount(comm);
    if (count < 5) {
      missingCommittees.push(comm);
      if (firstMissingIndex === -1) {
        firstMissingIndex = i;
      }
    }
  }

  if (missingCommittees.length > 0) {
    if (showErrors) {
      if (firstMissingIndex !== -1 && activeCommitteeIndex !== firstMissingIndex) {
        activeCommitteeIndex = firstMissingIndex;
        renderCpWorkspace();
      }
      const main = document.getElementById('cpMainWorkspace');
      if (main) {
        main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      const commNames = missingCommittees.map(c => c.code || c.name);
      const message = commNames.length === 1
        ? `Please assign at least 5 countries for ${commNames[0]}.`
        : `Please assign at least 5 countries for: ${commNames.join(', ')}.`;

      window.dispatchEvent(new CustomEvent('wizard:toast', {
        detail: { message, type: 'error' }
      }));
    }
    return false;
  }

  return true;
}

/**
 * Generate sensible default allotment per committee
 */
function getDefaultCommitteeAllotment(comm) {
  // If National / Specialized Portfolio Committee
  if (isIndianCommittee(comm)) {
    // Default to the top 30 key portfolios (Prime Minister + 29 Cabinet Ministers)
    const list = getIndianPortfoliosForComm(comm).slice(0, 30);
    return {
      countries: [...list],
      positions: list.map(name => ({ id: `pos-${name}`, name, count: 1 }))
    };
  }

  // If International Press (IP / Press) - 3 Roles: Journalists, Reporters, Photographers
  if (isIPCommittee(comm)) {
    const defaultCounts = { journalists: 5, reporters: 4, photographers: 2 };
    const countriesList = [];
    for (let i = 1; i <= defaultCounts.journalists; i++) countriesList.push(`Journalist ${i}`);
    for (let i = 1; i <= defaultCounts.reporters; i++) countriesList.push(`Reporter ${i}`);
    for (let i = 1; i <= defaultCounts.photographers; i++) countriesList.push(`Photographer ${i}`);

    return {
      countries: countriesList,
      pressCounts: { ...defaultCounts },
      positions: []
    };
  }

  // If Regional / Intergovernmental Organization (EU, ASEAN, AU, NATO, BRICS, SAARC, OECD, etc.)
  const org = getRegionalOrg(comm.code);
  if (org) {
    return {
      countries: [...org.members],
      positions: []
    };
  }

  const code = (comm.code || '').toUpperCase();

  // If UNSC: default to 15 members (P5 + non-permanent)
  if (code === 'UNSC' || code === 'SC') {
    return {
      countries: [...P5_NAMES, 'Japan', 'Switzerland', 'Ecuador', 'Malta', 'Mozambique', 'Algeria', 'Guyana', 'Sierra Leone', 'Slovenia', 'South Korea'],
      positions: []
    };
  }

  // If G20
  if (code === 'G20') {
    return {
      countries: [...G20_NAMES],
      positions: []
    };
  }

  // Default for UNGA and others: top 35 countries by default
  const defaultList = COUNTRIES_LIST.slice(0, 35).map(c => c.name);
  return {
    countries: defaultList,
    positions: []
  };
}

/**
 * Render the Country & Position Allotment Workspace
 */
function renderCpWorkspace() {
  const container = document.getElementById('cpDeckContainer');
  if (!container) return;

  if (selectedCommittees.length === 0) {
    container.innerHTML = `
      <div class="cc-cp-empty-state">
        <div class="cc-cp-empty-icon-box">
          <ion-icon name="alert-circle-outline"></ion-icon>
        </div>
        <h3 class="cc-cp-empty-title">No Committees Selected</h3>
        <p class="cc-cp-empty-desc">Please go back to Step 2 and choose committees for your conference before allotting countries and positions.</p>
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
  const isCustom = Boolean(activeComm.isCustom);
  const isWide = isWideCommittee(activeComm.code);
  const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(activeComm.code) : (activeComm.logoUrl || '');

  const allot = countryMatrixData[activeComm.code] || { countries: [] };
  const allottedCountries = Array.isArray(allot.countries) ? allot.countries : [];

  const isIndian = isIndianCommittee(activeComm);
  const isIP = isIPCommittee(activeComm);
  let countText;
  if (isIP) {
    const ipCounts = getIPRoleCounts(activeComm.code);
    const ipTotal = ipCounts.journalists + ipCounts.reporters + ipCounts.photographers;
    countText = `${ipTotal} ${ipTotal === 1 ? 'Position Allotted' : 'Positions Allotted'}`;
  } else if (isIndian) {
    countText = `${allottedCountries.length} ${allottedCountries.length === 1 ? 'Portfolio Selected' : 'Portfolios Selected'}`;
  } else {
    countText = `${allottedCountries.length} ${allottedCountries.length === 1 ? 'Country Selected' : 'Countries Selected'}`;
  }

  const searchPlaceholder = isIndian
    ? 'Search portfolios...'
    : 'Search 195 countries...';

  const clearTitle = (isIndian || isIP)
    ? 'Clear all selected portfolios'
    : 'Clear all selected countries';

  container.innerHTML = `
    <div class="cc-cp-workspace">
      <!-- Left Sidebar: Vertical Committees List -->
      <aside class="cc-cp-committees-sidebar">
        <div class="cc-cp-sidebar-sticky-inner">
          <div class="cc-cp-sidebar-header">
            <span class="cc-cp-sidebar-title">Committees</span>
            <span class="cc-cp-sidebar-count">${selectedCommittees.length} ${selectedCommittees.length === 1 ? 'Committee' : 'Committees'}</span>
          </div>
          <div class="cc-cp-sidebar-list" id="cpSidebarList">
            ${renderVerticalCommittees()}
          </div>
        </div>
      </aside>

      <!-- Right Main Workspace: Countries / Portfolios Deck -->
      <main class="cc-cp-main-workspace" id="cpMainWorkspace">
        <!-- Active Committee Header Bar -->
        <div class="cc-cp-main-header">
          <div class="cc-cp-comm-logo-wrap ${isWide ? 'is-wide' : ''}">
            ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(activeComm.code)}" />` : `<div class="cc-cp-comm-logo-fallback"><ion-icon name="${getCommitteeIcon(activeComm.category)}"></ion-icon></div>`}
          </div>
          <div class="cc-cp-comm-meta">
            <div class="cc-cp-comm-code-row">
              <span class="cc-cp-comm-code">${escapeHtml(activeComm.code)}</span>
            </div>
            <div class="cc-cp-comm-bottom-row">
              <div class="cc-cp-comm-name" title="${escapeHtml(activeComm.name || activeComm.code)}">
                ${escapeHtml(activeComm.name || activeComm.code)}
              </div>
              <div class="cc-cp-main-header-right">
                <span class="cc-cp-selected-count-text" id="commSelectedCountText">
                  ${countText}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Search & Actions Toolbar -->
        ${isIP ? '' : `
        <div class="cc-cp-toolbar-strip">
          <div class="cc-cp-search-box">
            <ion-icon name="search-outline"></ion-icon>
            <input
              type="text"
              id="countrySearchInput"
              class="cc-cp-search-input"
              placeholder="${searchPlaceholder}"
              value="${escapeHtml(searchQuery)}"
              autocomplete="off"
            />
            ${searchQuery ? `<button type="button" class="cc-cp-search-clear" id="btnSearchClear" title="Clear search"><ion-icon name="close-circle"></ion-icon></button>` : ''}
          </div>

          <button type="button" class="cc-cp-btn-clear-all" id="btnClearSelection" title="${clearTitle}" aria-label="Clear all" ${allottedCountries.length === 0 ? 'disabled' : ''}>
            <ion-icon name="trash-outline"></ion-icon>
          </button>
        </div>
        `}

        <!-- Main Workspace Deck (Portfolios for Indian Committees, Member States + Divider for Regional, 5x5 Grid for UN) -->
        <div class="cc-cp-grid-section" id="cpGridContainer">
          ${renderMainGrid(activeComm, searchQuery, allottedCountries)}
        </div>
      </main>
    </div>
  `;

  attachWorkspaceInteractions();
  requestAnimationFrame(() => {
    syncCountryScrollHeight();
  });
}

/**
 * Render the main grid contents based on committee type
 */
function renderMainGrid(comm, query, allotted) {
  const q = (query || '').trim().toLowerCase();

  // CASE 1: National / Specialized Portfolio Committees
  // Strictly NO foreign countries at all
  if (isIndianCommittee(comm)) {
    const allPortfolios = getIndianPortfoliosForComm(comm);
    const filtered = allPortfolios.filter(name => !q || name.toLowerCase().includes(q));
    const sections = getIndianPortfolioSections(filtered);

    if (sections.length === 0) {
      return `
        <div class="cc-cp-no-results">
          <ion-icon name="search-outline"></ion-icon>
          <span>No portfolios found matching "${escapeHtml(query)}"</span>
        </div>
      `;
    }

    return `
      <!-- Divided 5x5 Grids by Ministerial Rank -->
      <div id="countryGrid" class="cc-cp-portfolio-sections-wrap">
        ${sections.map((sec, idx) => {
          const secAllSelected = sec.items.length > 0 && sec.items.every(name => allotted.includes(name));
          return `
            <div class="cc-cp-grid-group" style="margin-top: ${idx > 0 ? '24px' : '0'};">
              <div class="cc-cp-grid-group-label">
                <span class="cc-cp-grid-group-title">${escapeHtml(sec.title)} (${sec.items.length})</span>
                <button type="button" class="cc-cp-btn-category-select-all" data-category="sec-${idx}">
                  ${secAllSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div class="cc-cp-portfolio-grid-5x5">
                ${renderIndianPortfolioCards(sec.items, allotted, comm.code)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // CASE 2: International Press (IP) — 3 Dedicated Roles: Journalists, Reporters, Photographers with Quantity Steppers
  if (isIPCommittee(comm)) {
    const counts = getIPRoleCounts(comm.code);
    const total = counts.journalists + counts.reporters + counts.photographers;

    return `
      <div class="cc-ip-roles-container">
        <div class="cc-ip-cards-stack">
          <!-- Role 1: Journalists -->
          <div class="cc-ip-role-card" id="cardRoleJournalists">
            <div class="cc-ip-role-left">
              <div class="cc-ip-role-icon">
                <ion-icon name="newspaper-outline"></ion-icon>
              </div>
              <div class="cc-ip-role-info">
                <h4 class="cc-ip-role-title">Journalists</h4>
                <p class="cc-ip-role-desc">Articles, editorial coverage, op-eds, and written proceedings.</p>
              </div>
            </div>
            <div class="cc-ip-stepper">
              <button type="button" class="cc-ip-stepper-btn" id="btnDecJournalists" title="Decrease Journalists" ${counts.journalists === 0 ? 'disabled' : ''}>
                <ion-icon name="remove-outline"></ion-icon>
              </button>
              <input type="number" id="inputJournalists" class="cc-ip-stepper-input" value="${counts.journalists}" min="0" max="999" />
              <button type="button" class="cc-ip-stepper-btn" id="btnIncJournalists" title="Increase Journalists">
                <ion-icon name="add-outline"></ion-icon>
              </button>
            </div>
          </div>

          <!-- Role 2: Reporters -->
          <div class="cc-ip-role-card" id="cardRoleReporters">
            <div class="cc-ip-role-left">
              <div class="cc-ip-role-icon">
                <ion-icon name="mic-outline"></ion-icon>
              </div>
              <div class="cc-ip-role-info">
                <h4 class="cc-ip-role-title">Reporters</h4>
                <p class="cc-ip-role-desc">Field reporting, interviews, breaking news, and live press briefings.</p>
              </div>
            </div>
            <div class="cc-ip-stepper">
              <button type="button" class="cc-ip-stepper-btn" id="btnDecReporters" title="Decrease Reporters" ${counts.reporters === 0 ? 'disabled' : ''}>
                <ion-icon name="remove-outline"></ion-icon>
              </button>
              <input type="number" id="inputReporters" class="cc-ip-stepper-input" value="${counts.reporters}" min="0" max="999" />
              <button type="button" class="cc-ip-stepper-btn" id="btnIncReporters" title="Increase Reporters">
                <ion-icon name="add-outline"></ion-icon>
              </button>
            </div>
          </div>

          <!-- Role 3: Photographers -->
          <div class="cc-ip-role-card" id="cardRolePhotographers">
            <div class="cc-ip-role-left">
              <div class="cc-ip-role-icon">
                <ion-icon name="camera-outline"></ion-icon>
              </div>
              <div class="cc-ip-role-info">
                <h4 class="cc-ip-role-title">Photographers</h4>
                <p class="cc-ip-role-desc">Photojournalism, live council captures, and visual media documentation.</p>
              </div>
            </div>
            <div class="cc-ip-stepper">
              <button type="button" class="cc-ip-stepper-btn" id="btnDecPhotographers" title="Decrease Photographers" ${counts.photographers === 0 ? 'disabled' : ''}>
                <ion-icon name="remove-outline"></ion-icon>
              </button>
              <input type="number" id="inputPhotographers" class="cc-ip-stepper-input" value="${counts.photographers}" min="0" max="999" />
              <button type="button" class="cc-ip-stepper-btn" id="btnIncPhotographers" title="Increase Photographers">
                <ion-icon name="add-outline"></ion-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Filter countries by searchQuery
  const filteredCountries = COUNTRIES_LIST.filter(c => {
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  const org = getRegionalOrg(comm.code);

  // CASE 2: Regional & Special Organizations (EU, ASEAN, AU, NATO, BRICS, SAARC, OECD, etc.)
  // Member States first, then divider, then other countries
  if (org) {
    const memberSet = new Set(org.members);
    const memberCountries = filteredCountries.filter(c => memberSet.has(c.name));
    const otherCountries = filteredCountries.filter(c => !memberSet.has(c.name));

    if (memberCountries.length === 0 && otherCountries.length === 0) {
      return `
        <div class="cc-cp-no-results">
          <ion-icon name="search-outline"></ion-icon>
          <span>No countries found matching "${escapeHtml(query)}"</span>
        </div>
      `;
    }

    const memberAllSelected = memberCountries.length > 0 && memberCountries.every(c => allotted.includes(c.name));
    const otherAllSelected = otherCountries.length > 0 && otherCountries.every(c => allotted.includes(c.name));

    return `
      ${memberCountries.length > 0 ? `
        <div class="cc-cp-grid-group">
          <div class="cc-cp-grid-group-label">
            <span class="cc-cp-grid-group-title">${escapeHtml(org.name)} (${memberCountries.length})</span>
            <button type="button" class="cc-cp-btn-category-select-all" data-category="member">
              ${memberAllSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div class="cc-cp-country-grid-7x7">
            ${renderCountryGridItems(memberCountries, allotted)}
          </div>
        </div>
      ` : ''}

      ${otherCountries.length > 0 ? `
        <div class="cc-cp-grid-group" style="margin-top: ${memberCountries.length > 0 ? '24px' : '0'};">
          <div class="cc-cp-grid-group-label">
            <span class="cc-cp-grid-group-title">Observers (${otherCountries.length})</span>
            <button type="button" class="cc-cp-btn-category-select-all" data-category="other">
              ${otherAllSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div class="cc-cp-country-grid-7x7">
            ${renderCountryGridItems(otherCountries, allotted)}
          </div>
        </div>
      ` : ''}
    `;
  }

  // CASE 3: Standard UN Committees (UNGA, UNHRC, WHO, etc.)
  if (filteredCountries.length === 0) {
    return `
      <div class="cc-cp-no-results">
        <ion-icon name="search-outline"></ion-icon>
        <span>No countries found matching "${escapeHtml(query)}"</span>
      </div>
    `;
  }

  return `
    <div class="cc-cp-country-grid-7x7" id="countryGrid">
      ${renderCountryGridItems(filteredCountries, allotted)}
    </div>
  `;
}

/**
 * Render Indian portfolio cards with clean icons and structured title/minister names
 */
function renderIndianPortfolioCards(portfolios, allotted, commCode) {
  return portfolios.map(name => {
    const isSelected = allotted.includes(name);
    const icon = getIndianPortfolioIcon(name, commCode);

    let contentHtml = `<div class="cc-cp-cell-name">${escapeHtml(name)}</div>`;
    if (name.includes(' — ')) {
      const parts = name.split(' — ');
      const portfolioTitle = parts[0].trim();
      const personName = parts.slice(1).join(' — ').trim();
      contentHtml = `
        <div class="cc-cp-cell-name cc-cp-portfolio-cell-name">
          <span class="cc-cp-portfolio-title" title="${escapeHtml(portfolioTitle)}">${escapeHtml(portfolioTitle)}</span>
          <span class="cc-cp-portfolio-person" title="${escapeHtml(personName)}">${escapeHtml(personName)}</span>
        </div>
      `;
    }

    return `
      <div
        class="cc-cp-country-cell cc-cp-portfolio-cell ${isSelected ? 'is-selected' : ''}"
        data-country-name="${escapeHtml(name)}"
        title="${escapeHtml(name)}"
      >
        <div class="cc-cp-portfolio-icon-badge">
          <ion-icon name="${icon}"></ion-icon>
        </div>
        ${contentHtml}
      </div>
    `;
  }).join('');
}

/**
 * Render vertical committees list for left sidebar
 */
function renderVerticalCommittees() {
  return selectedCommittees.map((comm, idx) => {
    const isActive = idx === activeCommitteeIndex;
    const isCustom = Boolean(comm.isCustom);
    const isWide = isWideCommittee(comm.code);
    const logoUrl = !isCustom && R2_CONFIG ? R2_CONFIG.getCommitteeLogoUrl(comm.code) : (comm.logoUrl || '');

    return `
      <div
        class="cc-cp-sidebar-comm-item ${isActive ? 'is-active' : ''}"
        data-index="${idx}"
        data-comm-code="${escapeHtml(comm.code)}"
        title="${escapeHtml(comm.name || comm.code)}"
      >
        <div class="cc-cp-sidebar-comm-logo ${isWide ? 'is-wide' : ''}">
          ${logoUrl ? `<img src="${logoUrl}" alt="${escapeHtml(comm.code)}" />` : `<ion-icon name="${getCommitteeIcon(comm.category)}"></ion-icon>`}
        </div>
        <span class="cc-cp-sidebar-comm-code">${escapeHtml(comm.code || comm.name)}</span>
      </div>
    `;
  }).join('');
}

/**
 * Render items in 7x7 countries grid with real flags and names
 */
function renderCountryGridItems(countries, allottedCountries) {
  if (countries.length === 0) {
    return `
      <div class="cc-cp-no-results">
        <ion-icon name="search-outline"></ion-icon>
        <span>No countries found matching "${escapeHtml(searchQuery)}"</span>
      </div>
    `;
  }

  return countries.map(c => {
    const isSelected = allottedCountries.includes(c.name);
    const codeLower = String(c.code || '').toLowerCase();
    const flagUrl = `https://flagcdn.com/w160/${codeLower}.png`;
    const flagEmoji = getFlagEmoji(c.code);

    return `
      <div
        class="cc-cp-country-cell ${isSelected ? 'is-selected' : ''}"
        data-country-name="${escapeHtml(c.name)}"
        title="${escapeHtml(c.name)}"
      >
        <div class="cc-cp-flag-wrap">
          <img
            class="cc-cp-flag-img"
            src="${flagUrl}"
            alt="${escapeHtml(c.name)} flag"
            loading="lazy"
            decoding="async"
            onerror="this.style.display='none'; const fb = this.nextElementSibling; if (fb) fb.style.display='flex';"
          />
          <span class="cc-cp-flag-fallback" style="display:none;">${flagEmoji}</span>
        </div>
        <div class="cc-cp-cell-name">${escapeHtml(c.name)}</div>
      </div>
    `;
  }).join('');
}

/**
 * Attach interactions for sidebar, country cells, and search
 */
function attachWorkspaceInteractions() {
  const container = document.getElementById('cpDeckContainer');
  if (!container) return;

  const currentComm = selectedCommittees[activeCommitteeIndex];
  if (!currentComm) return;

  // 1. Sidebar Committee Item Clicks
  container.querySelectorAll('.cc-cp-sidebar-comm-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx) && idx !== activeCommitteeIndex) {
        activeCommitteeIndex = idx;
        searchQuery = '';
        renderCpWorkspace();
        scrollSidebarItemIntoView(idx);
      }
    });
  });

  // 2. Country Cell Clicks (Instant toggle without full re-render)
  attachCountryCellClicks();

  // 3. Country Search Real-time Input
  const searchInput = document.getElementById('countrySearchInput');
  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value;
    updateCountryGridOnly();
  });

  // 4. Search Clear Button
  const btnClearSearch = document.getElementById('btnSearchClear');
  btnClearSearch?.addEventListener('click', () => {
    searchQuery = '';
    renderCpWorkspace();
  });

  // 5. Clear Selection Button
  const btnClearSelection = document.getElementById('btnClearSelection');
  btnClearSelection?.addEventListener('click', () => {
    if (countryMatrixData[currentComm.code]) {
      countryMatrixData[currentComm.code].countries = [];
      renderCpWorkspace();
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
    }
  });

  // 6. IP Role Steppers
  attachIPRoleSteppers();

  // 7. Category Select All / Deselect All
  container.querySelectorAll('.cc-cp-btn-category-select-all').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const catKey = btn.dataset.category;
      if (!countryMatrixData[currentComm.code]) {
        countryMatrixData[currentComm.code] = { countries: [], positions: [] };
      }
      const allot = countryMatrixData[currentComm.code];
      if (!Array.isArray(allot.countries)) allot.countries = [];

      let targetItems = [];
      const q = (searchQuery || '').trim().toLowerCase();

      if (isIndianCommittee(currentComm)) {
        const allPortfolios = getIndianPortfoliosForComm(currentComm);
        const filtered = allPortfolios.filter(name => !q || name.toLowerCase().includes(q));
        const sections = getIndianPortfolioSections(filtered);
        const idx = parseInt(catKey.replace('sec-', ''), 10);
        if (sections[idx]) {
          targetItems = sections[idx].items;
        }
      } else {
        const org = getRegionalOrg(currentComm.code);
        if (org) {
          const memberSet = new Set(org.members);
          const filteredCountries = COUNTRIES_LIST.filter(c => {
            if (!q) return true;
            return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
          });
          if (catKey === 'member') {
            targetItems = filteredCountries.filter(c => memberSet.has(c.name)).map(c => c.name);
          } else if (catKey === 'other') {
            targetItems = filteredCountries.filter(c => !memberSet.has(c.name)).map(c => c.name);
          }
        }
      }

      if (targetItems.length === 0) return;

      const isAllSelected = targetItems.every(name => allot.countries.includes(name));

      if (isAllSelected) {
        const removeSet = new Set(targetItems);
        allot.countries = allot.countries.filter(name => !removeSet.has(name));
      } else {
        targetItems.forEach(name => {
          if (!allot.countries.includes(name)) {
            allot.countries.push(name);
          }
        });
      }

      const gridScroll = document.getElementById('cpGridContainer')?.scrollTop;
      renderCpWorkspace();
      if (gridScroll != null) {
        const newGrid = document.getElementById('cpGridContainer');
        if (newGrid) newGrid.scrollTop = gridScroll;
      }
      window.dispatchEvent(new CustomEvent('wizard:dirty'));
    });
  });
}

/**
 * Handle clicks on country cells with zero latency
 */
function attachCountryCellClicks() {
  const currentComm = selectedCommittees[activeCommitteeIndex];
  if (!currentComm) return;

  const container = document.getElementById('cpGridContainer') || document.getElementById('cpDeckContainer');
  if (!container) return;

  container.querySelectorAll('.cc-cp-country-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const countryName = cell.dataset.countryName;
      toggleCountryCell(cell, currentComm.code, countryName);
    });
  });
}

/**
 * Attach plus/minus stepper listeners for the 3 IP roles
 */
function attachIPRoleSteppers() {
  const currentComm = selectedCommittees[activeCommitteeIndex];
  if (!currentComm || !isIPCommittee(currentComm)) return;

  const commCode = currentComm.code;

  const inputJ = document.getElementById('inputJournalists');
  const inputR = document.getElementById('inputReporters');
  const inputP = document.getElementById('inputPhotographers');

  const btnDecJ = document.getElementById('btnDecJournalists');
  const btnIncJ = document.getElementById('btnIncJournalists');
  const btnDecR = document.getElementById('btnDecReporters');
  const btnIncR = document.getElementById('btnIncReporters');
  const btnDecP = document.getElementById('btnDecPhotographers');
  const btnIncP = document.getElementById('btnIncPhotographers');

  const updateUI = (counts) => {
    if (inputJ) inputJ.value = counts.journalists;
    if (inputR) inputR.value = counts.reporters;
    if (inputP) inputP.value = counts.photographers;

    if (btnDecJ) btnDecJ.disabled = counts.journalists <= 0;
    if (btnDecR) btnDecR.disabled = counts.reporters <= 0;
    if (btnDecP) btnDecP.disabled = counts.photographers <= 0;

    updateCounters(commCode);
    window.dispatchEvent(new CustomEvent('wizard:dirty'));
  };

  const changeCount = (role, delta) => {
    const counts = getIPRoleCounts(commCode);
    counts[role] = Math.max(0, (counts[role] || 0) + delta);
    setIPRoleCounts(commCode, counts);
    updateUI(counts);
  };

  btnDecJ?.addEventListener('click', () => changeCount('journalists', -1));
  btnIncJ?.addEventListener('click', () => changeCount('journalists', 1));
  btnDecR?.addEventListener('click', () => changeCount('reporters', -1));
  btnIncR?.addEventListener('click', () => changeCount('reporters', 1));
  btnDecP?.addEventListener('click', () => changeCount('photographers', -1));
  btnIncP?.addEventListener('click', () => changeCount('photographers', 1));

  const handleDirectInput = (role, inputEl) => {
    let val = parseInt(inputEl?.value || '0', 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 999) val = 999;
    const counts = getIPRoleCounts(commCode);
    counts[role] = val;
    setIPRoleCounts(commCode, counts);
    updateUI(counts);
  };

  inputJ?.addEventListener('change', () => handleDirectInput('journalists', inputJ));
  inputR?.addEventListener('change', () => handleDirectInput('reporters', inputR));
  inputP?.addEventListener('change', () => handleDirectInput('photographers', inputP));
}

/**
 * Fast toggle country selection without full page re-render
 */
function toggleCountryCell(cell, commCode, countryName) {
  if (!countryMatrixData[commCode]) {
    countryMatrixData[commCode] = { countries: [], positions: [] };
  }
  const allot = countryMatrixData[commCode];
  if (!Array.isArray(allot.countries)) allot.countries = [];

  const idx = allot.countries.indexOf(countryName);

  if (idx >= 0) {
    allot.countries.splice(idx, 1);
    cell.classList.remove('is-selected');
  } else {
    allot.countries.push(countryName);
    cell.classList.add('is-selected');
  }

  // Update summary count pill
  updateCounters(commCode);

  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Update counters and clear-all state in real-time
 */
function updateCounters(commCode) {
  const currentComm = selectedCommittees[activeCommitteeIndex];
  const isIndian = isIndianCommittee(currentComm);
  const isIP = isIPCommittee(currentComm);
  const allot = countryMatrixData[commCode] || { countries: [] };
  const countryCount = Array.isArray(allot.countries) ? allot.countries.length : 0;

  const countEl = document.getElementById('commSelectedCountText');
  if (countEl) {
    if (isIP) {
      countEl.textContent = `${countryCount} ${countryCount === 1 ? 'Position Allotted' : 'Positions Allotted'}`;
    } else if (isIndian) {
      countEl.textContent = `${countryCount} ${countryCount === 1 ? 'Portfolio Selected' : 'Portfolios Selected'}`;
    } else {
      countEl.textContent = `${countryCount} ${countryCount === 1 ? 'Country Selected' : 'Countries Selected'}`;
    }
  }

  const clearBtn = document.getElementById('btnClearSelection');
  if (clearBtn) {
    clearBtn.disabled = countryCount === 0;
  }
}

/**
 * Apply presets to active committee
 */
function applyPreset(commCode, preset) {
  if (!countryMatrixData[commCode]) {
    countryMatrixData[commCode] = { countries: [], positions: [] };
  }
  const allot = countryMatrixData[commCode];

  if (preset === 'all-un') {
    allot.countries = COUNTRIES_LIST.map(c => c.name);
  } else if (preset === 'g20') {
    allot.countries = [...G20_NAMES];
  } else if (preset === 'p5') {
    allot.countries = [...P5_NAMES];
  } else if (preset === 'top35') {
    allot.countries = COUNTRIES_LIST.slice(0, 35).map(c => c.name);
  } else if (preset === 'clear') {
    allot.countries = [];
  }

  renderCpWorkspace();
  window.dispatchEvent(new CustomEvent('wizard:dirty'));
}

/**
 * Fast filter update for countries grid during search typing
 */
function updateCountryGridOnly() {
  const container = document.getElementById('cpGridContainer');
  if (!container) return;

  const currentComm = selectedCommittees[activeCommitteeIndex];
  if (!currentComm) return;

  const allot = countryMatrixData[currentComm.code] || { countries: [] };
  const allottedCountries = Array.isArray(allot.countries) ? allot.countries : [];

  container.innerHTML = renderMainGrid(currentComm, searchQuery, allottedCountries);
  attachCountryCellClicks();
  attachIPRoleSteppers();
  syncCountryScrollHeight();
}

/**
 * Scroll active sidebar item into view
 */
function scrollSidebarItemIntoView(idx) {
  setTimeout(() => {
    const list = document.getElementById('cpSidebarList');
    const item = list?.querySelector(`.cc-cp-sidebar-comm-item[data-index="${idx}"]`);
    if (item && list) {
      item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 40);
}

/**
 * Synchronize country scroll height dynamically with the committees row
 * Ensures committees row is never reduced, and country scroll extends till the bottom of the committees row
 */
export function syncCountryScrollHeight() {
  const sidebar = document.querySelector('.cc-cp-committees-sidebar');
  const gridSection = document.getElementById('cpGridContainer');
  const header = document.querySelector('.cc-cp-main-header');
  const toolbar = document.querySelector('.cc-cp-toolbar-strip');

  if (!sidebar || !gridSection) return;

  // On smaller screens where sidebar wraps on top
  if (window.innerWidth <= 960) {
    gridSection.style.height = '';
    gridSection.style.maxHeight = '65vh';
    return;
  }

  // Measure natural height of committees sidebar (full height of 2x2 committee items with no scroll)
  const sidebarHeight = sidebar.offsetHeight || 0;

  // Measure header + search toolbar + top/bottom padding
  const headerHeight = header ? header.offsetHeight : 60;
  const toolbarHeight = toolbar ? toolbar.offsetHeight : 52;
  const paddingOffset = 48; // 24px top padding + inner spacing

  // The scroll height needed so that its bottom aligns with the bottom of the committees row
  const heightMatchingCommittees = Math.max(0, sidebarHeight - headerHeight - toolbarHeight - paddingOffset);

  // Generous minimum scroll height so countries browsing always has comfortable room (at least 560px or viewport based)
  const minViewportScroll = Math.max(560, window.innerHeight - 300);

  // Dynamic height: stretches to match committees height till bottom, or generous viewport height
  const dynamicHeight = Math.max(heightMatchingCommittees, minViewportScroll);

  gridSection.style.height = `${dynamicHeight}px`;
  gridSection.style.maxHeight = `${dynamicHeight}px`;
}
