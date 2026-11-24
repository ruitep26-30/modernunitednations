/**
 * Modern United Nations - Committee Briefings & Institutional Architecture
 * Authoritative dossiers covering:
 * Part 1: Institutional Overview & Mandate Architecture
 *   1. Historical background
 *   2. Why the committee was established
 *   3. Its purpose
 *   4. Its international significance
 *   5. Its evolution over time
 *   6. Its role in global governance
 * Part 2: Operational Architecture & Membership Mechanics
 *   7. Membership structure
 *   8. Permanent and non-permanent members (where applicable)
 *   9. Voting arrangements
 *   10. Leadership structure
 *   11. Decision-making procedures
 *   12. Relevant organisational bodies
 */

const BESPOKE_BRIEFINGS = {
  UNGA: {
    historicalBackground: `Conceived amidst the devastation of World War II, the United Nations General Assembly was chartered at the 1945 San Francisco Conference as the principal deliberative parliament of mankind. Convening for the first time in January 1946 in London's Central Hall Westminster with 51 founding delegations, it embodied humanity's collective vow to establish an enduring architecture of multilateral dialogue and sovereign equality.`,
    establishmentReason: `Established under Chapter IV of the UN Charter, the General Assembly was created to address the fatal democratic deficits of the League of Nations. It was founded to guarantee that every sovereign nation—regardless of economic scale, military prowess, or geopolitical alignment—possesses an equal voice, institutional standing, and universal vote in deliberations governing international peace, human dignity, and collective security.`,
    purpose: `The General Assembly functions as the chief policymaking, representative, and normative organ of the United Nations. Operating with 193 Member States under the sovereign equality principle of 'one nation, one vote', it initiates global studies, adopts landmark resolutions, drafts multilateral conventions, approves the UN regular budget, and oversees operational organs across the international system.`,
    internationalSignificance: `As the sole assembly boasting universal national representation, the UNGA represents the moral conscience of the international community. While its resolutions are generally non-binding recommendations, they carry unparalleled moral and political authority, codifying customary international law, framing treaties like the Universal Declaration of Human Rights, and formalizing the Sustainable Development Goals (SDGs).`,
    evolution: `Over eight decades, the Assembly expanded from a post-war council of 51 nations into a universal forum of 193 states through the sweeping wave of post-colonial self-determination. During Cold War Security Council deadlocks, it asserted legislative authority through landmark mechanisms such as the 1950 Uniting for Peace Resolution (Resolution 377A), shifting its 21st-century focus toward climate multilateralism, digital governance, and sovereign debt equity.`,
    globalGovernanceRole: `The General Assembly sits at the apex of global governance as the universal convener of sovereign states. It provides an indispensable diplomatic check against great-power hegemony, establishes global consensus across existential planetary challenges, coordinates North-South developmental compacts, and provides smaller developing states with an institutional platform to shape international norms.`,
    
    // Operational & Governance Mechanics
    membershipStructure: `193 sovereign Member States of the United Nations, alongside 2 Permanent Non-Member Observer States (the Holy See and the State of Palestine) and accredited intergovernmental organizations.`,
    permanentTiers: `Universal sovereign equality applies across all 193 member states without permanent tiers, individual veto powers, or hierarchical castes. Every sovereign delegation votes on an identical legal footing.`,
    isTierApplicable: false,
    votingArrangements: `Operates strictly on the democratic principle of 'one state, one vote'. Standard procedural and regular matters require a simple majority of members present and voting. 'Important questions' under Article 18(2)—including recommendations on international peace and security, election of Security Council and ECOSOC members, admission and expulsion of states, and budgetary allocations—mandate a two-thirds majority.`,
    leadershipStructure: `Headed by the President of the General Assembly (PGA), elected annually by the Assembly under an equitable geographical rotation system across five regional groups. The President is assisted by 21 Vice-Presidents, the General Committee, and the Bureaus of the Six Main Committees.`,
    decisionProcedures: `Deliberated through annual regular sessions (convening every September), special sessions, and Emergency Special Sessions. Draft resolutions are formulated in informal working groups, reviewed in the respective Main Committees, and passed in the plenary hall either through recorded electronic voting or adopted by consensus without a vote.`,
    relevantBodies: `The Six Main Committees (DISEC/First, ECOFIN/Second, SOCHUM/Third, SPECPOL/Fourth, ABC/Fifth, LEGAL/Sixth), the General Committee, Credentials Committee, International Law Commission (ILC), Peacebuilding Commission (PBC), and the Human Rights Council.`
  },

  UNSC: {
    historicalBackground: `The United Nations Security Council was established in 1945 under the United Nations Charter, emerging directly from the Allied wartime conferences at Dumbarton Oaks and Yalta. The founding architecture recognized that post-war global peace required an executive organ endowed with rapid enforcement mechanisms, vested in the victorious Allied powers as permanent veto-wielding members alongside rotating elected states.`,
    establishmentReason: `The Council was established to correct the structural impotence that precipitated the collapse of the League of Nations, which lacked enforceable collective security mandates. It was designed to provide a permanent, continuously operational crisis executive capable of identifying threats to peace, prescribing binding economic sanctions, deploying peacekeeping forces, and authorizing multilateral military action under Chapter VII.`,
    purpose: `Under Chapter V, VII, and VIII of the UN Charter, the Security Council holds primary responsibility for the maintenance of international peace and security. It investigates disputes, mediates diplomatic armistices, mandates ceasefire agreements, dispatches UN Peacekeeping Operations, levies targeted counter-proliferation and economic embargoes, and refers egregious violations of international humanitarian law to the International Criminal Court.`,
    internationalSignificance: `The Security Council is the only global body whose resolutions possess binding legal force under Article 25 of the UN Charter, obligating all 193 member states to comply. Its Chapter VII mandates represent the apex of legal coercive authority in international affairs, governing the lawful use of force, arms embargoes, counter-terrorism asset freezes, and multinational intervention mandates.`,
    evolution: `Throughout the Cold War, the Council was frequently paralyzed by mutual US-Soviet vetoes, pivoting operational attention to observation missions in the Middle East and South Asia. The post-1990 era witnessed an unprecedented revitalization, establishing complex multidimensional peace operations, ad hoc criminal tribunals (ICTY and ICTR), and sanctions regimes, evolving today into debates over structural enlargement, African permanent representation, and veto reform.`,
    globalGovernanceRole: `The UNSC serves as the ultimate collective security executive of the international system. While navigating deep geopolitical fissures among its Permanent Five (P5) members, it remains the singular multilateral anchor for legitimizing humanitarian interventions, mediating nuclear non-proliferation compliance, counteracting illicit non-state armed actors, and containing escalating interstate conflicts.`,

    // Operational & Governance Mechanics
    membershipStructure: `15 Member States, comprising 5 Permanent Members (P5) designated in the UN Charter and 10 Non-Permanent Members (E10) elected by the General Assembly for staggered two-year non-consecutive mandates.`,
    permanentTiers: `Permanent Members (P5): China, France, Russian Federation, United Kingdom, and United States (holding individual veto power under Article 27). Non-Permanent Members (E10): 10 rotating members elected under geographical quotas: 3 from Africa, 2 from Asia-Pacific, 2 from Latin America and the Caribbean, 2 from Western Europe and Others, and 1 from Eastern Europe.`,
    isTierApplicable: true,
    votingArrangements: `Each Council member has one vote. Procedural matters require 9 affirmative votes out of 15. Substantive matters require 9 affirmative votes including the concurring votes of all five permanent members. A negative vote cast by any single P5 member constitutes an absolute veto that immediately blocks adoption. An abstention by a P5 member does not block adoption.`,
    leadershipStructure: `The Presidency of the Security Council rotates monthly among the 15 member states in English alphabetical order. The Council President presides over meetings, represents the Council before other UN organs, approves the provisional agenda, and issues formal Presidential Statements.`,
    decisionProcedures: `Permanently operational and capable of convening on immediate 24-hour notice. Deliberations alternate between closed bilateral consultations, formal public debates, and high-level ministerial meetings. Adopted measures take the form of legally binding Chapter VII Resolutions, non-binding Chapter VI Resolutions, Presidential Statements, or Press Statements.`,
    relevantBodies: `Counter-Terrorism Committee (CTC), 1267 ISIL/Al-Qaida Sanctions Committee, Military Staff Committee, Working Group on Peacekeeping Operations, Ad Hoc Working Group on Conflict Prevention in Africa, and 14 dedicated Sanctions Committees.`
  },

  DISEC: {
    historicalBackground: `The Disarmament and International Security Committee (DISEC) was established in 1945 as the First Committee of the United Nations General Assembly. Rooted in the grim dawn of the nuclear era following Hiroshima and Nagasaki, its inaugural agenda focused on the immediate containment and elimination of weapons of mass destruction, leading directly to the adoption of UNGA Resolution 1 (I) in January 1946.`,
    establishmentReason: `DISEC was created to fulfill Article 11 of the UN Charter, which mandates the General Assembly to consider general principles of cooperation in the maintenance of international peace and security, including the principles governing disarmament and the regulation of armaments. It was established so that the global majority of nations could directly shape disarmament treaties without exclusion.`,
    purpose: `DISEC deals with all disarmament, demilitarization, and international security matters affecting the international community. Its annual mandate encompasses nuclear disarmament, the prevention of an arms race in outer space (PAROS), conventional arms control, chemical and biological non-proliferation, lethal autonomous weapons systems (LAWS), and global cybersecurity governance.`,
    internationalSignificance: `DISEC acts as the universal normative incubator for international arms control. Although technical negotiations occur in Geneva at the Conference on Disarmament, DISEC drafts the resolutions that establish multilateral consensus, catalyze treaties such as the Nuclear Non-Proliferation Treaty (NPT), the Chemical Weapons Convention (CWC), the Arms Trade Treaty (ATT), and the Treaty on the Prohibition of Nuclear Weapons (TPNW).`,
    evolution: `From bilateral Cold War nuclear standoff oversight, DISEC transitioned in the 1990s toward chemical weapon eradication, landmine bans (Ottawa Treaty), and small arms tracking. In the contemporary digital age, it has rapidly expanded into new frontiers of conflict, addressing militarized artificial intelligence, space weaponization, and responsible state behavior in cyberspace.`,
    globalGovernanceRole: `DISEC democratizes international arms control. It prevents arms limitations from being dictated solely by nuclear-weapon states, providing non-nuclear and non-aligned nations with an authoritative platform to demand strategic de-escalation, verifiable disarmament standards, and transparent reporting on global military expenditures.`,

    // Operational & Governance Mechanics
    membershipStructure: `Universal membership comprising all 193 Member States of the United Nations, plus accredited observer delegations.`,
    permanentTiers: `Universal sovereign equality applies with no permanent seats or veto rights. Non-nuclear states hold identical voting power to nuclear-armed states.`,
    isTierApplicable: false,
    votingArrangements: `One delegation, one vote. Draft resolutions are voted on during the annual committee session (October-November) by simple majority of members present and voting, before being forwarded to the UNGA plenary for final adoption.`,
    leadershipStructure: `Chaired by a Committee Chair elected annually by the General Assembly, supported by three Vice-Chairs and a Rapporteur representing the regional geographical groups.`,
    decisionProcedures: `The work proceeds in three structured phases: general debate, thematic discussions on seven disarmament clusters, and action on all draft resolutions and decisions. Delegations negotiate compromise language to maximize consensus.`,
    relevantBodies: `Conference on Disarmament (Geneva), United Nations Disarmament Commission (UNDC), UN Office for Disarmament Affairs (UNODA), and the UN Institute for Disarmament Research (UNIDIR).`
  },

  WHO: {
    historicalBackground: `The World Health Organization was established on April 7, 1948, following the unanimous consensus of all 61 nations attending the International Health Conference in New York in 1946. Its creation united legacy institutions including the Office International d'Hygiène Publique and the League of Nations Health Organisation into a singular specialized agency under the United Nations system.`,
    establishmentReason: `The WHO was founded on the radical constitutional premise that 'the enjoyment of the highest attainable standard of health is one of the fundamental rights of every human being without distinction of race, religion, political belief, economic or social condition.' It was created to eradicate transmissible cross-border plagues and coordinate international health governance.`,
    purpose: `As the global directing and coordinating authority on health, the WHO directs international pandemic responses, establishes universal pharmaceutical and diagnostic standards, coordinates disease eradication initiatives (such as polio, smallpox, and malaria), and assists sovereign states in constructing resilient primary healthcare infrastructures.`,
    internationalSignificance: `The WHO is the guardian of the International Health Regulations (IHR 2005), a legally binding instrument requiring 196 countries to report and respond to Public Health Emergencies of International Concern (PHEIC). Its historic coordination led to the complete planetary eradication of smallpox in 1980, the single greatest achievement in public health history.`,
    evolution: `Evolving from early campaigns targeting acute communicable diseases (yaws, tuberculosis, smallpox), the WHO adopted the landmark Declaration of Alma-Ata in 1978 championing Primary Health Care. Over recent decades, it responded to HIV/AIDS, Ebola, and COVID-19, leading current negotiations on a historic international Pandemic Accord to ensure equitable vaccine distribution.`,
    globalGovernanceRole: `The WHO serves as the planetary sanitary shield and medical normative authority. In an interconnected world where biological threats travel faster than aircraft, it coordinates global epidemiological surveillance, prevents cross-border contagion, sets biomedical standards, and defends equitable medical access across the Global South.`,

    // Operational & Governance Mechanics
    membershipStructure: `194 Member States organized into six geographic regional groupings (AFRO, AMRO/PAHO, EMRO, EURO, SEARO, WPRO), alongside two Associate Members.`,
    permanentTiers: `Universal state membership. All 194 member states possess equal standing in the World Health Assembly without permanent seats or veto privileges.`,
    isTierApplicable: false,
    votingArrangements: `Each member state has one vote in the World Health Assembly. Standard administrative and technical resolutions pass by simple majority; conventions, international regulations, and Director-General appointments require a two-thirds majority.`,
    leadershipStructure: `Led by the Director-General (elected by the World Health Assembly for a five-year term), supported by the World Health Assembly President, an Executive Board of 34 technically qualified health experts, and six Regional Directors.`,
    decisionProcedures: `The World Health Assembly convenes annually in Geneva in May. Member state delegates deliberate in two main committees (Committee A for program/budget and Committee B for administrative/constitutional matters) before passing binding regulations or voluntary global strategies.`,
    relevantBodies: `World Health Assembly (WHA), Executive Board (EB), Strategic Advisory Group of Experts (SAGE) on Immunization, IHR Emergency Committees, and the Global Outbreak Alert and Response Network (GOARN).`
  },

  NATO: {
    historicalBackground: `The North Atlantic Treaty Organization was established on April 4, 1949, with the signing of the North Atlantic Treaty (the Washington Treaty) by twelve founding North American and Western European nations. Emerging from the post-war devastation of Europe and the onset of Soviet expansionism, it established a collective defense alliance safeguarding the transatlantic area.`,
    establishmentReason: `NATO was created to provide a credible deterrence against military aggression, foster transatlantic political consultation, and prevent the resurgence of nationalist militarism in Europe. As famously articulated by its first Secretary General Lord Ismay, its strategic mandate was to keep the peace, deter aggression, and defend democratic freedom.`,
    purpose: `NATO is a political and military alliance committed to the principle that an armed attack against one or more of its members is considered an attack against them all, enshrined in Article 5 of the Washington Treaty. It conducts crisis management operations, conducts strategic maritime and airspace policing, and fosters interoperability among Allied armed forces.`,
    internationalSignificance: `NATO constitutes the most formidable and durable military alliance in modern history, currently comprising 32 member nations across Europe and North America. Its combined military expenditure accounts for over 50 percent of global defense spending, and its nuclear and conventional deterrence shields over one billion citizens.`,
    evolution: `From a Cold War frontline territorial defense posture, NATO transformed in the 1990s into an out-of-area crisis manager, executing peace-enforcement operations in Bosnia and Kosovo. Post-9/11, it invoked Article 5 for the first and only time in its history to assist the United States, operating extensively in Afghanistan. In recent years, following the war in Ukraine, NATO revitalized collective territorial defense along its eastern flank.`,
    globalGovernanceRole: `NATO serves as the primary security umbrella of the Euro-Atlantic architecture. Through partnerships with global democracies, strategic dialogue, and counter-cyber operations, it provides the defensive stability upon which international trade, maritime freedom of navigation, and democratic institutions depend.`,

    // Operational & Governance Mechanics
    membershipStructure: `32 sovereign democratic member nations across North America and Europe, bound by mutual treaty commitments.`,
    permanentTiers: `All 32 Allied nations hold permanent, equal representation on the North Atlantic Council with no rotating classes or subordinate tiers.`,
    isTierApplicable: false,
    votingArrangements: `Operates strictly on Consensus and Unanimity. There is no voting; every decision is an agreed expression of the collective will of all 32 sovereign governments. Decisions are commonly approved via the 'Silence Procedure' (formal adoption if no Ally breaks silence with an objection before a deadline).`,
    leadershipStructure: `Led politically by the NATO Secretary General (appointed by Allied consensus), who chairs the North Atlantic Council, and militarily by the Chair of the Military Committee, Supreme Allied Commander Europe (SACEUR), and Supreme Allied Commander Transformation (SACT).`,
    decisionProcedures: `Allies consult under Article 4 whenever a member feels its security is threatened. The North Atlantic Council (NAC) meets regularly at the level of Permanent Representatives (Ambassadors), and periodically at the level of Foreign Ministers, Defense Ministers, and Heads of State and Government.`,
    relevantBodies: `North Atlantic Council (NAC), Military Committee (MC), International Staff, Allied Command Operations (SHAPE, Mons, Belgium), Allied Command Transformation (Norfolk, USA), and the Nuclear Planning Group (NPG).`
  },

  EU: {
    historicalBackground: `The European Union traces its genesis to the European Coal and Steel Community (ECSC) established by the Treaty of Paris in 1951, conceptualized by Robert Schuman and Jean Monnet to make war between historic European rivals 'not merely unthinkable, but materially impossible.' This foundation deepened through the 1957 Treaties of Rome and formally established the EU via the 1992 Maastricht Treaty.`,
    establishmentReason: `The EU was established to achieve lasting continental reconciliation after centuries of catastrophic wars, bind sovereign European nations into an interdependent single market, and create a united political and economic bloc capable of upholding democratic values, human rights, and the rule of law on the world stage.`,
    purpose: `The EU operates as an unprecedented supranational and intergovernmental partnership of 27 democratic member states. It manages a seamless internal market based on the 'four freedoms' (free movement of goods, capital, services, and people), coordinates fiscal policies through the Eurozone, enacts common environmental and digital legislation, and articulates a Common Foreign and Security Policy (CFSP).`,
    internationalSignificance: `The EU is the world's largest single market economy and the foremost donor of international humanitarian and development aid. Through its regulatory power—often termed the 'Brussels Effect'—EU regulations (such as GDPR in data privacy and the Green Deal in environmental taxonomy) establish de facto global commercial and technological standards.`,
    evolution: `From a six-nation industrial pact, the Union expanded across Western, Central, and Eastern Europe following the fall of the Berlin Wall, uniting 27 nations. It introduced the single European currency (the Euro), abolished internal borders through the Schengen Area, weathered the 2008 financial crisis and Brexit, and emerged as a cohesive geopolitical actor driving global decarbonization.`,
    globalGovernanceRole: `The EU is a champion and cornerstone of rules-based multilateralism. It champions the Paris Climate Agreement, international judicial bodies (including the ICC), global humanitarian conventions, and advocates for peaceful diplomatic resolution over unilateral force in international disputes.`,

    // Operational & Governance Mechanics
    membershipStructure: `27 sovereign democratic European member states participating in shared treaties and legal frameworks.`,
    permanentTiers: `All 27 member states maintain permanent constitutional status within the Union's legislative and judicial bodies.`,
    isTierApplicable: false,
    votingArrangements: `In the Council of the EU, decisions predominantly use Qualified Majority Voting (QMV): requires 55% of member states (15 of 27) representing at least 65% of the total EU population. A blocking minority requires at least 4 member states. Key sensitive areas (foreign policy, defense, taxation) require strict Unanimity. In the European Parliament, simple or absolute majority applies.`,
    leadershipStructure: `Operates via the 'Institutional Triangle': President of the European Council (chairs summits of heads of state), President of the European Commission (leads the executive body), and President of the European Parliament (leads the co-legislative body).`,
    decisionProcedures: `The European Commission proposes legislative drafts; proposals must be negotiated, amended, and approved jointly by both the Council of the EU (member state ministers) and the directly elected European Parliament under the Ordinary Legislative Procedure (co-decision).`,
    relevantBodies: `European Commission, European Parliament, Council of the European Union, European Council, Court of Justice of the European Union (CJEU), European Central Bank (ECB), and European External Action Service (EEAS).`
  },

  INDCN: {
    historicalBackground: `The Union Cabinet of India derives its constitutional foundation from Article 74 and Article 75 of the Constitution of India, tracing its institutional evolution from the Viceroy's Executive Council to the sovereign Interim Government formed in September 1946 under Prime Minister Jawaharlal Nehru.`,
    establishmentReason: `The Cabinet was established as the supreme executive council of the Republic of India to direct and oversee the execution of sovereign state power, formulate national policies, maintain national security, and aid and advise the President of India.`,
    purpose: `The Indian Cabinet serves as the highest executive decision-making organ of the Union Government. It coordinates inter-ministerial policy, sanctions defense and national security actions via the Cabinet Committee on Security (CCS), directs macroeconomic planning, and authorises legislative bills introduced in Parliament.`,
    internationalSignificance: `Representing sovereign leadership for 1.4 billion citizens and the world's fifth-largest economy, the Indian Cabinet exercises ultimate authority over foreign treaty ratifications, international trade partnerships, bilateral defense pacts, and multilateral diplomatic engagements.`,
    evolution: `From post-independence nation-building and five-year planning in the 1950s, the Cabinet navigated wars in 1962, 1965, 1971, and 1999, spearheaded historic economic liberalization in 1991, managed complex coalition governance architectures, and pioneered digital public infrastructure governance in the modern era.`,
    globalGovernanceRole: `The Indian Cabinet articulates sovereign stances in the G20, BRICS, SCO, Quad, and the United Nations, steering global governance on renewable energy transitions, Global South development compacts, and international maritime safety.`,

    // Operational & Governance Mechanics
    membershipStructure: `Comprises the Prime Minister of India as head of government and senior Cabinet Ministers heading Union Ministries, supported by the Cabinet Secretary (senior-most civil servant) and special invitees including the National Security Advisor.`,
    permanentTiers: `Constitutional council serving concurrent with executive government tenure; exercises continuous emergency and executive mandate.`,
    isTierApplicable: false,
    votingArrangements: `Operates on the Westminster doctrine of collective cabinet responsibility under Article 75(3). Decisions are reached via consensus; once sanctioned, every cabinet minister is bound to uphold cabinet solidarity.`,
    leadershipStructure: `Headed by the Prime Minister of India, with strategic support from the Cabinet Committee on Security (CCS), Cabinet Committee on Economic Affairs (CCEA), and the Cabinet Secretariat.`,
    decisionProcedures: `Weekly Cabinet meetings deliberate strategic notes prepared by Union ministries, reviewed by the Cabinet Secretariat and vetted by the Ministry of Law & Justice before executive promulgation.`,
    relevantBodies: `Cabinet Committee on Security (CCS), Cabinet Committee on Economic Affairs (CCEA), Cabinet Secretariat, Prime Minister's Office (PMO), and National Security Council Secretariat (NSCS).`
  },

  FIFA: {
    historicalBackground: `The Fédération Internationale de Football Association (FIFA) was founded on May 21, 1904, in Paris by delegates from France, Belgium, Denmark, the Netherlands, Spain, Sweden, and Switzerland. From seven European associations organizing basic amateur match regulations, it grew into the undisputed global governing body for the world's most popular sport.`,
    establishmentReason: `FIFA was established to standardize the rules of association football, establish mutually recognized international competitions, and prevent conflicting interpretations of the laws of the game as football transcended national borders into an international phenomenon.`,
    purpose: `The FIFA Council serves as the strategic executive oversight body responsible for setting the global direction of association football. It governs the staging of the FIFA World Cup, establishes structural regulations, oversees the international match calendar, enacts player transfer regulations, and invests billions into worldwide grassroots football development through the FIFA Forward programme.`,
    internationalSignificance: `With 211 member associations, FIFA possesses a larger global membership than the United Nations (193). The quadrennial FIFA World Cup is the single most watched sporting event in human civilization, commanding billions of television viewers and wielding immense cultural, economic, and geopolitical soft-power influence.`,
    evolution: `From early European regional tourneys, FIFA inaugurated the inaugural World Cup in Uruguay in 1930. Over subsequent decades, it globalized across the Americas, Africa, and Asia, instituted the FIFA Women's World Cup in 1991, underwent comprehensive governance and anti-corruption integrity reforms in 2016, and expanded the 2026 World Cup to a historic 48-team tournament hosted across North America.`,
    globalGovernanceRole: `FIFA operates as a unique non-state transnational governance authority. It exercises sovereign-like regulatory jurisdiction over international football, wields sports diplomacy to bridge geopolitical divides, enforces human rights and sustainability mandates on tournament hosts, and directs global investment in youth athletics and public health.`,

    // Operational & Governance Mechanics
    membershipStructure: `211 national football associations worldwide, affiliated across six continental confederations: AFC (Asia), CAF (Africa), CONCACAF (North/Central America), CONMEBOL (South America), OFC (Oceania), and UEFA (Europe).`,
    permanentTiers: `The FIFA Council consists of 37 members: 1 President (elected by Congress), 8 Vice-Presidents (appointed by confederations), and 28 members elected by national associations through confederation congresses, with guaranteed female member quotas for each confederation.`,
    isTierApplicable: true,
    votingArrangements: `In the supreme legislative FIFA Congress, each of the 211 member associations has one vote. Standard resolutions pass with a simple majority of valid votes; amendments to the FIFA Statutes require a 75% supermajority. In the FIFA Council, decisions require a simple majority of members present.`,
    leadershipStructure: `Headed by the FIFA President (elected by Congress for a four-year term), supported by the Secretary General (executive officer heading the Zurich headquarters administration) and the Bureau of the Council.`,
    decisionProcedures: `The FIFA Congress convenes annually to vote on statutes, approve financial reports, admit member associations, and award hosting rights for the FIFA World Cup via open roll-call ballot. The 37-member FIFA Council meets periodically to enact regulations, approve budgets, and schedule international match calendars.`,
    relevantBodies: `FIFA Congress, FIFA Council, Governance, Audit and Compliance Committee, Disciplinary Committee, Ethics Committee, Appeal Committee, Football Stakeholders Committee, and the International Football Association Board (IFAB).`
  }
};

/**
 * Synthesizes an authoritative briefing dossier for any committee, combining
 * bespoke historical records with canonical catalog metadata.
 */
export function getCommitteeBriefing(comm) {
  if (!comm) return null;

  const code = (comm.code || '').toUpperCase();
  if (BESPOKE_BRIEFINGS[code]) {
    return BESPOKE_BRIEFINGS[code];
  }

  // Synthesize rich, authoritative academic explanation using canonical metadata
  const name = comm.name || 'International Committee';
  const hq = comm.headquarters || 'International Headquarters';
  const est = comm.established || '1945';
  const mandate = comm.mandate || 'Advancing multilateral cooperation and international governance.';
  const category = comm.categoryLabel || 'Multilateral Organ';

  return {
    historicalBackground: `${name} (${code}) was formally established in ${est} as an integral component of the post-war multilateral architecture headquartered in ${hq}. Originating from intergovernmental treaties and global conferences, it was constituted to institutionalize structured deliberation among sovereign states facing common planetary challenges.`,
    establishmentReason: `The creation of ${code} was driven by the imperative to establish dedicated institutional machinery capable of addressing specialized dimensions of international affairs that transcended the unilateral competence of individual nation-states. It was chartered to provide legal standards, operational frameworks, and collective policy consensus across sovereign borders.`,
    purpose: `${mandate} Operating as an authoritative ${category.toLowerCase()}, it formulates strategic policy recommendations, oversees multilateral compliance standards, coordinates international technical assistance, and drives structured dialogue between member state delegations.`,
    internationalSignificance: `As a recognized multilateral institution, ${code} commands significant normative and operational authority across the international community. Its treaties, resolutions, and technical guidelines shape state behavior, guide bilateral and multilateral agreements, and establish global best practices adhered to by sovereign governments and non-state actors alike.`,
    evolution: `Since its establishment in ${est}, ${code} has continually adapted its operational doctrines to navigate major geopolitical shifts—from early cold-war dynamics and rapid decolonization to contemporary digital transformation, cross-border sustainability crises, and multipolar diplomatic architectures.`,
    globalGovernanceRole: `Within the contemporary global governance architecture, ${code} serves as an indispensable pillar of international cooperation. It prevents unilateral diplomatic fragmentation, bridges regional and sovereign divides, harmonizes international standards, and aligns nation-states under shared commitments to multilateral peace and sustainable progress.`,

    // Governance & Operational Mechanics
    membershipStructure: `Composed of accredited sovereign Member States and designated permanent observers accredited to ${name}, organized in compliance with its governing charter and procedural statutes.`,
    permanentTiers: `Operates on the foundation of sovereign equality under its founding convention, ensuring accredited member states hold institutional standing in legislative deliberations.`,
    isTierApplicable: false,
    votingArrangements: `Decisions are adopted under established parliamentary rules of procedure. Standard technical and administrative measures are decided by simple majority of accredited delegations present and voting, while substantive statutory changes or conventions require a qualified two-thirds majority or consensus.`,
    leadershipStructure: `Directed by an executive bureau comprising an elected President or Chair, supported by Vice-Chairs representing geographical regional groups and an executive Secretariat administering day-to-day operations.`,
    decisionProcedures: `Deliberations proceed through formal sessions, plenary debates, and working group consultations. Draft texts and conventions are negotiated through diplomatic consensus before final submission for roll-call voting or adoption without a vote.`,
    relevantBodies: `Standing committees, specialized technical working groups, administrative bureaus, and intergovernmental advisory panels designated under its founding statutes.`
  };
}
