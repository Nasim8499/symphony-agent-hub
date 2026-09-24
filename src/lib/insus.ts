export const INSUS = {
  name: "INSUS Manpower Solution",
  slogan: "Your Trusted Partner",
  description:
    "বাংলাদেশ থেকে বিশ্বজুড়ে কাজের সুযোগ ও ভিসা প্রসেসিংয়ের এক বিশ্বস্ত ঠিকানা। অস্ট্রেলিয়া, ইউরোপ এবং মধ্যপ্রাচ্যের শীর্ষস্থানীয় কোম্পানিগুলোর সাথে সরাসরি পার্টনারশিপ এবং কমপ্লায়েন্স মেনে কাজ করা হয়।",
  address: "হাউজ #০৯ (লিফট-৫), রোড #০৮, ব্লক-জে, বারিধারা, ভাটারা, ঢাকা-১২১২",
  phone: "01339-303961",
  phoneIntl: "+8801339303961",
  email: "contact@insusmanpowersolution.com",
  web: "www.insusmanpowersolution.com",
  webUrl: "https://www.insusmanpowersolution.com",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Road+8+Block+J+Baridhara+Bhatara+Dhaka+1212",
} as const;

const SIGNATURE = `${INSUS.name} — ${INSUS.slogan}\nPhone: ${INSUS.phone} | Email: ${INSUS.email} | Web: ${INSUS.web}`;

export type WorkCountry = { id: string; name: string; flag: string; region: string; sources: string; assessment: string };

export const WORK_COUNTRIES: WorkCountry[] = [
  { id: "australia", name: "Australia", flag: "🇦🇺", region: "Oceania", sources: "immi.homeaffairs.gov.au (Skills in Demand 482, 494, 186), ImmiAccount", assessment: "Trades Recognition Australia (tradesrecognitionaustralia.gov.au) / VETASSESS; English via IELTS or PTE" },
  { id: "serbia", name: "Serbia", flag: "🇷🇸", region: "Europe", sources: "mup.gov.rs (single work & residence permit), nsz.gov.rs (National Employment Service), euprava.gov.rs; Serbian embassy accredited to Bangladesh (New Delhi)", assessment: "Employer-sponsored; verify qualification recognition and any trade test required by the employer" },
  { id: "russia", name: "Russia", flag: "🇷🇺", region: "Europe", sources: "Ministry of Internal Affairs (мвд.рф / GUVM), Russian Embassy in Dhaka (bangladesh.mid.ru), employer invitation (work visa)", assessment: "Employer invitation + work permit; check Russian language/history test and medical requirements" },
  { id: "turkey", name: "Turkey", flag: "🇹🇷", region: "Europe / Asia", sources: "Ministry of Labour work permit e-İzin (csgb.gov.tr), Turkish Embassy Dhaka, visa.mfa.gov.tr", assessment: "Employer applies for work permit; check vocational competence (MYK) certificate for regulated trades" },
  { id: "singapore", name: "Singapore", flag: "🇸🇬", region: "Asia", sources: "mom.gov.sg (Work Permit, S Pass), approved training/testing centres in Bangladesh", assessment: "Construction workers need BCA skills test (CoreTrade/SEC(K)) at approved overseas testing centres" },
  { id: "malaysia", name: "Malaysia", flag: "🇲🇾", region: "Asia", sources: "imi.gov.my, esd.imi.gov.my, FWCMS, Malaysian High Commission Dhaka, BMET (bmet.gov.bd)", assessment: "Employer quota approval (JTK); FOMEMA/medical and BMET clearance" },
  { id: "saudi", name: "Saudi Arabia", flag: "🇸🇦", region: "Middle East", sources: "visa.mofa.gov.sa (Enjaz), qiwa.sa, musaned.com.sa, Skill Verification Program (svp-international.pacc.sa)", assessment: "Takamol Skill Verification Program (SVP) test for listed professions; GAMCA medical" },
  { id: "bahrain", name: "Bahrain", flag: "🇧🇭", region: "Middle East", sources: "lmra.gov.bh (Labour Market Regulatory Authority), evisa.gov.bh", assessment: "Employer applies via LMRA; GAMCA medical" },
];

export const JOB_CATEGORIES = [
  "Construction Worker", "Welder", "Electrician", "Plumber", "Carpenter", "Mason", "Heavy Driver", "Light Driver", "Caregiver", "Nurse",
  "Hospitality / Hotel Staff", "Chef / Cook", "Farm / Agriculture Worker", "Factory Worker", "Cleaner", "Security Guard", "Warehouse Worker", "IT Professional", "Engineer", "Other",
];

export type Candidate = {
  fullName: string;
  passportNumber: string;
  dob: string;
  phone: string;
  email: string;
  category: string;
  experienceYears: string;
  education: string;
  englishLevel: string;
  notes: string;
};

export function workPermitPrompt(countryId: string, c: Candidate, actions: { requirements: boolean; checklist: boolean; assessment: boolean; jobs: boolean }) {
  const country = WORK_COUNTRIES.find((x) => x.id === countryId) ?? WORK_COUNTRIES[0];
  const steps: string[] = [];
  if (actions.requirements) steps.push(`Research the CURRENT official work permit / employment visa pathway for a Bangladeshi national working as "${c.category}" in ${country.name}. Official sources to use: ${country.sources}. Capture eligibility, fees (local currency + approx. USD), processing time and the official links.`);
  if (actions.checklist) steps.push(`Generate a personalised document checklist for this candidate (passport validity, photos, educational & experience certificates, police clearance, medical/GAMCA if applicable, BMET emigration clearance / smart card from bmet.gov.bd, employer documents). Mark each item as "have / need / verify" based on the profile.`);
  if (actions.assessment) steps.push(`Identify the required skill assessment / trade test for "${c.category}" in ${country.name} (${country.assessment}). Find the nearest testing centre accessible from Bangladesh, its booking link and fee.`);
  if (actions.jobs) steps.push(`Search official employment portals and reputable job boards in ${country.name} for up to 5 current openings for "${c.category}" that sponsor foreign workers. Include employer, city, salary if shown and URL.`);

  return `You are the INSUS Manpower Solution work-permit & employment visa engine.

Candidate profile (intake):
- Name: ${c.fullName || "(not provided)"}
- Passport No.: ${c.passportNumber || "(not provided)"}
- Date of birth: ${c.dob || "(not provided)"}
- Trade / category: ${c.category}
- Experience: ${c.experienceYears || "0"} years
- Education: ${c.education || "(not provided)"}
- English level: ${c.englishLevel || "(not provided)"}
- Notes: ${c.notes || "—"}
Target country: ${country.flag} ${country.name}

Tasks:
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Rules: use official government sources first; never pay fees or submit an application; if a portal requires login, captcha or payment, stop and report what a human must do.
Deliverable: a clear candidate assessment report with sections — Eligibility verdict, Pathway & fees, Document checklist, Skill assessment, Openings (if requested), Next actions for the INSUS case officer.`;
}

export const VISITOR_DESTINATIONS = [
  { id: "schengen", name: "Schengen (Europe)", portal: "VFS Global Bangladesh (visa.vfsglobal.com/bgd) and the relevant embassy website" },
  { id: "uk", name: "United Kingdom", portal: "gov.uk/standard-visitor-visa and the UKVI application portal" },
  { id: "usa", name: "United States", portal: "ceac.state.gov (DS-160) and ais.usvisa-info.com appointment system" },
  { id: "canada", name: "Canada", portal: "IRCC online portal (canada.ca/visitor-visa)" },
  { id: "australia", name: "Australia", portal: "ImmiAccount — Visitor visa subclass 600 (immi.homeaffairs.gov.au)" },
  { id: "japan", name: "Japan", portal: "Embassy of Japan in Bangladesh (bd.emb-japan.go.jp) and approved agencies" },
  { id: "malaysia", name: "Malaysia", portal: "malaysiavisa.imi.gov.my (eVisa)" },
  { id: "singapore", name: "Singapore", portal: "ICA (ica.gov.sg) via authorised visa agents" },
  { id: "thailand", name: "Thailand", portal: "thaievisa.go.th (Thai e-Visa)" },
  { id: "turkey", name: "Turkey", portal: "evisa.gov.tr / Turkish Embassy Dhaka" },
  { id: "uae", name: "United Arab Emirates", portal: "icp.gov.ae / GDRFA Dubai (via airline or sponsor)" },
  { id: "saudi", name: "Saudi Arabia", portal: "visa.visitsaudi.com / visa.mofa.gov.sa" },
];

export function visitorPrompt(
  destId: string,
  a: { fullName: string; passportNumber: string; travelFrom: string; travelTo: string; purpose: string; employment: string; notes: string },
  modes: { checklist: boolean; prefill: boolean; slots: boolean; submit: boolean },
) {
  const d = VISITOR_DESTINATIONS.find((x) => x.id === destId) ?? VISITOR_DESTINATIONS[0];
  const steps: string[] = [];
  if (modes.checklist) steps.push(`Generate the official, up-to-date document checklist for a Bangladeshi applicant's ${d.name} visitor/tourist visa (purpose: ${a.purpose}). Include financial proof requirements, bank statement period, invitation/hotel/flight reservation rules, fees and processing time with official links.`);
  if (modes.prefill) steps.push(`Open the official application form on ${d.portal} and pre-fill every field you can with the applicant data below. Do NOT submit. Stop at the review page and summarise which fields still need human input.`);
  if (modes.slots) steps.push(`Check the nearest available biometric / interview appointment slots in Dhaka for ${d.name} and report the earliest dates and booking steps.`);
  if (modes.submit) steps.push(`The applicant has authorised submission. Proceed to the final submission step ONLY if no payment card, OTP or signature is needed; otherwise stop and hand control to the human operator (live takeover) and describe exactly what is pending.`);
  return `You are the INSUS Manpower Solution visitor & tourist visa automator.

Applicant:
- Name: ${a.fullName || "(not provided)"}
- Passport No.: ${a.passportNumber || "(not provided)"} (Bangladeshi)
- Travel dates: ${a.travelFrom || "?"} → ${a.travelTo || "?"}
- Purpose: ${a.purpose}
- Occupation / employer: ${a.employment || "(not provided)"}
- Notes: ${a.notes || "—"}
Destination: ${d.name} — official portal: ${d.portal}

Tasks:
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Rules: official sources only; never enter payment card details; never fabricate applicant data — leave unknown fields blank and list them.
Deliverable: checklist table, form status (fields filled / pending), appointment info, and next actions for the INSUS officer.`;
}

export const RESIDENCY_ENTITIES: Record<"serbia" | "russia", { id: string; label: string }[]> = {
  serbia: [
    { id: "doo", label: "DOO — Limited liability company" },
    { id: "preduzetnik", label: "Preduzetnik — Sole entrepreneur" },
  ],
  russia: [
    { id: "ooo", label: "OOO — Limited liability company" },
    { id: "ip", label: "IP — Individual entrepreneur" },
  ],
};

export function residencyPrompt(
  country: "serbia" | "russia",
  f: { founderName: string; passportNumber: string; entity: string; activity: string; capital: string; city: string; employees: string; notes: string },
  tasks: { registry: boolean; residence: boolean; banking: boolean; costPlan: boolean },
) {
  const isSerbia = country === "serbia";
  const entity = RESIDENCY_ENTITIES[country].find((e) => e.id === f.entity)?.label ?? f.entity;
  const steps: string[] = [];
  if (tasks.registry)
    steps.push(
      isSerbia
        ? `Research company registration of a "${entity}" in Serbia on the Serbian Business Registers Agency (apr.gov.rs): required documents for a foreign (Bangladeshi) founder, minimum capital, registered address, activity code for "${f.activity}", fees and timeline.`
        : `Research registration of an "${entity}" in Russia via the Federal Tax Service (nalog.gov.ru): required documents for a foreign (Bangladeshi) founder, charter capital, legal address, OKVED code for "${f.activity}", state duty and timeline.`,
    );
  if (tasks.residence)
    steps.push(
      isSerbia
        ? `Research temporary residence in Serbia on the basis of company ownership / self-employment via the Ministry of Interior (mup.gov.rs) and the single work & residence permit: eligibility, documents, fees, validity and renewal.`
        : `Research how a foreign founder/director can legally reside and work in Russia (e.g. work permit as director, Highly Qualified Specialist route, temporary residence permit) via the Ministry of Internal Affairs (мвд.рф). Summarise requirements, fees and timelines.`,
    );
  if (tasks.banking) steps.push(`Find the requirements for a non-resident founder to open a corporate bank account in ${isSerbia ? "Serbia" : "Russia"} (2–3 major banks) and any in-person presence rules.`);
  if (tasks.costPlan) steps.push(`Produce a step-by-step self-sponsorship plan with an estimated total cost (local currency + USD) and a realistic timeline from Bangladesh.`);
  return `You are the INSUS Manpower Solution business residency & self-sponsorship workflow.

Founder:
- Name: ${f.founderName || "(not provided)"}
- Passport No.: ${f.passportNumber || "(not provided)"} (Bangladeshi)
- Country: ${isSerbia ? "🇷🇸 Serbia" : "🇷🇺 Russia"} — preferred city: ${f.city || "any"}
- Entity type: ${entity}
- Business activity: ${f.activity || "(not provided)"}
- Planned capital: ${f.capital || "(not provided)"}
- Planned local employees: ${f.employees || "0"}
- Notes: ${f.notes || "—"}

Tasks:
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Rules: official government registries and ministries first; cite every link; do not submit anything or pay.
Deliverable: Registry checklist, Residency pathway, Banking notes, Cost & timeline table, Risks/compliance notes, Next actions for the INSUS officer.`;
}

export function trackingPrompt(
  t: { clientName: string; clientEmail: string; flightNumber: string; flightDate: string; from: string; to: string; destinationCountry: string; notes: string },
  opts: { flight: boolean; clearance: boolean; email: boolean },
) {
  const steps: string[] = [];
  if (opts.flight) steps.push(`Check the live status of flight ${t.flightNumber || "(not provided)"} on ${t.flightDate || "today"} (${t.from} → ${t.to}) using the airline's official website plus FlightAware or Flightradar24. Report scheduled vs. estimated departure/arrival, gate/terminal, delays and any cancellation.`);
  if (opts.clearance) steps.push(`Airport clearance assistance: list what the traveller must have at Hazrat Shahjalal International Airport (DAC) departure immigration as an overseas worker — BMET emigration clearance / smart card (bmet.gov.bd), valid visa, work contract, medical — and the arrival/immigration requirements for ${t.destinationCountry || t.to}. Flag anything time-sensitive.`);
  if (opts.email)
    steps.push(
      t.clientEmail
        ? `Using your AgentMail inbox, send a concise, professional status update email to ${t.clientEmail} addressed to ${t.clientName || "the client"}. Subject: "Travel status update – ${t.flightNumber || "your flight"} – INSUS Manpower Solution". Include flight status, key times, clearance reminders and next steps. Sign off with:\n${SIGNATURE}`
        : `No client email was provided — draft (do not send) the status email text instead.`,
    );
  return `You are the INSUS Manpower Solution end-to-end onboarding & tracking monitor.

Traveller / client: ${t.clientName || "(not provided)"} ${t.clientEmail ? `<${t.clientEmail}>` : ""}
Flight: ${t.flightNumber || "(not provided)"} on ${t.flightDate || "(date not provided)"} — ${t.from} → ${t.to}
Destination country: ${t.destinationCountry || "(not provided)"}
Notes: ${t.notes || "—"}

Tasks:
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Deliverable: a short status report — Flight status, Clearance checklist, Email sent (yes/no + recipient), Alerts for the INSUS officer.`;
}
