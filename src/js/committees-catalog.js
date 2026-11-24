/**
 * Modern United Nations - Canonical Committees & Simulation Organs Catalog
 * Structured metadata for accredited UN organs, specialized agencies,
 * regional summits, national bodies, and crisis committees, plus live matching
 * utilities against Cloud Firestore conferences.
 */

export const COMMITTEE_METADATA = {
  UNGA: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  UNSC: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  DISEC: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  ECOFIN: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  SOCHUM: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  SPECPOL: { established: '1993', headquarters: 'New York, United States', operationalStatus: 'Active' },
  ABC: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  LEGAL: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  UNHRC: { established: '2006', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  UNCSW: { established: '1946', headquarters: 'New York, United States', operationalStatus: 'Active' },
  UNEP: { established: '1972', headquarters: 'Nairobi, Kenya', operationalStatus: 'Active' },
  UNDP: { established: '1965', headquarters: 'New York, United States', operationalStatus: 'Active' },
  UNICEF: { established: '1946', headquarters: 'New York, United States', operationalStatus: 'Active' },
  UNODC: { established: '1997', headquarters: 'Vienna, Austria', operationalStatus: 'Active' },
  UNFPA: { established: '1969', headquarters: 'New York, United States', operationalStatus: 'Active' },
  'UN-HABITAT': { established: '1978', headquarters: 'Nairobi, Kenya', operationalStatus: 'Active' },
  JCC: { established: '1945', headquarters: 'Multi-Theater Command', operationalStatus: 'Active' },
  NATO: { established: '1949', headquarters: 'Brussels, Belgium', operationalStatus: 'Active' },
  ASEAN: { established: '1967', headquarters: 'Jakarta, Indonesia', operationalStatus: 'Active' },
  AU: { established: '2002', headquarters: 'Addis Ababa, Ethiopia', operationalStatus: 'Active' },
  EU: { established: '1993', headquarters: 'Brussels, Belgium', operationalStatus: 'Active' },
  BRICS: { established: '2009', headquarters: 'Rotating Secretariat', operationalStatus: 'Active' },
  SAARC: { established: '1985', headquarters: 'Kathmandu, Nepal', operationalStatus: 'Active' },
  IMF: { established: '1944', headquarters: 'Washington, D.C., United States', operationalStatus: 'Active' },
  WB: { established: '1944', headquarters: 'Washington, D.C., United States', operationalStatus: 'Active' },
  WTO: { established: '1995', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  UNCTAD: { established: '1964', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  ECOSOC: { established: '1945', headquarters: 'New York, United States', operationalStatus: 'Active' },
  OECD: { established: '1961', headquarters: 'Paris, France', operationalStatus: 'Active' },
  WEF: { established: '1971', headquarters: 'Cologny, Geneva, Switzerland', operationalStatus: 'Active' },
  ILO: { established: '1919', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  WHO: { established: '1948', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  UNESCO: { established: '1945', headquarters: 'Paris, France', operationalStatus: 'Active' },
  FAO: { established: '1945', headquarters: 'Rome, Italy', operationalStatus: 'Active' },
  ICAO: { established: '1947', headquarters: 'Montreal, Canada', operationalStatus: 'Active' },
  IMO: { established: '1948', headquarters: 'London, United Kingdom', operationalStatus: 'Active' },
  WMO: { established: '1950', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  ITU: { established: '1865', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  UNIDO: { established: '1966', headquarters: 'Vienna, Austria', operationalStatus: 'Active' },
  UNHCR: { established: '1950', headquarters: 'Geneva, Switzerland', operationalStatus: 'Active' },
  IAEA: { established: '1957', headquarters: 'Vienna, Austria', operationalStatus: 'Active' },
  UNWOMEN: { established: '2010', headquarters: 'New York, United States', operationalStatus: 'Active' },
  INDCN: { established: '1947', headquarters: 'New Delhi, India', operationalStatus: 'Active' },
  ICJ: { established: '1945', headquarters: 'The Hague, Netherlands', operationalStatus: 'Active' },
  ICC: { established: '2002', headquarters: 'The Hague, Netherlands', operationalStatus: 'Active' },
  IP: { established: '1945', headquarters: 'Global Press Gallery', operationalStatus: 'Active' },
  CCPCJ: { established: '1992', headquarters: 'Vienna, Austria', operationalStatus: 'Active' },
  AC: { established: '1996', headquarters: 'Tromsø, Norway', operationalStatus: 'Active' },
  IOC: { established: '1894', headquarters: 'Lausanne, Switzerland', operationalStatus: 'Active' },
  FIFA: { established: '1904', headquarters: 'Zurich, Switzerland', operationalStatus: 'Active' }
};

function makeCommittee(
  id,
  code,
  name,
  category,
  mandate,
  procedure,
  keyFocus,
  exactCodes = [],
  phraseAliases = [],
  badgeNote = ''
) {
  const meta = COMMITTEE_METADATA[code] || { established: '1945', headquarters: 'International', operationalStatus: 'Active' };
  return {
    id,
    code,
    name,
    category: 'committee',
    categoryLabel: 'Committee',
    color: 'blue',
    icon: 'shield-outline',
    mandate,
    shortIntro: mandate,
    established: meta.established,
    headquarters: meta.headquarters,
    operationalStatus: meta.operationalStatus,
    procedure,
    keyFocus,
    badgeNote,
    exactCodes: [
      ...new Set(
        [code, ...code.split(/[\/-]/).map(s => s.trim()), ...exactCodes]
          .map(s => s.toLowerCase())
          .filter(Boolean)
      )
    ],
    phraseAliases: [
      ...new Set(
        [name.replace(/\s*\([^)]*\)/g, '').trim(), ...phraseAliases]
          .map(s => s.toLowerCase())
          .filter(Boolean)
      )
    ]
  };
}

export const COMMITTEES_CATALOG = [
  makeCommittee(
    'unga',
    'UNGA',
    'United Nations General Assembly',
    'unga',
    'Chief deliberative, policymaking, and representative organ of the United Nations comprising all 193 Member States, debating international security, human rights, and sustainable development directives.',
    'UNGA Plenary Rules of Procedure',
    ['Multilateral Cooperation', 'Sovereign Equality & Global Directives', 'Sustainable Development Goals'],
    ['ga', 'general assembly', 'unga', 'un-ga'],
    ['general assembly', 'un general assembly', 'united nations general assembly', 'united nation general assembly']
  ),
  makeCommittee(
    'unsc',
    'UNSC',
    'United Nations Security Council',
    'un-organs',
    'Primary UN organ charged under Chapter V–VII of the Charter with maintaining international peace and security, authorizing peacekeeping missions, sanctions, and binding resolutions.',
    'UNSC Specialized Procedure (P5 Veto Active)',
    ['Peacekeeping Mandate Modernisation', 'Cross-Border Sanctions & Ceasefire Enforcement', 'Climate Security & Conflict Mediation'],
    ['sc', 'security council'],
    ['united nations security council', 'security council']
  ),
  makeCommittee(
    'disec',
    'DISEC',
    'Disarmament and International Security Committee (First Committee)',
    'unga',
    'Deliberates on disarmament, non-proliferation of weapons of mass destruction, regulation of global armaments, and regional threats to peace.',
    'UNGA Main Committee Rules of Procedure',
    ['Nuclear Non-Proliferation', 'Lethal Autonomous Weapons Systems (LAWS)', 'Space Militarization Moratoriums'],
    ['1st committee', 'unga 1st', 'unga first'],
    ['disarmament and international security committee']
  ),
  makeCommittee(
    'ecofin',
    'ECOFIN',
    'Economic and Financial Committee (Second Committee)',
    'unga',
    'Deals with international macroeconomic policy, sovereign debt sustainability, financing for development, and poverty eradication.',
    'UNGA Main Committee Rules of Procedure',
    ['Global Sovereign Debt Architecture Reform', 'Illicit Financial Flows & Tax Havens', 'South-South Economic Cooperation'],
    ['2nd committee', 'unga 2nd', 'unga second'],
    ['economic and financial committee']
  ),
  makeCommittee(
    'sochum',
    'SOCHUM',
    'Social, Humanitarian and Cultural Committee (Third Committee)',
    'unga',
    'General Assembly main committee addressing fundamental human rights, refugee protection, indigenous rights, youth empowerment, and social development.',
    'UNGA Main Committee Rules of Procedure',
    ['Protection of Displaced Populations', 'Freedom of Expression & Digital Censorship', 'Indigenous Heritage & Land Rights'],
    ['3rd committee', 'unga 3rd', 'unga third'],
    ['social, humanitarian and cultural committee']
  ),
  makeCommittee(
    'specpol',
    'SPECPOL',
    'Special Political and Decolonization Committee (Fourth Committee)',
    'unga',
    'General Assembly committee deliberating non-self-governing territories, peacekeeping mission reviews, atomic radiation effects, and peaceful outer space cooperation.',
    'UNGA Main Committee Rules of Procedure',
    ['Self-Determination in Non-Self-Governing Territories', 'UN Peacekeeping Mandates Review', 'Climate Displacement & Small Island Sovereignty'],
    ['4th committee', 'unga 4th', 'unga fourth'],
    ['special political and decolonization committee']
  ),
  makeCommittee(
    'abc',
    'ABC',
    'Administrative and Budgetary Committee (Fifth Committee)',
    'unga',
    'Oversees the United Nations regular budget, peacekeeping financing assessments, internal oversight, and administrative staffing reforms.',
    'UNGA Main Committee Rules of Procedure',
    ['UN Regular & Peacekeeping Budgets', 'Scale of Assessments', 'UN Secretariat Personnel Reform'],
    ['5th committee', 'unga 5th', 'unga fifth', 'fifth committee'],
    ['administrative and budgetary committee', 'fifth committee']
  ),
  makeCommittee(
    'legal',
    'LEGAL',
    'Legal Committee (Sixth Committee)',
    'unga',
    'Primary UN General Assembly forum for the progressive development and codification of public international law, treaties, diplomatic immunity, and counterterrorism conventions.',
    'UNGA Legal Committee & ILC Review RoP',
    ['Crimes Against Humanity Convention', 'Maritime Law & Sea-Level Rise Statehood', 'Universal Jurisdiction & Immunity'],
    ['ga6', '6th committee', 'unga 6th', 'unga sixth', 'legal committee', 'sixth committee', 'legalcommittee', 'legal-committee'],
    ['legal committee', 'sixth committee', 'legalcommittee']
  ),
  makeCommittee(
    'unhrc',
    'UNHRC',
    'Human Rights Council',
    'un-organs',
    'Intergovernmental UN body responsible for strengthening human rights promotion globally, conducting Universal Periodic Reviews, and mandating Special Rapporteurs.',
    'UNHRC Geneva Session Procedure',
    ['Digital Privacy & Mass Surveillance', 'Refugee & Statelessness Human Rights', 'Artificial Intelligence Bias & Civil Liberties'],
    ['hrc'],
    ['human rights council']
  ),
  makeCommittee(
    'uncsw',
    'UNCSW',
    'Commission on the Status of Women',
    'un-organs',
    'Premier global intergovernmental body dedicated exclusively to gender equality, women’s economic empowerment, and protection against gender-based violence.',
    'ECOSOC Functional Commission RoP',
    ['Women in STEM & Digital Economy', 'Ending Conflict-Related Sexual Violence', 'Equal Pay & Care Infrastructure'],
    ['csw'],
    ['commission on the status of women']
  ),
  makeCommittee(
    'unep',
    'UNEP',
    'United Nations Environment Programme',
    'agencies',
    'Leading global environmental authority that sets the global environmental agenda, promotes the coherent implementation of the environmental dimension of sustainable development.',
    'UN Environment Assembly (UNEA) RoP',
    ['Global Plastics Treaty Negotiations', 'Post-2020 Biodiversity Framework', 'Carbon Offsets Integrity'],
    [],
    ['united nations environment programme', 'un environment programme']
  ),
  makeCommittee(
    'undp',
    'UNDP',
    'United Nations Development Programme',
    'agencies',
    'UN lead agency on international development, working in 170 countries to eradicate poverty, reduce inequalities, and build sustainable resilience against crises.',
    'Executive Board Consensus RoP',
    ['Multidimensional Poverty Alleviation', 'Just Energy Transition Partnerships', 'Local Climate Adaptation Financing'],
    [],
    ['united nations development programme', 'un development programme']
  ),
  makeCommittee(
    'unicef',
    'UNICEF',
    "United Nations Children's Fund",
    'agencies',
    'Specialized UN fund defending child rights, delivering emergency humanitarian nutrition, child protection in conflict zones, and pediatric immunizations worldwide.',
    'Executive Board Tripartite Consensus RoP',
    ['Child Protection in Urban Warfare', 'Severe Acute Malnutrition Interventions', 'Digital Child Exploitation Countermeasures'],
    [],
    ["united nations children's fund", "united nations childrens fund"]
  ),
  makeCommittee(
    'unodc',
    'UNODC',
    'United Nations Office on Drugs and Crime',
    'agencies',
    'Global leader in the struggle against illicit drugs, organized crime, human trafficking, wildlife smuggling, money laundering, and international terrorism.',
    'Commission on Narcotic Drugs & CCPCJ RoP',
    ['Synthetic Opioid & Fentanyl Supply Interdiction', 'Dark Web Illicit Markets', 'Maritime Smuggling Corridors'],
    [],
    ['united nations office on drugs and crime']
  ),
  makeCommittee(
    'unfpa',
    'UNFPA',
    'United Nations Population Fund',
    'agencies',
    'UN sexual and reproductive health agency ensuring every pregnancy is wanted, every childbirth is safe, and every young person’s potential is fulfilled.',
    'Executive Board Consensus RoP',
    ['Maternal Mortality Eradication', 'Gender-Based Violence Humanitarian Response', 'Youth Reproductive Rights & Demographic Shifts'],
    [],
    ['united nations population fund']
  ),
  makeCommittee(
    'un-habitat',
    'UN-HABITAT',
    'United Nations Human Settlements Programme',
    'agencies',
    'Promotes socially and environmentally sustainable human settlements development, adequate housing for all, and climate-resilient urban planning.',
    'UN-Habitat Assembly RoP',
    ['Informal Settlements & Slum Upgrading', 'Climate-Resilient Urban Infrastructure', 'Affordable Housing & Smart Cities'],
    ['un habitat', 'habitat'],
    ['united nations human settlements programme', 'un habitat']
  ),
  makeCommittee(
    'jcc',
    'JCC',
    'Joint Crisis Committee',
    'crisis',
    'High-velocity dual or multi-room simulation simulating simultaneous competing factions, backroom directives, intelligence operations, and live military skirmishes.',
    'Continuous Crisis Directive & RoP',
    ['Backroom Covert Directives', 'Escalation Dynamics & Fog of War', 'Factional Geopolitical Negotiation'],
    ['joint crisis'],
    ['joint crisis committee']
  ),
  makeCommittee(
    'nato',
    'NATO',
    'North Atlantic Treaty Organization',
    'regional',
    'Transatlantic military and political alliance committed to mutual collective defense under Article 5 of the Washington Treaty, safeguarding allied territorial integrity, modernizing deterrence, and addressing emerging security threats.',
    'North Atlantic Council (NAC) Consensus RoP',
    ['Article 5 Collective Defense Readiness', 'Integrated Air & Missile Defense', 'Critical Undersea Infrastructure Protection'],
    [],
    ['north atlantic treaty organization']
  ),
  makeCommittee(
    'asean',
    'ASEAN',
    'Association of Southeast Asian Nations',
    'regional',
    'Ten-member regional intergovernmental union promoting Southeast Asian geopolitical stability, consensus diplomacy, trade liberalization, and maritime security.',
    'ASEAN Way Consensus Procedure',
    ['South China Sea Code of Conduct', 'Regional Trade & Digital Economy', 'Cross-Border Disaster Resilience'],
    [],
    ['association of southeast asian nations', 'association of southeastern asian nations']
  ),
  makeCommittee(
    'au',
    'AU',
    'African Union',
    'regional',
    'Continental union of African member states advancing the African Continental Free Trade Area, peace and security architecture, and Agenda 2063.',
    'AU Assembly & Peace and Security Council RoP',
    ['AfCFTA Implementation', 'Peace Support Operations', 'Climate Finance & Sovereign Debt'],
    [],
    ['african union']
  ),
  makeCommittee(
    'eu',
    'EU',
    'European Union',
    'regional',
    'Supranational political and economic union of 27 European member states coordinating single market regulation, monetary integration, climate directives, and defense cohesion.',
    'European Council Qualified Majority Voting (QMV)',
    ['European Green Deal & Carbon Border Adjustments', 'Strategic Autonomy & Defense Industrial Base', 'Digital Markets & AI Act Enforcement'],
    [],
    ['european union']
  ),
  makeCommittee(
    'brics',
    'BRICS',
    'BRICS',
    'regional',
    'Influential economic and geopolitical bloc of major emerging economies championing south-south multilateral cooperation, alternative payment mechanisms, and New Development Bank infrastructure.',
    'Summit Consensus & Intergovernmental RoP',
    ['Alternative Currency Settlements & De-Dollarization', 'New Development Bank Project Financing', 'Multipolar Governance Reform'],
    [],
    ['brics', 'brics summit']
  ),

  makeCommittee(
    'saarc',
    'SAARC',
    'South Asian Association for Regional Cooperation',
    'regional',
    'Regional intergovernmental organization and geopolitical union of states in South Asia promoting economic growth, cross-border trade integration, and disaster relief cooperation.',
    'SAARC Charter Consensus RoP',
    ['SAFTA Trade Liberalization', 'Cross-Border Water Sharing & Flood Warning', 'Regional Energy Grids'],
    [],
    ['south asian association for regional cooperation']
  ),
  makeCommittee(
    'imf',
    'IMF',
    'International Monetary Fund',
    'agencies',
    'Bretton Woods monetary institution safeguarding exchange stability, emergency balance-of-payments lending, SDR allocations, and sovereign macro-fiscal surveillance.',
    'Executive Board Quota-Weighted Voting RoP',
    ['SDR Quota Realignment Reforms', 'Emerging Market Debt Distress Conditionality', 'Central Bank Digital Currencies (CBDCs)'],
    [],
    ['international monetary fund']
  ),
  makeCommittee(
    'wb',
    'WB',
    'World Bank',
    'agencies',
    'Multilateral development finance institution providing low-interest loans, credits, and grants to low- and middle-income countries for infrastructure, poverty reduction, and human capital.',
    'Board of Executive Directors Weighted Voting RoP',
    ['IDA Replenishment & Concessional Lending', 'Global Pandemic Resilience Funds', 'Clean Energy Transition Financing'],
    ['world bank', 'ibrd', 'ida'],
    ['world bank', 'world bank group']
  ),
  makeCommittee(
    'wto',
    'WTO',
    'World Trade Organization',
    'agencies',
    'Global international organization dealing with the rules of trade between nations, multilateral tariff reductions, trade dispute arbitration, and subsidy transparency.',
    'General Council Consensus & Dispute Body RoP',
    ['Appellate Body Dispute Settlement Reform', 'E-Commerce Customs Duty Moratorium', 'Green Industrial Subsidies & Carbon Tariffs'],
    [],
    ['world trade organization']
  ),
  makeCommittee(
    'unctad',
    'UNCTAD',
    'United Nations Conference on Trade and Development',
    'un-organs',
    'Permanent intergovernmental body dealing with trade, investment, and development issues to maximize the commercial opportunities of developing nations.',
    'Trade and Development Board RoP',
    ['Critical Minerals Value-Addition in Developing States', 'Global Supply Chain Shocks & Freight Costs', 'Sovereign Debt Crisis Resolution'],
    [],
    ['united nations conference on trade and development']
  ),
  makeCommittee(
    'ecosoc',
    'ECOSOC',
    'Economic and Social Council',
    'un-organs',
    'Principal UN organ coordinating the economic, social, environmental, and developmental work of UN specialized agencies, regional commissions, and functional bodies.',
    'ECOSOC Parliamentary Rules of Procedure',
    ['SDG 2030 Financing Deficit', 'Debt Restructuring & Vulnerability Indexes', 'Multilateral Humanitarian Assistance Coordination'],
    [],
    ['economic and social council']
  ),
  makeCommittee(
    'oecd',
    'OECD',
    'Organisation for Economic Co-operation and Development',
    'regional',
    'Intergovernmental economic organization of high-income democracies shaping global policy benchmarks on tax transparency, corporate governance, and sustainable economic growth.',
    'OECD Council Consensus RoP',
    ['Pillar Two Global Minimum Corporate Tax', 'AI Principles & Risk Governance', 'Clean Energy Transition Subsidies'],
    [],
    ['organisation for economic co-operation and development', 'organization for economic cooperation and development']
  ),
  makeCommittee(
    'wef',
    'WEF',
    'World Economic Forum',
    'regional',
    'International non-governmental organization and global public-private summit bringing together business, political, and academic leaders to shape global, regional, and industry agendas.',
    'Multi-Stakeholder Plenary & Working Group RoP',
    ['Public-Private Capital Mobilization', 'Generative AI & Future of Jobs', 'Energy Transition & Industrial Decarbonization'],
    ['davos'],
    ['world economic forum']
  ),
  makeCommittee(
    'ilo',
    'ILO',
    'International Labour Organization',
    'agencies',
    'Unique tripartite UN agency bringing together governments, employers, and workers to set labour standards, develop policies, and devise programmes promoting decent work.',
    'Tripartite Government-Employer-Worker Voting RoP',
    ['Gig Economy & Algorithmic Platform Workers', 'Eliminating Forced Labor in Supply Chains', 'Just Transition for Fossil Fuel Workers'],
    [],
    ['international labour organization', 'international labor organization']
  ),
  makeCommittee(
    'who',
    'WHO',
    'World Health Organization',
    'agencies',
    'Directing and coordinating authority on international health within the UN system, leading global responses to health emergencies, disease eradication, and Universal Health Coverage.',
    'World Health Assembly (WHA) RoP',
    ['Pandemic Agreement & Pathogen Access Benefit Sharing', 'Antimicrobial Resistance (AMR) Treaties', 'Universal Primary Healthcare In Low-Income Nations'],
    [],
    ['world health organization']
  ),
  makeCommittee(
    'unesco',
    'UNESCO',
    'United Nations Educational, Scientific and Cultural Organization',
    'agencies',
    'Promotes world peace and security through international cooperation in education, sciences, culture, communication, and World Heritage protection.',
    'General Conference & Executive Board RoP',
    ['Ethics of Generative AI & Neurotechnology', 'Underwater & Conflict Heritage In Danger', 'Global Digital Learning Inclusivity'],
    [],
    ['united nations educational, scientific and cultural organization']
  ),
  makeCommittee(
    'fao',
    'FAO',
    'Food and Agriculture Organization',
    'agencies',
    'UN specialized agency leading international efforts to defeat hunger, eliminate food insecurity, improve agricultural nutrition, and build sustainable agro-ecological food systems.',
    'FAO Conference Majority & Consensus RoP',
    ['Agri-Food Supply Chain Resilience in Conflicts', 'Soil Degradation & Water Scarcity Strategies', 'Smallholder Farmer Climate Subsidies'],
    [],
    ['food and agriculture organization']
  ),
  makeCommittee(
    'icao',
    'ICAO',
    'International Civil Aviation Organization',
    'agencies',
    'UN specialized agency establishing international air navigation standards, airspace security protocols, safety audits, and carbon offsetting regulations for global civil aviation.',
    'ICAO Assembly Consensus & Council RoP',
    ['Sustainable Aviation Fuel Mandates', 'Civilian Flight Safety Over Conflict Airspace', 'Autonomous Unmanned Traffic Standards'],
    [],
    ['international civil aviation organization', 'international civil aviation organisation']
  ),
  makeCommittee(
    'imo',
    'IMO',
    'International Maritime Organization',
    'agencies',
    'UN agency setting global safety, security, and environmental standards for international shipping, preventing maritime pollution, and enforcing MARPOL and SOLAS conventions.',
    'IMO Assembly & Maritime Safety Committee RoP',
    ['Net-Zero Marine Fuel Standards (CII / EEXI)', 'Red Sea & Critical Strait Transit Security', 'Autonomous Maritime Cargo Ship Standards'],
    [],
    ['international maritime organization', 'international maritime organisation']
  ),
  makeCommittee(
    'wmo',
    'WMO',
    'World Meteorological Organization',
    'agencies',
    'UN specialized agency on weather, climate, and water resources coordinating global Earth observation networks, climate models, and the Early Warnings for All initiative.',
    'World Meteorological Congress RoP',
    ['Early Warnings for All (EW4All) Global Rollout', 'Global Greenhouse Gas Monitoring Network', 'El Niño Extreme Weather Preparedness'],
    [],
    ['world meteorological organization']
  ),
  makeCommittee(
    'itu',
    'ITU',
    'International Telecommunication Union',
    'agencies',
    'UN specialized agency for digital technologies, coordinating global radio spectrum allocations, orbital satellite slot governance, and telecom standardization.',
    'Plenipotentiary Conference & Study Group RoP',
    ['Low-Earth Orbit Satellite Megaconstellation Slots', 'Global 6G Spectrum Harmonization', 'Subsea Telecom Cable Defense Norms'],
    [],
    ['international telecommunication union', 'international telecommunications union']
  ),
  makeCommittee(
    'unido',
    'UNIDO',
    'United Nations Industrial Development Organization',
    'agencies',
    'UN specialized agency promoting industrial development for poverty reduction, inclusive globalization, green industrial tech transfer, and environmental sustainability.',
    'General Conference & Industrial Development Board RoP',
    ['Green Hydrogen Industrial Clusters', 'Circular Economy Industrial Symbiosis', 'Developing Nation Manufacturing Automation'],
    [],
    ['united nations industrial development organization']
  ),
  makeCommittee(
    'unhcr',
    'UNHCR',
    'United Nations High Commissioner for Refugees',
    'agencies',
    'UN refugee agency mandated to aid and protect refugees, forcibly displaced communities, and stateless people, and assist in their voluntary repatriation or resettlement.',
    'Executive Committee Consensus RoP',
    ['Climate Displacement & Statelessness Treaties', 'Host-Community Economic Inclusion Models', 'Non-Refoulement Enforcement in Crisis Zones'],
    [],
    ['united nations high commissioner for refugees', 'un high commissioner for refugees']
  ),
  makeCommittee(
    'iaea',
    'IAEA',
    'International Atomic Energy Agency',
    'agencies',
    'Global "Atoms for Peace" inspectorate verifying nuclear safeguards, peaceful civil atomic energy deployment, and nuclear safety protocols.',
    'IAEA Board of Governors & General Conference RoP',
    ['Safeguards Verification in Active War Zones', 'Small Modular Reactor (SMR) Safety Protocols', 'Enriched Fissile Stockpile Non-Proliferation'],
    [],
    ['international atomic energy agency']
  ),
  makeCommittee(
    'unwomen',
    'UNWOMEN',
    'UN Women',
    'un-organs',
    'United Nations entity dedicated to gender equality and the empowerment of women, eliminating discrimination, supporting international standards, and promoting female leadership and human rights globally.',
    'Executive Board Tripartite Consensus RoP',
    ['Closing Gender Digital & STEM Divide', 'Protecting Women Human Rights Defenders', 'Gender-Responsive Climate Adaptation Budgets'],
    ['un women', 'unwomen', 'un-women'],
    ['un women', 'united nations entity for gender equality']
  ),
  makeCommittee(
    'indian-cabinet',
    'INDCN',
    'Indian Cabinet',
    'national',
    'Apex executive decision-making council of the Republic of India, comprising the Prime Minister and Union Cabinet Ministers directing national security, economic policy, federal governance, and critical statutory legislation.',
    'Government of India Transaction of Business Rules',
    ['National Security & Integrated Defence Modernization', 'Strategic Economic Infrastructure & Supply Chain Sovereignty', 'Federal Emergency & Disaster Governance'],
    ['indcn', 'indian cabinet', 'union cabinet', 'cabinet of india'],
    ['indian cabinet', 'union cabinet of india', 'cabinet committee on security']
  ),
  makeCommittee(
    'icj',
    'ICJ',
    'International Court of Justice',
    'agencies',
    'Principal judicial organ of the United Nations seated at the Peace Palace in The Hague, adjudicating contentious legal disputes between sovereign states and issuing advisory opinions.',
    'ICJ Statute & Adversarial Pleadings Procedure',
    ['Provisional Measures Enforcement in Armed Conflict', 'Advisory Opinions on Climate Change Obligations', 'Maritime & Terrestrial Boundary Delimitation'],
    ['world court'],
    ['international court of justice', 'world court']
  ),
  makeCommittee(
    'icc',
    'ICC',
    'International Criminal Court',
    'agencies',
    'Permanent treaty-based international criminal tribunal under the Rome Statute prosecuting genocide, crimes against humanity, war crimes, and the crime of aggression.',
    'Rome Statute Adversarial Trial & Chamber RoP',
    ['Digital Open-Source War Crimes Evidence', 'Cyber Attacks Under Rome Statute', 'Victim Reparations & State Cooperation'],
    ['icct', 'icc-cpi', 'icc (criminal court)', 'icc court'],
    ['international criminal court']
  ),
  makeCommittee(
    'ip',
    'IP',
    'International Press',
    'crisis',
    'Simulated journalistic delegation representing international media agencies investigating committee caucuses, holding delegates accountable, and publishing press releases.',
    'Press Corps Press Conference & Publishing Protocol',
    ['Investigative Journalism & Leak Verification', 'Press Conferences & Questioning of Chairs', 'Real-Time Dispatch Bulletins & Communiqués'],
    ['international press', 'press corps'],
    ['international press', 'international press corps']
  ),
  makeCommittee(
    'ccpcj',
    'CCPCJ',
    'UN Commission on Crime Prevention and Criminal Justice',
    'un-organs',
    'Principal UN policymaking body on international crime prevention, transnational organized crime, cybercrime, and criminal justice reform under ECOSOC.',
    'ECOSOC Functional Commission RoP',
    ['Transnational Cybercrime Treaties', 'Anti-Money Laundering Protocols', 'Juvenile & Restorative Justice Frameworks'],
    [],
    ['commission on crime prevention and criminal justice', 'un commission on crime prevention and criminal justice']
  ),
  makeCommittee(
    'arctic-council',
    'AC',
    'Arctic Council',
    'regional',
    'Leading intergovernmental forum promoting cooperation, coordination, and interaction among Arctic States, Arctic Indigenous communities, and inhabitants on common Arctic issues.',
    'Arctic Council Ministerial Consensus RoP',
    ['Arctic Maritime Shipping Route Environmental Safeguards', 'Permafrost Thaw & Indigenous Community Resilience', 'Scientific Cooperation & Marine Biodiversity'],
    ['arctic council'],
    ['arctic council']
  ),
  makeCommittee(
    'ioc',
    'IOC',
    'International Olympic Committee',
    'agencies',
    'Supreme authority of the Olympic Movement, ensuring the regular celebration of the Olympic Games, fighting doping, promoting ethical sport governance, and protecting athlete rights.',
    'IOC Session & Executive Board RoP',
    ['Olympic Neutrality & Geopolitical Sanctions', 'WADA Doping Regulation & Anti-Corruption', 'Climate-Resilient Host City Infrastructure'],
    [],
    ['international olympic committee']
  ),
  makeCommittee(
    'fifa',
    'FIFA',
    'FIFA Council',
    'agencies',
    'Strategic and supervisory executive body of the International Federation of Association Football, setting global tournament regulations, managing commercial rights, establishing human rights standards, and overseeing host nation bidding integrity.',
    'FIFA Council Strategic Governance RoP',
    ['Mega-Event Labor Standards & Human Rights Oversight', 'Financial Fair Play & Club World Cup Regulations', 'Broadcasting Rights & Anti-Match-Fixing'],
    ['fifa council'],
    ['fifa council', 'fédération internationale de football association']
  )
];

function stripParen(str) {
  return String(str || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
}

function splitTokens(str) {
  return String(str || '')
    .toLowerCase()
    .split(/[/|–—]+|\s+&\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Checks whether a single conference/document committee label matches a catalog committee entry
 * using exact unique abbreviation code checks, acronym tokens, and safe phrase matching.
 */
export function doesEntryMatchCommittee(entry, committee) {
  if (!entry || !committee) return false;
  let rawStr = '';
  if (typeof entry === 'object' && entry !== null) {
    rawStr = [entry.code, entry.name, entry.title, entry.id].filter(Boolean).join(' ');
  } else {
    rawStr = String(entry || '');
  }
  const raw = rawStr.trim().toLowerCase();
  if (!raw) return false;

  const bare = stripParen(raw);
  const parenContentMatch = raw.match(/\(([^)]+)\)/);
  const parenInner = parenContentMatch ? parenContentMatch[1].trim().toLowerCase() : '';
  const allCandidateTokens = [
    raw,
    bare,
    parenInner,
    ...splitTokens(raw),
    ...splitTokens(bare),
    ...splitTokens(parenInner)
  ].filter(Boolean);

  // Direct exact code match
  if (committee.code && (raw === committee.code.toLowerCase() || bare === committee.code.toLowerCase())) {
    return true;
  }

  // Avoid confusing GA / UNGA with sub-committees (1st..6th)
  if (committee.id === 'unga' && /\b(1st|2nd|3rd|4th|5th|6th|first|second|third|fourth|fifth|sixth|disec|ecofin|sochum|specpol|abc|ga6|legal|legalcommittee)\b/.test(raw)) {
    return false;
  }

  for (const token of allCandidateTokens) {
    if (committee.exactCodes.includes(token)) {
      return true;
    }
  }

  for (const phrase of committee.phraseAliases) {
    if (phrase.length >= 4 && bare.includes(phrase)) {
      return true;
    }
  }

  return false;
}

export const DEFAULT_CONFERENCES = [];

/**
 * Matches a catalog committee against live Cloud Firestore conferences.
 * Returns upcoming/active conferences (status !== 'completed'), all matched conferences, and custom docs.
 */
export function findMatchingConferencesForCommittee(committee, conferences = [], firestoreCommittees = []) {
  const effectiveConfs = conferences && conferences.length > 0 ? conferences : DEFAULT_CONFERENCES;
  const customDocs = firestoreCommittees.filter(doc => {
    if (doc.catalogId) return doc.catalogId === committee.id;
    if (doc.code && (committee.code.toLowerCase() === String(doc.code).trim().toLowerCase() || committee.exactCodes.includes(String(doc.code).trim().toLowerCase()))) return true;
    return doesEntryMatchCommittee(doc.name, committee) || doesEntryMatchCommittee(doc.code, committee);
  });

  const linkedConfIds = new Set(customDocs.map(d => d.confId).filter(Boolean));

  const allMatchedConferences = effectiveConfs.filter(conf => {
    if (linkedConfIds.has(conf.id)) return true;
    const list = Array.isArray(conf.committees)
      ? conf.committees
      : String(conf.committees || '').split(',').map(s => s.trim()).filter(Boolean);
    return list.some(entry => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim().toLowerCase();
        if (committee.code.toLowerCase() === trimmed || committee.exactCodes.includes(trimmed)) return true;
      }
      return doesEntryMatchCommittee(entry, committee);
    });
  });

  const upcomingConferences = allMatchedConferences.filter(
    conf => String(conf.status || 'open').toLowerCase() !== 'completed'
  );

  return {
    upcomingConferences,
    allMatchedConferences,
    customDocs
  };
}

/**
 * Finds a catalog committee from a URL query, code, or identifier string.
 */
export function findCatalogCommitteeByQuery(queryStr) {
  if (!queryStr) return null;
  const q = String(queryStr).trim().toLowerCase();
  return (
    COMMITTEES_CATALOG.find(c => c.id === q) ||
    COMMITTEES_CATALOG.find(c => c.code.toLowerCase() === q) ||
    COMMITTEES_CATALOG.find(c => c.exactCodes.includes(q)) ||
    COMMITTEES_CATALOG.find(c => doesEntryMatchCommittee(q, c)) ||
    null
  );
}
