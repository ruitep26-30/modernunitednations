/**
 * Modern United Nations - Committees Database for Create Conference
 * Simplified from committees-catalog.js for the wizard
 */

export const COMMITTEES_DATABASE = [
  // UN General Assembly Committees
  { code: 'UNGA', name: 'United Nations General Assembly', category: 'unga' },
  { code: 'UNSC', name: 'United Nations Security Council', category: 'un-organs' },
  { code: 'DISEC', name: 'Disarmament and International Security Committee (First Committee)', category: 'unga' },
  { code: 'ECOFIN', name: 'Economic and Financial Committee (Second Committee)', category: 'unga' },
  { code: 'SOCHUM', name: 'Social, Humanitarian and Cultural Committee (Third Committee)', category: 'unga' },
  { code: 'SPECPOL', name: 'Special Political and Decolonization Committee (Fourth Committee)', category: 'unga' },
  { code: 'ABC', name: 'Administrative and Budgetary Committee (Fifth Committee)', category: 'unga' },
  { code: 'LEGAL', name: 'Legal Committee (Sixth Committee)', category: 'unga' },

  // UN Organs
  { code: 'UNHRC', name: 'Human Rights Council', category: 'un-organs' },
  { code: 'UNCSW', name: 'Commission on the Status of Women', category: 'un-organs' },
  { code: 'ECOSOC', name: 'Economic and Social Council', category: 'un-organs' },
  { code: 'CCPCJ', name: 'Commission on Crime Prevention and Criminal Justice', category: 'un-organs' },
  { code: 'UNWOMEN', name: 'UN Women', category: 'un-organs' },

  // Specialized Agencies
  { code: 'UNEP', name: 'United Nations Environment Programme', category: 'agencies' },
  { code: 'UNDP', name: 'United Nations Development Programme', category: 'agencies' },
  { code: 'UNICEF', name: "United Nations Children's Fund", category: 'agencies' },
  { code: 'UNODC', name: 'United Nations Office on Drugs and Crime', category: 'agencies' },
  { code: 'UNFPA', name: 'United Nations Population Fund', category: 'agencies' },
  { code: 'UN-HABITAT', name: 'United Nations Human Settlements Programme', category: 'agencies' },
  { code: 'ILO', name: 'International Labour Organization', category: 'agencies' },
  { code: 'WHO', name: 'World Health Organization', category: 'agencies' },
  { code: 'UNESCO', name: 'United Nations Educational, Scientific and Cultural Organization', category: 'agencies' },
  { code: 'FAO', name: 'Food and Agriculture Organization', category: 'agencies' },
  { code: 'ICAO', name: 'International Civil Aviation Organization', category: 'agencies' },
  { code: 'IMO', name: 'International Maritime Organization', category: 'agencies' },
  { code: 'WMO', name: 'World Meteorological Organization', category: 'agencies' },
  { code: 'ITU', name: 'International Telecommunication Union', category: 'agencies' },
  { code: 'UNIDO', name: 'United Nations Industrial Development Organization', category: 'agencies' },
  { code: 'UNHCR', name: 'United Nations High Commissioner for Refugees', category: 'agencies' },
  { code: 'IAEA', name: 'International Atomic Energy Agency', category: 'agencies' },
  { code: 'ICJ', name: 'International Court of Justice', category: 'agencies' },
  { code: 'ICC', name: 'International Criminal Court', category: 'agencies' },
  { code: 'IOC', name: 'International Olympic Committee', category: 'agencies' },
  { code: 'FIFA', name: 'FIFA Council', category: 'agencies' },

  // Regional Bodies
  { code: 'NATO', name: 'North Atlantic Treaty Organization', category: 'regional' },
  { code: 'ASEAN', name: 'Association of Southeast Asian Nations', category: 'regional' },
  { code: 'AU', name: 'African Union', category: 'regional' },
  { code: 'EU', name: 'European Union', category: 'regional' },
  { code: 'BRICS', name: 'BRICS', category: 'regional' },
  { code: 'SAARC', name: 'South Asian Association for Regional Cooperation', category: 'regional' },
  { code: 'OECD', name: 'Organisation for Economic Co-operation and Development', category: 'regional' },
  { code: 'WEF', name: 'World Economic Forum', category: 'regional' },
  { code: 'AC', name: 'Arctic Council', category: 'regional' },

  // Bretton Woods / Financial
  { code: 'IMF', name: 'International Monetary Fund', category: 'agencies' },
  { code: 'WB', name: 'World Bank', category: 'agencies' },
  { code: 'WTO', name: 'World Trade Organization', category: 'agencies' },
  { code: 'UNCTAD', name: 'United Nations Conference on Trade and Development', category: 'un-organs' },

  // Crisis Committees
  { code: 'JCC', name: 'Joint Crisis Committee', category: 'crisis' },
  { code: 'IP', name: 'International Press', category: 'crisis' },

  // National Bodies
  { code: 'INDCN', name: 'Indian Cabinet', category: 'national' }
];