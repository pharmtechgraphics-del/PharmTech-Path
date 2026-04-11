import { useState, useCallback, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence, sendPasswordResetEmail, deleteUser } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, increment } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "pharmtech-path.firebaseapp.com",
  projectId: "pharmtech-path",
  storageBucket: "pharmtech-path.firebasestorage.app",
  messagingSenderId: "644485599873",
  appId: "1:644485599873:web:43db9494de7d05185eb380",
  measurementId: "G-BLE75YJQT3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

async function loadUserData(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

async function saveUserData(uid, data) {
  try {
    await setDoc(doc(db, "users", uid), data, { merge: true });
  } catch {}
}

// ─── Track login date (once per calendar day) ────────────────────────────────
async function recordLoginDate(uid) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : {};
    const loginDates = data.loginDates || [];
    if (!loginDates.includes(today)) {
      await setDoc(doc(db, "users", uid), {
        loginDates: [...loginDates, today],
        lastLogin: today,
      }, { merge: true });
    }
  } catch {}
}

// ─── Track AI session (once per session trigger) ─────────────────────────────
async function recordAISession(uid) {
  try {
    await setDoc(doc(db, "users", uid), {
      aiSessionCount: increment(1),
      lastAISession: new Date().toISOString().split("T")[0],
    }, { merge: true });
  } catch {}
}


const JOB_TITLES = [
  // ── RETAIL PHARMACY ────────────────────────────────────────────────────────
  {
    id: "jt1",
    title: "Staff Pharmacy Technician",
    setting: "Retail Pharmacy",
    settingTag: "Retail",
    experienceLevel: "Entry Level",
    description: "Fill and dispense prescriptions, process insurance claims, manage inventory and support patients at the counter. This is where most techs begin and where core skills are built.",
    requirement: "State registration or licensure. No prior experience required in most states.",
    unique: "Direct daily patient interaction across a wide range of medications and conditions.",
  },
  {
    id: "jt2",
    title: "Lead Pharmacy Technician",
    setting: "Retail Pharmacy",
    settingTag: "Retail",
    experienceLevel: "Mid Level",
    description: "Oversee daily workflow, support and train newer techs and act as the point person when the pharmacist needs backup on operations.",
    requirement: "Requires CPhT.",
    unique: "Your leadership directly impacts how smoothly the entire pharmacy runs.",
  },
  {
    id: "jt3",
    title: "Pharmacy Supervisor",
    setting: "Retail Pharmacy",
    settingTag: "Retail",
    experienceLevel: "Advanced",
    description: "Manage a team of technicians, handle scheduling, performance reviews and ensure the pharmacy meets compliance standards.",
    requirement: "Often requires CPhT plus 3 to 5 years of experience.",
    unique: "This is where pharmacy transitions from clinical to operational leadership.",
  },
  {
    id: "jt4",
    title: "Controlled Substance Lead Technician",
    setting: "Retail Pharmacy",
    settingTag: "Retail",
    experienceLevel: "Mid to Advanced",
    description: "Manage DEA compliance, oversee controlled substance counts, investigate discrepancies and maintain audit-ready records.",
    requirement: "Requires CPhT and strong attention to regulatory detail.",
    unique: "One of the most critical compliance roles in any pharmacy setting.",
  },
  // ── HOSPITAL AND INPATIENT ─────────────────────────────────────────────────
  {
    id: "jt5",
    title: "Inpatient Pharmacy Technician",
    setting: "Hospital and Inpatient",
    settingTag: "Hospital",
    experienceLevel: "Entry Level",
    description: "Prepare and distribute medications across hospital units, restock automated dispensing cabinets and support pharmacists with order verification.",
    requirement: "State registration or licensure. Prior experience helpful but not always required.",
    unique: "Fast-paced environment with direct impact on patient care outcomes.",
  },
  {
    id: "jt6",
    title: "IV Sterile Compounding Technician",
    setting: "Hospital and Inpatient",
    settingTag: "Hospital",
    experienceLevel: "Mid Level",
    description: "Prepare sterile intravenous medications in a cleanroom environment following strict USP 797 and 800 guidelines. Requires additional training and certification.",
    requirement: "CPhT with USP 797/800 training. CSPT credential strongly preferred.",
    unique: "High precision, regulated work that directly touches critically ill patients.",
  },
  {
    id: "jt7",
    title: "Medication History Technician",
    setting: "Hospital and Inpatient",
    settingTag: "Hospital",
    experienceLevel: "Mid Level",
    description: "Obtain and document accurate medication histories for patients during hospital admission, reducing errors at transitions of care. Requires strong clinical communication skills.",
    requirement: "CPhT with inpatient experience and strong documentation skills.",
    unique: "You are often the first line of defense against harmful drug interactions.",
  },
  {
    id: "jt8",
    title: "Pharmacy Informatics Technician",
    setting: "Hospital and Inpatient",
    settingTag: "Hospital",
    experienceLevel: "Advanced",
    description: "Work at the intersection of pharmacy and health information technology, managing data systems, supporting EHR implementation and optimizing medication workflows.",
    requirement: "Requires CPhT-Adv or equivalent experience.",
    unique: "One of the few tech roles that sits at the leadership and technology table.",
  },
  // ── SPECIALTY PHARMACY ─────────────────────────────────────────────────────
  {
    id: "jt9",
    title: "Specialty Pharmacy Technician",
    setting: "Specialty Pharmacy",
    settingTag: "Specialty",
    experienceLevel: "Mid Level",
    description: "Manage complex, high-cost medications for patients with chronic or rare conditions. Handle prior authorizations, patient follow-ups and specialty drug logistics.",
    requirement: "Requires CPhT.",
    unique: "Deep relationships with patients on life-changing therapies.",
  },
  {
    id: "jt10",
    title: "Prior Authorization Technician",
    setting: "Specialty Pharmacy",
    settingTag: "Specialty",
    experienceLevel: "Mid Level",
    description: "Coordinate and process prior authorization requests, work directly with payers and providers and ensure patients get timely access to their medications.",
    requirement: "Requires CPhT and insurance knowledge.",
    unique: "You are the tech fighting for the patient when insurance says no.",
  },
  {
    id: "jt11",
    title: "Patient Care Coordinator Technician",
    setting: "Specialty Pharmacy",
    settingTag: "Specialty",
    experienceLevel: "Mid to Advanced",
    description: "Act as the bridge between patients, providers and the pharmacy, managing adherence, benefit verification and access programs for complex medication therapies.",
    requirement: "CPhT with specialty or clinical pharmacy experience.",
    unique: "One of the most patient-facing non-dispensing roles available to a tech.",
  },
  // ── PBM AND INSURANCE ──────────────────────────────────────────────────────
  {
    id: "jt12",
    title: "PBM Claims Technician",
    setting: "PBM and Insurance",
    settingTag: "PBM",
    experienceLevel: "Entry to Mid Level",
    description: "Process and audit prescription drug benefit claims, ensure accurate billing and support plan members with coverage questions.",
    requirement: "Requires CPhT.",
    unique: "Fully office or remote-based. No dispensing counter required.",
  },
  {
    id: "jt13",
    title: "Prior Authorization Analyst",
    setting: "PBM and Insurance",
    settingTag: "PBM",
    experienceLevel: "Mid to Advanced",
    description: "Review PA requests using clinical criteria, work within PBM platforms and support pharmacists in approving or escalating cases.",
    requirement: "Requires CPhT and familiarity with formulary management.",
    unique: "Analytical role with real influence over which medications patients access.",
  },
  {
    id: "jt14",
    title: "Pharmacy Audit Analyst",
    setting: "PBM and Insurance",
    settingTag: "PBM",
    experienceLevel: "Advanced",
    description: "Review claims data for billing accuracy, identify compliance issues and support internal or external audits.",
    requirement: "Requires CPhT plus experience in billing and regulatory standards.",
    unique: "One of the highest-paying non-clinical paths available to an experienced tech.",
  },
  // ── COMPOUNDING PHARMACY ───────────────────────────────────────────────────
  {
    id: "jt15",
    title: "Compounding Pharmacy Technician",
    setting: "Compounding Pharmacy",
    settingTag: "Compounding",
    experienceLevel: "Mid Level",
    description: "Prepare customized medications tailored to individual patient needs, including topical creams, oral suspensions and suppositories.",
    requirement: "Requires training in USP 795 non-sterile compounding.",
    unique: "Hands-on, science-forward work where every prescription is one of a kind.",
  },
  {
    id: "jt16",
    title: "Sterile Compounding Specialist",
    setting: "Compounding Pharmacy",
    settingTag: "Compounding",
    experienceLevel: "Advanced",
    description: "Prepare sterile compounded products including injections and ophthalmic preparations in a certified cleanroom.",
    requirement: "Requires USP 797 compliance training. CSPT or BCSCPT preferred.",
    unique: "Highly specialized, regulated and in growing demand across hospital and outsourcing facilities.",
  },
  // ── MAIL ORDER PHARMACY ────────────────────────────────────────────────────
  {
    id: "jt17",
    title: "Mail Order Pharmacy Technician",
    setting: "Mail Order Pharmacy",
    settingTag: "Mail Order",
    experienceLevel: "Entry to Mid Level",
    description: "Process and verify high volumes of prescription orders for home delivery, support automated dispensing systems and manage refill coordination.",
    requirement: "State registration or licensure. CPhT preferred.",
    unique: "Structured workflow, often remote-friendly and consistent volume.",
  },
  {
    id: "jt18",
    title: "Pharmacy Operations Technician",
    setting: "Mail Order Pharmacy",
    settingTag: "Mail Order",
    experienceLevel: "Mid Level",
    description: "Support the backend of a mail order or central fill operation, managing workflow queues, quality checks and fulfillment accuracy at scale.",
    requirement: "CPhT with operations or high-volume dispensing experience.",
    unique: "Process-driven role that suits techs who thrive in systems-level thinking.",
  },
  // ── LONG TERM CARE ─────────────────────────────────────────────────────────
  {
    id: "jt19",
    title: "Long Term Care Pharmacy Technician",
    setting: "Long Term Care",
    settingTag: "LTC",
    experienceLevel: "Mid Level",
    description: "Prepare and package medications for nursing homes and assisted living facilities, manage complex blister pack or unit-dose systems and coordinate with consulting pharmacists and care teams.",
    requirement: "CPhT with LTC or institutional pharmacy experience preferred.",
    unique: "Every patient is on multiple medications and accuracy is non-negotiable.",
  },
  {
    id: "jt20",
    title: "Medication Packaging Technician",
    setting: "Long Term Care",
    settingTag: "LTC",
    experienceLevel: "Entry to Mid Level",
    description: "Specialize in unit-dose and multi-dose packaging for LTC patients, maintaining detailed records and ensuring timely delivery to facilities.",
    requirement: "State registration or licensure. CPhT preferred.",
    unique: "Detail-oriented, documentation-heavy and a strong entry point into LTC pharmacy operations.",
  },
  // ── AMBULATORY AND CLINIC ──────────────────────────────────────────────────
  {
    id: "jt21",
    title: "Ambulatory Care Pharmacy Technician",
    setting: "Ambulatory and Clinic",
    settingTag: "Ambulatory",
    experienceLevel: "Mid Level",
    description: "Support pharmacists in an outpatient clinic setting, assisting with medication therapy management, refill authorizations and patient education support.",
    requirement: "CPhT with outpatient or clinical pharmacy experience.",
    unique: "Collaborative clinical environment working alongside physicians and nurses daily.",
  },
  {
    id: "jt22",
    title: "Medication Access Coordinator",
    setting: "Ambulatory and Clinic",
    settingTag: "Ambulatory",
    experienceLevel: "Mid to Advanced",
    description: "Help patients in clinic settings navigate prior authorizations, patient assistance programs and insurance appeals to reduce barriers to medication access.",
    requirement: "CPhT with experience in PA processing and insurance navigation.",
    unique: "Advocacy-focused role that directly reduces health disparities for underserved patients.",
  },
  {
    id: "jt23",
    title: "Medication Reconciliation Technician",
    setting: "Ambulatory and Clinic",
    settingTag: "Ambulatory",
    experienceLevel: "Mid Level",
    description: "Review and reconcile patient medication lists across care transitions, supporting accuracy in clinical documentation and reducing the risk of adverse events.",
    requirement: "CPhT with clinical documentation experience.",
    unique: "A growing hospital-adjacent role with direct patient safety impact.",
  },
  // ── LEADERSHIP AND ADMINISTRATIVE PATHWAYS ─────────────────────────────────
  {
    id: "jt24",
    title: "Medication Safety Technician",
    setting: "Hospital and Health Systems",
    settingTag: "Leadership",
    experienceLevel: "Advanced",
    description: "Identify, track and analyze medication errors and near-misses, lead root cause analyses and help build systems that prevent future harm.",
    requirement: "Requires CPhT-Adv.",
    unique: "Your floor experience becomes the foundation for protecting every patient in the building.",
    isLeadership: true,
  },
  {
    id: "jt25",
    title: "Pharmacy Quality Assurance Technician",
    setting: "Hospital and Health Systems",
    settingTag: "Leadership",
    experienceLevel: "Advanced",
    description: "Monitor and audit pharmacy operations for compliance with USP standards, regulatory requirements and internal quality benchmarks. Lead continuous quality improvement projects.",
    requirement: "Requires CPhT and quality improvement training.",
    unique: "A tech role that sits at the intersection of compliance, data and operational leadership.",
    isLeadership: true,
  },
  {
    id: "jt26",
    title: "CQI Coordinator",
    setting: "Retail, Health Systems, Specialty",
    settingTag: "Leadership",
    experienceLevel: "Mid to Advanced",
    description: "Manage the pharmacy's continuous quality improvement program, track error trends, coordinate reporting and support the team in building a culture of safety.",
    requirement: "Requires CPhT and strong analytical skills.",
    unique: "One of the few tech roles where your direct influence reaches the entire pharmacy team.",
    isLeadership: true,
  },
  {
    id: "jt27",
    title: "Pharmacy Compliance and Regulatory Technician",
    setting: "Hospital and Health Systems",
    settingTag: "Leadership",
    experienceLevel: "Advanced",
    description: "Ensure the pharmacy meets DEA, state board, USP and accreditation requirements. Support internal audits, maintain documentation and help prepare for inspections.",
    requirement: "Requires CPhT-Adv.",
    unique: "High-stakes, detail-driven work that protects the pharmacy's license to operate.",
    isLeadership: true,
  },
  {
    id: "jt28",
    title: "Performance Improvement Specialist",
    setting: "Health Systems",
    settingTag: "Leadership",
    experienceLevel: "Advanced",
    description: "Analyze pharmacy workflow data, identify inefficiencies and design process improvements.",
    requirement: "Requires CPhT-Adv and experience with quality methodologies like Lean or Six Sigma.",
    unique: "One of the highest-visibility roles a tech can hold without leaving pharmacy practice.",
    isLeadership: true,
  },
  {
    id: "jt29",
    title: "Pharmacy Informatics and Data Analyst Technician",
    setting: "Hospital and Health Systems",
    settingTag: "Leadership",
    experienceLevel: "Advanced",
    description: "Manage medication data systems, support EHR optimization and use analytics to improve clinical and operational outcomes. Works closely with IT, pharmacists and hospital leadership.",
    requirement: "Requires CPhT-Adv.",
    unique: "The only tech role where your daily work directly shapes how the entire organization uses medication data.",
    isLeadership: true,
  },
  {
    id: "jt30",
    title: "Pharmacy Technician Educator",
    setting: "Academic and Health Systems",
    settingTag: "Leadership",
    experienceLevel: "Advanced",
    description: "Train and mentor pharmacy technician students or new hires in academic programs or employer-based settings. Develop curriculum, assess competency and model professional standards.",
    requirement: "Requires CPhT with 3+ years of experience. CPTEd credential from PTCB recommended.",
    unique: "You shape the next generation of pharmacy technicians — your knowledge multiplies.",
    isLeadership: true,
  },
];

const JOB_SETTINGS = [
  "All Settings",
  "Retail Pharmacy",
  "Hospital and Inpatient",
  "Specialty Pharmacy",
  "PBM and Insurance",
  "Compounding Pharmacy",
  "Mail Order Pharmacy",
  "Long Term Care",
  "Ambulatory and Clinic",
  "Leadership and Admin",
];

const JOB_LEVELS = [
  "All Levels",
  "Entry Level",
  "Entry to Mid Level",
  "Mid Level",
  "Mid to Advanced",
  "Advanced",
];

function PharmacyJobTitles({ isPro, go }) {
  const [settingFilter, setSettingFilter] = useState("All Settings");
  const [levelFilter, setLevelFilter] = useState("All Levels");

  const teal = "#00c9a7";
  const tealDim = "rgba(0,201,167,0.12)";
  const tealBorder = "rgba(0,201,167,0.25)";
  const blue = "#0094ff";
  const mu = "#8b92a9";
  const sf = "rgba(255,255,255,0.04)";
  const br = "rgba(255,255,255,0.09)";
  const white = "#ffffff";
  const gold = "#f59e0b";

  if (!isPro) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: white, marginBottom: 8 }}>
          Pharmacy Tech Job Titles
        </div>
        <div style={{ fontSize: 13, color: mu, marginBottom: 20, maxWidth: 380, margin: "0 auto 20px", lineHeight: 1.7 }}>
          Explore 30 pharmacy technician job titles across 8 practice settings plus leadership and administrative pathways. Pro only.
        </div>
        <button
          onClick={() => go("upgrade")}
          style={{ background: `linear-gradient(135deg,${teal},${blue})`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          Upgrade to Pro →
        </button>
      </div>
    );
  }

  const filteredTitles = JOB_TITLES.filter(t => {
    const matchesSetting =
      settingFilter === "All Settings" ||
      (settingFilter === "Leadership and Admin" && t.isLeadership) ||
      (settingFilter !== "Leadership and Admin" && t.setting === settingFilter && !t.isLeadership);
    const matchesLevel = levelFilter === "All Levels" || t.experienceLevel === levelFilter;
    return matchesSetting && matchesLevel;
  });

  const standardTitles = filteredTitles.filter(t => !t.isLeadership);
  const leadershipTitles = filteredTitles.filter(t => t.isLeadership);

  const settingColors = {
    "Retail": teal,
    "Hospital": blue,
    "Specialty": "#a855f7",
    "PBM": "#f59e0b",
    "Compounding": "#ec4899",
    "Mail Order": "#22d3ee",
    "LTC": "#10b981",
    "Ambulatory": "#6366f1",
    "Leadership": gold,
  };

  const levelColors = {
    "Entry Level": "#4ade80",
    "Entry to Mid Level": "#22d3ee",
    "Mid Level": teal,
    "Mid to Advanced": blue,
    "Advanced": "#a855f7",
  };

  const TagChip = ({ label, color }) => (
    <span
      onClick={() => {
        const shortMap = {
          "Retail": "Retail Pharmacy",
          "Hospital": "Hospital and Inpatient",
          "Specialty": "Specialty Pharmacy",
          "PBM": "PBM and Insurance",
          "Compounding": "Compounding Pharmacy",
          "Mail Order": "Mail Order Pharmacy",
          "LTC": "Long Term Care",
          "Ambulatory": "Ambulatory and Clinic",
          "Leadership": "Leadership and Admin",
        };
        if (shortMap[label]) setSettingFilter(shortMap[label]);
      }}
      style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}44`, borderRadius: 20, padding: "2px 9px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace", cursor: "pointer" }}
      title="Click to filter by this setting"
    >
      {label}
    </span>
  );

  const LevelChip = ({ label }) => {
    const color = levelColors[label] || mu;
    return (
      <span onClick={() => setLevelFilter(label)} style={{ display: "inline-block", fontSize: 10, fontWeight: 600, color, background: color + "12", border: `1px solid ${color}30`, borderRadius: 20, padding: "2px 9px", letterSpacing: "0.05em", cursor: "pointer", fontFamily: "monospace" }} title="Click to filter by this level">
        {label}
      </span>
    );
  };

  const JobCard = ({ job }) => (
    <div style={{ background: job.isLeadership ? "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(168,85,247,0.04))" : sf, border: job.isLeadership ? "1px solid rgba(245,158,11,0.2)" : `1px solid ${br}`, borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <TagChip label={job.settingTag} color={settingColors[job.settingTag] || teal} />
        <LevelChip label={job.experienceLevel} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: white, lineHeight: 1.3 }}>{job.title}</div>
      <div style={{ fontSize: 13, color: "#c8cdd8", lineHeight: 1.7 }}>{job.description}</div>
      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${br}`, borderRadius: 9, padding: "9px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: teal, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: 4 }}>Certification / Experience</div>
        <div style={{ fontSize: 12, color: "#c8cdd8", lineHeight: 1.6 }}>{job.requirement}</div>
      </div>
      <div style={{ borderLeft: `3px solid ${job.isLeadership ? gold : teal}`, paddingLeft: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: job.isLeadership ? gold : teal, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: 3 }}>What Makes It Unique</div>
        <div style={{ fontSize: 12, color: "#d8dce8", lineHeight: 1.6, fontStyle: "italic" }}>{job.unique}</div>
      </div>
      <div style={{ fontSize: 10, color: "rgba(139,146,169,0.7)", lineHeight: 1.5, marginTop: 2 }}>Titles and requirements vary by employer and state.</div>
    </div>
  );

  const activeFilters = settingFilter !== "All Settings" || levelFilter !== "All Levels";

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: teal, background: tealDim, border: `1px solid ${tealBorder}`, borderRadius: 20, padding: "2px 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>Pro Feature</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: white, margin: "0 0 6px", lineHeight: 1.3 }}>Pharmacy Tech Job Titles</h2>
        <p style={{ fontSize: 13, color: mu, margin: 0, lineHeight: 1.6 }}>30 titles across 8 practice settings plus leadership and administrative pathways.</p>
      </div>

      {/* Page-level disclaimer — soft yellow info banner */}
      <div style={{ background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.35)", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
        <p style={{ fontSize: 12, color: "rgba(245,220,130,0.9)", lineHeight: 1.75, margin: 0 }}>
          Job titles, descriptions and requirements listed here are for general informational purposes only. Actual titles, responsibilities, compensation and qualifications vary by employer, organization, state and setting. PharmTech Path does not guarantee accuracy for any specific position or employer.
        </p>
      </div>

      {/* Setting filter */}
      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: mu, fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>Practice Setting</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {JOB_SETTINGS.map(s => (
              <button key={s} onClick={() => setSettingFilter(s)} style={{ background: settingFilter === s ? "rgba(0,201,167,0.15)" : sf, color: settingFilter === s ? teal : mu, border: settingFilter === s ? `1px solid rgba(0,201,167,0.4)` : `1px solid ${br}`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{s}</button>
            ))}
          </div>
        </div>
        {/* Level filter */}
        <div>
          <div style={{ fontSize: 11, color: mu, fontWeight: 600, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.08em" }}>Experience Level</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {JOB_LEVELS.map(l => (
              <button key={l} onClick={() => setLevelFilter(l)} style={{ background: levelFilter === l ? "rgba(0,201,167,0.15)" : sf, color: levelFilter === l ? teal : mu, border: levelFilter === l ? `1px solid rgba(0,201,167,0.4)` : `1px solid ${br}`, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{l}</button>
            ))}
          </div>
        </div>
        {activeFilters && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: mu }}>Showing {filteredTitles.length} of {JOB_TITLES.length} titles</span>
            <button onClick={() => { setSettingFilter("All Settings"); setLevelFilter("All Levels"); }} style={{ background: "none", border: "none", color: teal, fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Clear filters</button>
          </div>
        )}
      </div>

      {filteredTitles.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: mu }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: white, marginBottom: 6 }}>No titles match those filters</div>
          <button onClick={() => { setSettingFilter("All Settings"); setLevelFilter("All Levels"); }} style={{ background: tealDim, border: `1px solid ${tealBorder}`, color: teal, borderRadius: 9, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Clear filters</button>
        </div>
      )}

      {standardTitles.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {standardTitles.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>
      )}

      {leadershipTitles.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {/* Leadership section header — styled differently from practice settings */}
          <div style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(168,85,247,0.07))", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👑</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: white, marginBottom: 4 }}>Leadership and Administrative Pathways</div>
                <div style={{ fontSize: 12, color: "rgba(245,220,130,0.8)", lineHeight: 1.6, maxWidth: 600 }}>
                  These roles go beyond the dispensing counter. They are where experienced techs with strong credentials move into healthcare leadership, operations and systems-level work.
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {leadershipTitles.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        </div>
      )}
    </div>
  );
}


const RESOURCES = [
  { name:"PTCB", full:"Pharmacy Technician Certification Board", url:"https://www.ptcb.org", desc:"Primary national CPhT certification & advanced credentials", color:"#1a8fa8", cat:"Certification" },
  { name:"NHA",  full:"National Healthcareer Association", url:"https://www.nhanow.com", desc:"ExCPT certification — widely accepted nationally", color:"#2e9d68", cat:"Certification" },
  { name:"BPS",  full:"Board of Pharmacy Specialties", url:"https://www.bpsweb.org", desc:"Specialty certifications for advanced practice", color:"#4a7fc1", cat:"Certification" },
  { name:"BPTS", full:"Board of Pharmacy Technician Specialties", url:"https://bpts.org", desc:"Advanced certifications including CPhT-Adv, BCSCPT, BCHCPT & specialty certificates for pharmacy technicians", color:"#1a6fa8", cat:"Certification" },
  { name:"ACPE", full:"Accreditation Council for Pharmacy Education", url:"https://www.acpe-accredit.org", desc:"Pharmacy program accreditation & CE standards", color:"#27ae60", cat:"Education" },
  { name:"ASHP", full:"American Society of Health-System Pharmacists", url:"https://www.ashp.org", desc:"Hospital pharmacy training, residencies & advocacy", color:"#8e44ad", cat:"Professional Org" },
  { name:"NPTA", full:"National Pharmacy Technician Association", url:"https://www.pharmacytechnician.org", desc:"CE credits, community & technician advocacy", color:"#c0392b", cat:"Professional Org" },
  { name:"APhA", full:"American Pharmacists Association", url:"https://www.pharmacist.com", desc:"CE, career development & pharmacy resources", color:"#d35400", cat:"Professional Org" },
  { name:"PharmTech Society", full:"Pharmacy Technician Society", url:"https://www.pharmtechsociety.org", desc:"Professional community and resources for pharmacy technicians", color:"#2e7d52", cat:"Professional Org" },
  { name:"NABP", full:"National Association of Boards of Pharmacy", url:"https://nabp.pharmacy", desc:"Licensure, accreditation & pharmacy law standards", color:"#6c3483", cat:"Regulatory" },
  { name:"FDA",  full:"U.S. Food & Drug Administration", url:"https://www.fda.gov/drugs", desc:"Drug approvals, safety alerts & recalls", color:"#a93226", cat:"Regulatory" },
  { name:"DEA",  full:"Drug Enforcement Administration", url:"https://www.deadiversion.usdoj.gov", desc:"Controlled substance regulations & schedules", color:"#922b21", cat:"Regulatory" },
  { name:"PCAB", full:"Pharmacy Compounding Accreditation Board", url:"https://www.pcabaccreditation.org", desc:"Compounding pharmacy standards & accreditation", color:"#2471a3", cat:"Specialty" },
  { name:"ISMP", full:"Institute for Safe Medication Practices", url:"https://www.ismp.org", desc:"Medication safety alerts & error prevention tools", color:"#117a65", cat:"Safety" },
  { name:"MedlinePlus", full:"MedlinePlus Drug Information (NIH)", url:"https://medlineplus.gov/druginfo", desc:"Free NIH drug database", color:"#1f618d", cat:"Reference" },
  { name:"DailyMed", full:"DailyMed — Official FDA Drug Labels", url:"https://dailymed.nlm.nih.gov", desc:"Official FDA drug label database, free access", color:"#0e6655", cat:"Reference" },
];

const FREE_SECTIONS = [
  { id:"explore", title:"Explore Pharmacy", icon:"🔬", desc:"Discover what pharmacy technicians actually do every day",
    modules:[
      { id:"m1", title:"What Pharmacy Technicians Actually Do", lessons:[
        {
          id:"l1",
          title:"The Role Is Bigger Than It Looks",
          sections:[
            {
              header:"WHAT NOBODY TELLS YOU AT ORIENTATION",
              body:"Most people walk into their first pharmacy job thinking the role is about filling prescriptions and ringing up customers. That is what the job looks like from the outside. It is not what the job actually is.\n\nPharmacy is complex, structured, and regulated. It operates inside a chain of safety where every person, including you, holds a specific and critical position. What you do every shift either protects that chain or creates a gap in it.\n\nAnd here is the part nobody says out loud: you do not need a doctorate or a master's degree to do meaningful, high-impact work in this profession. Techs influence patient safety, workflow stability, regulatory compliance, and operational outcomes every single day. That starts on day one, whether you know it or not."
            },
            {
              header:"WHAT YOU ACTUALLY ARE",
              body:"Behind the counter, pharmacy technicians function as five things simultaneously: workflow stabilizers, documentation protectors, process enforcers, inventory managers, and safety checkpoints.\n\nWhen you stabilize workflow, the pharmacy runs. When you protect documentation, the pharmacy is defensible. When you enforce process, errors get caught. When you manage inventory, patients get what they need. When you function as a safety checkpoint, harm gets prevented before it reaches anyone.\n\nThat is not a support role. That is infrastructure."
            }
          ],
          keyPoints:[
            "Pharmacy is a regulated system, not just a service counter",
            "Your role functions across five critical areas simultaneously",
            "You do not need an advanced degree to make a meaningful impact",
            "Every action you take either protects or weakens the chain of safety",
            "Understanding your role is the first step toward advancing beyond it"
          ],
          takeaway:"The counter is where you start. It is not where your career ends.",
          selfCheck:{
            prompt:"When you think about your role in the pharmacy, which of these sounds most like you right now?",
            options:[
              {
                label:"I focus on doing my tasks correctly and efficiently. I know my job and I do it well.",
                response:"You have built a solid foundation. Start asking yourself why each task exists, not just how to do it. That shift separates good techs from indispensable ones."
              },
              {
                label:"I think about how my work connects to everything else, patient safety, workflow, compliance.",
                response:"You are already operating at a higher level. Make sure that awareness is visible. Document what you notice. Speak up when you see patterns."
              },
              {
                label:"I am starting to see the bigger picture but I am not sure how to act on it yet.",
                response:"This is exactly where PharmTech Path is designed to meet you. You have the instincts. Keep going."
              }
            ]
          },
          scenario:{
            setup:"You are three weeks into a new retail position. A patient comes in frustrated because their prescription has been rejected twice this week. You process it, fix the insurance issue, and the patient leaves satisfied. Your pharmacist moves on. The line keeps moving.",
            prompt:"What is the difference between a tech who closes that interaction and moves on, and a tech who does something more with it?"
          },
          answer:{
            recommended:"The tech who closes and moves on did the job. The tech who does something more writes it down, the rejection type, the medication, the date, and later mentions to the pharmacist that this is the second time this week. That second tech is functioning as a safety checkpoint and a workflow stabilizer at the same time. Same interaction. Completely different value to the pharmacy."
          },
          connection:{
            tag:"Senior Tech · Lead Tech · Pharmacy Supervisor · Medication Safety Tech",
            aiPrompt:"I just completed the lesson The Role Is Bigger Than It Looks in the Explore Pharmacy module. Help me understand how to start seeing my current role through a bigger lens based on my background."
          }
        },
        {
          id:"l2",
          title:"Retail vs Inpatient — Same Foundation, Different Pace",
          sections:[
            {
              header:"SAME KNOWLEDGE, DIFFERENT WORLD",
              body:"If you have ever looked at a hospital pharmacy job posting and thought you would not even know where to start, you are not alone. But here is what does not change: the knowledge you built in retail comes with you.\n\nIn retail, patients call with questions about their medications. In inpatient, replace the patients with nurses and providers. Same communication skill, different audience. In retail, you fill and sell a prescription. In inpatient, you deliver that medication to a floor or restock a Pyxis. Same accuracy requirement, different delivery point. The foundation is identical. The application shifts."
            },
            {
              header:"UNDERSTANDING THE TWO ENVIRONMENTS",
              body:"Retail is visible and fast. You manage intake, insurance processing, patient expectations, phone calls, inventory gaps, and controlled substance documentation, often all at the same time.\n\nInpatient is quieter but more system driven. You work within automated dispensing systems, manage cart fills, coordinate restocking, handle delivery, and maintain controlled substance accountability. Your patients are the nurses and providers relying on you to have the right medication in the right place at the right time."
            }
          ],
          keyPoints:[
            "Retail and inpatient require the same foundational knowledge applied differently",
            "Your audience shifts from patients to nurses and providers in inpatient settings",
            "Filling and selling becomes delivering and restocking",
            "Both environments demand accuracy, documentation and composure",
            "Understanding both settings makes you a more versatile and valuable tech"
          ],
          takeaway:"You are not starting over. You are transferring what you already know into a new environment.",
          selfCheck:{
            prompt:"Which of these best describes where you are right now?",
            options:[
              {
                label:"I work in retail and inpatient feels completely foreign to me. I would not know where to start.",
                response:"The transition is less of a leap than it looks. Your insurance knowledge, your controlled substance awareness, your communication skills, all of it transfers."
              },
              {
                label:"I work in inpatient and I feel like I left a lot of retail knowledge behind when I made the switch.",
                response:"Nothing you learned in retail disappeared. Those skills are still active in a hospital environment."
              },
              {
                label:"I have experience in both and I can see how the skills carry over.",
                response:"That cross-setting experience is genuinely valuable for leadership, training, and systems-level roles."
              }
            ]
          },
          scenario:{
            setup:"A retail tech with three years of experience applies for an inpatient position. During the interview she is asked how her retail background prepared her for hospital pharmacy. She freezes because she assumed the two settings had nothing in common.",
            prompt:"What should she have said, and what does that tell you about how you should be thinking about your own experience?"
          },
          answer:{
            recommended:"She should have said that retail pharmacy built her foundation in accuracy under pressure, insurance and documentation processes, controlled substance handling, and patient communication. Every year of retail experience is transferable. The tech who understands that walks into any setting with confidence."
          },
          connection:{
            tag:"Inpatient Pharmacy Tech · Medication History Tech · Pharmacy Informatics Tech · Controlled Substance Tech",
            aiPrompt:"I just completed the lesson Retail vs Inpatient in the Explore Pharmacy module. Help me understand how my current experience translates to a different pharmacy setting."
          }
        },
        {
          id:"l3",
          title:"The Technician Mindset",
          sections:[
            {
              header:"THE MOMENT IT CLICKS",
              body:"There is a moment most strong techs can point to. It is the day they realized that what they do actually matters beyond the task itself. For some it happens when they catch an expired medication in an ADS restock. For others it happens when they notice a flaw in a workflow and instead of accepting it, they start thinking about how to fix it. The technician mindset is not about working harder. It is about seeing more clearly."
            },
            {
              header:"THREE PILLARS OF A STRONG TECH",
              body:"The first is accuracy before speed. A fast mistake is worse than a slow correction. The second is ask before assuming. Pharmacy has no room for guesswork. The third is document clearly. If it is not documented, it did not happen."
            }
          ],
          keyPoints:[
            "The technician mindset is about seeing your work inside a larger system",
            "Accuracy before speed protects patients and builds long term efficiency",
            "Asking before assuming is professional judgment, not a weakness",
            "Clear documentation protects everyone including you",
            "Noticing problems and thinking toward solutions is how techs advance"
          ],
          takeaway:"The tech who pays attention to the small things is the one the whole team relies on.",
          selfCheck:{
            prompt:"Which of these sounds most like how you currently approach your work?",
            options:[
              {
                label:"I focus on getting through my tasks accurately and on time. I do what is expected and I do it well.",
                response:"Start with one shift where you ask yourself why each task exists. That single question changes how you see everything."
              },
              {
                label:"I pay attention to patterns, ask questions when something feels off, and document everything thoroughly.",
                response:"Make it visible. Document what you notice. Let your awareness translate into action that other people can see."
              },
              {
                label:"I know I should be more aware but the pace of the shift makes it hard to slow down and notice things.",
                response:"Awareness is not about slowing down. It is about what you notice while you keep moving."
              }
            ]
          },
          scenario:{
            setup:"You are restocking an ADS on a busy afternoon. You notice two vials are close to their expiration date but still technically within range.",
            prompt:"Do you pull them or leave them? And why does your answer matter beyond this one moment?"
          },
          answer:{
            recommended:"Pull them and replace them with newer stock. The nurse waiting behind you is not a reason to skip a safety step. The tech who makes that call consistently is the tech the team learns to trust."
          },
          firstWeekChecklist:[
            "Learn the physical layout of your pharmacy and any connected units",
            "Identify who to escalate to and how to reach them quickly",
            "Observe workflow before jumping in, understand the rhythm first",
            "Ask about controlled substance processes specific to your facility",
            "Write down abbreviations, system names, and terms you do not recognize yet"
          ],
          connection:{
            tag:"Senior Tech · Lead Tech · Pharmacy Supervisor · Controlled Substance Tech · Medication Safety Tech",
            aiPrompt:"I just completed the lesson The Technician Mindset in the Explore Pharmacy module. Help me identify specific ways I can build stronger awareness and documentation habits in my current role."
          }
        },   
        ]},
      { id:"m2", title:"Workflow 101", lessons:[
        {
          id:"l4",
          title:"Retail Workflow Deep Dive",
          sections:[
            {
              header:"THE CYCLE THAT NEVER STOPS",
              body:"Retail pharmacy runs on a continuous loop: intake, data entry, insurance adjudication, filling, pharmacist verification, and pickup. When a step gets rushed or skipped, the break almost never stays contained to the step where it happened."
            },
            {
              header:"WHERE BREAKDOWNS ACTUALLY START",
              body:"Two steps cause more downstream problems than any other: data entry and insurance adjudication. Data entry errors move forward silently and create pharmacist rework and patient safety risk. Insurance rejections require a resolved status before the patient is given a pickup time. Do not close an interaction until you know what the actual status is."
            },
            {
              header:"BREAKDOWNS AND HOW TO HANDLE THEM",
              body:"Incorrect insurance entry gets corrected at the source. Missing prescriber details require a call to the office. Prior authorization delays get escalated to the pharmacist. The strong move is to identify where the breakdown is, communicate it clearly, and escalate when the fix is outside your scope."
            }
          ],
          keyPoints:[
            "Retail workflow is a continuous six-step cycle where every step depends on the one before it",
            "Data entry errors move forward silently and create pharmacist rework and patient safety risk",
            "Insurance rejections require a resolved status before the patient is given a pickup time",
            "Most entry mistakes happen during multitasking or when rushing under pressure",
            "Identifying the breakdown point and escalating appropriately is a senior skill"
          ],
          takeaway:"A fast mistake costs more time than a slow correction.",
          selfCheck:{
            prompt:"Which of these sounds most like how you handle the retail workflow right now?",
            options:[
              {
                label:"I move through the queue as efficiently as I can. Sometimes I circle back to fix things but I keep the line moving.",
                response:"The data entry and insurance steps are the ones worth slowing down for. One mistake at either creates more time loss than the seconds you saved."
              },
              {
                label:"I slow down at the high-risk steps because I know a mistake there costs more time than doing it right.",
                response:"The techs who understand where the risk lives in a workflow are the ones who become the go-to person."
              },
              {
                label:"I am still learning which steps are high risk and which ones are okay to move through quickly.",
                response:"Watch data entry and insurance adjudication most closely first. Build your awareness there and expand outward."
              }
            ]
          },
          scenario:{
            setup:"A patient drops off a prescription and leaves to run errands. You enter it and hit a refill too soon rejection. The pharmacist is on the phone and the line is backing up.",
            prompt:"What do you do, and what is the cost of getting this wrong?"
          },
          answer:{
            recommended:"Do not assume the rejection will clear. Check the fill history to confirm when the last fill was dispensed. Note the date they will be eligible. The cost of getting this wrong is a patient who made plans around a pickup time you should not have confirmed."
          },
          connection:{
            tag:"Lead Tech · Pharmacy Supervisor · Prior Authorization Tech · Controlled Substance Tech",
            aiPrompt:"I just completed the lesson Retail Workflow Deep Dive in the Explore Pharmacy module. Help me understand how to identify breakdown points in my current retail workflow and escalate more effectively."
          }
        },
        {
          id:"l5",
          title:"Inpatient Workflow Deep Dive",
          sections:[
            {
              header:"FIRST THINGS FIRST",
              body:"In inpatient pharmacy, you can sit down. Retail techs who make the switch consistently say the physical environment alone feels like a different profession. No counter. No line of patients. No phones ringing with insurance questions every four minutes."
            },
            {
              header:"MORE THAN JUST FILLING",
              body:"Inpatient techs inventory, restock, refill, and in many states perform tech check tech. They handle narcotics with a level of accountability and documentation rigor that goes beyond most retail settings. They work directly with nurses and providers and are treated as clinical support staff. The variety of medications in an inpatient setting compared to retail is significant."
            },
            {
              header:"HOW INPATIENT FLOW WORKS",
              body:"Provider order entry kicks off the process. The pharmacist verifies the order. ADS units on patient floors hold commonly used medications that techs restock and maintain. Cart fills ensure patient-specific medications are prepared and delivered on schedule. Your work is largely invisible to patients but directly felt by the clinical team."
            }
          ],
          keyPoints:[
            "Inpatient pharmacy involves a significantly broader scope of responsibilities than most retail roles",
            "Tech check tech represents a higher level of peer accountability where available",
            "The drug variety in inpatient settings is substantially greater than in retail",
            "Your work directly supports nurses and providers who depend on accurate and timely medication access",
            "Inpatient techs are treated as clinical support staff and the role carries that level of respect"
          ],
          takeaway:"In inpatient pharmacy you are not just filling medications. You are keeping the clinical team moving.",
          selfCheck:{
            prompt:"Which of these best describes where you are with inpatient pharmacy right now?",
            options:[
              {
                label:"It sounds completely different from what I do now and I am not sure my skills would transfer.",
                response:"Your skills transfer more directly than you think. What changes is the environment and the workflow structure. That is learnable."
              },
              {
                label:"I work in inpatient already and I recognize everything described here from my own experience.",
                response:"Document your experience and use it to build toward the next level. Your scope of work is a resume in itself."
              },
              {
                label:"I have been curious about inpatient but I did not realize the scope was this broad.",
                response:"Inpatient opens doors to tech check tech certification, informatics roles, medication safety positions, and controlled substance leadership."
              }
            ]
          },
          scenario:{
            setup:"You are restocking a Pyxis unit. A nurse says a medication she needed was not in the cabinet when she pulled for her patient an hour ago. The patient's dose was delayed.",
            prompt:"What questions should you be asking yourself after this interaction?"
          },
          answer:{
            recommended:"Was that medication on my restock list and did I miss it? Was it out of stock and did I communicate that? Is there a par level issue to flag? A delayed dose is a patient care event. Your role in that Pyxis restock is part of the care chain."
          },
          connection:{
            tag:"Inpatient Pharmacy Tech · Medication History Tech · Pharmacy Informatics Tech · Controlled Substance Tech",
            aiPrompt:"I just completed the lesson Inpatient Workflow Deep Dive in the Explore Pharmacy module. Help me understand how my current experience translates into an inpatient setting and what I should focus on to prepare."
          }
        },
        {
          id:"l6",
          title:"Error Prevention",
          sections:[
            {
              header:"THE FAMILIARITY TRAP",
              body:"Most medication errors happen because someone thought they knew exactly what they were doing. Similar drug names and similar packaging trip up experienced techs just as often as new ones. The reason is familiarity. When you have filled the same medications hundreds of times, your brain stops fully reading and starts pattern matching. That is how the wrong medication gets filled."
            },
            {
              header:"WHY ERRORS HAPPEN",
              body:"Errors most commonly occur because of five conditions: distraction, similar drug names, similar packaging, multitasking, and fatigue. Understanding why errors happen is not about assigning blame. It is about building habits that work even when conditions are not ideal."
            },
            {
              header:"BUILDING HABITS THAT HOLD",
              body:"The techs with the lowest error rates are the most habitual. Pause before finalizing any entry. Read labels fully. Confirm quantities. Clarify unclear handwriting or order detail before moving forward. These are not extra steps. They are the steps."
            }
          ],
          keyPoints:[
            "Similar drug names and similar packaging cause errors in experienced techs just as often as new ones",
            "Familiarity breeds assumption and assumption is where errors live",
            "Distraction, multitasking and fatigue are environmental realities that require habitual responses",
            "Low error rates come from consistent habits, not talent",
            "Clarifying before processing is always faster than correcting after a mistake"
          ],
          takeaway:"The tech who reads every label like it is the first time they have seen it is the tech who catches what everyone else misses.",
          selfCheck:{
            prompt:"Which of these sounds most like how you approach familiar medications?",
            options:[
              {
                label:"I move through familiar medications quickly because I know what they look like. It saves time.",
                response:"Familiarity is not accuracy. Read the full label even on medications you have filled a hundred times."
              },
              {
                label:"I treat every fill the same way regardless of how familiar the medication is. I read the full label every time.",
                response:"That consistency is rare. Keep that habit and teach it to everyone around you."
              },
              {
                label:"I know I should slow down on familiar fills but the pace of the shift makes it hard to be consistent.",
                response:"Start with one category of high-risk medications and build the full read habit there first."
              }
            ]
          },
          scenario:{
            setup:"You are restocking a Pyxis unit. You reach for what looks like the right vial based on label color and shape. As you are about to scan it you notice the concentration is different from what is normally stocked there.",
            prompt:"Do you stop or do you assume it is fine because everything else looked right?"
          },
          answer:{
            recommended:"You stop. Always. A different concentration is not a minor variation. Concentration errors are among the most serious medication errors in inpatient settings. It takes ten seconds to confirm the right concentration. It takes significantly longer to manage the consequences of stocking the wrong one."
          },
          errorPreventionHabits:[
            "Pause before finalizing any entry",
            "Read labels fully, not just the first word",
            "Confirm quantities against the prescription or order before filling",
            "Clarify any unclear handwriting or order detail before processing",
            "",
            "",
            "",
            "",
            ""
          ],
          connection:{
            tag:"Lead Tech · Senior Tech · Pharmacy Supervisor · Medication Safety Tech · Controlled Substance Tech",
            aiPrompt:"I just completed the lesson Error Prevention in the Explore Pharmacy module. Help me build specific error prevention habits for my current work environment based on my background."
          }
        },
      ]},
     { id:"m3", title:"Safety & Law Basics", lessons:[
        {
          id:"l7",
          title:"Why Regulation Exists",
          sections:[
            {
              header:"RULES ARE NOT ARBITRARY",
              body:"Every rule in pharmacy exists because something went wrong before it was written. Regulations are not bureaucratic inconvenience. They are the documented response to real harm that reached real patients."
            },
            {
              header:"WHAT HAPPENS WHEN REGULATION GETS TREATED AS A CHECKLIST",
              body:"The most common consequence is a medication error. Wrong drug. Wrong dose. Wrong quantity. Expired medication. A narcotic discrepancy with legal and regulatory consequences. There is also a second consequence: when a pharmacist over-trusts a tech, they may not scrutinize each check as carefully as they should. That means when the tech misses something, the last safety checkpoint in the entire system is also at risk."
            },
            {
              header:"WHAT REGULATION ACTUALLY PROTECTS",
              body:"Medications can harm, interact, be misused, and be diverted. Regulation protects patients, staff, institutions, and licenses. Documentation is not paperwork. Documentation is the evidence that the chain of safety held."
            }
          ],
          keyPoints:[
            "Every pharmacy regulation exists because real harm happened before it was written",
            "Going through the motions creates medication errors and narcotic discrepancies",
            "A pharmacist who over-trusts a tech may not catch what the tech missed",
            "Regulation protects patients, staff, institutions and professional licenses",
            "Documentation is evidence that the chain of safety held"
          ],
          takeaway:"Following the rules is not the minimum requirement. It is the foundation everything else is built on.",
          selfCheck:{
            prompt:"Which of these sounds most like how you currently relate to pharmacy regulations?",
            options:[
              {
                label:"I follow the rules because I am required to. I do not always think about why they exist.",
                response:"The next time you complete a regulatory task, ask yourself what would happen if this step did not exist."
              },
              {
                label:"I understand why each requirement exists and that understanding changes how seriously I take it.",
                response:"That level of understanding separates a tech who follows rules from a tech who upholds standards."
              },
              {
                label:"I am still learning which rules are high stakes and which ones are more routine.",
                response:"Any step involving a controlled substance, patient identity, expiration date, or documentation entry is high stakes."
              }
            ]
          },
          scenario:{
            setup:"You are doing a routine narcotic count at the end of your shift and the numbers do not reconcile. You are tired, the count is only off by one, and the oncoming tech is waiting.",
            prompt:"What do you do, and why does it matter beyond this one count?"
          },
          answer:{
            recommended:"You report it and document it immediately. You do not assume it is a documentation error, you do not fix it quietly, and you do not pass it to the next shift without flagging it. The discomfort of holding up the shift handoff is not comparable to the risk of letting an unresolved discrepancy move forward undocumented."
          },
          connection:{
            tag:"Controlled Substance Tech · Pharmacy Compliance and Regulatory Tech · Medication Safety Tech · Pharmacy Quality Assurance Tech",
            aiPrompt:"I just completed the lesson Why Regulation Exists in the Explore Pharmacy module. Help me understand how to think about regulatory requirements in my current role as more than a checklist."
          }
        },
        {
          id:"l8",
          title:"Controlled Substance Awareness",
          sections:[
            {
              header:"BEFORE YOU EVER TOUCH ONE",
              body:"Most mistakes can be fixed. The majority of controlled substance discrepancies that techs create are reconcilable if you come forward immediately. The techs who create the most serious problems are the ones who knew something was off and said nothing. If something feels wrong, say it out loud right away."
            },
            {
              header:"WHAT YOUR ROLE ACTUALLY INCLUDES",
              body:"Your role includes accurate documentation, following storage protocols, maintaining count awareness, and reporting discrepancies the moment you identify them. Your role does not include independent clinical judgment, interpreting policy on your own, or overriding established processes. If something feels off, escalate. Every time."
            },
            {
              header:"WHEN IT CANNOT BE FIXED",
              body:"Some discrepancies cannot be resolved. When a controlled substance discrepancy cannot be reconciled, the consequences are not administrative. They are legal. A DEA investigation. Loss of your certification. Criminal liability. These are real outcomes. The standard is simple: take your time, verify what you are doing, and know why you are doing it."
            }
          ],
          keyPoints:[
            "Most controlled substance mistakes can be fixed if you report them immediately",
            "Silence after a discrepancy is almost always worse than the discrepancy itself",
            "Your role includes documentation, storage, counts and reporting, not clinical judgment",
            "Carelessness with controlled substances can result in legal consequences that cannot be undone",
            "Taking your time and knowing why you are doing each step is your best protection"
          ],
          takeaway:"A mistake you report is a problem that can be solved. A mistake you hide is a problem that grows.",
          selfCheck:{
            prompt:"Which of these sounds most like how you currently approach controlled substances?",
            options:[
              {
                label:"I am intimidated by them and tend to avoid asking questions because I do not want to seem incompetent.",
                response:"Ask questions. Every question you ask now is a discrepancy you prevent later."
              },
              {
                label:"I handle them carefully and know that if something goes wrong my first move is to report it immediately.",
                response:"That combination of care and transparency is exactly right."
              },
              {
                label:"I have gotten comfortable with the routine but sometimes move through the steps faster than I should.",
                response:"The routine steps with controlled substances are the ones most worth slowing down for."
              }
            ]
          },
          scenario:{
            setup:"You are completing a controlled substance count and the numbers are off by two units. Your controlled substance lead is still on site.",
            prompt:"What do you do right now, and what is the cost of waiting until tomorrow?"
          },
          answer:{
            recommended:"You go to your controlled substance lead right now. Tell them exactly what you found, what you think may have caused it, and what steps you already retraced. The cost of waiting is that the window for resolution narrows. Coming forward immediately keeps a fixable problem fixable."
          },
          connection:{
            tag:"Controlled Substance Tech · Pharmacy Compliance and Regulatory Tech · Medication Safety Tech · Pharmacy Quality Assurance Tech",
            aiPrompt:"I just completed the lesson Controlled Substance Awareness in the Explore Pharmacy module. Based on my background, help me understand what strong controlled substance habits look like in my current setting."
          }
        },
        {
          id:"l9",
          title:"Escalation as a Strength",
          sections:[
            {
              header:"THE REAL REASON TECHS DO NOT ESCALATE",
              body:"The real reason is culture. In retail and inpatient settings alike, there are pharmacists and technicians who respond to questions with impatience or hostility. If you were met with an attitude early in your career when you asked questions, you learned that asking is unsafe. That lesson is wrong. But it is completely understandable."
            },
            {
              header:"WHAT ESCALATION ACTUALLY IS",
              body:"Escalation is the correct professional response to a situation that requires more authority, more information, or more expertise than your current role provides. The tech who escalates consistently understands exactly where their role ends and where the next level of accountability begins. That clarity is a professional skill."
            },
            {
              header:"PROTECTING YOURSELF IN ANY CULTURE",
              body:"If you escalate and the response is an attitude, that is a reflection of the person who responded. Document what you escalated and when. Ask your question anyway. The patient on the other end of your decision does not know what the culture in your pharmacy feels like. They just need the right medication."
            }
          ],
          keyPoints:[
            "Workplace culture is the most common real reason techs do not escalate",
            "Being met with hostility when asking questions teaches the wrong lesson",
            "Escalation is the correct professional response to situations outside your scope",
            "Counts, documentation conflicts, unclear orders and conflicting patient information all require escalation",
            "Escalating consistently, even in difficult cultures, builds a professional reputation that follows you"
          ],
          takeaway:"The tech who asks the uncomfortable question is the one who prevents the serious error.",
          selfCheck:{
            prompt:"Which of these sounds most like how you currently handle situations that might need escalation?",
            options:[
              {
                label:"I avoid escalating when I can because I do not want to seem like I cannot handle things.",
                response:"Identify one category of situation where you know you should escalate and commit to doing it every time."
              },
              {
                label:"I escalate when something is outside my scope and I do not let the reaction change that.",
                response:"That combination of clarity and consistency is exactly what strong pharmacy practice looks like."
              },
              {
                label:"I want to escalate more but the culture in my pharmacy makes it feel risky.",
                response:"Your obligation to the patient does not change because of the culture around you. Document your escalations. Ask anyway."
              }
            ]
          },
          scenario:{
            setup:"You are working a shift with a pharmacist who has a reputation for being short with techs. You are filling an order and the dose seems higher than expected. You are not certain enough to feel comfortable moving forward.",
            prompt:"What do you do, and what do you tell yourself if the response you get is not a kind one?"
          },
          answer:{
            recommended:"You ask anyway. The pharmacist still has to answer the question because the question is clinically valid. The culture of a pharmacy does not change what the right action is. It only changes how uncomfortable the right action feels. Do it anyway."
          },
          connection:{
            tag:"Controlled Substance Tech · Pharmacy Compliance and Regulatory Tech · Medication Safety Tech · Pharmacy Quality Assurance Tech",
            aiPrompt:"I just completed the lesson Escalation as a Strength in the Explore Pharmacy module. Help me build confidence around escalating in my current work environment based on my background."
          }
        },
      ]},
      { id:"m4", title:"Communication Under Pressure", lessons:[
        {
          id:"l10",
          title:"Retail Communication Framework",
          sections:[
            {
              header:"THE REALITY OF RETAIL COMMUNICATION",
              body:"Retail pharmacy is where patients are often at their most frustrated. And sometimes that frustration comes out as anger directed at you. The mistake many techs make is not recognizing frustration building inside themselves until it suddenly overflows. A tech who is naturally quiet can absorb a lot of verbal frustration. And then one interaction triggers a response that does not feel like them. That moment usually comes after a long accumulation of smaller moments."
            },
            {
              header:"THE COMMUNICATION FRAMEWORK",
              body:"When a patient is frustrated, there is a structure that works: acknowledge, clarify, set expectation.\n\nAcknowledge means you recognize the patient's frustration without over-apologizing. Clarify means you identify the actual problem. Set expectation means you tell the patient exactly what comes next and when with specific information, not vague promises."
            }
          ],
          keyPoints:[
            "Frustration in retail techs often builds silently before it suddenly shows",
            "Verbal abuse from patients is real and it accumulates over time",
            "The acknowledge, clarify, set expectation framework gives you structure when emotions are high",
            "Acknowledgment without over-apologizing de-escalates most patient situations",
            "Clarity and specific expectations remove the uncertainty that fuels frustration"
          ],
          takeaway:"Staying calm is not about being nice. It is about staying in control of the interaction instead of letting frustration control you.",
          selfCheck:{
            prompt:"Which of these sounds most like how you handle frustrated patients right now?",
            options:[
              {
                label:"I stay quiet and absorb the frustration without showing how it affects me, but sometimes it builds up internally.",
                response:"The risk is that frustration is accumulating silently. Start recognizing the early signs: tension, faster breathing, shorter responses."
              },
              {
                label:"I use a framework to acknowledge and clarify before jumping to solutions, and I manage my own frustration in the moment.",
                response:"That structure is what separates techs who last in retail from techs who burn out."
              },
              {
                label:"I recognize I am getting frustrated but I struggle to keep my voice and tone steady when patients are being difficult.",
                response:"Verbal abuse is real. If you are noticing your frustration showing, it might be time to talk to your lead or recognize that retail may not be the right fit long term. Neither is a failure."
              }
            ]
          },
          scenario:{
            setup:"A patient comes to the counter angry because their prescription was rejected. You have already had three similar interactions that shift and you can feel frustration rising.",
            prompt:"What do you do in the first ten seconds that prevents frustration from showing in your response?"
          },
          answer:{
            recommended:"You pause. Literally pause. Take a breath. Then you acknowledge: I can see you are frustrated. Let me find out exactly what happened with your prescription. That pause lets your nervous system reset instead of escalate."
          },
          communicationScript:{
            title:"Retail Communication Framework",
            lines:[
              "Acknowledge: I can see this is frustrating.",
              "Clarify: Your prescription was rejected for [specific reason]. Let me [specific action].",
              "Set Expectation: You should expect [specific outcome] by [specific time].",
              "Example: I can see you are frustrated. Your insurance rejected this because you filled it too recently. I am going to call your insurance right now to see if an override is possible. You should hear back from me within fifteen minutes."
            ]
          },
          connection:{
            tag:"Lead Tech · Pharmacy Supervisor · Customer Service Tech · Patient Experience Tech",
            aiPrompt:"I just completed the lesson Retail Communication Framework in the Explore Pharmacy module. Help me practice the acknowledge, clarify, set expectation framework for difficult patient interactions in my current setting."
          }
        },
        {
          id:"l11",
          title:"Inpatient Communication Framework",
          sections:[
            {
              header:"THE ROOT OF INPATIENT MISCOMMUNICATION",
              body:"Inpatient communication breaks down most often because of assumptions. A nurse calls expecting a certain process based on how her unit handles things. A tech responds based on how they have handled similar requests before. But that tech might be used to a different unit with different workflows. Nobody asks. Nobody verifies. Both people assume the other knows what they mean."
            },
            {
              header:"HOW INPATIENT COMMUNICATION WORKS",
              body:"The framework has four parts: listen fully, confirm what you heard, clarify any assumptions, and communicate your timeline. Listen fully means you do not interrupt. Confirm means you repeat back what they told you. Clarify means you ask the specific questions that prevent miscommunication. Communicate your timeline means you give them a specific answer about when they can expect resolution."
            }
          ],
          keyPoints:[
            "Inpatient miscommunication usually comes from assumptions, not unclear speaking",
            "Two people can think they understand each other and be operating from completely different assumptions",
            "Different units have different workflows and what works on one floor may not work on another",
            "Confirming and clarifying takes thirty seconds and prevents delays and errors",
            "Specific timelines remove uncertainty and build trust with clinical staff"
          ],
          takeaway:"The nurse who knows exactly when her medication will arrive is less frustrated than the nurse who is left wondering.",
          selfCheck:{
            prompt:"Which of these sounds most like how you handle clinical communication right now?",
            options:[
              {
                label:"I handle requests based on my standard process and assume the caller understands how pharmacy works.",
                response:"Start adding one clarifying question to each clinical call: Do you need this urgently or is standard timeline okay?"
              },
              {
                label:"I listen to the full request, confirm what I heard, and clarify any details that might affect how I handle it.",
                response:"Clinical staff learns to rely on you. You are the tech they call first because they know you will get it right."
              },
              {
                label:"I answer questions but sometimes realize afterward that my understanding did not match what the caller expected.",
                response:"Next time you finish a clinical call, ask yourself: do I know exactly what they need and when? If not, call back and clarify."
              }
            ]
          },
          scenario:{
            setup:"A nurse calls from a floor you do not usually cover. She asks about a medication and seems to assume you already know her unit's protocol for urgent requests.",
            prompt:"What do you say, and how do you make sure you both leave the conversation with the same understanding?"
          },
          answer:{
            recommended:"Say: I want to make sure I handle this correctly for your unit. Can you tell me if this is urgent or standard timeline? And what is your usual process when you need something escalated quickly? Then confirm back: So what I am hearing is you need this within thirty minutes and if there is a delay I should call the charge nurse directly. Is that right?"
          },
          communicationScript:{
            title:"Inpatient Communication Framework",
            lines:[
              "Listen fully. Do not interrupt. Do not start solving before they finish.",
              "Confirm: What I am hearing is [repeat back]. Is that correct?",
              "Clarify: Is this urgent or standard timeline? What is your unit's process if there is a delay?",
              "Set timeline: You can expect [specific outcome] by [specific time]. If anything changes I will call you directly."
            ]
          },
          connection:{
            tag:"Inpatient Pharmacy Tech · Medication History Tech · Lead Tech · Pharmacy Supervisor",
            aiPrompt:"I just completed the lesson Inpatient Communication Framework in the Explore Pharmacy module. Help me practice the listen, confirm, clarify, set timeline framework for clinical staff communication in my current setting."
          }
        },
      ]},
     { id:"m5", title:"First Week Survival Guide", lessons:[
        {
          id:"l12",
          title:"First Week Priorities and Common Mistakes",
          sections:[
            {
              header:"NOBODY WARNS YOU ABOUT THIS PART",
              body:"In retail pharmacy, you are patient-facing all day, every day. If you are someone who finds constant social interaction draining rather than energizing, retail will exhaust you in a way that has nothing to do with how skilled you are. That exhaustion is real and it is worth naming before you experience it, not after."
            },
            {
              header:"WHAT TO PRIORITIZE IN YOUR FIRST WEEK",
              body:"The techs who struggle most try to impress with speed, avoid asking questions, or panic when something does not go as expected. The techs who succeed are calm, curious, and observant. They watch before they jump in. They ask before they assume. They write things down."
            },
            {
              header:"COMMON FIRST WEEK MISTAKES",
              body:"Trying to impress with speed leads to errors when you have the least experience to catch them. Avoiding questions creates gaps that compound. Panicking when unsure skips the process. The process is: pause, identify who to escalate to, and ask."
            }
          ],
          keyPoints:[
            "Knowing your environment before you walk in protects you from being blindsided",
            "Retail pharmacy is high volume patient interaction and that has an energy cost",
            "Your first week goal is orientation and safety, not speed or performance",
            "Calm, curious, and observant is what strong first week behavior looks like",
            "Every question you ask in week one is a future error you prevent"
          ],
          takeaway:"Your first week is not a performance. It is a foundation. Build it carefully.",
          selfCheck:{
            prompt:"Which of these sounds most like how your first week went or how you expect it to go?",
            options:[
              {
                label:"I wanted to show I could keep up with everyone else so I pushed myself to work as fast as possible from day one.",
                response:"Speed without knowledge is the fastest path to an error. The techs who are most trusted came in careful and got faster over time."
              },
              {
                label:"I took my time, asked questions, and focused on understanding the environment before worrying about my speed.",
                response:"The foundation you build in week one is what everything else stands on."
              },
              {
                label:"I felt overwhelmed by the environment itself and did not expect how much the patient-facing side would drain me.",
                response:"You are not alone and there is nothing wrong with you. That awareness is valuable and it is worth following."
              }
            ]
          },
          scenario:{
            setup:"You are in your third day of a new retail position. You realize you have been filling prescriptions without fully understanding the insurance adjudication step because you did not want to slow down and ask.",
            prompt:"What do you do today, and why does it matter that you do it now rather than later?"
          },
          answer:{
            recommended:"Find a moment and ask someone to walk you through the insurance adjudication step specifically. Say: I have been following along but I want to make sure I actually understand this step rather than just copying it. Every shift you work without understanding that step, you are building habits on a gap."
          },
          firstWeekChecklist:[
            "Learn the physical layout of your pharmacy and any connected areas",
            "Observe workflow rhythm before jumping in at full speed",
            "Identify your escalation path and how to reach the right person quickly",
            "Understand the controlled substance handling process at your facility at a high level",
            "Write down new terms, abbreviations, and system names as you encounter them",
            "",
            "",
            "",
            "",
            ""
          ],
          connection:{
            tag:"Lead Tech · Senior Tech · Pharmacy Supervisor · Pharmacy Informatics Tech",
            aiPrompt:"I just completed the lesson First Week Priorities and Common Mistakes in the Explore Pharmacy module. Help me build a specific plan for my first week based on my background and current experience level."
          }
        },
      ]},
    ]
  },
  { id:"certify", title:"Getting Certified", icon:"🎓", desc:"A complete roadmap from zero to certified pharmacy tech",
    modules:[
      { id:"c1", title:"Structuring Your Study Plan", lessons:[
        { id:"c1l1", title:"Why Most People Fail & How to Win", content:`WHY MOST PEOPLE FAIL:\n• Study inconsistently\n• Focus only on drugs\n• Avoid math\n• Skip practice exams\n\nCertification requires balance.\n\nSTUDY BLUEPRINT — 4 Pillars:\n────────────────────\n1. Math\n2. Law\n3. Drug Classes\n4. Workflow Knowledge\n\nStudy 45–60 minutes per session.\n3–5 sessions per week minimum.\n\nSelf-Assessment: Take a baseline practice test first.\nDo not panic at low scores. Use it as a map.` },
      ]},
      { id:"c2", title:"Pharmacy Math Essentials", lessons:[
        { id:"c2l1", title:"Key Math Concepts & Sample Problems", content:`KEY CONCEPTS:\n• Ratio and proportion\n• Conversions\n• Alligation\n• IV rate basics\n• Percent strength\n\nSAMPLE PROBLEM:\n────────────────────\nOrder: 250 mg\nAvailable: 125 mg tablets\nHow many tablets?\n\n250 ÷ 125 = 2 tablets\n\nDECIMAL SAFETY RULE:\nIf you see .5 → rewrite as 0.5\nNever use trailing zeros in calculations.` },
      ]},
      { id:"c3", title:"Drug Class Recognition", lessons:[
        { id:"c3l1", title:"Group by Suffix", content:`-pril     → ACE Inhibitor\n-sartan   → ARB\n-olol     → Beta Blocker\n-statin   → Lipid Lowering\n-cillin   → Penicillin Antibiotic\n\nBuild class clusters.\n\nSTUDY TIP:\n• Create 25 drug mini-lists\n• Review daily\n• Rotate weekly\n\nRepetition builds recall speed.` },
      ]},
      { id:"c4", title:"Federal Law & Controlled Substances", lessons:[
        { id:"c4l1", title:"What to Know for the Exam", content:`KNOW:\n• Schedule II–V structure\n• High-level refill rules\n• Transfer limitations (general awareness)\n• HIPAA basics\n• Medication safety reporting\n\nFocus on principles over memorization.` },
      ]},
      { id:"c5", title:"Practice Exam Strategy & 30-Day Plan", lessons:[
        { id:"c5l1", title:"After Each Test + The Crash Plan", content:`AFTER EACH PRACTICE TEST:\nWrite down:\n• Category missed\n• Why missed\n• How to correct\n\nTrack patterns.\n\n30-DAY CRASH PLAN:\n────────────────────\nWeek 1: Math daily + Workflow review\nWeek 2: Law + Safety + Controlled substance basics\nWeek 3: Drug classes daily\nWeek 4: Full practice exams + Target weak areas\n\nYou passed. Now what?\nCertification is just the beginning.\nThe real differentiator is what you build next.` },
      ]},
    ]
  },
];

const PRO_SECTIONS = [
  { id:"retail", title:"Retail Excellence", icon:"🏪", desc:"Advanced skills for techs who want to be the one everyone counts on.",
    modules:[
      { id:"r1", title:"Advanced Intake & Data Entry Precision", lessons:[
        { id:"r1l1", title:"Data Entry Is a Safety Gate", content:`Data entry is not clerical. It is:\n• The first safety checkpoint\n• The foundation of insurance processing\n• The source of downstream accuracy\n\nSmall entry errors create:\n• Rejections\n• Delays\n• Incorrect labels\n• Patient frustration` },
        { id:"r1l2", title:"High-Risk Entry Areas", content:`Pay extra attention to:\n• Drug strength\n• Quantity\n• Day supply\n• Prescriber information\n• Patient date of birth\n• Similar drug names\n\nMost entry mistakes happen during multitasking.` },
        { id:"r1l3", title:"Incomplete Prescription Recognition", content:`Before typing, scan for:\n☐ Missing strength\n☐ Missing quantity\n☐ Unclear directions\n☐ Duplicate therapy\n☐ Illegible information\n\nEscalate early. Always clarify before processing.` },
      ]},
      { id:"r2", title:"Insurance & Rejection Strategy", lessons:[
        { id:"r2l1", title:"Top Rejection Types", content:`• Refill too soon\n• Prior authorization required\n• Plan limitations exceeded\n• Non-covered drug\n• Invalid ID\n\nStrong techs recognize patterns quickly.` },
        { id:"r2l2", title:"Troubleshoot vs Escalate", content:`CORRECT YOURSELF:\n• Wrong birthdate\n• Wrong BIN/PCN\n• Incorrect plan selected\n\nESCALATE:\n• Therapeutic interchange\n• Prior authorization\n• Insurance override needed\n\nAcknowledge → Explain → Offer next step.` },
      ]},
      { id:"r3", title:"Inventory & Ordering Intelligence", lessons:[
        { id:"r3l1", title:"Par Levels, Backorders & Controlled Substances", content:`PAR LEVEL = target stock amount\nToo low → out-of-stocks, frustrated patients\nToo high → expired product, financial waste\n\nBACKORDER HANDLING:\n• Document clearly\n• Communicate timeline\n• Never promise unrealistic dates\n• Inform pharmacist early` },
      ]},
      { id:"r4", title:"Becoming the Go-To Retail Tech", lessons:[
        { id:"r4l1", title:"Anticipation, Peak Hours & Informal Leadership", content:`ANTICIPATION — Strong techs:\n• Refill vials before they're empty\n• Prepare labels during downtime\n• Check stock before rush\n• Anticipate common questions\n\nStay calm. Others mirror your energy.\n\nManagers notice:\nConsistency. Accountability. Initiative.` },
      ]},
    ]
  },
  { id:"inpatient", title:"Hospital Pharmacy Essentials", icon:"🏥", desc:"How hospital pharmacy works and what it takes to thrive in it.",
    modules:[
      { id:"i1", title:"Understanding Distribution Systems", lessons:[{ id:"i1l1", title:"Centralized vs Decentralized Systems", content:`• Centralized vs decentralized pharmacy\n• Automated dispensing system logic\n• Restock patterns\n• Risk points at each stage\n\nEven highly automated environments require human accountability at every step.` }]},
      { id:"i2", title:"Automation Awareness", lessons:[{ id:"i2l1", title:"Why Counts & Documentation Matter", content:`• Why counts matter\n• Documentation chain\n• Common discrepancy causes\n• Pattern recognition mindset\n\nUnderstand why each step exists. That mindset separates average techs from strong ones.` }]},
      { id:"i3", title:"Cart Fill & Workflow Efficiency", lessons:[{ id:"i3l1", title:"Prioritization, Communication & Documentation", content:`• Prioritization logic\n• Error prevention habits\n• Shift-to-shift communication\n• Documentation hygiene\n\nEvery handoff is a risk point. Document clearly.` }]},
      { id:"i4", title:"Controlled Substance Accountability", lessons:[{ id:"i4l1", title:"Reconciliation, Escalation & Documentation", content:`If a count is off:\nDo not fix it quietly.\nReport and document immediately.\n\nThis protects you, your team, and your license.` }]},
      { id:"i5", title:"Sterile Compounding Awareness", lessons:[{ id:"i5l1", title:"Cleanroom Principles (High-Level)", content:`• Cleanroom principles\n• Why environment matters\n• Documentation significance\n\nAlways defer to your facility's SOPs and licensed pharmacist supervision.` }]},
    ]
  },
  { id:"advanced", title:"Beyond the Counter", icon:"🚀", desc:"Leadership, career pathways & long-term positioning",
    modules:[], // Beyond the Counter now uses its own dedicated view — see BeyondTheCounter component below
    isBeyond: true
  },
];

// ─── CAREER PREFERENCES DATA ───────────────────────────────────────────────

const CAREER_PREFERENCE_CATEGORIES = [
  {
    id: "enjoy",
    label: "What I Enjoy Doing",
    emoji: "✅",
    proRequired: false,
    chips: [
      "Hands-on tasks",
      "Teaching others",
      "Problem solving",
      "Organizing & systems",
      "Data & documentation",
      "Patient interaction",
    ],
  },
  {
    id: "avoid",
    label: "What I Want to Avoid",
    emoji: "🚫",
    proRequired: false,
    chips: [
      "High stress environments",
      "Repetitive tasks",
      "Heavy lifting",
      "Overnight shifts",
      "Direct patient contact",
      "Fast pace",
    ],
  },
  {
    id: "setting",
    label: "Work Setting Preference",
    emoji: "🏥",
    proRequired: true,
    chips: [
      "Hospital / Inpatient",
      "Retail / Community",
      "Specialty Pharmacy",
      "Home Infusion",
      "Remote / Admin",
      "Long-Term Care",
    ],
  },
  {
    id: "patientContact",
    label: "Patient Interaction Level",
    emoji: "🤝",
    proRequired: true,
    chips: [
      "Love it",
      "Okay with some",
      "Prefer minimal",
      "Prefer none",
      "Open to anything",
      "Depends on the role",
    ],
  },
  {
    id: "motivators",
    label: "Career Motivators",
    emoji: "🎯",
    proRequired: true,
    chips: [
      "Higher pay",
      "Leadership opportunities",
      "Work-life balance",
      "Continuous learning",
      "Helping patients",
      "Job stability",
    ],
  },
  {
    id: "skills",
    label: "Skills I Want to Use More",
    emoji: "🛠",
    proRequired: true,
    chips: [
      "Clinical knowledge",
      "Technology & software",
      "Training others",
      "Writing & documentation",
      "Sterile compounding",
      "Inventory management",
    ],
  },
];

// ─── CAREER PREFERENCES COMPONENT ──────────────────────────────────────────

function CareerPreferencesSelector({ user, isPro, db }) {
  const [selections, setSelections] = useState({});
const [saved, setSaved] = useState(false);
const [loading, setLoading] = useState(true);

  // Load existing selections from Firestore on mount
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().careerPreferences) {
          setSelections(snap.data().careerPreferences);
        }
      } catch (e) {
        console.error("Error loading career preferences:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // Toggle a chip and auto-save to Firestore
  const toggleChip = async (categoryId, chip, proRequired) => {
    if (proRequired && !isPro) return; // blocked for free users

    const current = selections[categoryId] || [];
    const updated = current.includes(chip)
      ? current.filter((c) => c !== chip)
      : [...current, chip];

    const newSelections = { ...selections, [categoryId]: updated };
    setSelections(newSelections);

    try {
      await setDoc(doc(db, "users", user.uid),

        { careerPreferences: newSelections },
        { merge: true }
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Error saving career preferences:", e);
    }
  };

  if (loading) {
    return (
      <div style={{ color: "#a0aec0", fontSize: "0.9rem", padding: "1rem 0" }}>
        Loading your preferences...
      </div>
    );
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      {/* Section Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <h3 style={{ color: "#fff", fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
          Career Preferences
        </h3>
        {saved && (
          <span style={{ color: "#00c9a7", fontSize: "0.8rem", fontWeight: 600 }}>
            ✓ Saved
          </span>
        )}
      </div>
      <p style={{ color: "#a0aec0", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Select what fits you. Your AI Career Assistant uses these to personalize suggestions.
      </p>

      {CAREER_PREFERENCE_CATEGORIES.map((cat) => {
        const isLocked = cat.proRequired && !isPro;
        const catSelections = selections[cat.id] || [];

        return (
          <div
            key={cat.id}
            style={{
              marginBottom: "1.5rem",
              position: "relative",
              opacity: isLocked ? 0.6 : 1,
            }}
          >
            {/* Category Label */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "1rem" }}>{cat.emoji}</span>
              <span style={{ color: "#e2e8f0", fontSize: "0.9rem", fontWeight: 600 }}>
                {cat.label}
              </span>
              {isLocked && (
                <span
                  style={{
                    background: "linear-gradient(135deg, #0094ff, #00c9a7)",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "20px",
                    letterSpacing: "0.05em",
                  }}
                >
                  PRO
                </span>
              )}
            </div>

            {/* Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {cat.chips.map((chip) => {
                const selected = catSelections.includes(chip);
                return (
                  <button
                    key={chip}
                    onClick={() => toggleChip(cat.id, chip, cat.proRequired)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "20px",
                      border: selected
                        ? "1.5px solid #00c9a7"
                        : "1.5px solid #2d3748",
                      background: selected
                        ? "rgba(0, 201, 167, 0.15)"
                        : "rgba(255,255,255,0.04)",
                      color: selected ? "#00c9a7" : "#a0aec0",
                      fontSize: "0.8rem",
                      fontWeight: selected ? 700 : 400,
                      cursor: isLocked ? "not-allowed" : "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            {/* Locked overlay prompt */}
            {isLocked && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  background: "rgba(10, 15, 30, 0.55)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <span style={{ color: "#00c9a7", fontSize: "0.8rem", fontWeight: 600 }}>
                  🔒 Upgrade to Pro to unlock
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Upgrade CTA for free users */}
      {!isPro && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.9rem 1.2rem",
            borderRadius: "10px",
            background: "rgba(0, 148, 255, 0.08)",
            border: "1px solid rgba(0, 148, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <span style={{ color: "#a0aec0", fontSize: "0.85rem" }}>
            Unlock all 6 categories and get fully personalized AI career suggestions.
          </span>
          <button
            onClick={() => {
              // Trigger your existing Stripe upgrade flow here
              // Replace this with whatever opens your Stripe modal
              alert("Upgrade flow here");
            }}
            style={{
              background: "linear-gradient(135deg, #0094ff, #00c9a7)",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              padding: "6px 18px",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Upgrade to Pro
          </button>
        </div>
      )}
    </div>
  );
}


// ─── AI ASSISTANT SYSTEM PROMPT HELPER ─────────────────────────────────────
// Call this function when building the system prompt for your AI Career Assistant.
// Pass in the careerPreferences object from Firestore and it returns a formatted string
// you can append to your existing system prompt.

function buildPreferencesPrompt(careerPreferences) {
  if (!careerPreferences) return "";

  const labelMap = {
    enjoy: "Things they enjoy doing",
    avoid: "Things they want to avoid",
    setting: "Preferred work settings",
    patientContact: "Patient interaction preference",
    motivators: "Career motivators",
    skills: "Skills they want to use more",
  };

  const lines = Object.entries(careerPreferences)
    .filter(([, values]) => values && values.length > 0)
    .map(([key, values]) => `${labelMap[key] || key}: ${values.join(", ")}`);

  if (lines.length === 0) return "";

  return `\n\nThe user has shared the following career preferences:\n${lines.join("\n")}\nUse these preferences to personalize your suggestions. Prioritize roles and paths that align with what they enjoy and their motivators. Avoid recommending paths that conflict with what they want to avoid.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORE PHARMACY — LESSON RENDERER
// ─────────────────────────────────────────────────────────────────────────────

function ExplorePharmacyLesson({ lesson, go }) {
  const [selfCheckPick, setSelfCheckPick] = useState(null);
  const [answerOpen, setAnswerOpen] = useState(false);

  const surface  = "#1a1d27";
  const surface2 = "#22263a";
  const teal     = "#00c9a7";
  const tealDim  = "rgba(0,201,167,0.12)";
  const tealBorder = "rgba(0,201,167,0.25)";
  const blue     = "#0094ff";
  const gold     = "#f59e0b";
  const mu       = "#8b92a9";
  const white    = "#ffffff";

  const card = {
    background: surface,
    borderRadius: 14,
    padding: "20px 22px",
    marginBottom: 18,
    border: "1px solid rgba(255,255,255,0.06)"
  };

  const sectionHeader = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: teal,
    marginBottom: 8,
    marginTop: 0
  };

  const bodyText = {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#c8cdd8",
    margin: 0,
    whiteSpace: "pre-line"
  };

  const pill = (color, bg) => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    color,
    background: bg,
    borderRadius: 20,
    padding: "3px 10px",
    letterSpacing: "0.05em"
  });

  if (!lesson) return null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 4px 40px" }}>

      {/* TITLE */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...pill(teal, tealDim), border: `1px solid ${tealBorder}`, marginBottom: 10 }}>
          Explore Pharmacy
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: white, margin: 0, lineHeight: 1.3 }}>
          {lesson.title}
        </h1>
      </div>

      {/* LESSON CONTENT */}
      <div style={card}>
        <div style={{ ...pill("#0094ff", "rgba(0,148,255,0.1)"), border: "1px solid rgba(0,148,255,0.2)", marginBottom: 16 }}>
          Lesson Content
        </div>
        {(lesson.sections || []).map((sec, i) => (
          <div key={i} style={{ marginBottom: i < lesson.sections.length - 1 ? 20 : 0 }}>
            <p style={sectionHeader}>{sec.header}</p>
            <p style={bodyText}>{sec.body}</p>
          </div>
        ))}
        {lesson.keyPoints && lesson.keyPoints.length > 0 && (
          <div style={{ background: "rgba(0,148,255,0.06)", border: "1px solid rgba(0,148,255,0.15)", borderRadius: 10, padding: "14px 16px", marginTop: 20 }}>
            <p style={{ ...sectionHeader, color: blue, marginBottom: 10 }}>Key Points</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lesson.keyPoints.map((pt, i) => (
                <li key={i} style={{ ...bodyText, marginBottom: i < lesson.keyPoints.length - 1 ? 6 : 0 }}>{pt}</li>
              ))}
            </ul>
          </div>
        )}
        {lesson.takeaway && (
          <div style={{ borderLeft: `3px solid ${teal}`, paddingLeft: 14, marginTop: 18 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#e0e4f0", margin: 0, fontStyle: "italic" }}>
              {lesson.takeaway}
            </p>
          </div>
        )}
      </div>

      {/* SELF-CHECK */}
      {lesson.selfCheck && (
        <div style={{ ...card, background: "linear-gradient(135deg, rgba(0,201,167,0.07), rgba(0,148,255,0.05))", border: `1px solid ${tealBorder}` }}>
          <div style={{ ...pill(teal, tealDim), border: `1px solid ${tealBorder}`, marginBottom: 14 }}>Self-Check</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: white, margin: "0 0 16px" }}>{lesson.selfCheck.prompt}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(lesson.selfCheck.options || []).map((opt, i) => {
              const picked = selfCheckPick === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setSelfCheckPick(i)}
                    style={{
                      width: "100%", textAlign: "left",
                      background: picked ? "linear-gradient(135deg,rgba(0,201,167,0.18),rgba(0,148,255,0.12))" : surface2,
                      border: picked ? `1.5px solid ${teal}` : "1.5px solid rgba(255,255,255,0.08)",
                      borderRadius: picked && opt.response ? "10px 10px 0 0" : 10,
                      padding: "12px 14px", color: picked ? white : "#c8cdd8",
                      fontSize: 13, fontWeight: picked ? 600 : 400, cursor: "pointer",
                      transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 10
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: picked ? `2px solid ${teal}` : "2px solid rgba(255,255,255,0.2)",
                      background: picked ? teal : "transparent", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: picked ? "#000" : "transparent", fontWeight: 800
                    }}>
                      {picked ? "✓" : ""}
                    </span>
                    {opt.label}
                  </button>
                  {picked && opt.response && (
                    <div style={{ background: "rgba(0,201,167,0.06)", border: `1px solid ${tealBorder}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 14px" }}>
                      <p style={{ fontSize: 13, color: "#b8f5eb", margin: 0, lineHeight: 1.6 }}>{opt.response}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REAL-WORLD SCENARIO */}
      {lesson.scenario && (
        <div style={{ ...card, background: "linear-gradient(135deg, rgba(255,170,0,0.06), rgba(255,100,50,0.04))", border: "1px solid rgba(255,170,0,0.18)" }}>
          <div style={{ ...pill("#ffaa00", "rgba(255,170,0,0.1)"), border: "1px solid rgba(255,170,0,0.2)", marginBottom: 14 }}>
            Real-World Scenario
          </div>
          <p style={{ ...bodyText, marginBottom: 16 }}>{lesson.scenario.setup}</p>
          <div style={{ background: "rgba(255,170,0,0.07)", border: "1px solid rgba(255,170,0,0.15)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#ffd080", margin: 0 }}>{lesson.scenario.prompt}</p>
          </div>
          <p style={{ fontSize: 12, color: mu, margin: "12px 0 0", fontStyle: "italic" }}>
            Take a moment to think it through. Then check the answer below.
          </p>
        </div>
      )}

      {/* SEE RECOMMENDED RESPONSE */}
      {lesson.answer && (
        <div style={{ marginBottom: 18 }}>
          <button
            onClick={() => setAnswerOpen(!answerOpen)}
            style={{
              width: "100%",
              background: answerOpen ? "linear-gradient(135deg,rgba(0,201,167,0.12),rgba(0,148,255,0.08))" : surface,
              border: answerOpen ? `1px solid ${tealBorder}` : "1px solid rgba(255,255,255,0.06)",
              borderRadius: answerOpen ? "14px 14px 0 0" : 14,
              padding: "16px 20px", display: "flex", alignItems: "center",
              justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: answerOpen ? teal : white }}>See Recommended Response</span>
            </div>
            <span style={{ color: answerOpen ? teal : mu, fontSize: 18, fontWeight: 300, display: "inline-block", transform: answerOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>▾</span>
          </button>
          {answerOpen && (
            <div style={{ background: "linear-gradient(135deg,rgba(0,201,167,0.06),rgba(0,148,255,0.04))", border: `1px solid ${tealBorder}`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: "20px 22px" }}>
              <p style={{ ...sectionHeader, color: teal }}>Recommended Response</p>
              <p style={bodyText}>{lesson.answer.recommended}</p>
            </div>
          )}
        </div>
      )}

     {/* ERROR PREVENTION HABITS — Lesson l6 only */}
      {lesson.errorPreventionHabits && lesson.errorPreventionHabits.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(0,201,167,0.06), rgba(0,148,255,0.04))",
          border: "1px solid rgba(0,201,167,0.2)",
          borderRadius: 14,
          padding: "20px 22px",
          marginBottom: 18
        }}>
          <div style={{ ...pill(teal, tealDim), border: `1px solid ${tealBorder}`, marginBottom: 14 }}>
            Error Prevention Habits
          </div>
          <p style={{ fontSize: 13, color: mu, margin: "0 0 14px", fontStyle: "italic" }}>
            The first four are your foundation. Add your facility-specific habits in the fields below.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lesson.errorPreventionHabits.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${i < 4 ? tealBorder : "rgba(255,255,255,0.06)"}`,
                borderRadius: 9, padding: "10px 13px"
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: `1.5px solid ${i < 4 ? "rgba(0,201,167,0.4)" : "rgba(255,255,255,0.15)"}`,
                  background: "transparent", flexShrink: 0
                }} />
                {i < 4
                  ? <span style={{ fontSize: 13, color: "#c8cdd8", lineHeight: 1.6 }}>{item}</span>
                  : <input
                      placeholder="Add your facility-specific habit here..."
                      style={{
                        flex: 1, background: "transparent", border: "none",
                        color: "#c8cdd8", fontSize: 13, outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIRST WEEK CHECKLIST — Lesson 3 only */}
      {lesson.firstWeekChecklist && lesson.firstWeekChecklist.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg, rgba(255,170,0,0.06), rgba(245,158,11,0.04))",
          border: "1px solid rgba(255,170,0,0.2)",
          borderRadius: 14,
          padding: "20px 22px",
          marginBottom: 18
        }}>
          <div style={{ ...pill(gold, "rgba(245,158,11,0.12)"), border: "1px solid rgba(245,158,11,0.25)", marginBottom: 14 }}>
            First Week Reference List
          </div>
          <p style={{ fontSize: 13, color: mu, margin: "0 0 14px", fontStyle: "italic" }}>
            Screenshot this or save it before your first shift.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lesson.firstWeekChecklist.map((item, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,170,0,0.12)",
                borderRadius: 9, padding: "10px 13px"
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: "1.5px solid rgba(245,158,11,0.4)",
                  background: "transparent", flexShrink: 0, marginTop: 1
                }} />
                <span style={{ fontSize: 13, color: "#c8cdd8", lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: mu, margin: "14px 0 0" }}>
            Interactive checklist coming in a future update.
          </p>
        </div>
      )}

      {/* MARK LESSON COMPLETE */}
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => { if (go) go("explore-complete", { lessonId: lesson.id }); }}
          style={{
            background: `linear-gradient(135deg,#00c9a7,#0094ff)`,
            color: "#fff", border: "none", borderRadius: 12,
            padding: "12px 28px", fontSize: 14, fontWeight: 800,
            cursor: "pointer", letterSpacing: 0.2,
          }}
        >
          ✓ Mark Lesson Complete
        </button>
      </div>

      {/* SUPPORTS + ASK THE AI */}
      {lesson.connection && (
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, color: mu, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Supports</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: teal, background: tealDim, border: `1px solid ${tealBorder}`, borderRadius: 20, padding: "4px 12px", letterSpacing: "0.03em" }}>
              {lesson.connection.tag}
            </span>
          </div>
          <button
            onClick={() => { if (go) go("career-ai", { preload: lesson.connection.aiPrompt }); }}
            style={{ background: "linear-gradient(135deg,#00c9a7,#0094ff)", border: "none", borderRadius: 10, padding: "10px 18px", color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
          >
            <span>✨</span>Ask the AI
          </button>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// BEYOND THE COUNTER — MODULE DATA
// 8 modules. Module 1 Lesson 1 fully populated.
// Modules 2–8 ready for content.
// ─────────────────────────────────────────────────────────────────────────────

const BEYOND_MODULES = [
  {
    id: "btc1",
    title: "Thinking Beyond Task Completion",
    icon: "🧠",
    desc: "Shift from doing your job to owning your impact.",
    lessons: [
      {
        id: "btc1l1",
        title: "What Your Job Description Does Not Tell You",
        sections: [
          {
            header: "The Gap Nobody Talks About",
            body: "Every pharmacy technician job description says roughly the same thing. Count, dispense, verify, repeat. And if you do those things accurately and efficiently, you are doing your job.\n\nBut here is what nobody writes in the job description. The techs who advance are not the ones who just complete tasks. They are the ones who understand why the tasks exist, what breaks when they are done wrong and how the work connects to patient outcomes, team performance and organizational risk.\n\nThat shift in thinking is not something you learn in a training module. It is something you choose to do."
          },
          {
            header: "From Execution to Awareness",
            body: "Task completion is doing the work. Strategic awareness is watching the work.\n\nWhen you are counting a controlled substance, a task-completion mindset checks the count and moves on. A strategic awareness mindset notices that this medication has been short three times this month, flags it and asks whether there is a workflow problem, a diversion risk or an ordering issue.\n\nSame action. Completely different value to the organization.\n\nThis is not about working harder. It is about paying attention differently. You are already in the room where the work happens. That gives you information that a manager sitting in an office does not have access to. The question is whether you are using it."
          }
        ],
        keyPoints: [
          "Task completion gets you hired. Strategic awareness gets you promoted.",
          "You have access to frontline information that leaders do not see directly.",
          "Noticing patterns is a skill you build on purpose, not by accident.",
          "The same action done with awareness creates more value than the same action done on autopilot."
        ],
        takeaway: "Every task you complete exists inside a larger system. The more you understand that system, the more valuable you become to it.",
        selfCheck: {
          prompt: "Read each situation below. Tap the one that sounds most like how you currently show up at work.",
          options: [
            {
              label: "I complete my tasks accurately and efficiently. I do what is asked of me and I do it well.",
              response: "You have a strong foundation. The next step is intentionally widening your lens. Start with one shift per week where you ask yourself why each task exists, not just how to do it."
            },
            {
              label: "I complete my tasks and I also pay attention to patterns, flag things that seem off and think about how my work connects to the bigger picture.",
              response: "You are already thinking like a leader. The next step is making sure the people around you know it. Document what you notice. Bring patterns to your pharmacist. Let your awareness become visible."
            },
            {
              label: "I am somewhere in between. I notice things but I am not always sure it is my place to say something.",
              response: "This is the most common place experienced techs get stuck. You have the instincts. What you need is the confidence to act on them. This section of PharmTech Path was built specifically for you."
            }
          ]
        },
        scenario: {
          setup: "You are working a busy retail shift and notice that the same insurance rejection code has come up four times in the last two hours for different patients on different medications. Your pharmacist is on the phone and the line is backing up.",
          prompt: "What do you do and why does it matter beyond just fixing each rejection one at a time?"
        },
        answer: {
          recommended: "Handle each rejection efficiently in the moment so patients are not waiting. But also write down the rejection code, the medications affected and the approximate times. When your pharmacist is free, bring it up as a pattern rather than four separate problems.",
          why: "A single rejection is a task. Four rejections with the same code in two hours is a system signal. It could mean a formulary change, a PBM update or a billing error that will affect dozens of patients if nobody catches it. The tech who notices the pattern and reports it is operating at a completely different level than the tech who just clears each queue item and moves on. That is the difference between being replaceable and being relied upon."
        },
        connection: {
          tag: "Lead Tech · Pharmacy Supervisor · CQI Coordinator · Performance Improvement Specialist",
          aiPrompt: "I just completed the lesson 'What Your Job Description Does Not Tell You' in the Thinking Beyond Task Completion module. I want to understand how to start building strategic awareness in my current role. Based on my background, where should I focus first?"
        }
      }
    ]
  },
  {
    id: "btc2",
    title: "Owning Your Professional Reputation",
    icon: "⭐",
    desc: "How you show up every day builds the career you want.",
    lessons: [
      {
        id: "btc2l1",
        title: "You Are Already Doing Leadership Work",
        sections: [
          {
            header: "The Work You Are Not Counting",
            body: "Most pharmacy technicians who have been in the field for more than a year are already doing leadership work. They are training new staff. They are catching errors before they reach the pharmacist. They are managing the workflow when things get backed up. They are the person other techs come to when something is unclear.\n\nNone of that is in the job description. And most of the time, none of it is on the resume.\n\nThe gap between what experienced techs actually do and what they say they do is one of the most consistent patterns in pharmacy career development. It is not a gap in competence. It is a gap in recognition, both how others see you and how you see yourself."
          },
          {
            header: "Why This Gap Exists",
            body: "The most common reason experienced techs underrepresent their work is that they have normalized it. When you have been training new hires for two years, it stops feeling like a skill and starts feeling like just something you do. When you catch a controlled substance discrepancy, you document it and move on. The significance of that action fades into routine.\n\nBut routine for you is not routine to a hiring manager reading your resume. Routine for you is not ordinary to a new tech trying to figure out how things work. What feels automatic to you is built on years of practice, judgment and accountability that most people in the room do not have.\n\nRecognizing your own work through"
          }
        ],
        keyPoints: [
          "Most experienced techs are already doing leadership work without calling it that.",
          "Normalizing your work is what creates the gap between what you do and what you say you do.",
          "Training, error prevention and workflow management are leadership functions regardless of your title.",
          "Seeing your work through a leadership lens is the first step to communicating it effectively."
        ],
        takeaway: "The leadership experience you are looking for on your resume is already there. You just have not written it down yet.",
        selfCheck: {
          prompt: "When you think about your current role, which of these feels most true?",
          options: [
            {
              label: "I do not think of what I do as leadership. I am just doing my job.",
              response: "That humility is common among the most competent techs. The reframe is not about inflating what you do. It is about accurately describing it. Training a new tech is leadership. Catching an error is risk management. These are not exaggerations. They are accurate descriptions of real work."
            },
            {
              label: "I know I am doing leadership work but I do not know how to put it into words.",
              response: "That is exactly what this module addresses. The next lesson gives you the specific language and frameworks to translate your daily work into leadership language that resonates in interviews and on resumes."
            },
            {
              label: "I have tried to describe my work as leadership before but it did not land the way I expected.",
              response: "The issue is usually specificity. Saying I help train new techs lands differently than I developed and delivered onboarding support for three new technicians resulting in faster workflow integration. Same work. Very different impression. We will work on that in the next lesson."
            }
          ]
        },
        scenario: {
          setup: "You are applying for a Lead Technician position at your current workplace. The manager asks you in the interview: What leadership experience do you have? You have never held a formal leadership title.",
          prompt: "How do you answer that question and what specific examples would you draw from your current role?"
        },
        answer: {
          recommended: "Start by reframing the question in your own mind before you answer it. Leadership experience is not the same as leadership titles. Then answer with three specific examples, each one naming what you did, what the outcome was and why it mattered. For example: In my current role I have been the primary point of contact for onboarding three new technicians over the past year. I identified a recurring data entry error pattern on our shift and brought it to the pharmacist as a workflow recommendation rather than an individual correction. And during our two most understaffed periods this year I coordinated task distribution to keep fill times within standard without pharmacist intervention.",
          why: "Hiring managers for lead roles are not looking for someone who has held the title before. They are looking for evidence that the person already thinks and operates like a leader. Specific examples with outcomes provide that evidence far more effectively than general statements about being a team player."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · Training Coordinator · CPhT-Adv",
          aiPrompt: "I just completed the lesson You Are Already Doing Leadership Work. Help me identify and describe the leadership work I have been doing in my current role so I can communicate it in my next interview or on my resume."
        }
      },
      {
        id: "btc2l2",
        title: "Communicating Your Value Without Underselling",
        sections: [
          {
            header: "Why Competent People Undersell Themselves",
            body: "There is a pattern that shows up consistently among experienced pharmacy technicians, especially those from underrepresented communities who were taught that humility means minimizing. They do exceptional work, they know their environment inside and out, they carry responsibilities that far exceed their job description and then they sit in an interview or write a resume and describe themselves as someone who helps out and works well with others. The work is real. The description does not match it. This is not a character flaw. It is a skill gap and it is completely fixable."
          },
          {
            header: "The Framework for Communicating What You Actually Do",
            body: "Every professional accomplishment can be described using three elements. What you did, the scope of it and the outcome or impact. I processed prescriptions becomes I managed high-volume prescription processing averaging 200 fills per shift while maintaining a zero dispensing error rate over six months. I trained new staff becomes I developed an informal onboarding process for new technicians that reduced time-to-independence by approximately two weeks based on pharmacist feedback. You do not need to have metrics for everything. Qualitative outcomes matter too. The pharmacist specifically requested I work the controlled substance reconciliation shifts tells a story about trust and reliability that a resume line cannot fully capture but an interview answer absolutely can."
          }
        ],
        keyPoints: [
          "Underselling is a skill gap, not a character trait. It is fixable with practice.",
          "Every accomplishment has three elements: what you did, the scope and the outcome.",
          "Qualitative outcomes are as valuable as quantitative ones when described specifically.",
          "The goal is accuracy, not inflation. Your actual work is more impressive than your current description of it."
        ],
        takeaway: "Describing your work accurately is not arrogance. It is a professional skill that gets you into rooms where your work can speak for itself.",
        selfCheck: {
          prompt: "How do you typically describe your work when someone asks what you do?",
          options: [
            {
              label: "I keep it simple. I say I am a pharmacy technician and leave it at that.",
              response: "That simplicity is costing you opportunities. The next time someone asks, try adding one specific thing you are known for or responsible for. Just one. See how the conversation changes."
            },
            {
              label: "I try to describe it but I always feel like I am either bragging or underselling.",
              response: "That tension usually means you have not found the right frame yet. Accurate description with specific outcomes never reads as bragging. It reads as professional confidence. That is what we are building here."
            },
            {
              label: "I am pretty good at talking about my work. I know how to frame it for different audiences.",
              response: "That skill is genuinely rare. The next level is helping the people around you develop it too. That is mentorship and it is one of the clearest markers of leadership readiness."
            }
          ]
        },
        scenario: {
          setup: "You are updating your resume for the first time in three years. Your current job title is Pharmacy Technician. You have been responsible for controlled substance reconciliation, training new hires and covering lead responsibilities during your supervisor's days off for the past 18 months.",
          prompt: "Write three resume bullet points that accurately reflect what you have been doing."
        },
        answer: {
          recommended: "Here are three examples. First: Served as acting Lead Technician during supervisor absences, coordinating workflow and staff task distribution across a team of four technicians. Second: Responsible for daily controlled substance reconciliation and discrepancy reporting in compliance with DEA documentation standards. Third: Provided informal onboarding and peer training for new pharmacy technicians, supporting faster workflow integration and reducing pharmacist intervention during the onboarding period.",
          why: "These bullet points do not exaggerate anything. They describe real work using language that communicates responsibility and impact. A hiring manager reading these sees a tech who is already operating at a lead level. That is the point."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · CPhT-Adv · Performance Improvement Specialist",
          aiPrompt: "I just completed the lesson Communicating Your Value Without Underselling. Help me write strong resume bullet points and interview answers for my current role based on my background and experience."
        }
      }
    ]
  },
  {
    id: "btc3",
    title: "Leadership Without Title",
    icon: "🤝",
    desc: "Lead from any seat. Title is not a prerequisite.",
    lessons: [
      {
        id: "btc3l1",
        title: "You Are Already Doing Leadership Work",
        sections: [
          {
            header: "The Work You Are Not Counting",
            body: "Most pharmacy technicians who have been in the field for more than a year are already doing leadership work. They are training new staff. They are catching errors before they reach the pharmacist. They are managing the workflow when things get backed up. They are the person other techs come to when something is unclear.\n\nNone of that is in the job description. And most of the time, none of it is on the resume.\n\nThe gap between what experienced techs actually do and what they say they do is one of the most consistent patterns in pharmacy career development. It is not a gap in competence. It is a gap in recognition, both how others see you and how you see yourself."
          },
          {
            header: "Why This Gap Exists",
            body: "The most common reason experienced techs underrepresent their work is that they have normalized it. When you have been training new hires for two years, it stops feeling like a skill and starts feeling like just something you do. When you catch a controlled substance discrepancy, you document it and move on. The significance of that action fades into routine.\n\nBut routine for you is not routine to a hiring manager reading your resume. Routine for you is not ordinary to a new tech trying to figure out how things work. What feels automatic to you is built on years of practice, judgment and accountability that most people in the room do not have.\n\nSeeing your work through a leadership lens is the first step to communicating it effectively."
          }
        ],
        keyPoints: [
          "Leadership is demonstrated through behavior, not assigned through titles.",
          "The tech others come to with questions is already leading, regardless of what their badge says.",
          "Composure under pressure, accuracy under stress and mentoring newer staff are all leadership in action.",
          "Organizations promote the people who are already behaving like the role they want."
        ],
        takeaway: "The title comes after the behavior. Start leading where you are.",
        selfCheck: {
          prompt: "Think about how you show up on a typical shift. Which feels most accurate?",
          options: [
            {
              label: "I do my job well but I stay in my lane. Leadership is someone else's responsibility.",
              response: "Staying in your lane is not a problem. The invitation here is to notice where you are already influencing the people and environment around you, even without intending to. That influence is leadership and it is worth being intentional about."
            },
            {
              label: "I naturally step up when things get difficult but I do not think of it as leadership.",
              response: "That instinct to step up is exactly what leadership looks like before the title. The next step is recognizing it as a pattern, not just a reaction, and starting to build on it deliberately."
            },
            {
              label: "I am conscious of how I show up and I try to set a positive tone for the people around me.",
              response: "That awareness is the foundation of intentional leadership. The next level is making sure the right people can see it. Visibility matters as much as behavior when it comes to advancement."
            }
          ]
        },
        scenario: {
          setup: "It is a short-staffed shift. The pharmacist is managing three consultations at once. Two newer techs are unsure what to prioritize and the queue is backing up. No one has been designated as lead for the shift.",
          prompt: "What do you do and how does your response either demonstrate or miss a leadership opportunity?"
        },
        answer: {
          recommended: "Assess the queue quickly and make a brief prioritization call out loud. Something like: I am going to take the verification queue, can you handle new drop-offs and flag anything that needs the pharmacist. You are not overstepping. You are filling a vacuum. Then follow through calmly and debrief with the pharmacist when the rush settles.",
          why: "Leadership without a title is most visible in exactly these moments. The tech who steps in calmly, communicates clearly and keeps the team moving without drama is demonstrating exactly the behavior that gets noticed and remembered when lead roles open up. The tech who waits for direction in a vacuum is not doing anything wrong, but they are missing an opportunity to show what they are capable of."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · Training Coordinator · CPhT-Adv",
          aiPrompt: "I just completed the lesson Leadership Without a Title. Based on my current role, help me identify specific ways I can demonstrate leadership without a formal title and how to make that visible to the right people."
        }
      },
      {
        id: "btc3l2",
        title: "Communicating Your Value Without Underselling",
        sections: [
          {
            header: "Why Competent People Undersell Themselves",
            body: "There is a pattern that shows up consistently among experienced pharmacy technicians, especially those from underrepresented communities who were taught that humility means minimizing. They do exceptional work, they know their environment inside and out, they carry responsibilities that far exceed their job description and then they sit in an interview or write a resume and describe themselves as someone who helps out and works well with others. The work is real. The description does not match it. This is not a character flaw. It is a skill gap and it is completely fixable."
          },
          {
            header: "The Framework for Communicating What You Actually Do",
            body: "Every professional accomplishment can be described using three elements. What you did, the scope of it and the outcome or impact. I processed prescriptions becomes I managed high-volume prescription processing averaging 200 fills per shift while maintaining a zero dispensing error rate over six months. I trained new staff becomes I developed an informal onboarding process for new technicians that reduced time-to-independence by approximately two weeks based on pharmacist feedback. You do not need to have metrics for everything. Qualitative outcomes matter too. The pharmacist specifically requested I work the controlled substance reconciliation shifts tells a story about trust and reliability that a resume line cannot fully capture but an interview answer absolutely can."
          }
        ],
        keyPoints: [
          "Underselling is a skill gap, not a character trait. It is fixable with practice.",
          "Every accomplishment has three elements: what you did, the scope and the outcome.",
          "Qualitative outcomes are as valuable as quantitative ones when described specifically.",
          "The goal is accuracy, not inflation. Your actual work is more impressive than your current description of it."
        ],
        takeaway: "Describing your work accurately is not arrogance. It is a professional skill that gets you into rooms where your work can speak for itself.",
        selfCheck: {
          prompt: "How do you typically describe your work when someone asks what you do?",
          options: [
            {
              label: "I keep it simple. I say I am a pharmacy technician and leave it at that.",
              response: "That simplicity is costing you opportunities. The next time someone asks, try adding one specific thing you are known for or responsible for. Just one. See how the conversation changes."
            },
            {
              label: "I try to describe it but I always feel like I am either bragging or underselling.",
              response: "That tension usually means you have not found the right frame yet. Accurate description with specific outcomes never reads as bragging. It reads as professional confidence. That is what we are building here."
            },
            {
              label: "I am pretty good at talking about my work. I know how to frame it for different audiences.",
              response: "That skill is genuinely rare. The next level is helping the people around you develop it too. That is mentorship and it is one of the clearest markers of leadership readiness."
            }
          ]
        },
        scenario: {
          setup: "You are updating your resume for the first time in three years. Your current job title is Pharmacy Technician. You have been responsible for controlled substance reconciliation, training new hires and covering lead responsibilities during your supervisor's days off for the past 18 months.",
          prompt: "Write three resume bullet points that accurately reflect what you have been doing."
        },
        answer: {
          recommended: "Here are three examples. First: Served as acting Lead Technician during supervisor absences, coordinating workflow and staff task distribution across a team of four technicians. Second: Responsible for daily controlled substance reconciliation and discrepancy reporting in compliance with DEA documentation standards. Third: Provided informal onboarding and peer training for new pharmacy technicians, supporting faster workflow integration and reducing pharmacist intervention during the onboarding period.",
          why: "These bullet points do not exaggerate anything. They describe real work using language that communicates responsibility and impact. A hiring manager reading these sees a tech who is already operating at a lead level. That is the point."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · CPhT-Adv · Performance Improvement Specialist",
          aiPrompt: "I just completed the lesson Communicating Your Value Without Underselling. Help me write strong resume bullet points and interview answers for my current role based on my background and experience."
        }
      }
    ]
  },
  {
   id: "btc4",
    title: "Translating Your Skills to Leadership Roles",
    icon: "🔄",
    desc: "Turn your daily work into a leadership resume.",
    lessons: [
      {
        id: "btc4l1",
        title: "You Are Already Doing Leadership Work",
        sections: [
          {
            header: "The Work You Are Not Counting",
            body: "Most pharmacy technicians who have been in the field for more than a year are already doing leadership work. They are training new staff. They are catching errors before they reach the pharmacist. They are managing the workflow when things get backed up. They are the person other techs come to when something is unclear.\n\nNone of that is in the job description. And most of the time, none of it is on the resume.\n\nThe gap between what experienced techs actually do and what they say they do is one of the most consistent patterns in pharmacy career development. It is not a gap in competence. It is a gap in recognition, both how others see you and how you see yourself."
          },
          {
            header: "Translating Daily Work Into Leadership Language",
            body: "The shift from technician language to leadership language is not about exaggerating what you do. It is about describing it at the right level of abstraction.\n\nCounting and dispensing medications becomes managing high-volume prescription workflow with accuracy and compliance. Training a new tech becomes developing and delivering onboarding support that accelerated new hire integration. Catching a controlled substance discrepancy becomes identifying and escalating a regulatory compliance risk before it became a reportable incident.\n\nSame work. Different frame. The frame is what gets you into leadership conversations."
          }
        ],
        keyPoints: [
          "Leadership language describes the impact and purpose of your work, not just the task itself.",
          "Every tech role contains transferable leadership skills that most techs never put into words.",
          "The translation from task language to leadership language is a learnable skill.",
          "Resumes and interviews reward people who can articulate the value of their work, not just its content."
        ],
        takeaway: "The leadership experience you are looking for on your resume is already there. You just have not written it down yet.",
        selfCheck: {
          prompt: "When you think about your current role, which of these feels most true?",
          options: [
            {
              label: "I do not think of what I do as leadership. I am just doing my job.",
              response: "That humility is common among the most competent techs. The reframe is not about inflating what you do. It is about accurately describing it. Training a new tech is leadership. Catching an error is risk management. These are not exaggerations. They are accurate descriptions of real work."
            },
            {
              label: "I know I am doing leadership work but I do not know how to put it into words.",
              response: "That is exactly what this module addresses. The next lesson gives you the specific language and frameworks to translate your daily work into leadership language that resonates in interviews and on resumes."
            },
            {
              label: "I have tried to describe my work as leadership before but it did not land the way I expected.",
              response: "The issue is usually specificity. Saying I help train new techs lands differently than I developed and delivered onboarding support for three new technicians resulting in faster workflow integration. Same work. Very different impression. We will work on that in the next lesson."
            }
          ]
        },
        scenario: {
          setup: "You are applying for a Lead Technician position at your current workplace. The manager asks you in the interview: What leadership experience do you have? You have never held a formal leadership title.",
          prompt: "How do you answer that question and what specific examples would you draw from your current role?"
        },
        answer: {
          recommended: "Start by reframing the question in your own mind before you answer it. Leadership experience is not the same as leadership titles. Then answer with three specific examples, each one naming what you did, what the outcome was and why it mattered. For example: In my current role I have been the primary point of contact for onboarding three new technicians over the past year. I identified a recurring data entry error pattern on our shift and brought it to the pharmacist as a workflow recommendation rather than an individual correction. And during our two most understaffed periods this year I coordinated task distribution to keep fill times within standard without pharmacist intervention.",
          why: "Hiring managers for lead roles are not looking for someone who has held the title before. They are looking for evidence that the person already thinks and operates like a leader. Specific examples with outcomes provide that evidence far more effectively than general statements about being a team player."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · Training Coordinator · CPhT-Adv",
          aiPrompt: "I just completed the lesson Translating Your Skills to Leadership Roles. Help me rewrite my current job responsibilities using leadership language I can use on my resume and in interviews."
        }
      },
      {
        id: "btc4l2",
        title: "Communicating Your Value Without Underselling",
        sections: [
          {
            header: "Why Competent People Undersell Themselves",
            body: "There is a pattern that shows up consistently among experienced pharmacy technicians, especially those from underrepresented communities who were taught that humility means minimizing. They do exceptional work, they know their environment inside and out, they carry responsibilities that far exceed their job description and then they sit in an interview or write a resume and describe themselves as someone who helps out and works well with others. The work is real. The description does not match it. This is not a character flaw. It is a skill gap and it is completely fixable."
          },
          {
            header: "The Framework for Communicating What You Actually Do",
            body: "Every professional accomplishment can be described using three elements. What you did, the scope of it and the outcome or impact. I processed prescriptions becomes I managed high-volume prescription processing averaging 200 fills per shift while maintaining a zero dispensing error rate over six months. I trained new staff becomes I developed an informal onboarding process for new technicians that reduced time-to-independence by approximately two weeks based on pharmacist feedback. You do not need to have metrics for everything. Qualitative outcomes matter too. The pharmacist specifically requested I work the controlled substance reconciliation shifts tells a story about trust and reliability that a resume line cannot fully capture but an interview answer absolutely can."
          }
        ],
        keyPoints: [
          "Underselling is a skill gap, not a character trait. It is fixable with practice.",
          "Every accomplishment has three elements: what you did, the scope and the outcome.",
          "Qualitative outcomes are as valuable as quantitative ones when described specifically.",
          "The goal is accuracy, not inflation. Your actual work is more impressive than your current description of it."
        ],
        takeaway: "Describing your work accurately is not arrogance. It is a professional skill that gets you into rooms where your work can speak for itself.",
        selfCheck: {
          prompt: "How do you typically describe your work when someone asks what you do?",
          options: [
            {
              label: "I keep it simple. I say I am a pharmacy technician and leave it at that.",
              response: "That simplicity is costing you opportunities. The next time someone asks, try adding one specific thing you are known for or responsible for. Just one. See how the conversation changes."
            },
            {
              label: "I try to describe it but I always feel like I am either bragging or underselling.",
              response: "That tension usually means you have not found the right frame yet. Accurate description with specific outcomes never reads as bragging. It reads as professional confidence. That is what we are building here."
            },
            {
              label: "I am pretty good at talking about my work. I know how to frame it for different audiences.",
              response: "That skill is genuinely rare. The next level is helping the people around you develop it too. That is mentorship and it is one of the clearest markers of leadership readiness."
            }
          ]
        },
        scenario: {
          setup: "You are updating your resume for the first time in three years. Your current job title is Pharmacy Technician. You have been responsible for controlled substance reconciliation, training new hires and covering lead responsibilities during your supervisor's days off for the past 18 months.",
          prompt: "Write three resume bullet points that accurately reflect what you have been doing."
        },
        answer: {
          recommended: "Here are three examples. First: Served as acting Lead Technician during supervisor absences, coordinating workflow and staff task distribution across a team of four technicians. Second: Responsible for daily controlled substance reconciliation and discrepancy reporting in compliance with DEA documentation standards. Third: Provided informal onboarding and peer training for new pharmacy technicians, supporting faster workflow integration and reducing pharmacist intervention during the onboarding period.",
          why: "These bullet points do not exaggerate anything. They describe real work using language that communicates responsibility and impact. A hiring manager reading these sees a tech who is already operating at a lead level. That is the point."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · CPhT-Adv · Performance Improvement Specialist",
          aiPrompt: "I just completed the lesson Communicating Your Value Without Underselling. Help me write strong resume bullet points and interview answers for my current role based on my background and experience."
        }
      }
    ]
  },
  {
    id: "btc5",
    title: "Advanced Certifications and What They Actually Open",
    icon: "🎓",
    desc: "Know what credentials unlock and when to pursue them.",
    lessons: [
      {
        id: "btc5l1",
        title: "CPhT-Adv — What It Is and What It Actually Changes",
        sections: [
          {
            header: "Beyond the Credential",
            body: "The CPhT-Adv is the most recognized advanced credential for pharmacy technicians in the United States. But the credential itself is not the point. The point is what earning it signals to every employer, pharmacist and hiring manager who sees it. It signals that you did not stop at the minimum. That you sought out specialized knowledge across multiple areas of practice. That you meet a standard that most pharmacy technicians never pursue.\n\nIn a field where the baseline certification is the same whether you have six months or six years of experience, the CPhT-Adv is one of the clearest ways to make your depth of experience visible on paper."
          },
          {
            header: "How It Works and What It Requires",
            body: "The CPhT-Adv is offered through both BPTS and PTCB. There is no separate exam. It is an application-based credential earned once you meet specific requirements. You need an active CPhT, at least two years of supervised pharmacy experience and a combination of specialty certificates. Through BPTS the path requires four assessment-based specialty certificates with at least one from BPTS. Through PTCB the requirements are similar with specific certificate combinations accepted.\n\nOnce approved you receive a digital badge through Credly that you display on LinkedIn, your resume and your email signature. It renews every two years and requires 25 hours of ACPE-accredited continuing education."
          }
        ],
        keyPoints: [
          "CPhT-Adv signals advanced practice to employers in a way that years of experience alone cannot.",
          "It is application-based with no separate exam required.",
          "Requirements include active CPhT, two years of experience and specialty certificates.",
          "The digital badge through Credly makes the credential visible on LinkedIn and professional profiles."
        ],
        takeaway: "The CPhT-Adv does not make you more competent overnight. It makes your existing competence visible to people who have never worked with you.",
        selfCheck: {
          prompt: "Where are you in your certification journey right now?",
          options: [
            {
              label: "I have my CPhT but have not looked into what comes next.",
              response: "You are closer than you think. The next step is identifying which specialty certificates align with your current work. You do not need to pursue all of them at once. Start with one that reflects what you already do every day."
            },
            {
              label: "I am actively working toward specialty certificates or the CPhT-Adv.",
              response: "Stay the course. The compounding effect of credentials is real. Each certificate makes the next one easier to pursue and the overall picture more compelling to anyone evaluating your background."
            },
            {
              label: "I already hold the CPhT-Adv or other advanced credentials.",
              response: "The credential is the floor, not the ceiling. The question now is how visible it is. Is it on your LinkedIn? Your email signature? Are you using it to position yourself for the next opportunity?"
            }
          ]
        },
        scenario: {
          setup: "A pharmacist you respect asks you why you are pursuing the CPhT-Adv since your pay will not change immediately and your current role does not require it.",
          prompt: "How do you respond and what does your answer reveal about how you think about your career?"
        },
        answer: {
          recommended: "I am not pursuing it for my current role. I am pursuing it for the role I want to be in two years. The credential makes my experience readable to people who have never worked with me. And the specialty certificates I need to earn it are pushing me to formalize knowledge I already use every day but have never documented.",
          why: "The pharmacist asked a legitimate question. A defensive answer suggests you have not thought it through. A clear forward-looking answer signals that you are operating with intention. That conversation often becomes a reference point for how a pharmacist thinks about you when a leadership opportunity comes up."
        },
        connection: {
          tag: "Lead Pharmacy Technician · CQI Coordinator · Pharmacy Supervisor · Training Coordinator",
          aiPrompt: "I just completed the lesson CPhT-Adv — What It Is and What It Actually Changes. Based on my current certifications and background, help me understand whether I should pursue CPhT-Adv now or focus on specialty certificates first."
        }
      },
      {
        id: "btc5l2",
        title: "Choosing Your Next Certification Based on Where You Want to Go",
        sections: [
          {
            header: "Not All Credentials Open the Same Doors",
            body: "The most common mistake pharmacy technicians make with certifications is pursuing whatever is available rather than whatever is strategic. Both PTCB and BPTS offer a range of specialty certificates and board certifications. Each one positions you differently depending on the environment you work in and the role you are moving toward.\n\nA tech in retail pursuing a sterile compounding credential is building knowledge but not necessarily building toward their next opportunity. A tech in a hospital IV room pursuing BCSCPT is doing both. The difference is alignment. Your certifications should tell a coherent story about where you are going, not just what you have done."
          },
          {
            header: "A Framework for Choosing What to Pursue Next",
            body: "Start with your target role. What is the next position you want to hold? Look at job postings for that role and identify what credentials appear most frequently. That is market signal. Then look at what you already do every day and ask which certificate would formalize and validate that existing knowledge. That is your lowest friction path to a credential with real relevance.\n\nFinally consider the CPhT-Adv pathway. If you are within reach of the certificate requirements, it may be more strategic to pursue the certificates that count toward CPhT-Adv rather than pursuing certificates randomly. A planned pathway gets you further faster."
          }
        ],
        keyPoints: [
          "Credential selection should align with your target role, not just what is available.",
          "Job postings for your target role are the clearest signal of what credentials matter to employers.",
          "The CPhT-Adv pathway provides a framework for choosing certificates strategically.",
          "Formalizing knowledge you already use every day is the lowest friction path to a relevant credential."
        ],
        takeaway: "A planned certification pathway tells a story. A random collection of credentials just fills space on a resume.",
        selfCheck: {
          prompt: "How have you made certification decisions in the past?",
          options: [
            {
              label: "I pursued what was available or what my employer offered.",
              response: "That is how most techs start. The shift is moving from reactive to intentional. Now that you have a clearer picture of where you want to go, you can evaluate future opportunities against that direction."
            },
            {
              label: "I have thought about it but I am not sure which path makes sense for my goals.",
              response: "Start with the job posting exercise in this lesson. Pull three postings for the role you want and look at what credentials appear. That data will tell you more than any general advice can."
            },
            {
              label: "I have a clear plan and I am working it.",
              response: "That intentionality is exactly what separates techs who advance consistently from those who wait for the right opportunity. Make sure your plan is visible to the people around you who can support or accelerate it."
            }
          ]
        },
        scenario: {
          setup: "You work in an inpatient hospital pharmacy and your goal is to move into a Lead Tech role within 18 months. You currently hold your CPhT and have no specialty certificates.",
          prompt: "Using what you know about your environment and your goal, what would your certification plan look like for the next 18 months?"
        },
        answer: {
          recommended: "Start with the Medication Safety certificate from either PTCB or BPTS since safety mindset is central to any lead role in an inpatient setting and it formalizes work you are already doing. Add Controlled Substances Diversion Prevention next since inpatient lead roles almost universally involve controlled substance oversight. Those two certificates plus your existing CPhT put you on the CPhT-Adv pathway. Research whether your target job postings mention CPhT-Adv and if so make that the 18-month goal by identifying the remaining certificate requirements and mapping them to a timeline.",
          why: "This plan is not random. Every certificate directly supports the target role, builds relevant knowledge and contributes to a larger credential that will make your application stand out. Eighteen months is realistic. The plan is specific enough to execute and flexible enough to adjust."
        },
        connection: {
          tag: "Lead Pharmacy Technician · CPhT-Adv · Pharmacy Supervisor · CQI Coordinator",
          aiPrompt: "I just completed the lesson Choosing Your Next Certification Based on Where You Want to Go. Based on my current role and where I want to go, help me build a specific certification plan."
        }
      },
      {
        id: "btc5l3",
        title: "Making Your Credentials Visible and Working For You",
        sections: [
          {
            header: "A Credential Nobody Knows About Does Not Help You",
            body: "You earned the certificate. You passed the assessment. You have the digital badge sitting in a Credly email you have not opened since you received it. This is more common than it should be. Credentials only create opportunity when they are visible to the people who make decisions about your career.\n\nThat means your LinkedIn profile needs to be updated. Your resume needs to reflect the credential with the issuing body and the date. Your email signature at work, if professional signatures are used, should include your full credential string. Your manager should know you earned it. The pharmacist you work with most closely should know you earned it. Visibility is not bragging. It is basic career management."
          },
          {
            header: "How Credentials Change Conversations",
            body: "When your credentials are visible something specific happens. People start conversations with you differently. A hiring manager who sees CPhT-Adv on your resume before the interview begins already has a different baseline assumption about your experience than they would otherwise. A pharmacist who sees your Medication Safety certificate on your badge or profile is more likely to include you in safety-related conversations.\n\nCredentials change how people perceive your expertise before you have said a word. That perception opens doors that your daily work alone cannot."
          }
        ],
        keyPoints: [
          "Credentials must be visible to create opportunity. Earning them is only half the work.",
          "LinkedIn, your resume and your email signature are the three primary visibility channels.",
          "Visible credentials change how people engage with you before you have said anything.",
          "Informing your manager and pharmacist directly about credentials you earn is professional, not boastful."
        ],
        takeaway: "Earning a credential without making it visible is like doing exceptional work on a shift nobody witnessed. The work happened. The opportunity did not.",
        selfCheck: {
          prompt: "How visible are your current credentials right now?",
          options: [
            {
              label: "I have credentials but I have not updated my LinkedIn or resume recently.",
              response: "Today is a good day to change that. Start with LinkedIn. Add each credential with the issuing body and the date earned. It takes fifteen minutes and it is one of the highest return-on-time activities in your career."
            },
            {
              label: "My credentials are visible on my resume and LinkedIn but I have not mentioned them at work.",
              response: "That next step feels uncomfortable for a lot of people but it is simpler than it sounds. The next time you are asked about your background or goals, mention it naturally. You do not need to announce it. Just include it."
            },
            {
              label: "My credentials are fully visible and I actively reference them in professional conversations.",
              response: "That visibility is working for you. The next layer is helping peers understand how to do the same. That is leadership."
            }
          ]
        },
        scenario: {
          setup: "You earned your Medication Safety certificate two months ago. You have not updated your LinkedIn, your resume still shows only CPhT and you have not mentioned it to your manager or pharmacist.",
          prompt: "Walk through the specific steps you would take in the next week to make this credential visible and working for you."
        },
        answer: {
          recommended: "Day one, open the Credly email and accept the digital badge. Add it to your LinkedIn profile under licenses and certifications with the issuing body and date. Day two, update your resume to include the certificate under a certifications section. Day three, mention it to your pharmacist or manager in a natural context. Something like I finished my Medication Safety certificate last month. I wanted you to know in case it is relevant to anything coming up.",
          why: "Most techs let credentials sit quietly on a piece of paper. The ones who advance treat each credential as a professional communication. They earned it. They announce it appropriately. They let it work for them. That habit compounds significantly over a career."
        },
        connection: {
          tag: "CPhT-Adv · Lead Pharmacy Technician · Pharmacy Supervisor · Performance Improvement Specialist",
          aiPrompt: "I just completed the lesson Making Your Credentials Visible and Working For You. Help me create a plan to make my current credentials more visible and put them to work for my career."
        }
      }
    ]
  },
  {
    id: "btc6",
    title: "Career Pathways and Long-Term Positioning",
    icon: "🗺️",
    desc: "See the full path. Plan further ahead than your next role.",
    lessons: [
      {
        id: "btc6l1",
        title: "The Pathways Available to You",
        sections: [
          {
            header: "More Doors Than Most Techs Realize",
            body: "Most pharmacy technicians see two career options. Stay where they are or become a pharmacist. The reality is significantly broader than that. The pharmacy technician field has developed a range of specialized and leadership roles that were not widely available ten years ago and are expanding as the scope of technician practice grows.\n\nUnderstanding what is available is the first step to positioning yourself for it. You cannot aim at a target you do not know exists."
          },
          {
            header: "The Major Pathways",
            body: "The retail to inpatient transition is one of the most common moves and one of the most valuable for career growth. Inpatient environments generally offer more structured advancement, stronger exposure to clinical processes and clearer pathways to leadership roles.\n\nSpecialty pharmacy is a growing area covering oncology, infusion, rare disease and more. These roles require specific training but offer higher compensation and deeper clinical engagement than standard dispensing.\n\nThe educator and trainer pathway is underutilized. Techs who hold CPTEd or who have significant training experience are positioned for roles in workforce development, pharmacy school programs and healthcare system education departments.\n\nQuality and compliance roles including CQI Coordinator, Medication Safety Officer support and Performance Improvement Specialist are increasingly available to credentialed techs with strong documentation and process skills. And leadership tracks including Lead Tech, Supervisor and Pharmacy Operations Manager are the most visible advancement pathway in most health systems."
          }
        ],
        keyPoints: [
          "The pharmacy technician career landscape is broader than most techs are aware of.",
          "Retail to inpatient transition is one of the highest-value moves for long-term career growth.",
          "Specialty pharmacy, education, quality and leadership represent four distinct advancement tracks.",
          "Knowing what is available is the prerequisite to positioning yourself for it."
        ],
        takeaway: "Your career path is not a single hallway. It is a building with more doors than you have tried to open.",
        selfCheck: {
          prompt: "Which pathway feels most aligned with where you want to go?",
          options: [
            {
              label: "I want to move into a leadership role at my current or a similar workplace.",
              response: "The leadership track is the most clearly defined pathway. Lead Tech and Supervisor roles are available in most pharmacy environments. The next step is identifying what your target organization looks for in those roles and building toward it deliberately."
            },
            {
              label: "I am interested in moving from retail to inpatient or into a specialty area.",
              response: "That transition is very achievable with the right preparation. The next lesson covers how to position yourself for a transition before you are ready to make it. That timing is critical."
            },
            {
              label: "I am not sure yet. I know I want more but I have not settled on a direction.",
              response: "That is a completely valid place to be. The goal of this module is to give you enough visibility into each pathway that a direction becomes clearer. You do not need to decide today. You need enough information to start leaning."
            }
          ]
        },
        scenario: {
          setup: "You have been in retail pharmacy for four years and are starting to feel like you have reached the ceiling of what is available to you in that environment. You are interested in inpatient but have no hospital experience.",
          prompt: "What are the realistic first steps toward making that transition and what would make you a competitive candidate?"
        },
        answer: {
          recommended: "Start by researching entry-level inpatient tech positions at local health systems. Many post roles specifically for techs transitioning from retail and value the customer service and insurance processing experience that retail builds. Pursue a certification that bridges the gap. Medication Safety or Controlled Substances Diversion Prevention are directly relevant to inpatient environments and signal readiness to hiring managers. Connect with a tech who works in an inpatient setting and ask about their experience. Informational conversations open more doors than applications in most cases. Update your resume to frame your retail experience in terms of skills that transfer.",
          why: "The biggest barrier to the retail to inpatient transition is not experience. It is framing. Retail techs have more transferable skills than they realize. The ones who make the transition successfully are the ones who can articulate those skills in the language of the environment they are moving into."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Inpatient Pharmacy Technician · CPhT-Adv · Specialty Pharmacy Technician",
          aiPrompt: "I just completed the lesson The Pathways Available to You. Based on my background and current role, help me understand which career pathway makes the most sense for me and what I should do next."
        }
      },
      {
        id: "btc6l2",
        title: "Positioning Yourself for a Transition Before You Are Ready",
        sections: [
          {
            header: "The Timing Problem Most Techs Get Wrong",
            body: "Most pharmacy technicians start preparing for a career transition about three months before they want to make it. They update their resume, apply for jobs and wonder why they are not competitive. The techs who transition successfully into new environments or higher roles typically started preparing twelve to eighteen months before the move. Not because they are more talented but because they understood that positioning is a long game.\n\nBy the time you are ready to move, the groundwork should already be laid. The credentials should already be visible. The relationships should already exist. The resume should already tell the right story."
          },
          {
            header: "What Early Positioning Actually Looks Like",
            body: "It starts with research. Understand the environment or role you want to move into well enough to speak its language. If you want to move into inpatient, know what USP 797 means, know what an ADC is, know what cart fill involves. You do not need to have done it. You need to be able to demonstrate that you understand it.\n\nIt continues with credential building. Identify what certificates or credentials appear in job postings for your target role and start earning them now, not when you are applying. It includes relationship building. Attend a professional organization event. Connect with a tech or pharmacist in your target environment on LinkedIn. Ask for a fifteen minute conversation. These relationships are how most good opportunities actually happen."
          }
        ],
        keyPoints: [
          "Successful transitions are built twelve to eighteen months before the move, not three months before.",
          "Research, credential building, relationship building and current-role framing are the four elements of early positioning.",
          "Speaking the language of your target environment signals readiness before you have the experience.",
          "The relationships you build now are how most real opportunities surface."
        ],
        takeaway: "The best time to prepare for your next role was a year ago. The second best time is today.",
        selfCheck: {
          prompt: "How far out are you currently thinking about your next career move?",
          options: [
            {
              label: "I am focused on my current role. I will think about next steps when something comes up.",
              response: "That reactive approach works occasionally but it leaves opportunity to chance. Starting to think twelve months out does not mean you have to act now. It means you are ready when something comes up rather than scrambling to prepare after it does."
            },
            {
              label: "I have a general sense of where I want to go but I have not started preparing actively.",
              response: "That clarity of direction is valuable. The next step is turning that direction into a specific list of actions. Credentials to earn, relationships to build, language to develop. Start with one item from that list this week."
            },
            {
              label: "I am actively preparing for a move I want to make in the next year or two.",
              response: "That intentionality is exactly right. The refinement is making sure your preparation includes relationship building, not just credential building. Most opportunities come through people, not applications."
            }
          ]
        },
        scenario: {
          setup: "You want to move into a CQI Coordinator or Medication Safety support role within the next two years. You currently work as a staff pharmacy technician in a retail setting with no formal quality experience.",
          prompt: "Build a rough twelve month preparation plan for that transition."
        },
        answer: {
          recommended: "Months one through three: Research the role. Read job postings. Understand what organizations look for. Identify two or three credentials that appear consistently. Month three through six: Pursue your first target credential. Medication Safety is the most direct entry point. While studying, document any quality or safety related observations you make at work. Month six through nine: Pursue your second credential. Begin building a LinkedIn presence that reflects your direction. Connect with people in quality and safety roles in pharmacy. Month nine through twelve: Seek out any quality adjacent responsibilities in your current role. Begin applying selectively to roles that represent the step toward your target.",
          why: "This plan builds on itself. Each step makes the next step more credible. By month twelve you have two relevant credentials, a developing professional network, documented quality observations from your current work and a resume that tells a coherent story toward your target role. That is a competitive candidate."
        },
        connection: {
          tag: "CQI Coordinator · Performance Improvement Specialist · Medication Safety Officer · CPhT-Adv",
          aiPrompt: "I just completed the lesson Positioning Yourself for a Transition Before You Are Ready. Help me build a specific preparation plan for the career transition I want to make based on my background."
        }
      },
      {
        id: "btc6l3",
        title: "Thinking Three to Five Years Out",
        sections: [
          {
            header: "Why Most Techs Only Think One Step Ahead",
            body: "The majority of pharmacy technician career planning happens in single steps. Get certified. Get a raise. Get the lead role. Each goal is reasonable but disconnected from a larger direction. The result is a career that advances incrementally without a clear destination.\n\nThe techs who build careers they are genuinely proud of are almost always the ones who had a picture of what they were building toward, even if that picture changed along the way. Three to five year thinking is not about predicting the future. It is about having a direction clear enough to make decisions that compound in the right direction."
          },
          {
            header: "Building a Three to Five Year Career Picture",
            body: "Start with the question: what do you want your professional life to look like in five years? Not just the title but the environment, the type of work, the level of responsibility, the way you spend your days. Get specific. I want to be a Lead Tech in a hospital inpatient setting overseeing a team of four to six technicians with my CPhT-Adv and a specialty certification in sterile compounding is a target you can build toward.\n\nOnce you have the picture, work backward. What needs to be true in three years to make five years possible? What needs to be true in one year to make three years possible? What needs to be true in six months to make one year possible? That backward mapping turns a distant goal into a series of near-term actions that are completely within your control."
          }
        ],
        keyPoints: [
          "Single step career planning produces incremental results without a clear destination.",
          "Three to five year thinking provides direction for decisions that compound over time.",
          "Specificity in your five year picture is what makes backward planning possible.",
          "Working backward from a clear goal produces a near-term action plan that is immediately executable."
        ],
        takeaway: "You do not need to know exactly where you will end up. You need to know enough about the direction to make decisions today that point that way.",
        selfCheck: {
          prompt: "How clearly can you describe what you want your professional life to look like in five years?",
          options: [
            {
              label: "I have a clear picture. I know the role, the environment and roughly what it looks like.",
              response: "That clarity is a genuine advantage. The next step is the backward mapping exercise from this lesson. Turn that picture into a twelve month action list and review it quarterly."
            },
            {
              label: "I have a general sense of direction but the details are fuzzy.",
              response: "Spend fifteen minutes this week writing down what a good five years looks like in as much detail as you can. Do not edit yourself. Just write. The details will sharpen with time and the act of writing them down changes how you make daily decisions."
            },
            {
              label: "I honestly do not know. I take things as they come.",
              response: "That approach has gotten you this far and there is nothing wrong with it. The invitation is just to try adding a longer lens. Not because you have to plan perfectly but because even a rough direction helps you recognize the right opportunities when they appear."
            }
          ]
        },
        scenario: {
          setup: "You are three years into your pharmacy career, you have your CPhT and you are working in retail. You enjoy the work but you know you want more. You have never sat down and thought more than six months ahead.",
          prompt: "Walk through the five year visioning and backward mapping exercise for your own situation."
        },
        answer: {
          recommended: "Five year picture: Lead Technician in an inpatient hospital pharmacy, holding CPhT-Adv and a sterile compounding credential, managing a team and involved in quality improvement processes. Three year milestone: Employed in an inpatient setting, holding at least two specialty certificates, actively working toward CPhT-Adv requirements. One year milestone: Transitioned to inpatient or actively positioned for that transition with one specialty certificate earned, resume and LinkedIn updated to reflect the direction. Six month milestone: First specialty certificate identified and in progress, inpatient environment researched, one professional connection made in that setting, LinkedIn profile complete. This week: Identify the first certificate. Pull three inpatient job postings. Update LinkedIn.",
          why: "The five year goal feels distant and possibly overwhelming. This week's action is completely manageable. The backward mapping connects them. Every action this week is in service of something five years from now and that connection makes the daily work feel purposeful rather than routine."
        },
        connection: {
          tag: "Lead Pharmacy Technician · CPhT-Adv · Pharmacy Supervisor · Specialty Pharmacy Technician",
          aiPrompt: "I just completed the lesson Thinking Three to Five Years Out. Help me build a five year career vision and map it backward to specific actions I can take this week."
        }
      }
    ]
  },
  {
    id: "btc7",
    title: "Quality and Safety Mindset",
    icon: "🛡️",
    desc: "Build the habits that protect patients and advance careers.",
    lessons: [
      {
        id: "btc7l1",
        title: "What a Quality Mindset Looks Like in Daily Practice",
        sections: [
          {
            header: "Quality Is Not a Department. It Is a Habit.",
            body: "Most pharmacy technicians hear the word quality and think about audits, inspections and compliance reviews. Those are the formal expressions of quality. But the actual work of quality happens every single day in decisions that never show up in a report.\n\nIt happens when you pause before finalizing a data entry instead of rushing because the line is long. It happens when you flag an ambiguous order instead of making your best guess. It happens when you document a discrepancy accurately even though it means more paperwork and a difficult conversation. Quality is not what you do when someone is watching. It is what you do when no one is."
          },
          {
            header: "The Daily Habits of Quality-Minded Techs",
            body: "Quality-minded techs slow down at the right moments. Not on everything but specifically on high-risk steps. Controlled substance counts. High-alert medication fills. Verbal order readbacks. They treat documentation as communication, not paperwork. Every entry they make is written for the next person who needs to understand what happened and why.\n\nThey escalate early. A quality mindset means recognizing that a small uncertainty now is always cheaper to address than a large problem later. And they close the loop. When they flag something, they follow up to make sure it was addressed. Not because they are checking up on anyone but because they understand that their responsibility does not end with the flag."
          }
        ],
        keyPoints: [
          "Quality is a daily practice, not an event that happens during audits.",
          "Slowing down at high-risk moments is a skill that quality-minded techs develop deliberately.",
          "Documentation is communication with the next person in the chain, not a compliance task.",
          "Early escalation and loop closure are the two habits that prevent small problems from becoming large ones."
        ],
        takeaway: "Quality is not about being perfect. It is about building habits that make errors less likely and more catchable when they do occur.",
        selfCheck: {
          prompt: "Which of these best describes how you currently approach accuracy and documentation?",
          options: [
            {
              label: "I work quickly and accurately. I trust my instincts and rarely slow down unless something feels off.",
              response: "Speed and instinct are valuable. The refinement is identifying the specific steps where your instincts are most likely to miss something and building deliberate pauses there. Not everywhere. Just at the high-risk points."
            },
            {
              label: "I am very careful but I sometimes feel like I am the only one who cares about doing things correctly.",
              response: "That frustration is common among quality-minded techs in environments that have not fully built a quality culture. Your consistency still matters even when it is not mirrored around you. And it is being noticed by someone, even if that feedback has not reached you yet."
            },
            {
              label: "Honestly I know I rush sometimes and my documentation is not always as thorough as it should be.",
              response: "That honesty is the first step. Pick one specific habit to improve this week. Not everything at once. Just one. Deliberate pause before controlled substance count finalization is a high-impact, low-effort starting point."
            }
          ]
        },
        scenario: {
          setup: "You are working a busy shift and you notice that a colleague has been consistently skipping the readback step on verbal orders because it is slowing things down. No errors have occurred yet but you know the risk.",
          prompt: "What do you do and how do you frame it in a way that is constructive rather than confrontational?"
        },
        answer: {
          recommended: "First, continue modeling the correct behavior yourself without comment. Then in a quiet moment approach your colleague peer to peer. Something like: Hey, I noticed we have both been skipping the readback on verbal orders when it gets busy. I know it feels like it slows things down but I got nervous about it and wanted to flag it. Can we make a point to do it even on the rushed shifts? You are including yourself, keeping it low-key and focusing on the behavior rather than the person. If it continues after that conversation, bring it to your pharmacist as a workflow observation rather than a complaint about the individual.",
          why: "Confrontational correction triggers defensiveness. Peer-level, we-framing invites collaboration. You addressed a real safety risk, preserved the relationship and modeled the kind of quality advocacy that gets noticed by leadership over time."
        },
        connection: {
          tag: "CQI Coordinator · Medication Safety Officer · Lead Pharmacy Technician · Performance Improvement Specialist",
          aiPrompt: "I just completed the lesson What a Quality Mindset Looks Like in Daily Practice. Help me identify specific habits I can build in my current role to strengthen my quality and safety mindset."
        }
      },
      {
        id: "btc7l2",
        title: "Engaging with Safety Processes Instead of Just Complying",
        sections: [
          {
            header: "The Difference Between Compliance and Engagement",
            body: "Compliance means you do what the policy says. Engagement means you understand why the policy exists, you follow it even when it is inconvenient, you notice when it is not working the way it was designed to and you bring that observation forward.\n\nMost pharmacy technicians operate at compliance. The techs who advance into quality, safety and leadership roles operate at engagement. The difference is not intelligence or effort. It is perspective. Compliant techs see safety processes as requirements. Engaged techs see them as systems that are trying to solve a problem, and like all systems they can be improved."
          },
          {
            header: "How to Engage With Safety Processes Actively",
            body: "Start by understanding the why behind every process you follow. Why does the controlled substance count require two witnesses? Why does the high-alert medication require a second check? Why is the readback required on verbal orders? When you know the why you follow the process differently and you notice more quickly when the process is breaking down.\n\nThen start observing patterns. If a safety step is being skipped consistently, that is a system design problem as much as a behavior problem. Bring it forward as a process observation rather than a complaint. Organizations that have strong safety cultures are built on techs and pharmacists who report near misses and process gaps without fear of blame. And when error reporting systems exist, use them. A near miss reported is a future error prevented."
          }
        ],
        keyPoints: [
          "Compliance follows policy. Engagement understands why the policy exists.",
          "Knowing the why behind a process changes how you follow it and what you notice.",
          "Pattern observation and process gap reporting are the highest-value safety contributions a tech can make.",
          "Near miss reporting prevents future errors. It is one of the most impactful safety behaviors available to frontline staff."
        ],
        takeaway: "The safest pharmacies are not the ones with the strictest rules. They are the ones where every person on the team feels responsible for the outcome.",
        selfCheck: {
          prompt: "How do you currently relate to safety processes and policies at work?",
          options: [
            {
              label: "I follow the policies because I am required to. I do not think about them much beyond that.",
              response: "That compliance is a baseline. The invitation in this lesson is to pick one policy this week and spend five minutes understanding why it exists. That shift in perspective changes how you follow it and what you notice when it is not working."
            },
            {
              label: "I follow the policies and I notice when they are not being followed but I do not usually say anything.",
              response: "You are halfway there. The observation without the communication is where the value gets lost. The next step is finding a low-stakes way to raise one observation. The framing in this lesson is designed to make that feel manageable."
            },
            {
              label: "I actively engage with safety processes, report near misses and bring process gaps to my pharmacist.",
              response: "That engagement is rare and genuinely valuable. If your organization has a formal quality improvement structure, find a way to be part of it. Your frontline perspective is exactly what those processes need."
            }
          ]
        },
        scenario: {
          setup: "You notice that the barcode scanning step before dispensing has been turned off on one of the workstations because the scanner is malfunctioning. Staff have been manually verifying without the scan for three days. No one has reported it or submitted a work order.",
          prompt: "What do you do and why does it matter beyond just the inconvenience of a broken scanner?"
        },
        answer: {
          recommended: "Submit the work order for the scanner immediately if you have the ability to do so. If not, inform your pharmacist that the scanner has been down for three days and that the barcode verification step is not happening at that station. Frame it as a safety gap, not a complaint. The scanner at station two has been down for three days and we have been manually verifying. I wanted to flag it as a risk since barcode scanning is part of our error prevention process. Then document that you raised it. If your organization has a near miss or safety reporting system, this qualifies.",
          why: "A malfunctioning barcode scanner is not just an inconvenience. It is a removed safety layer. The longer it goes unreported the longer the team operates without a protection that was specifically designed to catch errors. The tech who raises it is not being difficult. They are doing exactly what a quality and safety mindset looks like in practice."
        },
        connection: {
          tag: "CQI Coordinator · Medication Safety Officer · Performance Improvement Specialist · Lead Pharmacy Technician",
          aiPrompt: "I just completed the lesson Engaging with Safety Processes Instead of Just Complying. Help me understand how to move from compliance to genuine engagement with safety processes in my current workplace."
        }
      }
    ]
  },
  {
    id: "btc8",
    title: "Building Your Personal Brand as a Tech",
    icon: "💼",
    desc: "Get known for the right things in and out of your workplace.",
    lessons: [
      {
        id: "btc8l1",
        title: "Your Internal Brand — How You Are Known at Work",
        sections: [
          {
            header: "Your Brand at Work Is Already Established",
            body: "Every person who has worked with you has formed an impression. That impression, the thing they would say about you if someone asked, is your internal brand. You did not choose whether to have one. You only choose whether to manage it.\n\nIn a pharmacy setting your internal brand is built on a small number of highly visible dimensions. How you handle pressure. Whether you can be counted on. How you treat people with less experience or authority than you. Whether you bring problems or solutions. Whether your presence on a shift makes the environment better or harder. Most techs have never thought about their brand in these terms. The ones who manage their careers most effectively have."
          },
          {
            header: "Shaping How You Are Known Intentionally",
            body: "The first step is asking yourself what you want to be known for. Not generically but specifically. Do you want to be known as the tech who is unshakeable under pressure? The one who makes new staff feel supported? The one who catches things before they become problems? The one who knows controlled substances better than anyone on the team?\n\nPick one or two things and build toward them intentionally. Then look for opportunities to demonstrate those qualities visibly. Not performatively but genuinely. When your moment comes to show what you are about, be ready to show it. Over time the reputation compounds and the internal brand becomes the reason you get called for the hard shifts, the lead opportunities and the professional recommendations."
          }
        ],
        keyPoints: [
          "Your internal brand is already established. The question is whether it reflects what you want people to say.",
          "Brand is built on a small number of highly visible dimensions including composure, reliability and how you treat others.",
          "Identifying what you want to be known for is the prerequisite to building toward it intentionally.",
          "Internal brand compounds over time. Early investment pays long-term returns."
        ],
        takeaway: "You are always branding. The only question is whether you are doing it on purpose.",
        selfCheck: {
          prompt: "If your pharmacist or manager were describing you to someone who had never met you, what do you think they would say?",
          options: [
            {
              label: "Honestly I am not sure. I have never thought about it from their perspective.",
              response: "That is a useful realization. The exercise of imagining how others describe you reveals gaps between how you see yourself and how you are perceived. Pick one dimension you want to strengthen and focus on it for the next thirty days."
            },
            {
              label: "I have a pretty good sense of my reputation at work and I am mostly happy with it.",
              response: "That self-awareness is valuable. The next level is getting explicit feedback rather than inferring. A simple question asking what you do best and where they see room for development is one of the most powerful career conversations you can have."
            },
            {
              label: "I know exactly how I am perceived and I have been intentionally building my reputation for a while.",
              response: "That intentionality is the foundation of this entire module. The next lesson takes that internal brand and extends it beyond your current workplace. That is where the real career leverage lives."
            }
          ]
        },
        scenario: {
          setup: "You have been at your current pharmacy for two years. A new pharmacist joins the team and within the first week asks a veteran tech: Who are the people on this team I should really pay attention to? You are not in the room.",
          prompt: "Based on how you currently show up at work, what would that veteran tech say about you and is it what you want them to say?"
        },
        answer: {
          recommended: "This is a reflective exercise more than a prescriptive one. The honest answer requires you to evaluate your current internal brand against your intended one. Think about the last thirty days. What moments stand out? How did you handle the hardest shift? How did you respond to the last mistake you or someone near you made? How do you treat the newest person on the team? The veteran tech's answer is built from moments exactly like those. If the answer you imagine does not match what you want, you now have a specific starting point for what to change.",
          why: "Most people wait for feedback to understand their reputation. This exercise lets you audit your own brand proactively. The gap between what you imagine they would say and what you want them to say is your development roadmap."
        },
        connection: {
          tag: "Lead Pharmacy Technician · Pharmacy Supervisor · CPhT-Adv · Training Coordinator",
          aiPrompt: "I just completed the lesson Your Internal Brand — How You Are Known at Work. Help me assess my current internal brand and identify the one or two things I should focus on to strengthen how I am known at work."
        }
      },
      {
        id: "btc8l2",
        title: "Your External Brand — Professional Presence Beyond Your Employer",
        sections: [
          {
            header: "Why Your Professional Presence Needs to Exist Outside Your Workplace",
            body: "Your employer knows what you can do. The rest of the pharmacy world does not. If your entire professional identity lives inside one building, your career is limited to the opportunities that building offers.\n\nThe techs who build the most dynamic careers are the ones who are known in their field, not just their workplace. That does not mean you need to be famous or have a large following. It means that a hiring manager at another health system, a credentialing committee, a colleague at a professional conference can find you, understand your background and form a positive impression before you have said a word. That is what external professional presence accomplishes."
          },
          {
            header: "Building External Presence Without Starting From Scratch",
            body: "LinkedIn is the foundation. A complete LinkedIn profile with your credentials, employment history, a professional photo and a summary that describes what you do and where you are going is the minimum. It is findable, professional and permanent.\n\nBeyond LinkedIn, professional organizations like NPTA, ASHP and the Pharmacy Technician Society offer membership, networking events and sometimes volunteer or committee opportunities. These are where relationships get built outside your employer. If you have knowledge worth sharing, consider whether any local or regional pharmacy events accept speakers or panelists. The bar is lower than most people think and one presentation at a regional conference can open more doors than years of applying to job postings."
          }
        ],
        keyPoints: [
          "Professional presence outside your employer expands the opportunities available to you beyond what your current organization can offer.",
          "LinkedIn is the non-negotiable foundation of external professional presence.",
          "Professional organizations are where relationships get built across employers and environments.",
          "Speaking and volunteering opportunities exist at lower barriers than most techs assume."
        ],
        takeaway: "Your career should not be limited to what one organization decides to offer you. External presence creates options.",
        selfCheck: {
          prompt: "How visible are you professionally outside of your current workplace?",
          options: [
            {
              label: "I am not on LinkedIn and I am not involved in any professional organizations.",
              response: "LinkedIn first. Today if possible. A complete profile with your credentials and employment history is the single highest-leverage professional action available to you right now. Everything else builds from there."
            },
            {
              label: "I have a LinkedIn profile but it is not very complete and I have not been active on it.",
              response: "A dormant LinkedIn profile is better than none but a complete one works for you passively every day. Spend one hour this week updating it. Credentials, current role with specific responsibilities, a one paragraph summary of your background and direction. That investment pays returns for years."
            },
            {
              label: "I am active on LinkedIn, involved in a professional organization and building presence outside my employer.",
              response: "That visibility is compounding in ways you may not be able to see yet. Stay consistent. The relationships and opportunities that come from sustained external presence often arrive unexpectedly and from directions you did not anticipate."
            }
          ]
        },
        scenario: {
          setup: "You have been a pharmacy technician for five years, you hold your CPhT and one specialty certificate, and you have never been on LinkedIn or attended a professional pharmacy event outside of required employer training.",
          prompt: "Build a simple three month plan to establish external professional presence from scratch."
        },
        answer: {
          recommended: "Month one: Create or complete your LinkedIn profile. Professional photo, complete employment history, credentials listed with issuing bodies and dates, a two to three sentence summary that describes your background and where you are heading. Connect with colleagues, former supervisors and any pharmacists you have worked with. Month two: Join one professional organization. NPTA is a practical starting point for technicians. Explore their events, resources and any volunteer or committee opportunities. Set a goal to attend one virtual or in-person event before the end of the month. Month three: Engage on LinkedIn at least once per week. Comment thoughtfully on posts in your field, share resources that are relevant to pharmacy technicians and connect with one new person per week.",
          why: "External presence feels overwhelming when you look at people who have been building it for years. Built from scratch in ninety days with specific weekly actions it is completely manageable. The goal is not to arrive. The goal is to exist professionally outside your workplace and then keep building from there."
        },
        connection: {
          tag: "CPhT-Adv · Lead Pharmacy Technician · Pharmacy Supervisor · Pharmacy Technician Educator",
          aiPrompt: "I just completed the lesson Your External Brand — Professional Presence Beyond Your Employer. Help me build a plan to establish my professional presence outside my current workplace based on where I am starting from."
        }
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// BEYOND THE COUNTER — LESSON RENDERER
// Handles all 5 parts of every lesson automatically.
// ─────────────────────────────────────────────────────────────────────────────

function BeyondTheCounterLesson({ lesson, go }) {
  const [selfCheckPick, setSelfCheckPick] = useState(null);
  const [answerOpen, setAnswerOpen] = useState(false);

  const surface  = "#1a1d27";
  const surface2 = "#22263a";
  const teal     = "#00c9a7";
  const tealDim  = "rgba(0,201,167,0.12)";
  const tealBorder = "rgba(0,201,167,0.25)";
  const blue     = "#0094ff";
  const mu       = "#8b92a9";
  const white    = "#ffffff";

  const card = {
    background: surface,
    borderRadius: 14,
    padding: "20px 22px",
    marginBottom: 18,
    border: "1px solid rgba(255,255,255,0.06)"
  };

  const sectionHeader = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: teal,
    marginBottom: 8,
    marginTop: 0
  };

  const bodyText = {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#c8cdd8",
    margin: 0,
    whiteSpace: "pre-line"
  };

  const pill = (color, bg) => ({
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    color,
    background: bg,
    borderRadius: 20,
    padding: "3px 10px",
    letterSpacing: "0.05em"
  });

  if (!lesson) return null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 4px 40px" }}>

      {/* TITLE */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ ...pill(teal, tealDim), border: `1px solid ${tealBorder}`, marginBottom: 10 }}>
          Beyond the Counter
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: white, margin: 0, lineHeight: 1.3 }}>
          {lesson.title}
        </h1>
      </div>

      {/* PART 1 — LESSON CONTENT */}
      <div style={card}>
        <div style={{ ...pill("#0094ff", "rgba(0,148,255,0.1)"), border: "1px solid rgba(0,148,255,0.2)", marginBottom: 16 }}>
          Lesson Content
        </div>
        {(lesson.sections || []).map((sec, i) => (
          <div key={i} style={{ marginBottom: i < lesson.sections.length - 1 ? 20 : 0 }}>
            <p style={sectionHeader}>{sec.header}</p>
            <p style={bodyText}>{sec.body}</p>
          </div>
        ))}
        {lesson.keyPoints && lesson.keyPoints.length > 0 && (
          <div style={{ background: "rgba(0,148,255,0.06)", border: "1px solid rgba(0,148,255,0.15)", borderRadius: 10, padding: "14px 16px", marginTop: 20 }}>
            <p style={{ ...sectionHeader, color: blue, marginBottom: 10 }}>Key Points</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {lesson.keyPoints.map((pt, i) => (
                <li key={i} style={{ ...bodyText, marginBottom: i < lesson.keyPoints.length - 1 ? 6 : 0 }}>{pt}</li>
              ))}
            </ul>
          </div>
        )}
        {lesson.takeaway && (
          <div style={{ borderLeft: `3px solid ${teal}`, paddingLeft: 14, marginTop: 18 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#e0e4f0", margin: 0, fontStyle: "italic" }}>
              {lesson.takeaway}
            </p>
          </div>
        )}
      </div>

      {/* PART 2 — SELF-CHECK */}
      {lesson.selfCheck && (
        <div style={{ ...card, background: "linear-gradient(135deg, rgba(0,201,167,0.07), rgba(0,148,255,0.05))", border: `1px solid ${tealBorder}` }}>
          <div style={{ ...pill(teal, tealDim), border: `1px solid ${tealBorder}`, marginBottom: 14 }}>Self-Check</div>
          <p style={{ fontSize: 15, fontWeight: 700, color: white, margin: "0 0 16px" }}>{lesson.selfCheck.prompt}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(lesson.selfCheck.options || []).map((opt, i) => {
              const picked = selfCheckPick === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setSelfCheckPick(i)}
                    style={{
                      width: "100%", textAlign: "left",
                      background: picked ? "linear-gradient(135deg,rgba(0,201,167,0.18),rgba(0,148,255,0.12))" : surface2,
                      border: picked ? `1.5px solid ${teal}` : "1.5px solid rgba(255,255,255,0.08)",
                      borderRadius: picked && opt.response ? "10px 10px 0 0" : 10,
                      padding: "12px 14px", color: picked ? white : "#c8cdd8",
                      fontSize: 13, fontWeight: picked ? 600 : 400, cursor: "pointer",
                      transition: "all 0.2s ease", display: "flex", alignItems: "center", gap: 10
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: "50%",
                      border: picked ? `2px solid ${teal}` : "2px solid rgba(255,255,255,0.2)",
                      background: picked ? teal : "transparent", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, color: picked ? "#000" : "transparent", fontWeight: 800
                    }}>
                      {picked ? "✓" : ""}
                    </span>
                    {opt.label}
                  </button>
                  {picked && opt.response && (
                    <div style={{ background: "rgba(0,201,167,0.06)", border: `1px solid ${tealBorder}`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "12px 14px" }}>
                      <p style={{ fontSize: 13, color: "#b8f5eb", margin: 0, lineHeight: 1.6 }}>{opt.response}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PART 3 — SCENARIO */}
      {lesson.scenario && (
        <div style={{ ...card, background: "linear-gradient(135deg, rgba(255,170,0,0.06), rgba(255,100,50,0.04))", border: "1px solid rgba(255,170,0,0.18)" }}>
          <div style={{ ...pill("#ffaa00", "rgba(255,170,0,0.1)"), border: "1px solid rgba(255,170,0,0.2)", marginBottom: 14 }}>
            Real-World Scenario
          </div>
          <p style={{ ...bodyText, marginBottom: 16 }}>{lesson.scenario.setup}</p>
          <div style={{ background: "rgba(255,170,0,0.07)", border: "1px solid rgba(255,170,0,0.15)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#ffd080", margin: 0 }}>{lesson.scenario.prompt}</p>
          </div>
          <p style={{ fontSize: 12, color: mu, margin: "12px 0 0", fontStyle: "italic" }}>
            Take a moment to think it through. Then check the answer below.
          </p>
        </div>
      )}

      {/* PART 4 — COLLAPSIBLE ANSWER */}
      {lesson.answer && (
        <div style={{ marginBottom: 18 }}>
          <button
            onClick={() => setAnswerOpen(!answerOpen)}
            style={{
              width: "100%",
              background: answerOpen ? "linear-gradient(135deg,rgba(0,201,167,0.12),rgba(0,148,255,0.08))" : surface,
              border: answerOpen ? `1px solid ${tealBorder}` : "1px solid rgba(255,255,255,0.06)",
              borderRadius: answerOpen ? "14px 14px 0 0" : 14,
              padding: "16px 20px", display: "flex", alignItems: "center",
              justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s ease"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>💡</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: answerOpen ? teal : white }}>See Recommended Response</span>
            </div>
            <span style={{ color: answerOpen ? teal : mu, fontSize: 18, fontWeight: 300, display: "inline-block", transform: answerOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>▾</span>
          </button>
          {answerOpen && (
            <div style={{ background: "linear-gradient(135deg,rgba(0,201,167,0.06),rgba(0,148,255,0.04))", border: `1px solid ${tealBorder}`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: "20px 22px" }}>
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...sectionHeader, color: teal }}>What to Do</p>
                <p style={bodyText}>{lesson.answer.recommended}</p>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                <p style={{ ...sectionHeader, color: blue }}>Why It Works</p>
                <p style={bodyText}>{lesson.answer.why}</p>
              </div>
            </div>
          )}
        </div>
      )}

     {/* MARK COMPLETE BUTTON */}
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "center" }}>
        <button
          onClick={() => {
            if (go) go("btc-complete", { lessonId: lesson.id });
          }}
          style={{
            background: `linear-gradient(135deg,#00c9a7,#0094ff)`,
            color: "#fff", border: "none", borderRadius: 12,
            padding: "12px 28px", fontSize: 14, fontWeight: 800,
            cursor: "pointer", letterSpacing: 0.2,
          }}
        >
          ✓ Mark Lesson Complete
        </button>
      </div>

      {/* PART 5 — CONNECTION TAG + ASK THE AI */}
      {lesson.connection && (
        <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, color: mu, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Supports</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: teal, background: tealDim, border: `1px solid ${tealBorder}`, borderRadius: 20, padding: "4px 12px", letterSpacing: "0.03em" }}>
              {lesson.connection.tag}
            </span>
          </div>
          <button
            onClick={() => { if (go) go("career-ai", { preload: lesson.connection.aiPrompt }); }}
            style={{ background: "linear-gradient(135deg,#00c9a7,#0094ff)", border: "none", borderRadius: 10, padding: "10px 18px", color: "#000", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
          >
            <span>✨</span>Ask the AI
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BEYOND THE COUNTER — PAGE WRAPPER
// Three views: module grid, lesson list, lesson reader
// ─────────────────────────────────────────────────────────────────────────────

function BeyondTheCounter({ go, isPro, user }) {
  const [btcView, setBtcView] = useState("modules");
  const [activeModule, setActiveModule] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);

  const bgColor  = "#0a1628";
  const surface  = "#1a1d27";
  const teal     = "#00c9a7";
  const tealDim  = "rgba(0,201,167,0.12)";
  const tealBorder = "rgba(0,201,167,0.25)";
  const mu       = "#8b92a9";
  const white    = "#ffffff";

  const openModule = (mod) => { setActiveModule(mod); setBtcView("module"); };
  const openLesson = (lesson) => { setActiveLesson(lesson); setBtcView("lesson"); };
  const back = () => {
    if (btcView === "lesson") { setBtcView("module"); setActiveLesson(null); }
    else if (btcView === "module") { setBtcView("modules"); setActiveModule(null); }
  };

  const BackBtn = ({ label }) => (
    <button onClick={back} style={{ background: "none", border: "none", color: teal, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "0 0 20px", marginBottom: 4 }}>
      ← {label}
    </button>
  );

  if (btcView === "modules") {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: teal, background: tealDim, border: `1px solid ${tealBorder}`, borderRadius: 20, padding: "3px 10px", letterSpacing: "0.05em", marginBottom: 10 }}>
            Pro Feature
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: white, margin: "0 0 8px", lineHeight: 1.3 }}>Beyond the Counter</h1>
          <p style={{ fontSize: 14, color: mu, margin: 0, lineHeight: 1.6 }}>
            8 modules built for techs who want to go further than their job description.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {BEYOND_MODULES.map((mod, i) => {
            const hasLessons = mod.lessons && mod.lessons.length > 0;
            return (
              <div
                key={mod.id}
                onClick={() => hasLessons && openModule(mod)}
                style={{ background: surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, cursor: hasLessons ? "pointer" : "default", opacity: hasLessons ? 1 : 0.5 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: tealDim, border: `1px solid ${tealBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                    {mod.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: mu, fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.08em" }}>Module {i + 1}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: white, marginBottom: 4 }}>{mod.title}</div>
                    <div style={{ fontSize: 12, color: mu }}>{mod.desc}</div>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {hasLessons
                    ? <span style={{ color: teal, fontSize: 18 }}>›</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, color: mu, background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "3px 8px" }}>Coming Soon</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (btcView === "module" && activeModule) {
    return (
      <div>
        <BackBtn label="All Modules" />
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{activeModule.icon}</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: white, margin: "0 0 6px" }}>{activeModule.title}</h1>
          <p style={{ fontSize: 13, color: mu, margin: 0 }}>{activeModule.desc}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activeModule.lessons.map((lesson, i) => (
            <div
              key={lesson.id}
              onClick={() => openLesson(lesson)}
              style={{ background: surface, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: tealDim, border: `1px solid ${tealBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: teal, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: white }}>{lesson.title}</span>
              </div>
              <span style={{ color: teal, fontSize: 18 }}>›</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (btcView === "lesson" && activeLesson) {
    return (
      <div>
        <BackBtn label={activeModule ? activeModule.title : "Back"} />
        <BeyondTheCounterLesson lesson={activeLesson} go={go} />
      </div>
    );
  }

  return null;
}

const CONVERSIONS = [
  {f:"1 g",t:"1,000 mg"},{f:"1 kg",t:"2.2 lb"},{f:"1 mg",t:"1,000 mcg"},
  {f:"1 tsp",t:"5 mL"},{f:"1 tbsp",t:"15 mL"},{f:"1 oz",t:"30 mL"},
  {f:"1 L",t:"1,000 mL"},{f:"1 gr",t:"64.8 mg"},{f:"1 lb",t:"454 g"},{f:"1 fl oz",t:"29.57 mL"},
];
const DRUG_CLASSES = [
  {s:"-pril",c:"ACE Inhibitor",u:"Blood pressure / heart failure",e:"lisinopril, enalapril"},
  {s:"-sartan",c:"ARB",u:"Blood pressure",e:"losartan, valsartan"},
  {s:"-olol",c:"Beta Blocker",u:"Blood pressure / heart rate",e:"metoprolol, atenolol"},
  {s:"-statin",c:"Statin",u:"Cholesterol",e:"atorvastatin, simvastatin"},
  {s:"-cillin",c:"Penicillin",u:"Bacterial infection",e:"amoxicillin, ampicillin"},
  {s:"-mycin",c:"Macrolide/Aminoglycoside",u:"Bacterial infection",e:"azithromycin, clarithromycin"},
  {s:"-prazole",c:"Proton Pump Inhibitor",u:"Acid reflux / GERD",e:"omeprazole, pantoprazole"},
  {s:"-dipine",c:"Calcium Channel Blocker",u:"Blood pressure / angina",e:"amlodipine, nifedipine"},
  {s:"-gliptin",c:"DPP-4 Inhibitor",u:"Type 2 Diabetes",e:"sitagliptin, saxagliptin"},
  {s:"-floxacin",c:"Fluoroquinolone",u:"Bacterial infection",e:"ciprofloxacin, levofloxacin"},
  {s:"-zepam/-zolam",c:"Benzodiazepine",u:"Anxiety / sedation",e:"diazepam, alprazolam"},
  {s:"-tidine",c:"H2 Blocker",u:"Acid reduction",e:"famotidine, cimetidine"},
  {s:"-triptan",c:"Triptan",u:"Migraine",e:"sumatriptan, rizatriptan"},
  {s:"-mab",c:"Monoclonal Antibody",u:"Biologic therapy",e:"adalimumab, pembrolizumab"},
  {s:"metformin",c:"Biguanide",u:"Type 2 Diabetes",e:"metformin HCl"},
  {s:"-cycline",c:"Tetracycline",u:"Bacterial / acne",e:"doxycycline, minocycline"},
];
const CS_SCHEDULES = [
  {s:"Schedule II",e:"oxycodone, morphine, fentanyl, Adderall, Ritalin",r:"No refills. New Rx required each time. High abuse potential, accepted medical use."},
  {s:"Schedule III",e:"buprenorphine, anabolic steroids, ketamine",r:"Up to 5 refills in 6 months. Moderate abuse potential."},
  {s:"Schedule IV",e:"alprazolam, diazepam, zolpidem, tramadol",r:"Up to 5 refills in 6 months. Lower abuse potential than Schedule III."},
  {s:"Schedule V",e:"cough preps w/ codeine, pregabalin",r:"Some OTC in certain states. Lowest abuse potential among controlled schedules."},
];
const ABBREVS = [
  {a:"QD",m:"Once daily"},{a:"BID",m:"Twice daily"},{a:"TID",m:"Three times daily"},
  {a:"QID",m:"Four times daily"},{a:"PRN",m:"As needed"},{a:"PO",m:"By mouth (oral)"},
  {a:"SL",m:"Sublingual"},{a:"IM",m:"Intramuscular"},{a:"IV",m:"Intravenous"},
  {a:"SQ",m:"Subcutaneous"},{a:"DAW",m:"Dispense as written"},{a:"NKA",m:"No known allergies"},
  {a:"Sig",m:"Directions / label"},{a:"Rx",m:"Prescription"},{a:"OTC",m:"Over the counter"},
  {a:"DEA #",m:"Prescriber CS number"},{a:"NPI",m:"National Provider ID"},
  {a:"AC",m:"Before meals"},{a:"PC",m:"After meals"},{a:"HS",m:"At bedtime"},
  {a:"UD",m:"As directed"},{a:"DAW 1",m:"Prescriber requests brand"},{a:"DAW 2",m:"Patient requests brand"},
];

const TOOLS = [
  {id:"top200",title:"Top 200 Drugs",icon:"💊"},
  {id:"conversions",title:"Conversion Reference",icon:"⚖️"},
  {id:"drugclasses",title:"Drug Class Quick Reference",icon:"📖"},
  {id:"schedules",title:"CS Schedules",icon:"🔒"},
  {id:"abbrev",title:"Rx Abbreviations",icon:"📋"},
  {id:"tracker",title:"4-Week Study Tracker",icon:"📅"},
  {id:"firstmonth",title:"First Month Planner",icon:"🗓️"},
  {id:"mynotes",title:"My Notes",icon:"🗒️"},
];

const CAREER_MILESTONES = [
  { id:"m_start",  label:"Starting Out",       icon:"🌱", desc:"Exploring pharmacy as a career path", lessonIds:["l1","l2","l3"] },
  { id:"m_workflow",label:"Workflow Ready",    icon:"⚙️", desc:"Understanding daily operations",       lessonIds:["l4","l5","l6"] },
  { id:"m_safe",   label:"Safety Aware",       icon:"🛡️", desc:"Regulation, law & escalation skills",  lessonIds:["l7","l8","l9"] },
  { id:"m_comm",   label:"Communication Pro",  icon:"💬", desc:"Handling pressure & difficult moments", lessonIds:["l10","l11"] },
  { id:"m_week1",  label:"First Week Survived",icon:"🏁", desc:"Real-world first-week survival",        lessonIds:["l12"] },
  { id:"m_cert",   label:"Certification Path", icon:"🎓", desc:"Structured study & exam strategy",      lessonIds:["c1l1","c2l1","c3l1","c4l1","c5l1"] },
  { id:"m_retail", label:"Retail Foundations", icon:"🏪", desc:"Advanced retail skills (Pro)",          lessonIds:["r1l1","r1l2","r1l3","r2l1","r2l2","r3l1","r4l1"], pro:true },
  { id:"m_inpat",  label:"Inpatient Ready",    icon:"🏥", desc:"Hospital pharmacy skills (Pro)",        lessonIds:["i1l1","i2l1","i3l1","i4l1","i5l1"], pro:true },
  { id:"m_btc",    label:"Beyond the Counter", icon:"🚀", desc:"Leadership & career strategy (Pro)",    lessonIds:["btc1l1"], pro:true },
];

const ALL_LESSONS = [...FREE_SECTIONS,...PRO_SECTIONS.filter(s=>!s.isBeyond)].flatMap(s=>s.modules.flatMap(m=>m.lessons));
const LESSON_MAP = Object.fromEntries(ALL_LESSONS.map(l=>[l.id,l]));

const MERCH_URL = "https://pharmtechgraphics.printify.me/";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_aFabJ065s4Jl5Qm8gQdIA00";

const bg="#0a1628", sf="rgba(255,255,255,0.04)", br="rgba(255,255,255,0.09)";
const ac="#00c9a7", bl="#0094ff", tx="#e8f0fe", mu="#8899bb";

// ─── PROGRESS SNAPSHOT HELPERS ───────────────────────────────────────────────

function calcProfileSections(profile) {
  return [
    { key: "name",       label: "Preferred name",      done: !!(profile.preferredName?.trim()) },
    { key: "job",        label: "Current job title",   done: !!(profile.currentJob?.trim()) },
    { key: "workplace",  label: "Workplace",            done: !!(profile.workplace?.trim()) },
    { key: "jobDesc",    label: "Role description",     done: !!(profile.jobDesc?.trim()) },
    { key: "certs",      label: "Certifications",       done: (profile.certifications||[]).some(c=>c.trim()) },
    { key: "employment", label: "Employment history",   done: (profile.employment||[]).length > 0 },
    { key: "resume",     label: "Resume notes",         done: !!(profile.resumeNote?.trim()) },
  ];
}

function getMemberDays(createdAt) {
  if (!createdAt) return 1;
  const created = typeof createdAt === "number" ? createdAt : Date.now();
  return Math.max(1, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
}

function getSnapshotStage(profilePct, aiSessionCount, lessonsComplete) {
  const fullyEngaged = profilePct === 100 && aiSessionCount >= 1 && lessonsComplete >= 1;
  const profileDone = profilePct === 100;
  if (fullyEngaged) return 3;
  if (profileDone) return 2;
  return 1;
}

function getNextStep(profilePct, aiSessionCount, lessonsComplete, isPro, go) {
  if (profilePct < 100) return {
    icon: "👤",
    text: "Complete your profile to get personalized AI advice.",
    cta: "Finish Profile",
    color: ac,
    action: () => {
      go("career");
      setTimeout(() => document.dispatchEvent(new CustomEvent("pharmtech-tab", { detail: "profile" })), 80);
    },
  };
  if (isPro && aiSessionCount === 0) return {
    icon: "🤖",
    text: "Your AI Career Assistant is ready. Ask it anything.",
    cta: "Open AI Assistant",
    color: bl,
    action: () => {
      go("career");
      setTimeout(() => document.dispatchEvent(new CustomEvent("pharmtech-tab", { detail: "ai" })), 80);
    },
  };
  if (!isPro) return {
    icon: "⭐",
    text: "Unlock Pro to access the AI Assistant, advanced modules and Bonus Tools.",
    cta: "Upgrade to Pro",
    color: "#f59e0b",
    action: () => go("upgrade"),
  };
  if (lessonsComplete < 5) return {
    icon: "📚",
    text: "Keep going. You have lessons waiting on your path.",
    cta: "Continue Learning",
    color: ac,
    action: () => go("learn"),
  };
  return {
    icon: "🗺️",
    text: "Check your full roadmap and track completed milestones.",
    cta: "View My Career",
    color: bl,
    action: () => go("career"),
  };
}

// ─── PROGRESS SNAPSHOT CARD ──────────────────────────────────────────────────

function ProgressSnapshotCard({ user, profile, isPro, done, aiSessionCount, createdAt, go }) {
  const [expanded, setExpanded] = useState(false);
  const [celebPlayed, setCelebPlayed] = useState(false);

  const sections = calcProfileSections(profile);
  const filledCount = sections.filter(s => s.done).length;
  const profilePct = Math.round((filledCount / sections.length) * 100);

  const allL = [...FREE_SECTIONS,...PRO_SECTIONS].flatMap(s=>s.modules.flatMap(m=>m.lessons));
  const lessonsComplete = allL.filter(l => done[l.id]).length;
  const memberDays = getMemberDays(createdAt);
  const stage = getSnapshotStage(profilePct, aiSessionCount, lessonsComplete);
  const nextStep = getNextStep(profilePct, aiSessionCount, lessonsComplete, isPro, go);

  const isFullyEngaged = stage === 3;

  // Celebration trigger: profile just hit 100
  useEffect(() => {
    if (profilePct === 100 && !celebPlayed) {
      setCelebPlayed(true);
    }
  }, [profilePct, celebPlayed]);

  // Stage labels and colors
  const stageConfig = {
    1: { label: "Getting Started", color: mu,  bg: "rgba(136,153,187,.08)",  border: "rgba(136,153,187,.2)" },
    2: { label: "Profile Complete", color: ac, bg: "rgba(0,201,167,.07)",    border: "rgba(0,201,167,.25)" },
    3: { label: "Fully Engaged",    color: "#f59e0b", bg: "rgba(245,158,11,.07)", border: "rgba(245,158,11,.3)" },
  };
  const sc = stageConfig[stage];

  // Dynamic activity line
  const activityParts = [];
  activityParts.push(`Member for ${memberDays} day${memberDays !== 1 ? "s" : ""}`);
  if (filledCount > 0) activityParts.push(`${filledCount} of ${sections.length} profile sections complete`);
  if (lessonsComplete > 0) activityParts.push(`${lessonsComplete} lesson${lessonsComplete !== 1 ? "s" : ""} finished`);
  if (aiSessionCount > 0) activityParts.push(`used AI Assistant ${aiSessionCount} time${aiSessionCount !== 1 ? "s" : ""}`);
  const activityLine = activityParts.join(" · ");

  return (
    <div style={{
      background: sc.bg,
      border: `1px solid ${sc.border}`,
      borderRadius: 18,
      padding: "20px 22px",
      marginBottom: 20,
      position: "relative",
      overflow: "hidden",
      transition: "border-color .3s",
    }}>

      {/* Stage 3 celebration shimmer */}
      {isFullyEngaged && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(105deg, transparent 40%, rgba(245,158,11,.04) 50%, transparent 60%)",
          animation: "shimmer 3.5s ease-in-out infinite",
        }}/>
      )}

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Stage badge + celebration */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              background: sc.color + "18",
              color: sc.color,
              border: `1px solid ${sc.color}33`,
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 10px",
              letterSpacing: 1,
              textTransform: "uppercase",
              fontFamily: "monospace",
            }}>
              {isFullyEngaged ? "🏆 " : ""}{sc.label}
            </span>
            {isPro && <span style={{
              background: "rgba(0,201,167,.12)", color: ac,
              border: "1px solid rgba(0,201,167,.25)",
              borderRadius: 20, fontSize: 10, fontWeight: 700,
              padding: "2px 10px", letterSpacing: 1,
              textTransform: "uppercase", fontFamily: "monospace",
            }}>Pro ⭐</span>}
          </div>

          {/* Greeting */}
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 3 }}>
            {isFullyEngaged
              ? `You're dialed in${profile.preferredName ? `, ${profile.preferredName.split(" ")[0]}` : ""}. 🎯`
              : stage === 2
              ? `Profile complete${profile.preferredName ? `, ${profile.preferredName.split(" ")[0]}` : ""}. Now let's use it.`
              : `Welcome back${profile.preferredName ? `, ${profile.preferredName.split(" ")[0]}` : ""}!`
            }
          </div>

          {/* Activity line */}
          <div style={{ fontSize: 11, color: mu, lineHeight: 1.6 }}>{activityLine}</div>
        </div>

        {/* Profile ring + percent */}
        <div
          onClick={() => setExpanded(e => !e)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}
          title={expanded ? "Collapse checklist" : "View profile checklist"}
        >
          <SnapshotRing pct={profilePct} stage={stage}/>
          <span style={{ fontSize: 9, color: mu, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {expanded ? "Close ▲" : "Profile ▼"}
          </span>
        </div>
      </div>

      {/* Profile checklist (expandable) */}
      {expanded && (
        <div style={{
          marginTop: 16,
          borderTop: `1px solid ${br}`,
          paddingTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "6px 10px",
          animation: "fadeSlideIn .2s ease",
        }}>
          {sections.map(s => (
            <div
              key={s.key}
              onClick={() => {
                if (!s.done) {
                  go("career");
                  setTimeout(() => document.dispatchEvent(new CustomEvent("pharmtech-tab", { detail: "profile" })), 80);
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 0",
                cursor: s.done ? "default" : "pointer",
                opacity: s.done ? 1 : 0.75,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: s.done ? ac : "transparent",
                border: s.done ? "none" : `1.5px solid rgba(255,255,255,.22)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .2s",
              }}>
                {s.done && <span style={{ color: "#0a1628", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: s.done ? tx : mu, fontWeight: s.done ? 500 : 400 }}>
                {s.label}
                {!s.done && <span style={{ fontSize: 10, color: ac, marginLeft: 5 }}>→ Add</span>}
              </span>
            </div>
          ))}
          {profilePct < 100 && (
            <div style={{ gridColumn: "1 / -1", marginTop: 6 }}>
              <div style={{ background: "#1e2a3a", borderRadius: 99, height: 5, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: `linear-gradient(90deg,${ac},${bl})`,
                  width: `${profilePct}%`,
                  transition: "width .5s",
                }}/>
              </div>
              <div style={{ fontSize: 10, color: mu, marginTop: 5 }}>
                {sections.length - filledCount} section{sections.length - filledCount !== 1 ? "s" : ""} left to complete your profile
              </div>
            </div>
          )}
          {profilePct === 100 && (
            <div style={{
              gridColumn: "1 / -1", marginTop: 4,
              background: "rgba(0,201,167,.1)", border: "1px solid rgba(0,201,167,.3)",
              borderRadius: 10, padding: "8px 13px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>🏅</span>
              <span style={{ fontSize: 12, color: ac, fontWeight: 700 }}>Profile 100% complete. The AI Assistant has everything it needs to personalize your advice.</span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: br, margin: "16px 0 14px" }}/>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          { n: lessonsComplete, label: "Lessons", color: ac },
          { n: filledCount + "/" + sections.length, label: "Profile", color: bl },
          ...(isPro ? [{ n: aiSessionCount, label: "AI Sessions", color: "#f59e0b" }] : []),
          { n: memberDays + "d", label: "Member", color: mu },
        ].map(s => (
          <div key={s.label} style={{
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${br}`,
            borderRadius: 10,
            padding: "7px 13px",
            textAlign: "center",
            flex: "1 1 60px",
            minWidth: 54,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.n}</div>
            <div style={{ fontSize: 9, color: mu, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Suggested next step */}
      <div style={{
        background: nextStep.color + "0f",
        border: `1px solid ${nextStep.color}28`,
        borderRadius: 12,
        padding: "11px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{nextStep.icon}</span>
          <span style={{ fontSize: 12, color: tx, lineHeight: 1.5 }}>{nextStep.text}</span>
        </div>
        <button
          onClick={nextStep.action}
          style={{
            background: `linear-gradient(135deg,${nextStep.color},${nextStep.color === ac ? bl : nextStep.color + "cc"})`,
            color: "#fff", border: "none", borderRadius: 9,
            padding: "7px 14px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          {nextStep.cta} →
        </button>
      </div>

      {/* Pro enrichment row (Stage 2+ and Pro) */}
      {isPro && stage >= 2 && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { icon: "📚", label: `${allL.filter(l => done[l.id]).length} / ${allL.length} total lessons`, action: () => go("learn") },
            { icon: "🧰", label: "Bonus Tools open", action: () => go("tools") },
            { icon: "🗺️", label: "View full roadmap", action: () => go("career") },
          ].map(chip => (
            <button
              key={chip.label}
              onClick={chip.action}
              style={{
                background: sf, border: `1px solid ${br}`,
                borderRadius: 20, padding: "4px 11px",
                fontSize: 11, color: mu, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
                transition: "border-color .15s, color .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,201,167,.4)"; e.currentTarget.style.color = ac; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = br; e.currentTarget.style.color = mu; }}
            >
              {chip.icon} {chip.label}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%,100% { opacity: 0; }
          50% { opacity: 1; }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── SNAPSHOT RING ────────────────────────────────────────────────────────────

function SnapshotRing({ pct, stage }) {
  const size = 56, sw = 4;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const colors = { 1: mu, 2: ac, 3: "#f59e0b" };
  const color = colors[stage] || ac;

  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2a3a" strokeWidth={sw}/>
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${circ * pct / 100} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray .6s ease, stroke .4s ease" }}
        />
      </svg>
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {pct === 100
          ? <span style={{ fontSize: 20 }}>🏅</span>
          : <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct}%</span>
        }
      </div>
    </div>
  );
}

// ─── ONBOARDING SLIDES ────────────────────────────────────────────────────────
const ONBOARDING_SLIDES = [
  {
    id: 1,
    icon: "⬡",
    headline: "You made it. Welcome to PharmTech Path.",
    body: "This is the career advancement resource built for techs who want to go further. Whether you are just getting started or ready to level up, you are in the right place.",
    cta: "Let's go",
  },
  {
    id: 2,
    icon: "🗺️",
    headline: "This is not just another study app.",
    body: "PharmTech Path gives you a real career roadmap. Explore job titles, certifications, advancement paths and tools that show you what is possible beyond retail and inpatient pharmacy.",
    cta: "Next",
  },
  {
    id: 3,
    icon: "👤",
    headline: "Your profile makes everything more personal.",
    body: "When you fill out your profile, the AI Career Assistant gives you advice based on where you actually are in your career. The more you put in, the more you get out.",
    cta: "Next",
  },
  {
    id: 4,
    icon: "⭐",
    headline: "Want the full experience?",
    body: "Pro unlocks the AI Career Assistant, advanced career tools and everything we are building next. You can activate it anytime from your profile.",
    cta: "Activate Pro",
    isProSlide: true,
  },
];

// ─── ONBOARDING MODAL ─────────────────────────────────────────────────────────
function OnboardingModal({ user, onDismiss, onActivatePro }) {
  const [slide, setSlide] = useState(0);
  const total = ONBOARDING_SLIDES.length;
  const current = ONBOARDING_SLIDES[slide];
  const isLast = slide === total - 1;

  const handleCta = () => {
    if (isLast) { onActivatePro(); }
    else { setSlide(s => s + 1); }
  };

  return (
    <div style={{
      position:"fixed",inset:0,
      background:"rgba(5,10,22,0.88)",
      zIndex:8000,display:"flex",alignItems:"center",justifyContent:"center",
      padding:16,backdropFilter:"blur(4px)",
    }}>
      <div style={{
        background:"#0d1e36",border:`1px solid ${br}`,borderRadius:24,
        width:"100%",maxWidth:480,padding:"36px 32px 28px",
        position:"relative",boxShadow:"0 24px 64px rgba(0,0,0,.7)",
        animation:"onboardFadeIn .25s ease",
      }}>
        {!isLast && (
          <button onClick={onDismiss} style={{position:"absolute",top:18,right:20,background:"none",border:"none",color:mu,fontSize:12,cursor:"pointer",fontWeight:500,letterSpacing:0.2}}>
            Skip for now
          </button>
        )}
        <div style={{width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${ac}22,${bl}22)`,border:`1px solid rgba(0,201,167,.25)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:22}}>
          {current.icon}
        </div>
        <div style={{fontSize:20,fontWeight:800,color:"#fff",lineHeight:1.25,marginBottom:14}}>{current.headline}</div>
        <div style={{fontSize:14,color:"#c8d8f0",lineHeight:1.8,marginBottom:32}}>{current.body}</div>
        <button onClick={handleCta} style={{width:"100%",background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:12,padding:"13px 0",fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:isLast?14:0,letterSpacing:0.2}}>
          {current.cta}
        </button>
        {isLast && (
          <button onClick={onDismiss} style={{display:"block",width:"100%",background:"none",border:"none",color:mu,fontSize:12,cursor:"pointer",textAlign:"center",padding:"4px 0",fontWeight:500}}>
            Maybe later
          </button>
        )}
        <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:24}}>
          {ONBOARDING_SLIDES.map((_,i) => (
            <div key={i} style={{width:i===slide?20:7,height:7,borderRadius:99,background:i===slide?ac:"rgba(255,255,255,.18)",transition:"all .3s ease"}}/>
          ))}
        </div>
      </div>
      <style>{`@keyframes onboardFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}

function Ring({p,size=44,sw=3}){
  const r=(size-sw)/2,c=2*Math.PI*r;
  return <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2a3a" strokeWidth={sw}/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={ac} strokeWidth={sw}
      strokeDasharray={`${c*p/100} ${c}`} strokeLinecap="round" style={{transition:"stroke-dasharray .5s"}}/>
  </svg>;
}
function Bar({p}){return <div style={{background:"#1e2a3a",borderRadius:99,height:6,overflow:"hidden",marginTop:8}}><div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,${ac},${bl})`,width:`${p}%`,transition:"width .5s"}}/></div>;}
function Tag({label,color=ac}){return <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:20,fontSize:10,fontWeight:700,padding:"2px 9px",letterSpacing:1,textTransform:"uppercase",fontFamily:"monospace"}}>{label}</span>;}
function Toast({msg}){return <div style={{position:"fixed",bottom:22,left:"50%",transform:"translateX(-50%)",background:"#0f2040",border:"1px solid rgba(0,201,167,.4)",color:ac,padding:"9px 20px",borderRadius:99,fontSize:13,fontWeight:700,zIndex:999,whiteSpace:"nowrap",pointerEvents:"none"}}>{msg}</div>;}
const Bp=({ch,on,sx={}})=><button onClick={on} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",...sx}}>{ch}</button>;
const Bs=({ch,on,sx={}})=><button onClick={on} style={{background:sf,color:tx,border:`1px solid ${br}`,borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",...sx}}>{ch}</button>;
const Inp=({ta,sx,...p})=>ta
  ?<textarea style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:10,color:tx,fontSize:14,padding:"10px 13px",outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",...sx}} {...p}/>
  :<input style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:10,color:tx,fontSize:14,padding:"10px 13px",outline:"none",fontFamily:"inherit",boxSizing:"border-box",...sx}} {...p}/>;

function FeedbackButton({user, pop}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("general");
  const [msg, setMsg] = useState("");
  const [rating, setRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "feedback"), {
        message: msg.trim(), type, rating,
        uid: user?.uid || "anonymous",
        email: user?.email || "anonymous",
        displayName: user?.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false); setOpen(false); setMsg(""); setRating(0); setType("general");
        pop("Thanks for your feedback! 🙏");
      }, 1800);
    } catch { pop("Something went wrong. Please try again."); }
    setSending(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} title="Share feedback"
        style={{position:"fixed",bottom:24,right:24,zIndex:900,background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:50,width:52,height:52,fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px rgba(0,201,167,.4)",display:"flex",alignItems:"center",justifyContent:"center",transition:"transform .2s"}}
        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
      >💬</button>
      {open && (
        <div style={{position:"fixed",inset:0,background:"rgba(5,10,22,.85)",zIndex:950,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:"0 24px 90px"}}
          onClick={e=>{ if(e.target===e.currentTarget) setOpen(false); }}>
          <div style={{background:"#0f1e35",border:`1px solid ${br}`,borderRadius:20,width:"100%",maxWidth:360,padding:24,boxShadow:"0 8px 40px rgba(0,0,0,.6)"}}>
            {sent ? (
              <div style={{textAlign:"center",padding:"24px 0"}}>
                <div style={{fontSize:36,marginBottom:10}}>🙏</div>
                <div style={{fontSize:16,fontWeight:800,color:"#fff",marginBottom:6}}>Thank you!</div>
                <div style={{fontSize:12,color:mu}}>Your feedback helps make PharmTech Path better.</div>
              </div>
            ) : (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div><div style={{fontSize:15,fontWeight:800,color:"#fff"}}>Share Feedback</div><div style={{fontSize:11,color:mu,marginTop:2}}>Help us improve PharmTech Path</div></div>
                  <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:mu,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:mu,marginBottom:6}}>How's your experience?</div>
                  <div style={{display:"flex",gap:6}}>
                    {[1,2,3,4,5].map(s=>(
                      <button key={s} onClick={()=>setRating(s)} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",opacity:s<=rating?1:0.3,transition:"opacity .15s"}}>⭐</button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:mu,marginBottom:6}}>Type</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[["general","💬 General"],["bug","🐛 Bug"],["idea","💡 Idea"],["content","📚 Content"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setType(v)} style={{background:type===v?"rgba(0,201,167,.15)":sf,color:type===v?ac:mu,border:type===v?`1px solid rgba(0,201,167,.4)`:`1px solid ${br}`,borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:mu,marginBottom:6}}>Your message</div>
                  <Inp ta sx={{minHeight:88}} placeholder="Tell us what's on your mind…" value={msg} onChange={e=>setMsg(e.target.value)}/>
                </div>
                <Bp ch={sending?"Sending…":"Send Feedback →"} on={submit} sx={{width:"100%",opacity:msg.trim()&&!sending?1:0.5,cursor:msg.trim()&&!sending?"pointer":"not-allowed"}}/>
                <div style={{textAlign:"center",marginTop:10,fontSize:10,color:mu}}>{user?`Submitting as ${user.displayName||user.email}`:"Submitting anonymously"}</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function LegalPopup({onAccept}){
  const [checked,setChecked]=useState(false);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(5,10,22,0.95)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#0f1e35",border:`1px solid ${br}`,borderRadius:20,maxWidth:540,width:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"24px 24px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <span style={{fontSize:24}}>⬡</span>
            <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>Before You Continue</div>
          </div>
          <div style={{fontSize:13,color:mu,marginBottom:16}}>Please read and acknowledge the following before using PharmTech Path.</div>
          <div style={{height:1,background:br}}/>
        </div>
        <div style={{overflowY:"auto",padding:"16px 24px",flex:1}}>
          {[
            {title:"📚 Educational Use Only",body:"PharmTech Path is an educational platform. All content — including modules, drug references, law summaries, and workflow descriptions — is for informational and career development purposes only. It does not constitute medical advice, clinical guidance, legal advice, or official pharmacy policy."},
            {title:"🏥 Not a Substitute for Formal Training",body:"This app is not a substitute for accredited pharmacy technician training programs, employer-specific training, state board requirements, or licensed pharmacist supervision. Always defer to your facility's standard operating procedures and your supervising pharmacist."},
            {title:"⚠️ Accuracy & Changing Regulations",body:"Pharmacy regulations, drug schedules, and certification requirements change. Always verify critical information with official sources such as PTCB.org, your State Board of Pharmacy, the DEA, or the FDA."},
            {title:"💊 Controlled Substances",body:"Information about controlled substances is provided for high-level awareness only. Technicians must follow their state's laws, employer policies, and pharmacist direction at all times."},
            {title:"🎓 No Guaranteed Outcomes",body:"PharmTech Path does not guarantee certification exam passage, employment, or any specific career outcome."},
          ].map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${br}`,borderRadius:12,padding:"14px 16px",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:5}}>{s.title}</div>
              <div style={{fontSize:12,color:mu,lineHeight:1.7}}>{s.body}</div>
            </div>
          ))}
        </div>
        <div style={{padding:"16px 24px 24px",borderTop:`1px solid ${br}`,flexShrink:0}}>
          <label style={{display:"flex",alignItems:"flex-start",gap:12,cursor:"pointer",marginBottom:18}}>
            <div onClick={()=>setChecked(!checked)} style={{width:20,height:20,borderRadius:5,border:`2px solid ${checked?ac:br}`,background:checked?ac:"transparent",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
              {checked&&<span style={{color:"#fff",fontSize:13,fontWeight:900}}>✓</span>}
            </div>
            <span style={{fontSize:12,color:mu,lineHeight:1.6}}>I understand that PharmTech Path is an educational resource only, not medical or legal advice. I agree to the Terms of Use and acknowledge the Educational Disclaimer.</span>
          </label>
          <Bp ch="I Understand — Enter PharmTech Path" on={()=>checked&&onAccept()} sx={{width:"100%",opacity:checked?1:0.4,cursor:checked?"pointer":"not-allowed"}}/>
          <div style={{textAlign:"center",marginTop:10,fontSize:11,color:mu}}>By continuing you accept our Terms of Use, Privacy Policy, and Educational Disclaimer.</div>
        </div>
      </div>
    </div>
  );
}

function CareerRoadmap({done,isPro}){
  const milestones = CAREER_MILESTONES;
  return (
    <div>
      <div style={{fontSize:13,color:mu,marginBottom:20}}>Your journey mapped — each milestone unlocks as you complete lessons.</div>
      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:21,top:20,bottom:20,width:2,background:`linear-gradient(to bottom,${ac},${bl})`,opacity:0.3,borderRadius:99}}/>
        {milestones.map((ms,i)=>{
          const totalL=ms.lessonIds.length;
          const doneL=ms.lessonIds.filter(id=>done[id]).length;
          const pct=totalL?Math.round((doneL/totalL)*100):0;
          const complete=pct===100;
          const locked=ms.pro&&!isPro;
          return (
            <div key={ms.id} style={{display:"flex",gap:16,alignItems:"flex-start",marginBottom:16,position:"relative"}}>
              <div style={{width:44,height:44,borderRadius:"50%",flexShrink:0,background:locked?"#1a2a3a":complete?`linear-gradient(135deg,${ac},${bl})`:pct>0?"#1a3a4a":"#1a2a3a",border:locked?`2px solid ${br}`:complete?"none":pct>0?`2px solid ${ac}`:`2px solid ${br}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,zIndex:1,transition:"all .3s"}}>
                {locked?"🔒":complete?"✓":ms.icon}
              </div>
              <div style={{flex:1,background:locked?"rgba(255,255,255,.02)":complete?"rgba(0,201,167,.07)":sf,border:complete?`1px solid rgba(0,201,167,.25)`:`1px solid ${br}`,borderRadius:12,padding:"12px 16px",opacity:locked?0.5:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:complete?ac:"#fff"}}>{ms.label}</div>
                    <div style={{fontSize:11,color:mu,marginTop:2}}>{ms.desc}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {ms.pro&&<Tag label="Pro" color={bl}/>}
                    <span style={{fontSize:12,color:complete?ac:mu,fontWeight:700}}>{doneL}/{totalL}</span>
                  </div>
                </div>
                {!locked&&<Bar p={pct}/>}
                {locked&&<div style={{fontSize:11,color:mu,marginTop:6}}>Unlock with Pro to access this milestone</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:8}}>
        {[{color:ac,label:"Complete"},{color:"#1a3a4a",borderColor:ac,label:"In Progress"},{color:"#1a2a3a",label:"Not Started"}].map((l,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:mu}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:l.color,border:l.borderColor?`2px solid ${l.borderColor}`:"none"}}/>
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function Nav({view,go,user,isPro,out}){
  const items=[["learn","Learn"],["resources","Resources"],["tools","Tools"],["career","My Career"]];
  return <div style={{background:"rgba(10,22,40,.97)",backdropFilter:"blur(14px)",borderBottom:`1px solid ${br}`,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",position:"sticky",top:0,zIndex:200}}>
    <div onClick={()=>go("home")} style={{fontWeight:800,fontSize:18,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
      <span style={{color:ac}}>⬡</span>PharmTech<span style={{color:ac}}>Path</span>
      {isPro&&<Tag label="Pro"/>}
    </div>
    <div style={{display:"flex",gap:2,alignItems:"center",flexWrap:"wrap"}}>
      {items.map(([id,lb])=><button key={id} onClick={()=>go(id)} style={{background:view===id?"rgba(0,201,167,.12)":"transparent",color:view===id?ac:mu,border:view===id?`1px solid rgba(0,201,167,.3)`:"1px solid transparent",borderRadius:7,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{lb}</button>)}
      <a href={MERCH_URL} target="_blank" rel="noopener noreferrer"
        style={{background:"linear-gradient(135deg,rgba(168,85,247,.2),rgba(236,72,153,.15))",color:"#c084fc",border:"1px solid rgba(168,85,247,.35)",borderRadius:7,padding:"5px 10px",fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"none",whiteSpace:"nowrap"}}>
        👕 Merch
      </a>
      {user
        ?<button onClick={out} style={{background:"transparent",color:"#ff6b6b",border:"none",borderRadius:7,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Sign Out</button>
        :<button onClick={()=>go("auth")} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:7,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Sign In</button>
      }
    </div>
  </div>;
}

function Footer({go}){
  return (
    <div style={{borderTop:`1px solid ${br}`,marginTop:44,paddingTop:18,textAlign:"center"}}>
      <div style={{fontSize:11,color:mu,lineHeight:2.6}}>
        © {new Date().getFullYear()} PharmTech Path. All rights reserved.<br/>
        {[["Terms of Use","legal"],["Privacy Policy","legal"],["Educational Disclaimer","legal"],["Contact Us","contact"]].map(([l,v])=>
          <button key={l} onClick={()=>go(v)} style={{background:"none",border:"none",color:mu,cursor:"pointer",fontSize:11,textDecoration:"underline",margin:"0 7px"}}>{l}</button>
        )}
      </div>
    </div>
  );
}

export default function App(){
  const [legalAccepted,setLegalAccepted]=useState(false);
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [isPro,setIsPro]=useState(false);
  const [view,setView]=useState("home");
  const [sec,setSec]=useState(null);
  const [mod,setMod]=useState(null);
  const [lesson,setLesson]=useState(null);
  const [done,setDone]=useState({});
  const [notes,setNotes]=useState({});
  const [noteIn,setNoteIn]=useState("");
  const [toolId,setToolId]=useState(null);
  const [tracker,setTracker]=useState({});
  const [planData,setPlanData]=useState({});
  const [toast,setToast]=useState(null);
  const [resCat,setResCat]=useState("All");
  const [authMode,setAuthMode]=useState("login");
  const [resetSent,setResetSent]=useState(false);
  const [em,setEm]=useState(""); const [pw,setPw]=useState(""); const [nm,setNm]=useState(""); const [er,setEr]=useState("");
  const [cf,setCf]=useState({name:"",email:"",subject:"question",message:""});
  const [sent,setSent]=useState(false);
  const [careerTab,setCareerTab]=useState("roadmap");
  const [showDeleteConfirm,setShowDeleteConfirm]=useState(false);
  const [promoCode, setPromoCode] = useState("");
const [promoStatus, setPromoStatus] = useState(null);
const [promoMessage, setPromoMessage] = useState("");
  const [freeNotes,setFreeNotes]=useState([]);
  const [freeNoteForm,setFreeNoteForm]=useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [aiSessionCount, setAiSessionCount] = useState(0);
  const [profile,setProfile]=useState({
    preferredName:"", currentJob:"", workplace:"",
    jobDesc:"", employment:[], certifications:["","",""], resumeNote:""
  });

  const [showOnboarding, setShowOnboarding] = useState(false);

  const pop=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),2600);},[]);

  useEffect(()=>{
    const handler=(e)=>setCareerTab(e.detail);
    document.addEventListener("pharmtech-tab",handler);
    return ()=>document.removeEventListener("pharmtech-tab",handler);
  },[]);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async fbUser=>{
      if(fbUser){
        setUser({email:fbUser.email,displayName:fbUser.displayName||fbUser.email.split("@")[0],uid:fbUser.uid});
        const data=await loadUserData(fbUser.uid);
        if(data){
          setIsPro(data.isPro||false);
          setDone(data.completed||{});
          setNotes(data.notes||{});
          setTracker(data.tracker||{});
          setPlanData(data.planner||{});
          setFreeNotes(data.freeNotes||[]);
          setCreatedAt(data.createdAt || null);
          setAiSessionCount(data.aiSessionCount || 0);
          if(data.profile) setProfile(p=>({...p,...data.profile}));
          if(data.legalAccepted) setLegalAccepted(true);
          if(!data.hasSeenOnboarding) setShowOnboarding(true);
        } else {
          setShowOnboarding(true);
        }
        // Record login date (once per calendar day)
        await recordLoginDate(fbUser.uid);
      } else {
        setUser(null);setIsPro(false);setDone({});setNotes({});
        setCreatedAt(null); setAiSessionCount(0);
        setShowOnboarding(false);
      }
      setAuthLoading(false);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(user?.uid) saveUserData(user.uid,{completed:done,notes,tracker,planner:planData,isPro,legalAccepted,freeNotes,profile});
  },[done,notes,tracker,planData,isPro,legalAccepted,freeNotes,profile]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (user?.uid) saveUserData(user.uid, { hasSeenOnboarding: true });
  }, [user]);

  const handleOnboardingPro = useCallback(() => {
    setShowOnboarding(false);
    if (user?.uid) saveUserData(user.uid, { hasSeenOnboarding: true });
    go("upgrade");
  }, [user]);

  // Callback passed to AICareerAssistant to record AI session
  const handleAISession = useCallback(async () => {
    if (!user?.uid) return;
    setAiSessionCount(prev => prev + 1);
    await recordAISession(user.uid);
  }, [user]);

  const sections=user&&isPro?[...FREE_SECTIONS,...PRO_SECTIONS]:FREE_SECTIONS;
  const allL=sections.filter(s=>!s.isBeyond).flatMap(s=>s.modules.flatMap(m=>m.lessons));
  const doneN=allL.filter(l=>done[l.id]).length;
  const pct=allL.length?Math.round((doneN/allL.length)*100):0;

 const go=(v, payload)=>{
    if(v==="career-ai"){setSec(null);setMod(null);setLesson(null);setView("career");setCareerTab("ai");return;}
    if(v==="btc-complete" && payload?.lessonId){
      setDone(p=>({...p,[payload.lessonId]:true}));
      pop("✓ Lesson complete!");
      return;
    }
    setSec(null);setMod(null);setLesson(null);setView(v);
  };
  const back=()=>{
    if(lesson){setLesson(null);setNoteIn("");}
    else if(mod)setMod(null);
    else if(sec)setSec(null);
    else go("learn");
  };

  const doAuth=async()=>{
    if(!em.trim()||!pw.trim()){setEr("Please fill in all fields.");return;}
    if(pw.length<6){setEr("Password must be at least 6 characters.");return;}
    setEr("loading");
    try{
      if(authMode==="signup"){
        const cred=await createUserWithEmailAndPassword(auth,em,pw);
        if(nm) await updateProfile(cred.user,{displayName:nm});
        await saveUserData(cred.user.uid,{email:em,displayName:nm||em.split("@")[0],isPro:false,completed:{},notes:{},createdAt:Date.now(),hasSeenOnboarding:false});
      } else {
        await signInWithEmailAndPassword(auth,em,pw);
      }
      setEr(""); go("home"); pop("Welcome to PharmTech Path!");
    } catch(e){
      const msg=e.code==="auth/user-not-found"?"No account found with that email.":e.code==="auth/wrong-password"?"Incorrect password.":e.code==="auth/email-already-in-use"?"An account already exists with this email.":"Something went wrong. Please try again.";
      setEr(msg);
    }
  };

  const doGoogle=async()=>{
    try{
      await setPersistence(auth, browserLocalPersistence);
      const cred=await signInWithPopup(auth,googleProvider);
      const data=await loadUserData(cred.user.uid);
      if(!data) await saveUserData(cred.user.uid,{email:cred.user.email,displayName:cred.user.displayName,isPro:false,completed:{},notes:{},createdAt:Date.now(),hasSeenOnboarding:false});
      go("home"); pop("Welcome to PharmTech Path!");
    } catch(e){ setEr("Google sign-in failed. Please try again."); }
  };

  const doReset = async () => {
    if (!em.trim()) { setEr("Please enter your email address first."); return; }
    try {
      await sendPasswordResetEmail(auth, em.trim());
      setResetSent(true); setEr("");
    } catch(e) { setEr("Couldn't send reset email. Please check the address and try again."); }
  };

  const doOut=async()=>{
    await signOut(auth);
    setUser(null);setIsPro(false);setDone({});setNotes({});go("home");
  };
const redeemPromoCode = async () => {
  if (!promoCode.trim()) return;
  if (!user) { setPromoStatus("error"); setPromoMessage("Please sign in first."); return; }
  setPromoStatus("loading");
  setPromoMessage("");
  try {
    const snap = await getDoc(doc(db, "promoCodes", promoCode.trim().toUpperCase()));
    if (!snap.exists()) { setPromoStatus("error"); setPromoMessage("That code is not valid. Please check and try again."); return; }
    const data = snap.data();
    if (!data.active) { setPromoStatus("error"); setPromoMessage("That code is no longer active."); return; }
    if (data.grantsPro) {
      setIsPro(true);
      await saveUserData(user.uid, { isPro: true });
      setPromoStatus("success");
      setPromoMessage("Pro unlocked! Welcome to PharmTech Path Pro. 🎉");
      pop("Pro unlocked! 🎉");
    }
  } catch(e) {
    setPromoStatus("error");
    setPromoMessage("Something went wrong. Please try again.");
  }
};
  const doDeleteAccount = async () => {
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) return;
      await deleteDoc(doc(db, "users", fbUser.uid));
      await deleteUser(fbUser);
      setUser(null); setIsPro(false); setDone({}); setNotes({});
      setShowDeleteConfirm(false);
      go("home");
      pop("Account deleted.");
    } catch(e) {
      pop("Couldn't delete account. Please sign out and sign back in, then try again.");
      setShowDeleteConfirm(false);
    }
  };

  if(authLoading) return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:ac,fontSize:14,fontWeight:700}}>Loading PharmTech Path…</div>
    </div>
  );

  const wrap=ch=>(
    <div style={{minHeight:"100vh",background:bg,color:tx,fontFamily:"'Segoe UI',system-ui,sans-serif",overflowX:"hidden"}}>
      {!legalAccepted&&<LegalPopup onAccept={()=>setLegalAccepted(true)}/>}
      {showOnboarding&&user&&legalAccepted&&(
        <OnboardingModal user={user} onDismiss={dismissOnboarding} onActivatePro={handleOnboardingPro}/>
      )}
      <Nav view={view} go={go} user={user} isPro={isPro} out={doOut}/>
      {toast&&<Toast msg={toast}/>}
      <div style={{maxWidth:920,margin:"0 auto",padding:"24px 16px 80px"}}>
        {ch}
        <Footer go={go}/>
      </div>
      <FeedbackButton user={user} pop={pop}/>
    </div>
  );

  const Bk=({lb})=><button onClick={back} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:5}}>← {lb||"Back"}</button>;
  const H1=({ch,sub})=><><div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:sub?3:18}}>{ch}</div>{sub&&<div style={{fontSize:13,color:mu,marginBottom:18}}>{sub}</div>}</>;

  if(view==="auth") return wrap(
    <div style={{maxWidth:400,margin:"0 auto"}}>
      <button onClick={()=>go("home")} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:5}}>← Back</button>
      <div style={{background:sf,border:`1px solid ${br}`,borderRadius:18,padding:28}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:28,marginBottom:6}}>⬡</div>
          <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{authMode==="login"?"Welcome back":"Create account"}</div>
          <div style={{fontSize:12,color:mu,marginTop:3}}>PharmTech Path</div>
        </div>
        {authMode==="signup"&&<div style={{marginBottom:11}}><div style={{fontSize:11,color:mu,marginBottom:4}}>Full Name</div><Inp placeholder="Your name" value={nm} onChange={e=>setNm(e.target.value)}/></div>}
        <div style={{marginBottom:11}}><div style={{fontSize:11,color:mu,marginBottom:4}}>Email</div><Inp type="email" placeholder="you@email.com" value={em} onChange={e=>setEm(e.target.value)}/></div>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{fontSize:11,color:mu}}>Password</div>
            {authMode==="login"&&<button onClick={doReset} style={{background:"none",border:"none",color:ac,fontSize:11,cursor:"pointer",fontWeight:600}}>Forgot password?</button>}
          </div>
          <Inp type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAuth()}/>
        </div>
        {resetSent&&<div style={{color:ac,fontSize:12,marginBottom:11,background:"rgba(0,201,167,.08)",padding:"8px 12px",borderRadius:7,lineHeight:1.6}}>
          ✓ Reset email sent! Check your inbox.<br/>
          <span style={{color:mu,fontSize:11}}>Don't see it? Check your spam or junk folder.</span>
        </div>}
        {er&&<div style={{color:"#ff6b6b",fontSize:12,marginBottom:11,background:"rgba(255,107,107,.08)",padding:"6px 10px",borderRadius:7}}>{er}</div>}
        <Bp ch={authMode==="login"?"Sign In":"Create Account"} on={doAuth} sx={{width:"100%"}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"14px 0"}}>
          <div style={{flex:1,height:1,background:br}}/><span style={{fontSize:11,color:mu}}>or</span><div style={{flex:1,height:1,background:br}}/>
        </div>
        <Bs ch="Continue with Google" on={doGoogle} sx={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:15}}>G</span> Continue with Google
        </Bs>
        <div style={{textAlign:"center",marginTop:14,fontSize:12,color:mu}}>
          {authMode==="login"?"No account? ":"Have an account? "}
          <button onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setEr("");}} style={{background:"none",border:"none",color:ac,fontWeight:700,cursor:"pointer",fontSize:12}}>{authMode==="login"?"Sign up free":"Sign in"}</button>
        </div>
      </div>
    </div>
  );

  if(view==="learn"&&lesson) return wrap(<>
    <Bk lb="Back to lessons"/>
    {lesson.sections
      ? <ExplorePharmacyLesson lesson={lesson} go={(action, payload) => {
          if (action === "explore-complete") {
            setDone(p=>({...p,[payload.lessonId]:true}));
            pop("✓ Lesson complete!");
          } else {
            go(action, payload);
          }
        }}/>
      : <>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div><div style={{fontSize:19,fontWeight:800,color:"#fff",marginBottom:3}}>{lesson.title}</div><div style={{fontSize:12,color:mu}}>{mod?.title}</div></div>
          {done[lesson.id]&&<Tag label="Completed"/>}
        </div>
        <div style={{background:sf,border:`1px solid ${br}`,borderRadius:13,padding:24,marginBottom:18}}>
          <pre style={{fontSize:14,lineHeight:1.9,color:"#c8d8f0",whiteSpace:"pre-wrap",margin:0,fontFamily:"inherit"}}>{lesson.content}</pre>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
          {!done[lesson.id]&&<Bp ch="Mark Complete ✓" on={()=>{setDone(p=>({...p,[lesson.id]:true}));pop("✓ Lesson complete!");}}/>}
          <Bs ch="← Back" on={back}/>
        </div>
        {user?(
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:9}}>📝 My Notes</div>
            {!(notes[lesson.id]||[]).length&&<div style={{fontSize:12,color:mu,marginBottom:9}}>No notes yet for this lesson.</div>}
            {(notes[lesson.id]||[]).map((n,i)=>(
              <div key={i} style={{background:"rgba(0,201,167,.06)",border:"1px solid rgba(0,201,167,.15)",borderRadius:9,padding:"9px 12px",marginBottom:6,fontSize:13,color:"#c8d8f0",display:"flex",justifyContent:"space-between",gap:10}}>
                <span>{n.text}</span>
                <button onClick={()=>{const a=[...(notes[lesson.id]||[])];a.splice(i,1);setNotes(p=>({...p,[lesson.id]:a}));pop("Deleted");}} style={{background:"none",border:"none",color:mu,cursor:"pointer",fontSize:15,flexShrink:0}}>×</button>
              </div>
            ))}
            <Inp ta sx={{minHeight:72,marginTop:4}} placeholder="Add a note for this lesson…" value={noteIn} onChange={e=>setNoteIn(e.target.value)}/>
            <Bs ch="Save Note" on={()=>{if(!noteIn.trim())return;setNotes(p=>({...p,[lesson.id]:[...(p[lesson.id]||[]),{text:noteIn.trim()}]}));setNoteIn("");pop("Note saved!");}} sx={{marginTop:8}}/>
          </div>
        ):(
          <div style={{background:"rgba(0,148,255,.06)",border:"1px solid rgba(0,148,255,.2)",borderRadius:11,padding:16,textAlign:"center"}}>
            <div style={{color:bl,fontWeight:700,marginBottom:4}}>Sign in to save notes and track progress</div>
            <div style={{color:mu,fontSize:12,marginBottom:11}}>Create a free account to keep your progress.</div>
            <Bp ch="Sign In / Sign Up Free" on={()=>go("auth")}/>
          </div>
        )}
      </>
    }
  </>);

  if(view==="learn"&&mod) return wrap(<>
    <Bk/>
    <H1 ch={mod.title}/>
    <div style={{fontSize:12,color:mu,marginBottom:3}}>{mod.lessons.filter(l=>done[l.id]).length}/{mod.lessons.length} lessons complete</div>
    <Bar p={mod.lessons.length?(mod.lessons.filter(l=>done[l.id]).length/mod.lessons.length)*100:0}/>
    <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:8}}>
      {mod.lessons.map((ls,i)=>(
        <div key={ls.id} onClick={()=>setLesson(ls)} style={{background:done[ls.id]?"rgba(0,201,167,.08)":sf,border:done[ls.id]?"1px solid rgba(0,201,167,.25)":`1px solid ${br}`,borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <div style={{width:27,height:27,borderRadius:"50%",background:done[ls.id]?ac:"rgba(255,255,255,.08)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{done[ls.id]?"✓":i+1}</div>
            <span style={{fontSize:14,fontWeight:600,color:tx}}>{ls.title}</span>
          </div>
          <span style={{color:mu,fontSize:17}}>›</span>
        </div>
      ))}
    </div>
  </>);

  if(view==="learn"&&sec) return wrap(<>
    <Bk/>
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:3}}><span style={{fontSize:26}}>{sec.icon}</span><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{sec.title}</div></div>
    <div style={{fontSize:13,color:mu,marginBottom:20}}>{sec.desc}</div>

    {/* If this is the Beyond the Counter section, render its own component */}
    {sec.isBeyond ? (
      <BeyondTheCounter go={go} isPro={isPro} user={user} />
    ) : (
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {sec.modules.map((m,i)=>{
          const tot=m.lessons.length,dn=m.lessons.filter(l=>done[l.id]).length;
          return <div key={m.id} onClick={()=>setMod(m)} style={{background:sf,border:`1px solid ${br}`,borderRadius:12,padding:"17px 19px",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:10,color:mu,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Module {i+1}</div><div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{m.title}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:7}}><Ring p={tot?Math.round((dn/tot)*100):0}/><span style={{color:mu,fontSize:17}}>›</span></div>
            </div>
            <Bar p={tot?(dn/tot)*100:0}/>
            <div style={{fontSize:11,color:mu,marginTop:6}}>{dn}/{tot} lessons</div>
          </div>;
        })}
      </div>
    )}
  </>);

  if(view==="learn") return wrap(<>
    <H1 ch="Learning Path" sub="Your personalized pharmacy tech mentorship journey"/>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
      {[{n:doneN,l:"Done",c:ac},{n:allL.length,l:"Total",c:tx},{n:pct+"%",l:"Complete",c:bl}].map(s=>(
        <div key={s.l} style={{background:sf,border:`1px solid ${br}`,borderRadius:12,padding:"12px 17px",flex:1,minWidth:85}}>
          <div style={{fontSize:23,fontWeight:800,color:s.c}}>{s.n}</div>
          <div style={{fontSize:10,color:mu,marginTop:2,textTransform:"uppercase",letterSpacing:1}}>{s.l}</div>
        </div>
      ))}
    </div>
    <Bar p={pct}/>
    <div style={{marginTop:22,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:11}}>
      {sections.map(s=>{
        const sl=s.isBeyond?BEYOND_MODULES.flatMap(m=>m.lessons):s.modules.flatMap(m=>m.lessons);
        const sd=sl.filter(l=>done[l.id]).length;
        return <div key={s.id} onClick={()=>setSec(s)} style={{background:sf,border:`1px solid ${br}`,borderRadius:13,padding:18,cursor:"pointer"}}>
          <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
          <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:3}}>{s.title}</div>
          <div style={{fontSize:12,color:mu,marginBottom:11}}>{s.desc}</div>
          <Bar p={sl.length?(sd/sl.length)*100:0}/>
          <div style={{fontSize:11,color:mu,marginTop:6}}>{sd}/{sl.length} lessons</div>
        </div>;
      })}
      {(!user||!isPro)&&<div onClick={()=>go(user?"upgrade":"auth")} style={{background:"rgba(0,148,255,.06)",border:"1px dashed rgba(0,148,255,.3)",borderRadius:13,padding:18,cursor:"pointer",textAlign:"center"}}>
        <div style={{fontSize:24,marginBottom:8}}>🔒</div>
        <div style={{fontSize:14,fontWeight:700,color:bl,marginBottom:3}}>Unlock Pro</div>
        <div style={{fontSize:12,color:mu}}>Retail, Inpatient, Beyond the Counter + Bonus Tools</div>
      </div>}
    </div>
  </>);

  if(view==="resources"){
    const cats=["All",...Array.from(new Set(RESOURCES.map(r=>r.cat)))];
    const fil=resCat==="All"?RESOURCES:RESOURCES.filter(r=>r.cat===resCat);
    return wrap(<>
      <H1 ch="Professional Resources" sub="Official certification bodies, associations, regulatory agencies & reference tools"/>

      {/* ─── ASHP FEATURED SCHOLARSHIP CARD ─────────────────────────────── */}
      <div style={{
        position:"relative",
        background:"linear-gradient(135deg,rgba(0,201,167,.13) 0%,rgba(0,148,255,.09) 100%)",
        border:"1.5px solid rgba(0,201,167,.4)",
        borderRadius:18,
        padding:"24px 26px",
        marginBottom:24,
        overflow:"hidden",
      }}>
        {/* Background accent glow */}
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:"rgba(0,201,167,.07)",pointerEvents:"none"}}/>

        {/* Top row */}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:14,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{
              background:"linear-gradient(135deg,rgba(0,201,167,.2),rgba(0,148,255,.15))",
              border:"1px solid rgba(0,201,167,.35)",
              borderRadius:12,
              width:48,height:48,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:24,flexShrink:0,
            }}>🏆</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                <span style={{
                  background:"rgba(0,201,167,.15)",color:ac,
                  border:"1px solid rgba(0,201,167,.35)",
                  borderRadius:20,fontSize:9,fontWeight:700,
                  padding:"2px 9px",letterSpacing:1.2,
                  textTransform:"uppercase",fontFamily:"monospace",
                }}>Featured Opportunity</span>
                <span style={{
                  background:"rgba(0,148,255,.12)",color:bl,
                  border:"1px solid rgba(0,148,255,.3)",
                  borderRadius:20,fontSize:9,fontWeight:700,
                  padding:"2px 9px",letterSpacing:1.2,
                  textTransform:"uppercase",fontFamily:"monospace",
                }}>Scholarship</span>
              </div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",lineHeight:1.2}}>
                ASHP Professional Advancement Scholarship Program
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{fontSize:13,color:"#c8d8f0",lineHeight:1.8,marginBottom:16,maxWidth:680}}>
          This scholarship program supports pharmacy technicians and graduating pharmacy students who want to attend the ASHP Midyear Clinical Meeting — one of the largest pharmacy conferences in the country.
          It is a real opportunity to expand your professional network, earn CE credit and get exposure to career paths that most techs never see from behind the counter.
        </div>

        {/* CTA row */}
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <a href="https://www.ashp.org" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
            <button style={{
              background:`linear-gradient(135deg,${ac},${bl})`,
              color:"#fff",border:"none",borderRadius:10,
              padding:"10px 22px",fontSize:13,fontWeight:700,
              cursor:"pointer",letterSpacing:0.2,
            }}>
              Learn More at ASHP.org →
            </button>
          </a>
          <div style={{fontSize:11,color:mu,lineHeight:1.6,maxWidth:400}}>
            ⚠️ Scholarship details, eligibility and deadlines are subject to change. Always verify current information directly at{" "}
            <a href="https://www.ashp.org" target="_blank" rel="noopener noreferrer" style={{color:ac,textDecoration:"underline"}}>ashp.org</a>.
          </div>
        </div>
      </div>
      {/* ─────────────────────────────────────────────────────────────────── */}

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:18}}>
        {cats.map(c=><button key={c} onClick={()=>setResCat(c)} style={{background:resCat===c?"rgba(0,201,167,.15)":sf,color:resCat===c?ac:mu,border:resCat===c?`1px solid rgba(0,201,167,.4)`:`1px solid ${br}`,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{c}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:11,marginBottom:28}}>
        {fil.map(r=>(
          <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
            <div style={{background:sf,border:`1px solid ${r.color}33`,borderRadius:13,padding:18,height:"100%",boxSizing:"border-box"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{fontSize:15,fontWeight:900,color:r.color,fontFamily:"monospace"}}>{r.name}</div>
                <Tag label={r.cat} color={r.color}/>
              </div>
              <div style={{fontSize:10,color:mu,marginBottom:6}}>{r.full}</div>
              <div style={{fontSize:12,color:"#c8d8f0",lineHeight:1.5}}>{r.desc}</div>
              <div style={{marginTop:11,fontSize:11,color:r.color,fontWeight:600}}>Visit →</div>
            </div>
          </a>
        ))}
      </div>
    </>);
  }

  if(view==="tools"){
    if(!user||!isPro) return wrap(
      <div style={{textAlign:"center",padding:"48px 0"}}>
        <div style={{fontSize:42,marginBottom:12}}>🔒</div>
        <div style={{fontSize:19,fontWeight:800,color:"#fff",marginBottom:7}}>Bonus Tools — Pro Only</div>
        <div style={{color:mu,fontSize:13,marginBottom:18}}>Drug tables, conversions, schedules, abbreviations & study planner.</div>
        <Bp ch={user?"Upgrade to Pro":"Sign In / Sign Up"} on={()=>go(user?"upgrade":"auth")}/>
      </div>
    );
    if(toolId){
      const tl=TOOLS.find(x=>x.id===toolId);
      return wrap(<>
        <button onClick={()=>setToolId(null)} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:5}}>← Back to tools</button>
        <div style={{fontSize:19,fontWeight:800,color:"#fff",marginBottom:16}}>{tl.icon} {tl.title}</div>
        {toolId==="top200"&&(
          <div>
            <div style={{background:sf,border:`1px solid rgba(0,201,167,.2)`,borderRadius:13,padding:24,marginBottom:16}}>
              <div style={{fontSize:13,color:mu,marginBottom:6}}>Free PTCB-focused flashcard set. Covers brand names, generics, drug classes and indications for the top 200 drugs tested on the CPhT exam.</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20,marginTop:14}}>
                {[{icon:"💊",label:"200 drug cards"},{icon:"🏷️",label:"Brand + generic names"},{icon:"🧬",label:"Drug classes"},{icon:"📋",label:"Indications"}].map((f,i)=>(
                  <div key={i} style={{background:"rgba(0,201,167,.08)",border:"1px solid rgba(0,201,167,.2)",borderRadius:9,padding:"7px 12px",fontSize:12,color:ac,display:"flex",alignItems:"center",gap:6}}>
                    <span>{f.icon}</span>{f.label}
                  </div>
                ))}
              </div>
              <a href="https://quizlet.com/1166435496/top-200-drugs-for-ptcb-flash-cards/?new" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}}>
                <button style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"11px 28px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                  Open Flashcards on Quizlet →
                </button>
              </a>
              <div style={{marginTop:10,fontSize:11,color:mu}}>Free · No account required · Opens in a new tab</div>
            </div>
          </div>
        )}
        {toolId==="conversions"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>{CONVERSIONS.map((c,i)=><div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:9,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:"monospace",color:ac,fontWeight:700,fontSize:12}}>{c.f}</span><span style={{color:mu}}>→</span><span style={{fontFamily:"monospace",color:tx,fontWeight:700,fontSize:12}}>{c.t}</span></div>)}</div>}
        {toolId==="drugclasses"&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid rgba(0,201,167,.3)"}}>{["Suffix","Class","Use","Examples"].map(h=><th key={h} style={{padding:"8px 11px",textAlign:"left",color:ac,fontWeight:700,fontFamily:"monospace",fontSize:10,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{DRUG_CLASSES.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${br}`,background:i%2===0?"rgba(255,255,255,.02)":"transparent"}}><td style={{padding:"8px 11px",color:ac,fontFamily:"monospace",fontWeight:700}}>{r.s}</td><td style={{padding:"8px 11px",color:"#fff",fontWeight:600}}>{r.c}</td><td style={{padding:"8px 11px",color:mu}}>{r.u}</td><td style={{padding:"8px 11px",color:"#c8d8f0"}}>{r.e}</td></tr>)}</tbody></table></div>}
        {toolId==="schedules"&&<div style={{display:"flex",flexDirection:"column",gap:11}}>{CS_SCHEDULES.map((s,i)=><div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:18}}><div style={{fontSize:14,fontWeight:800,color:ac,marginBottom:6}}>{s.s}</div><div style={{fontSize:12,color:"#c8d8f0",marginBottom:4}}><strong style={{color:"#fff"}}>Examples:</strong> {s.e}</div><div style={{fontSize:12,color:mu}}>{s.r}</div></div>)}<div style={{background:"rgba(255,107,107,.06)",border:"1px solid rgba(255,107,107,.2)",borderRadius:9,padding:12,fontSize:11,color:mu}}>⚠️ Schedule I substances have no accepted medical use and are not dispensed in pharmacies.</div></div>}
        {toolId==="abbrev"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>{ABBREVS.map((a,i)=><div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:9,padding:"10px 13px"}}><div style={{fontFamily:"monospace",color:ac,fontWeight:700,fontSize:13,marginBottom:2}}>{a.a}</div><div style={{fontSize:12,color:"#c8d8f0"}}>{a.m}</div></div>)}</div>}
        {toolId==="tracker"&&<StudyTracker tracker={tracker} set={setTracker}/>}
        {toolId==="firstmonth"&&<MonthPlan plan={planData} set={setPlanData} pop={pop}/>}
        {toolId==="mynotes"&&<FreeNotes notes={freeNotes} setNotes={setFreeNotes} form={freeNoteForm} setForm={setFreeNoteForm} pop={pop}/>}
      </>);
    }
    return wrap(<>
      <H1 ch="Bonus Tools" sub="Quick reference sheets, study utilities & planners"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:11}}>
        {TOOLS.map(t=><div key={t.id} onClick={()=>setToolId(t.id)} style={{background:sf,border:`1px solid ${br}`,borderRadius:13,padding:18,cursor:"pointer"}}>
          <div style={{fontSize:24,marginBottom:8}}>{t.icon}</div>
          <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{t.title}</div>
        </div>)}
      </div>
    </>);
  }

  if(view==="career"){
    if(!user) return wrap(
      <div style={{textAlign:"center",padding:"48px 0"}}>
        <div style={{fontSize:42,marginBottom:12}}>🗺️</div>
        <div style={{fontSize:19,fontWeight:800,color:"#fff",marginBottom:7}}>Sign in to track your career</div>
        <div style={{fontSize:13,color:mu,marginBottom:18}}>Create a free account to see your career roadmap, notes, and progress in one place.</div>
        <Bp ch="Sign In / Sign Up Free" on={()=>go("auth")}/>
      </div>
    );

    const allNoted=Object.entries(notes).filter(([,v])=>v&&v.length>0);
    const totalNotes=allNoted.reduce((a,[,v])=>a+v.length,0);

    return wrap(<>
      <div style={{background:`linear-gradient(135deg,rgba(0,201,167,.1),rgba(0,148,255,.08))`,border:`1px solid rgba(0,201,167,.2)`,borderRadius:16,padding:"22px 24px",marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${ac},${bl})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff",flexShrink:0}}>
            {user.displayName?user.displayName[0].toUpperCase():"P"}
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{profile.preferredName||user.displayName||"Pharmacy Tech"}</div>
            <div style={{fontSize:12,color:mu,marginTop:2}}>{profile.currentJob?`${profile.currentJob}${profile.workplace?" · "+profile.workplace:""}`:user.email}</div>
            <div style={{marginTop:6,display:"flex",gap:7,flexWrap:"wrap"}}>
              {isPro&&<Tag label="Pro Member" color={ac}/>}
              <Tag label={`${doneN} lessons complete`} color={bl}/>
              <Tag label={`${pct}% progress`} color={pct===100?ac:mu}/>
            </div>
          </div>
        </div>
        <Ring p={pct} size={62} sw={5}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10,marginBottom:24}}>
        {[{n:doneN,l:"Lessons Done",c:ac},{n:allL.length,l:"Total Lessons",c:tx},{n:totalNotes,l:"Notes Saved",c:"#f59e0b"},{n:Object.values(CAREER_MILESTONES).filter(ms=>ms.lessonIds.every(id=>done[id])).length,l:"Milestones",c:bl}].map(s=>(
          <div key={s.l} style={{background:sf,border:`1px solid ${br}`,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.n}</div>
            <div style={{fontSize:10,color:mu,marginTop:2,textTransform:"uppercase",letterSpacing:1}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:20,background:"rgba(255,255,255,.03)",borderRadius:12,padding:4,border:`1px solid ${br}`,overflowX:"auto"}}>
        {[["roadmap","🗺️ Roadmap"],["certmap","🌿 Cert Path"],["jobtitles","💼 Job Titles"],["notes","📝 Notes"],["profile","👤 Profile"],["ai","🤖 AI Assistant"],["settings","⚙️ Account"]].map(([id,lb])=>(
          <button key={id} onClick={()=>setCareerTab(id)} style={{flex:"0 0 auto",background:careerTab===id?`linear-gradient(135deg,${ac},${bl})`:"transparent",color:careerTab===id?"#fff":mu,border:"none",borderRadius:9,padding:"9px 10px",fontSize:10,fontWeight:700,cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap"}}>{lb}</button>
        ))}
      </div>

      {careerTab==="roadmap"&&<CareerRoadmap done={done} isPro={isPro}/>}
      {careerTab==="certmap"&&<CertRoadmap isPro={isPro} go={go}/>}
{careerTab==="jobtitles"&&<PharmacyJobTitles isPro={isPro} go={go}/>}
      {careerTab==="notes"&&(
        <div>
          {allNoted.length===0
            ?<div style={{textAlign:"center",padding:"32px 0",color:mu}}><div style={{fontSize:34,marginBottom:9}}>📝</div>No notes yet. Open any lesson and start taking notes.</div>
            :allNoted.map(([lid,ln])=>(
              <div key={lid} style={{marginBottom:16}}>
                <div
                  onClick={()=>{
                    const foundLesson=LESSON_MAP[lid];
                    if(!foundLesson) return;
                    const foundSec=[...FREE_SECTIONS,...PRO_SECTIONS].find(s=>s.modules.some(m=>m.lessons.some(l=>l.id===lid)));
                    const foundMod=foundSec?.modules.find(m=>m.lessons.some(l=>l.id===lid));
                    if(foundSec&&foundMod){setSec(foundSec);setMod(foundMod);setLesson(foundLesson);setView("learn");}
                  }}
                  style={{fontSize:13,fontWeight:700,color:ac,marginBottom:6,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                >
                  {LESSON_MAP[lid]?.title||lid}
                  <span style={{fontSize:10,color:mu,fontWeight:400}}>→ Go to lesson</span>
                </div>
                {ln.map((n,i)=>(
                  <div key={i} style={{background:"rgba(0,201,167,.06)",border:"1px solid rgba(0,201,167,.15)",borderRadius:9,padding:"9px 12px",marginBottom:5,fontSize:13,color:"#c8d8f0",display:"flex",justifyContent:"space-between",gap:10}}>
                    <span>{n.text}</span>
                    <button onClick={()=>{const a=[...(notes[lid]||[])];a.splice(i,1);setNotes(p=>({...p,[lid]:a}));pop("Deleted");}} style={{background:"none",border:"none",color:mu,cursor:"pointer",fontSize:14}}>×</button>
                  </div>
                ))}
              </div>
            ))
          }
        </div>
      )}

      {careerTab==="profile"&&<CareerProfile profile={profile} setProfile={setProfile} isPro={isPro} go={go} pop={pop}/>}
{careerTab==="profile"&&<CareerPreferencesSelector user={user} isPro={isPro} db={db}/>}
      {careerTab==="ai"&&<AICareerAssistant profile={profile} isPro={isPro} go={go} setProfile={setProfile} pop={pop} onFirstMessage={handleAISession}/>}

      {careerTab==="settings"&&(
        <div>
          <div style={{background:sf,border:`1px solid ${br}`,borderRadius:14,padding:22,marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:14}}>Account Details</div>
            {[{l:"Name",v:user.displayName||"—"},{l:"Email",v:user.email},{l:"Plan",v:isPro?"Pro ⭐":"Free"},{l:"Lessons Complete",v:`${doneN} / ${allL.length}`}].map(row=>(
              <div key={row.l} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${br}`}}>
                <span style={{fontSize:12,color:mu}}>{row.l}</span>
                <span style={{fontSize:12,color:tx,fontWeight:600}}>{row.v}</span>
              </div>
            ))}
          </div>
          {!isPro&&<div style={{background:"rgba(0,201,167,.07)",border:"1px solid rgba(0,201,167,.25)",borderRadius:14,padding:20,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div><div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:3}}>Upgrade to Pro</div><div style={{fontSize:12,color:mu}}>Unlock all sections, bonus tools, and more.</div></div>
            <Bp ch="Upgrade →" on={()=>go("upgrade")}/>
          </div>}
          <Bs ch="Sign Out" on={doOut} sx={{marginTop:14,width:"100%",color:"#ff6b6b",borderColor:"rgba(255,107,107,.3)",marginBottom:10}}/>
          {!showDeleteConfirm
            ?<button onClick={()=>setShowDeleteConfirm(true)} style={{background:"none",border:"none",color:"rgba(255,107,107,.5)",fontSize:11,cursor:"pointer",textDecoration:"underline",width:"100%",textAlign:"center",padding:"6px 0"}}>Delete Account</button>
            :<div style={{background:"rgba(255,107,107,.07)",border:"1px solid rgba(255,107,107,.3)",borderRadius:12,padding:18,marginTop:4}}>
              <div style={{fontSize:13,fontWeight:700,color:"#ff6b6b",marginBottom:6}}>⚠️ Delete your account?</div>
              <div style={{fontSize:12,color:mu,marginBottom:14,lineHeight:1.6}}>This will permanently delete your account and all your data including notes and progress. This cannot be undone.</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={doDeleteAccount} style={{flex:1,background:"#ff6b6b",color:"#fff",border:"none",borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer"}}>Yes, delete my account</button>
                <button onClick={()=>setShowDeleteConfirm(false)} style={{flex:1,background:sf,color:tx,border:`1px solid ${br}`,borderRadius:8,padding:"9px 0",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
              </div>
            </div>
          }
        </div>
      )}
    </>);
  }

  if(view==="upgrade") return wrap(<>
    <div style={{textAlign:"center",padding:"14px 0 32px"}}>
      <Tag label="PharmTech Path Pro"/>
      <div style={{fontSize:"clamp(24px,5vw,40px)",fontWeight:800,color:"#fff",lineHeight:1.15,margin:"12px 0 9px"}}>The mentorship system that<br/><span style={{color:ac}}>reshapes your career</span></div>
      <div style={{fontSize:13,color:mu,maxWidth:420,margin:"0 auto"}}>Not a textbook. Not a test prep app. The strategic playbook no one handed you.</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:13,marginBottom:32}}>
      {[
        {label:"Free",price:"$0",icon:"🆓",features:["Explore Pharmacy (5 modules)","Getting Certified roadmap","16 resource links & cert guide","Basic progress tracking","Career roadmap overview"],cta:user&&!isPro?"Current Plan":"Sign Up Free",act:()=>!user&&go("auth")},
        {label:"Pro",price:"$9.99/mo",icon:"⭐",hi:true,features:["Everything in Free","Retail Foundations","Inpatient Foundations","Beyond the Counter (8 modules)","Drug class & conversion tables","Controlled substance schedules","Rx abbreviation reference","Top 200 Drugs flashcard set","4-Week Study Tracker","First Month at Work Planner","Notes on every lesson","Full career roadmap & milestones","Progress synced across devices"],cta:isPro?"✓ Active":"Subscribe with Stripe →",act:()=>{ window.open(STRIPE_PAYMENT_LINK,"_blank"); }},
      ].map(p=>(
        <div key={p.label} style={{background:p.hi?"rgba(0,201,167,.07)":sf,border:p.hi?"2px solid rgba(0,201,167,.4)":`1px solid ${br}`,borderRadius:16,padding:24}}>
          <div style={{fontSize:24,marginBottom:6}}>{p.icon}</div>
          <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>{p.label}</div>
          <div style={{fontSize:24,fontWeight:900,color:p.hi?ac:tx,margin:"6px 0 16px"}}>{p.price}</div>
          <div style={{marginBottom:20}}>{p.features.map((f,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:8}}><span style={{color:ac,flexShrink:0}}>✓</span><span style={{fontSize:12,color:"#c8d8f0"}}>{f}</span></div>)}</div>
          {p.hi?<>
            <Bp ch={p.cta} on={p.act} sx={{width:"100%",padding:"11px 0"}}/>
            {!isPro&&<>
             
            <div style={{display:"flex",alignItems:"center",gap:10,margin:"10px 0"}}>
  <div style={{flex:1,height:1,background:br}}/><span style={{fontSize:10,color:mu}}>or use a promo code</span><div style={{flex:1,height:1,background:br}}/>
</div>
<div style={{display:"flex",gap:8}}>
  <input
    placeholder="Enter promo code"
    value={promoCode}
    onChange={e=>{setPromoCode(e.target.value.toUpperCase());setPromoStatus(null);setPromoMessage("");}}
    style={{flex:1,background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:10,color:tx,fontSize:13,padding:"10px 13px",outline:"none",fontFamily:"inherit"}}
  />
  <button
    onClick={redeemPromoCode}
    disabled={!promoCode.trim()||promoStatus==="loading"||promoStatus==="success"}
    style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",opacity:promoCode.trim()&&promoStatus!=="success"?1:0.4,whiteSpace:"nowrap"}}
  >
    {promoStatus==="loading"?"Checking…":"Apply Code"}
  </button>
</div>
{promoMessage&&(
  <div style={{marginTop:8,fontSize:12,color:promoStatus==="success"?ac:"#ff6b6b",background:promoStatus==="success"?"rgba(0,201,167,.08)":"rgba(255,107,107,.08)",border:`1px solid ${promoStatus==="success"?"rgba(0,201,167,.3)":"rgba(255,107,107,.3)"}`,borderRadius:8,padding:"8px 12px"}}>
    {promoMessage}
  </div>
)}
            </>}
          </>:<Bs ch={p.cta} on={p.act} sx={{width:"100%",padding:"11px 0"}}/>}
        </div>
      ))}
    </div>
  </>);

  if(view==="contact") return wrap(<>
    <button onClick={()=>go("home")} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 24px",display:"flex",alignItems:"center",gap:5}}>← Back</button>
    <div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${br}`,borderRadius:20,padding:"28px 28px",marginBottom:28,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:32,alignItems:"center"}}>
      <div style={{display:"flex",justifyContent:"center",alignItems:"center"}}>
        <div style={{position:"relative",width:220,height:220,flexShrink:0}}>
          <div style={{position:"absolute",inset:-4,borderRadius:20,background:`linear-gradient(135deg,${ac},${bl})`,opacity:0.35,zIndex:0}}/>
          <img src="/profile_headshot.jpg" alt="MJ — CPhT-Adv, Founder of PharmTech Path" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:16,position:"relative",zIndex:1,display:"block"}}
            onError={e=>{e.currentTarget.style.display="none";e.currentTarget.nextSibling.style.display="flex";}}/>
          <div style={{display:"none",width:"100%",height:"100%",borderRadius:16,background:`linear-gradient(135deg,${ac}22,${bl}22)`,border:`1px solid ${br}`,alignItems:"center",justifyContent:"center",fontSize:64,position:"relative",zIndex:1}}>👩‍⚕️</div>
        </div>
      </div>
      <div>
        <div style={{marginBottom:14,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <Tag label="CPhT-Adv" color={ac}/>
          <Tag label="Founder" color={bl}/>
          <Tag label="Controlled Substance Lead" color="#a855f7"/>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4,lineHeight:1.2}}>Hi, I'm MJ.</div>
        <div style={{fontSize:13,color:"#c8d8f0",lineHeight:1.9}}>CPhT-Adv, pharmacy technician with years of hands-on pharmacy experience and a straightforward reason for building this app. Nobody told me what my career could actually look like.</div>
        <div style={{fontSize:13,color:"#c8d8f0",lineHeight:1.9,marginTop:12}}>When career coaching resources fell short and the advice was to keep doing what I was already doing, I started researching on my own. What I found changed how I saw the profession entirely.</div>
        <div style={{fontSize:13,color:"#c8d8f0",lineHeight:1.9,marginTop:12}}>PharmTech Path exists so no tech has to figure that out alone. You deserve a resource that actually shows you what is possible.</div>
        <div style={{fontSize:14,fontWeight:700,color:ac,marginTop:14,fontStyle:"italic"}}>Your career doesn't stop at the counter.</div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:24}}>
      <div>
        <div style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:16,marginBottom:11}}>
          <div style={{fontSize:11,fontWeight:700,color:ac,marginBottom:4}}>📧 Email Us Directly</div>
          <a href="mailto:pharmtechgraphics@gmail.com" style={{color:tx,fontSize:13,textDecoration:"none"}}>pharmtechgraphics@gmail.com</a>
        </div>
        <div style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:16}}>
          <div style={{fontSize:11,fontWeight:700,color:ac,marginBottom:8}}>We love hearing about:</div>
          {["Content you want added","Topics needing more depth","Tools or features you need","Bugs or technical issues","Pro subscription questions"].map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontSize:12,color:"#c8d8f0"}}>
              <span style={{color:ac}}>→</span>{item}
            </div>
          ))}
        </div>
      </div>
      <div>
        {sent?(
          <div style={{background:"rgba(0,201,167,.08)",border:"1px solid rgba(0,201,167,.3)",borderRadius:16,padding:32,textAlign:"center"}}>
            <div style={{fontSize:34,marginBottom:12}}>✅</div>
            <div style={{fontSize:16,fontWeight:800,color:"#fff",marginBottom:6}}>Message received!</div>
            <div style={{fontSize:12,color:mu,marginBottom:16}}>We'll follow up at {cf.email}. Thank you!</div>
            <Bp ch="Send another" on={()=>{setSent(false);setCf({name:"",email:"",subject:"question",message:""});}}/>
          </div>
        ):(
          <div style={{background:sf,border:`1px solid ${br}`,borderRadius:16,padding:24}}>
            <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:16}}>Send us a message</div>
            {[{l:"Your Name",k:"name",t:"text",p:"Full name"},{l:"Email",k:"email",t:"email",p:"you@email.com"}].map(f=>(
              <div key={f.k} style={{marginBottom:11}}><div style={{fontSize:11,color:mu,marginBottom:4}}>{f.l}</div><Inp type={f.t} placeholder={f.p} value={cf[f.k]} onChange={e=>setCf(p=>({...p,[f.k]:e.target.value}))}/></div>
            ))}
            <div style={{marginBottom:11}}>
              <div style={{fontSize:11,color:mu,marginBottom:4}}>Subject</div>
              <select style={{width:"100%",background:"#0f1e35",border:`1px solid ${br}`,borderRadius:9,color:tx,fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}} value={cf.subject} onChange={e=>setCf(p=>({...p,subject:e.target.value}))}>
                {[{v:"question",l:"I have a question"},{v:"idea",l:"Feature idea / suggestion"},{v:"content",l:"Content request"},{v:"bug",l:"Bug or technical issue"},{v:"pro",l:"Pro subscription inquiry"},{v:"other",l:"Something else"}].map(s=><option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div style={{marginBottom:16}}><div style={{fontSize:11,color:mu,marginBottom:4}}>Message</div><Inp ta sx={{minHeight:90}} placeholder="Tell us what's on your mind…" value={cf.message} onChange={e=>setCf(p=>({...p,message:e.target.value}))}/></div>
            <Bp ch="Send Message →" on={()=>{if(!cf.name.trim()||!cf.email.trim()||!cf.message.trim()){pop("Please fill in all fields");return;}setSent(true);pop("Message sent!");}} sx={{width:"100%",padding:"11px 0"}}/>
          </div>
        )}
      </div>
    </div>
  </>);

  if(view==="legal") return wrap(<>
    <button onClick={()=>go("home")} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:5}}>← Back</button>
    <H1 ch="Legal & Policies"/>
    {[
      {title:"Terms of Use",body:`Last updated: ${new Date().toLocaleDateString()}\n\nBy accessing PharmTech Path you agree to these Terms.\n\n1. USE OF CONTENT\nAll content is for informational and educational purposes only. You may not reproduce, distribute, or commercialize any content without explicit written permission.\n\n2. ACCOUNTS\nYou are responsible for maintaining the confidentiality of your account credentials.\n\n3. SUBSCRIPTIONS & PAYMENTS\nPro subscription fees are billed as stated at purchase. Refunds handled case-by-case.\nContact: pharmtechgraphics@gmail.com\n\n4. INTELLECTUAL PROPERTY\nAll content and design are the intellectual property of PharmTech Path. Unauthorized reproduction is prohibited.`},
      {title:"Privacy Policy",body:`Last updated: ${new Date().toLocaleDateString()}\n\n1. INFORMATION WE COLLECT\n• Account info: email, display name\n• Usage data: lesson progress, notes you create\n\n2. HOW WE USE YOUR INFORMATION\n• To sync your learning progress across devices\n• To manage your account and subscription\n• To respond to contact form submissions\n• We do NOT sell your personal data to third parties\n\n3. YOUR RIGHTS\nRequest deletion of your account and data at any time:\npharmtechgraphics@gmail.com\n\n4. CHILDREN'S PRIVACY\nPharmTech Path is not directed at children under 13.
\n\n5. DATA STORAGE AND THIRD-PARTY SERVICES\n• Your data is stored using Google Firebase, a cloud platform operated by Google LLC.\n• Firebase stores data on secure servers. You can review Google's privacy practices at firebase.google.com/support/privacy.\n• PharmTech Path does not sell, rent or share your personal data with advertisers or third parties.`},
      {title:"Educational Disclaimer",body:`IMPORTANT — PLEASE READ\n\nPharmTech Path is an educational platform supporting career development for pharmacy technicians.\n\n1. NOT MEDICAL OR LEGAL ADVICE\nAll content is for educational purposes only. It does not constitute medical advice, clinical guidance, legal advice, or official pharmacy policy.\n\n2. NOT A SUBSTITUTE FOR FORMAL TRAINING\nPharmTech Path is not a substitute for accredited training programs, employer training, state board requirements, or licensed pharmacist supervision. Always defer to your facility's SOPs and supervising pharmacist.\n\n3. ACCURACY OF INFORMATION\nPharmacy regulations and certification requirements may change. Always verify with official sources.\n\n4. CONTROLLED SUBSTANCES\nInformation about controlled substances is for high-level awareness only.\n\n5. CERTIFICATION OUTCOMES\nPharmTech Path does not guarantee exam passage or employment outcomes.\n\n6. HIPAA CLARIFICATION\nPharmTech Path does not collect, store, transmit or process any protected health information (PHI) as defined by HIPAA. This platform is a career development and educational tool for pharmacy technicians and is not a covered entity under HIPAA.\n\nQuestions: pharmtechgraphics@gmail.com`},
    ].map(s=>(
      <div key={s.title} style={{background:sf,border:`1px solid ${br}`,borderRadius:13,padding:22,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:12}}>{s.title}</div>
        <pre style={{fontSize:12,color:"#c8d8f0",whiteSpace:"pre-wrap",lineHeight:1.8,margin:0,fontFamily:"inherit"}}>{s.body}</pre>
      </div>
    ))}
  </>);

  // ─── HOME PAGE ─────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:bg,color:tx,fontFamily:"'Segoe UI',system-ui,sans-serif",overflowX:"hidden"}}>
      {!legalAccepted&&<LegalPopup onAccept={()=>setLegalAccepted(true)}/>}
      {showOnboarding&&user&&legalAccepted&&(
        <OnboardingModal user={user} onDismiss={dismissOnboarding} onActivatePro={handleOnboardingPro}/>
      )}
      <Nav view={view} go={go} user={user} isPro={isPro} out={doOut}/>
      {toast&&<Toast msg={toast}/>}
      <FeedbackButton user={user} pop={pop}/>

      <div style={{textAlign:"center",padding:"56px 16px 32px",background:"radial-gradient(ellipse at 50% 0%,rgba(0,201,167,.08) 0%,transparent 66%)"}}>
        <span style={{display:"inline-block",background:"rgba(0,201,167,.1)",color:ac,border:"1px solid rgba(0,201,167,.25)",borderRadius:20,padding:"3px 13px",fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",fontFamily:"monospace"}}>BUILT BY A TECH. FOR TECHS.</span>
        <h1 style={{fontSize:"clamp(28px,6vw,50px)",fontWeight:800,color:"#fff",lineHeight:1.1,margin:"12px 0 11px"}}><span style={{color:ac}}>PharmTech</span> Path</h1>
        <p style={{fontSize:"clamp(18px,3vw,28px)",fontWeight:600,color:"#fff",lineHeight:1.2,margin:"0 0 10px"}}>Your career does not stop at the counter.</p>
        <p style={{fontSize:14,color:mu,maxWidth:480,margin:"0 auto 26px",lineHeight:1.7}}>PharmTech Path is the career advancement resource built for techs who want to go further. We show you what comes next and how to get there.</p>
        <div style={{display:"flex",gap:9,justifyContent:"center",flexWrap:"wrap"}}>
          <Bp ch="Start Learning →" on={()=>go("learn")}/>
        </div>
      </div>

      <div style={{maxWidth:920,margin:"0 auto",padding:"0 16px 20px"}}>

        {/* ─── PROGRESS SNAPSHOT CARD (logged-in users only) ─── */}
        {user && (
          <ProgressSnapshotCard
            user={user}
            profile={profile}
            isPro={isPro}
            done={done}
            aiSessionCount={aiSessionCount}
            createdAt={createdAt}
            go={go}
          />
        )}

       

        {/* ─── CERT ROADMAP TEASER ─── */}
        <CertRoadmapTeaser go={go} isPro={isPro} user={user}/>

        <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:13}}>Where do you want to go?</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:11,marginBottom:28}}>
          {[
            {icon:"📚",title:"Learning Path",desc:"Modules from day one to advanced growth",action:()=>go("learn"),color:ac},
            {icon:"🔗",title:"Resources",desc:"16 official sites — PTCB, BPTS, FDA & more",action:()=>go("resources"),color:bl},
            {icon:"🧰",title:"Bonus Tools",desc:"Drug tables, conversions & trackers",action:()=>go("tools"),color:"#a855f7",locked:!user||!isPro},
            {icon:"🗺️",title:"My Career",desc:"Roadmap, notes & your profile",action:()=>go("career"),color:"#f59e0b",locked:!user},
          ].map(item=>(
            <div key={item.title} onClick={item.action} style={{position:"relative",background:sf,border:`1px solid ${item.color}22`,borderRadius:13,padding:18,cursor:"pointer"}}>
              {item.locked&&<div style={{position:"absolute",top:11,right:11,fontSize:12}}>🔒</div>}
              <div style={{fontSize:23,marginBottom:8}}>{item.icon}</div>
              <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:3}}>{item.title}</div>
              <div style={{fontSize:11,color:mu}}>{item.desc}</div>
            </div>
          ))}
        </div>

        <a href={MERCH_URL} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"block",marginBottom:22}}>
          <div style={{background:"linear-gradient(135deg,rgba(168,85,247,.1),rgba(236,72,153,.08))",border:"1px solid rgba(168,85,247,.3)",borderRadius:16,padding:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16,cursor:"pointer",transition:"border-color .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(168,85,247,.6)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(168,85,247,.3)"}
          >
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <img src="/PharmTechGraphics_logo.png" alt="PharmTech Graphics" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid rgba(168,85,247,.4)"}}/>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:3}}>PharmTechGraphics — Merch Store</div>
                <div style={{fontSize:12,color:mu,maxWidth:360}}>Pharmacy-themed apparel, accessories & designs made for techs, by a tech. Shop the collection.</div>
                <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
                  <Tag label="39 Products" color="#a855f7"/>
                  <Tag label="Shop Now" color="#ec4899"/>
                </div>
              </div>
            </div>
            <div style={{background:"linear-gradient(135deg,#a855f7,#ec4899)",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
              Visit Store →
            </div>
          </div>
        </a>

        {user&&!isPro&&<div style={{background:`linear-gradient(135deg,rgba(0,201,167,.08),rgba(0,148,255,.08))`,border:"1px solid rgba(0,201,167,.2)",borderRadius:16,padding:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div><div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:4}}>Ready to go deeper?</div><div style={{fontSize:12,color:mu,maxWidth:340}}>Unlock Retail, Inpatient, Beyond the Counter & Bonus Tools.</div></div>
          <Bp ch="Upgrade to Pro →" on={()=>go("upgrade")}/>
        </div>}

        <Footer go={go}/>
      </div>
    </div>
  );
}

// ─── CERTIFICATION ROADMAP DATA ───────────────────────────────────────────────

const CERT_TREE = {
  layers: [
    {
      id: "L1",
      label: "Foundation",
      pro: false,
      color: "#4ecdc4",
      bgAlpha: "rgba(78,205,196,0.13)",
      borderColor: "rgba(78,205,196,0.4)",
      nodes: [
        {
          id:"n1_1", icon:"📋", title:"State Registration or Licensure",
          desc:"Every state requires pharmacy technicians to register or obtain a license before working. Requirements vary by state — check your State Board of Pharmacy for exact steps and fees.",
          requirement:"Must meet your state's minimum age and background check requirements.",
          url:"https://nabp.pharmacy", urlLabel:"Check NABP for state requirements",
        },
        {
          id:"n1_2", icon:"🏥", title:"First Pharmacy Job",
          desc:"Landing your first role — whether retail, hospital, or long-term care — is where your real training begins. Hands-on experience builds the skills no classroom fully covers.",
          requirement:"State registration or licensure in hand before starting.",
          url:"https://www.pharmacytechnician.org", urlLabel:"NPTA job resources",
        },
        {
          id:"n1_3", icon:"📅", title:"1 Year Experience Milestone",
          desc:"One year on the job gives you enough workflow exposure to sit for national certification with confidence. Use this time to document responsibilities and build your resume.",
          requirement:"Varies by certifying body — PTCB requires no minimum prior to testing.",
          url:"https://www.ptcb.org", urlLabel:"PTCB eligibility details",
        },
      ],
    },
    {
      id: "L2",
      label: "Certification",
      pro: false,
      color: "#26b5a8",
      bgAlpha: "rgba(38,181,168,0.13)",
      borderColor: "rgba(38,181,168,0.4)",
      nodes: [
        {
          id:"n2_1", icon:"🎓", title:"CPhT via PTCB",
          desc:"The Pharmacy Technician Certification Exam (PTCE) through PTCB is the most widely recognized national credential. Passing earns you the CPhT designation accepted across all pharmacy settings.",
          requirement:"High school diploma or equivalent. No prior work experience required to test.",
          url:"https://www.ptcb.org", urlLabel:"Apply at PTCB.org",
        },
        {
          id:"n2_2", icon:"🎓", title:"CPhT via NHA (ExCPT)",
          desc:"The ExCPT exam through the National Healthcareer Association is a nationally accepted alternative to the PTCE. It is recognized by most state boards and many major employers.",
          requirement:"High school diploma or equivalent. Preferred experience of 1 year recommended.",
          url:"https://www.nhanow.com", urlLabel:"Apply at NHAnow.com",
        },
        {
          id:"n2_3", icon:"📅", title:"3 Year Experience Milestone",
          desc:"Three years of active pharmacy practice positions you for specialty certifications and leadership responsibilities. Start identifying which specialty aligns with your setting.",
          requirement:"Active CPhT credential maintained with CE requirements.",
          url:"https://www.ptcb.org", urlLabel:"Explore next steps at PTCB",
        },
      ],
    },
    {
      id: "L3",
      label: "Specialty & Advanced",
      pro: true,
      color: "#1a9990",
      bgAlpha: "rgba(26,153,144,0.13)",
      borderColor: "rgba(26,153,144,0.4)",
      nodes: [
        {
          id:"n3_1", icon:"💉", title:"CSPT — Sterile Compounding",
          desc:"The Certified Compounded Sterile Preparation Technician credential from PTCB demonstrates advanced competency in IV preparation, cleanroom standards and USP 797 compliance.",
          requirement:"Active CPhT required. Recommended 1 year of sterile compounding experience.",
          url:"https://www.ptcb.org/credentials", urlLabel:"CSPT at PTCB.org",
        },
        {
          id:"n3_2", icon:"⚠️", title:"BCHCPT — Hazardous Compounding",
          desc:"The Board Certified Hazardous Compounding Pharmacy Technician credential from BPTS covers safe handling protocols, PPE standards and USP 800 compliance for hazardous drugs.",
          requirement:"Active CPhT and relevant compounding experience required.",
          url:"https://bpts.org", urlLabel:"BCHCPT at BPTS.org",
        },
        {
          id:"n3_3", icon:"🎓", title:"Associate or Bachelor Degree Programs",
          desc:"Formal pharmacy technology or healthcare administration degree programs strengthen your clinical knowledge base and open doors to supervisory, educator and management roles.",
          requirement:"Varies by program. Most accept active technicians with 1+ year of experience.",
          url:"https://www.acpe-accredit.org", urlLabel:"Accredited programs via ACPE",
        },
        {
          id:"n3_4", icon:"📅", title:"5 Year Experience Milestone",
          desc:"Five years of active practice with a mix of certifications and settings positions you as a strong candidate for lead technician, educator and senior specialist roles.",
          requirement:"Continued CE and active credential maintenance throughout.",
          url:"https://bpts.org", urlLabel:"Advanced credentials at BPTS",
        },
        {
          id:"n3_5", icon:"🏅", title:"CPhT-Adv — Advanced CPhT",
          desc:"The Advanced Certified Pharmacy Technician is the gold standard credential for experienced techs. Application-based — no separate exam — once eligibility requirements are met.",
          requirement:"Active CPhT + four specialty certificates (at least one from BPTS) + 2 years experience.",
          url:"https://bpts.org/credentials/advanced-certified-pharmacy-technician-cpht-adv/", urlLabel:"Apply for CPhT-Adv at BPTS",
        },
      ],
    },
    {
      id: "L4",
      label: "Leadership & Administrative Pathways",
      pro: true,
      color: "#0d7a74",
      bgAlpha: "rgba(13,122,116,0.13)",
      borderColor: "rgba(13,122,116,0.45)",
      nodes: [
        {
          id:"n4_1", icon:"👑", title:"Lead Pharmacy Technician",
          desc:"Lead techs oversee daily workflow, mentor newer staff and serve as the first escalation point for operational issues. This is the most common first step into pharmacy leadership.",
          requirement:"Typically 3+ years experience and active CPhT. Often an internal promotion.",
          url:"https://www.ashp.org", urlLabel:"ASHP workforce resources",
        },
        {
          id:"n4_2", icon:"📊", title:"Pharmacy Supervisor or Manager",
          desc:"Supervisors and managers handle scheduling, compliance oversight, staff training and performance. They bridge operations and pharmacist-level clinical decisions.",
          requirement:"3–5+ years experience. CPhT-Adv or advanced degree strongly preferred.",
          url:"https://www.ashp.org", urlLabel:"ASHP leadership resources",
        },
        {
          id:"n4_3", icon:"🏫", title:"Pharmacy Technician Educator",
          desc:"Educators teach and train future pharmacy technicians in academic or employer-based programs. The CPTEd credential from PTCB formalizes this pathway.",
          requirement:"Active CPhT. CPTEd credential from PTCB recommended.",
          url:"https://www.ptcb.org/credentials", urlLabel:"CPTEd at PTCB.org",
        },
        {
          id:"n4_4", icon:"🔬", title:"Specialty Lab or Compounding Supervisor",
          desc:"Techs with board-level compounding credentials (BCSCPT, BCHCPT) can move into cleanroom supervision, quality assurance and USP compliance management roles.",
          requirement:"BCSCPT or BCHCPT credential plus relevant supervisory experience.",
          url:"https://bpts.org", urlLabel:"Board credentials at BPTS",
        },
        {
          id:"n4_5", icon:"💼", title:"Pharmacy Operations or Director Role",
          desc:"Director-level roles focus on budget management, regulatory compliance, staffing strategy and institutional policy. These positions require both clinical background and leadership experience.",
          requirement:"Typically 7–10+ years experience. Advanced degree or CPhT-Adv strongly preferred.",
          url:"https://www.ashp.org", urlLabel:"ASHP director resources",
        },
        {
          id:"n4_6", icon:"📋", title:"Compliance and Regulatory Specialist",
          desc:"Compliance specialists ensure pharmacy operations meet state board, DEA, Joint Commission and USP standards. The BPTS Regulatory Compliance certificate directly supports this role.",
          requirement:"Active CPhT. BPTS Regulatory Compliance certificate recommended.",
          url:"https://bpts.org", urlLabel:"Regulatory cert at BPTS",
        },
      ],
    },
  ],
};

// ─── CERT ROADMAP COMPONENT ───────────────────────────────────────────────────

function CertRoadmap({ isPro, go }) {
  const [activeNode, setActiveNode] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleNode = (node, layerPro) => {
    if (layerPro && !isPro) { setShowUpgrade(true); return; }
    setActiveNode(node);
    setShowUpgrade(false);
  };

  const closeAll = () => { setActiveNode(null); setShowUpgrade(false); };

  return (
    <div>
      <div style={{fontSize:13,color:mu,marginBottom:6,lineHeight:1.7}}>
        Your certification journey from day one to leadership. Tap any node to learn more.
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:22}}>
        {CERT_TREE.layers.map(l=>(
          <div key={l.id} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:mu}}>
            <div style={{width:10,height:10,borderRadius:3,background:l.color,flexShrink:0}}/>
            {l.label}
            {l.pro&&<span style={{fontSize:9,color:bl,fontWeight:700,background:"rgba(0,148,255,.12)",border:"1px solid rgba(0,148,255,.25)",borderRadius:99,padding:"1px 6px",letterSpacing:0.5}}>PRO</span>}
          </div>
        ))}
      </div>

      {/* Tree */}
      <div style={{display:"flex",flexDirection:"column",gap:0,position:"relative"}}>
        {CERT_TREE.layers.map((layer, li) => {
          const locked = layer.pro && !isPro;
          return (
            <div key={layer.id}>
              {/* Connector line between layers */}
              {li > 0 && (
                <div style={{display:"flex",justifyContent:"center",height:28,alignItems:"center"}}>
                  <div style={{width:2,height:"100%",background:`linear-gradient(to bottom,${CERT_TREE.layers[li-1].color}88,${layer.color}88)`}}/>
                </div>
              )}

              {/* Layer card */}
              <div style={{
                background: locked ? "rgba(255,255,255,.02)" : layer.bgAlpha,
                border: `1.5px solid ${locked ? br : layer.borderColor}`,
                borderRadius: 16,
                padding: "18px 16px 20px",
                position: "relative",
                opacity: locked ? 0.85 : 1,
                transition: "opacity .2s",
              }}>
                {/* Layer header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{
                      width:28,height:28,borderRadius:8,
                      background:`${layer.color}22`,border:`1px solid ${layer.color}44`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,fontWeight:900,color:layer.color,fontFamily:"monospace",
                      flexShrink:0,
                    }}>{layer.id}</div>
                    <div style={{fontSize:14,fontWeight:800,color:locked?"rgba(255,255,255,.4)":"#fff"}}>{layer.label}</div>
                  </div>
                  {locked && (
                    <span style={{background:"rgba(0,148,255,.12)",color:bl,border:"1px solid rgba(0,148,255,.25)",borderRadius:20,fontSize:9,fontWeight:700,padding:"2px 9px",letterSpacing:1,textTransform:"uppercase",fontFamily:"monospace"}}>
                      🔒 Pro Only
                    </span>
                  )}
                </div>

                {/* Nodes grid */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
                  {layer.nodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => handleNode(node, layer.pro)}
                      style={{
                        background: locked
                          ? "rgba(255,255,255,.03)"
                          : activeNode?.id === node.id
                          ? `linear-gradient(135deg,${layer.color}30,${layer.color}18)`
                          : `rgba(255,255,255,.04)`,
                        border: activeNode?.id === node.id
                          ? `1.5px solid ${layer.color}`
                          : locked
                          ? `1px solid rgba(255,255,255,.08)`
                          : `1px solid ${layer.color}33`,
                        borderRadius: 12,
                        padding: "12px 13px",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all .18s",
                        position: "relative",
                        filter: locked ? "blur(0px)" : "none",
                      }}
                      onMouseEnter={e => { if (!locked) e.currentTarget.style.borderColor = layer.color; }}
                      onMouseLeave={e => { if (!locked && activeNode?.id !== node.id) e.currentTarget.style.borderColor = `${layer.color}33`; }}
                    >
                      {locked && (
                        <div style={{position:"absolute",inset:0,borderRadius:12,backdropFilter:"blur(3px)",background:"rgba(10,22,40,.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
                          <span style={{fontSize:16}}>🔒</span>
                        </div>
                      )}
                      <div style={{fontSize:18,marginBottom:6,lineHeight:1}}>{node.icon}</div>
                      <div style={{fontSize:11,fontWeight:700,color:locked?"rgba(255,255,255,.3)":activeNode?.id===node.id?layer.color:"#fff",lineHeight:1.4}}>{node.title}</div>
                    </button>
                  ))}
                </div>

                {/* Unlock prompt inside locked layer */}
                {locked && showUpgrade && (
                  <div style={{marginTop:14,background:"rgba(0,148,255,.08)",border:"1px solid rgba(0,148,255,.25)",borderRadius:11,padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                    <div style={{fontSize:12,color:tx}}>Unlock Layers 3 and 4 with Pro to see the full advancement path.</div>
                    <button onClick={()=>go("upgrade")} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Upgrade to Pro →</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Node detail popup */}
      {activeNode && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(5,10,22,.82)",zIndex:800,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}}
          onClick={e=>{ if(e.target===e.currentTarget) closeAll(); }}
        >
          <div style={{
            background:"#0d1e36",border:`1.5px solid ${ac}44`,borderRadius:20,
            width:"100%",maxWidth:460,padding:"26px 26px 22px",
            boxShadow:"0 24px 60px rgba(0,0,0,.7)",
            animation:"certFadeIn .2s ease",
          }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:26,lineHeight:1}}>{activeNode.icon}</span>
                <div style={{fontSize:15,fontWeight:800,color:"#fff",lineHeight:1.3}}>{activeNode.title}</div>
              </div>
              <button onClick={closeAll} style={{background:"none",border:"none",color:mu,fontSize:22,cursor:"pointer",lineHeight:1,flexShrink:0,marginTop:2}}>×</button>
            </div>

            <div style={{fontSize:13,color:"#c8d8f0",lineHeight:1.8,marginBottom:14}}>{activeNode.desc}</div>

            <div style={{background:"rgba(0,201,167,.07)",border:"1px solid rgba(0,201,167,.2)",borderRadius:10,padding:"10px 13px",marginBottom:18}}>
              <div style={{fontSize:10,fontWeight:700,color:ac,letterSpacing:1,textTransform:"uppercase",fontFamily:"monospace",marginBottom:4}}>Requirement</div>
              <div style={{fontSize:12,color:"#c8d8f0",lineHeight:1.7}}>{activeNode.requirement}</div>
            </div>

            <a href={activeNode.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"block"}}>
              <button style={{width:"100%",background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:11,padding:"11px 0",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:0.2}}>
                {activeNode.urlLabel} →
              </button>
            </a>
            <div style={{textAlign:"center",marginTop:10,fontSize:10,color:mu}}>Opens in a new tab</div>
          </div>
          <style>{`@keyframes certFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
        </div>
      )}

      {/* Standalone upgrade prompt (when user taps Pro node and popup isn't inside a layer) */}
      {showUpgrade && !activeNode && (
        <div style={{marginTop:18,background:"rgba(0,148,255,.07)",border:"1px solid rgba(0,148,255,.25)",borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:3}}>This section is Pro only</div>
            <div style={{fontSize:12,color:mu}}>Upgrade to unlock Layers 3 and 4 — specialty certifications and leadership pathways.</div>
          </div>
          <button onClick={()=>go("upgrade")} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Upgrade →</button>
        </div>
      )}
    </div>
  );
}

// ─── CERT ROADMAP HOMEPAGE TEASER ─────────────────────────────────────────────

function CertRoadmapTeaser({ go, isPro, user }) {
  // Mini static preview nodes — purely visual, no interaction
  const previewLayers = [
    { color:"#4ecdc4", nodes:["📋 State Reg","🏥 First Job","📅 1 Yr"] },
    { color:"#26b5a8", nodes:["🎓 CPhT","📅 3 Yr"] },
    { color:"#1a9990", nodes:["💉 CSPT","🏅 CPhT-Adv","📅 5 Yr"] },
    { color:"#0d7a74", nodes:["👑 Lead Tech","📊 Manager","🏫 Educator"] },
  ];

  return (
    <div style={{
      background:"rgba(78,205,196,.06)",
      border:"1.5px solid rgba(78,205,196,.28)",
      borderRadius:18,
      padding:"20px 22px",
      marginBottom:22,
      position:"relative",
      overflow:"hidden",
    }}>
      {/* Background glow */}
      <div style={{position:"absolute",bottom:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(78,205,196,.05)",pointerEvents:"none"}}/>

      <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        {/* Mini tree preview */}
        <div style={{
          flex:"0 0 auto",
          filter: isPro ? "none" : "blur(2.5px)",
          pointerEvents:"none",
          display:"flex",flexDirection:"column",gap:4,
          transition:"filter .3s",
        }} aria-hidden="true">
          {previewLayers.map((l,li)=>(
            <div key={li} style={{display:"flex",gap:4,alignItems:"center"}}>
              {li>0&&<div style={{display:"none"}}/>}
              {l.nodes.map((n,ni)=>(
                <div key={ni} style={{
                  background:`${l.color}18`,
                  border:`1px solid ${l.color}44`,
                  borderRadius:7,padding:"4px 7px",
                  fontSize:9,color:l.color,fontWeight:600,
                  whiteSpace:"nowrap",
                }}>{n}</div>
              ))}
            </div>
          ))}
        </div>

        {/* Text and CTA */}
        <div style={{flex:1,minWidth:180}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,flexWrap:"wrap"}}>
            <span style={{fontSize:16}}>🌿</span>
            <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>Certification Roadmap</div>
            {!isPro&&<span style={{background:"rgba(0,148,255,.12)",color:bl,border:"1px solid rgba(0,148,255,.25)",borderRadius:99,fontSize:9,fontWeight:700,padding:"1px 7px",letterSpacing:0.5,fontFamily:"monospace"}}>PRO</span>}
          </div>
          <div style={{fontSize:12,color:mu,lineHeight:1.6,marginBottom:12}}>
            {isPro
              ? "See every step from state registration to leadership. Tap any node for details and direct links."
              : "See your full career path from registration to leadership. Layers 3 and 4 unlock with Pro."
            }
          </div>
          {user && (
            <button
              onClick={()=>{
                go("career");
                setTimeout(()=>document.dispatchEvent(new CustomEvent("pharmtech-tab",{detail:"certmap"})),80);
              }}
              style={{
                background:`linear-gradient(135deg,#4ecdc4,${ac})`,
                color:"#fff",border:"none",borderRadius:10,
                padding:"8px 18px",fontSize:12,fontWeight:700,
                cursor:"pointer",
              }}
            >
              See your full certification path →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AICareerAssistant({ profile, isPro, go, setProfile, pop, onFirstMessage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasTrackedSession, setHasTrackedSession] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const profileFields = [
    { key: "preferredName", label: "Preferred Name" },
    { key: "currentJob", label: "Current Job Title" },
    { key: "workplace", label: "Workplace" },
    { key: "jobDesc", label: "Role Description" },
    { key: "resumeNote", label: "Resume Notes" },
  ];
  const certsFilled = (profile.certifications || []).filter(c => c.trim()).length > 0;
  const employmentFilled = (profile.employment || []).length > 0;
  const missingFields = profileFields.filter(f => !profile[f.key]?.trim()).map(f => f.label);
  if (!certsFilled) missingFields.push("Certifications");
  if (!employmentFilled) missingFields.push("Employment History");
  const profileComplete = missingFields.length === 0;
  const profilePct = Math.round(
    ((profileFields.filter(f => profile[f.key]?.trim()).length + (certsFilled ? 1 : 0) + (employmentFilled ? 1 : 0)) /
      (profileFields.length + 2)) * 100
  );

  const STARTER_PROMPTS = [
    { icon: "📝", text: "Help me write strong resume bullet points for my current role" },
    { icon: "🎓", text: "What certification should I pursue next based on my background?" },
    { icon: "💼", text: "How do I prepare for a pharmacy technician interview?" },
    { icon: "🗺️", text: "What are my best career growth options from here?" },
  ];

  const buildSystemPrompt = () => {
    const name = profile.preferredName || "this pharmacy technician";
    const job = profile.currentJob || "pharmacy technician";
    const workplace = profile.workplace ? "at " + profile.workplace : "";
    const certs = (profile.certifications || []).filter(c => c.trim()).join(", ") || "none listed";
    const jobDesc = profile.jobDesc ? "Current role description: " + profile.jobDesc : "";
    const employment = (profile.employment || [])
      .map(e => `${e.title} at ${e.workplace || "unknown"} (${e.start || ""}${e.current ? " — Present" : e.end ? " — " + e.end : ""})`)
      .join("; ") || "none listed";
    const resumeNote = profile.resumeNote ? "Resume notes/skills: " + profile.resumeNote : "";
    return `You are a dedicated career coach and mentor for pharmacy technicians, built into PharmTech Path — an educational platform created by a CPhT-Adv with 5+ years of experience.\n\nYou are speaking with ${name}, who works as a ${job}${workplace}.\n\nProfile:\n- Certifications: ${certs}\n- Employment history: ${employment}\n- ${jobDesc}\n- ${resumeNote}\n\nYour role:\n- Give specific, actionable career advice tailored to pharmacy technicians\n- Cover topics like certifications, resume writing, interview prep, job titles, career paths, retail vs inpatient transitions, and healthcare career growth\n- Be warm, direct, and practical — like a knowledgeable colleague who has been through it\n- When profile info is missing or vague, give useful general advice and note what additional context would help you personalize further\n- Keep responses focused and easy to read. Use bullet points or numbered lists when helpful.\n- Never give clinical or medical advice — stay in the lane of career development and professional growth`;
  };

  const sendMessage = async (text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");

    // Track AI session on first message only
    if (!hasTrackedSession && onFirstMessage) {
      setHasTrackedSession(true);
      onFirstMessage();
    }

    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildSystemPrompt(),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          careerPreferences: profile?.careerPreferences || {},
        }),
      });
      const data = await response.json();
      const reply = data.content?.[0]?.text || "Sorry, I couldn't generate a response. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please check your connection and try again." }]);
    }
    setLoading(false);
  };

  const clearChat = () => setMessages([]);

  if (!isPro) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ fontSize: 42, marginBottom: 12 }}>🤖</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>AI Career Assistant</div>
      <div style={{ fontSize: 13, color: mu, marginBottom: 20, maxWidth: 360, margin: "0 auto 20px" }}>
        Get personalized career guidance, resume help, interview prep, and job match advice — powered by AI and built around your profile.
      </div>
      <Tag label="Pro Only" color={bl} />
      <div style={{ marginTop: 20 }}>
        <button onClick={() => go("upgrade")} style={{ background: `linear-gradient(135deg,${ac},${bl})`, color: "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          Upgrade to Pro →
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>🤖 AI Career Assistant</div>
          <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>Powered by PharmTech Path · Pro feature</div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} style={{ background: "none", border: `1px solid ${br}`, color: mu, borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Clear chat
          </button>
        )}
      </div>

      {!profileComplete && (
        <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 4 }}>
              Your profile is {profilePct}% complete — fill it in for more accurate advice
            </div>
            <div style={{ fontSize: 11, color: mu, lineHeight: 1.7, marginBottom: 8 }}>
              Missing: {missingFields.join(", ")}. The more context the assistant has about you, the better it personalizes its answers.
            </div>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("pharmtech-tab", { detail: "profile" }))}
              style={{ background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.35)", color: "#f59e0b", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
            >
              Complete my profile →
            </button>
          </div>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,.02)", border: `1px solid ${br}`, borderRadius: 14, minHeight: 320, maxHeight: 460, overflowY: "auto", padding: "16px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                Hey{profile.preferredName ? `, ${profile.preferredName.split(" ")[0]}` : ""}! What are you working on?
              </div>
              <div style={{ fontSize: 12, color: mu }}>Ask anything about your pharmacy tech career.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
              {STARTER_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p.text)}
                  style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${br}`, borderRadius: 10, padding: "11px 13px", fontSize: 12, color: tx, cursor: "pointer", textAlign: "left", lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start", transition: "border-color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,201,167,.4)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = br}
                >
                  <span style={{ flexShrink: 0 }}>{p.icon}</span>
                  <span>{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: m.role === "user" ? `linear-gradient(135deg,${ac},${bl})` : "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
              {m.role === "user" ? (profile.preferredName?.[0]?.toUpperCase() || "👤") : "🤖"}
            </div>
            <div style={{ maxWidth: "78%", background: m.role === "user" ? `linear-gradient(135deg,rgba(0,201,167,.15),rgba(0,148,255,.12))` : "rgba(255,255,255,.05)", border: m.role === "user" ? "1px solid rgba(0,201,167,.25)" : `1px solid ${br}`, borderRadius: m.role === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px", padding: "10px 13px", fontSize: 13, color: tx, lineHeight: 1.7}}>
              {m.content.split('\n').map((line, i) => {
                const formatted = line
                  .replace(/^### (.+)/, '<strong style="font-size:13px;color:#fff">$1</strong>')
                  .replace(/^## (.+)/, '<strong style="font-size:14px;color:#fff">$1</strong>')
                  .replace(/^# (.+)/, '<strong style="font-size:15px;color:#fff">$1</strong>')
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/^- (.+)/, '• $1');
                return <span key={i} dangerouslySetInnerHTML={{__html: formatted}} style={{display:'block', marginBottom: line.startsWith('#') ? 8 : 2}}/>;
              })}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🤖</div>
            <div style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${br}`, borderRadius: "4px 14px 14px 14px", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map(d => (
                <div key={d} style={{ width: 7, height: 7, borderRadius: "50%", background: ac, opacity: 0.6, animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${d * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex", gap: 9 }}>
        <input
          placeholder="Ask about certifications, resume, career paths…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
          style={{ flex: 1, background: "rgba(255,255,255,.05)", border: `1px solid ${br}`, borderRadius: 10, color: tx, fontSize: 13, padding: "10px 13px", outline: "none", fontFamily: "inherit" }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          style={{ background: `linear-gradient(135deg,${ac},${bl})`, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.45, flexShrink: 0 }}
        >
          Send →
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function CareerProfile({profile,setProfile,isPro,go,pop}){
  const upd=(k,v)=>setProfile(p=>({...p,[k]:v}));
  const [newJob,setNewJob]=useState({title:"",workplace:"",start:"",end:"",current:false,desc:""});
  const [showJobForm,setShowJobForm]=useState(false);

  const addJob=()=>{
    if(!newJob.title.trim()) return;
    setProfile(p=>({...p,employment:[...(p.employment||[]),{...newJob,id:Date.now().toString()}]}));
    setNewJob({title:"",workplace:"",start:"",end:"",current:false,desc:""});
    setShowJobForm(false);
    pop("Employment added!");
  };

  const removeJob=(id)=>{
    setProfile(p=>({...p,employment:(p.employment||[]).filter(e=>e.id!==id)}));
    pop("Removed.");
  };

  const inpStyle={width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:9,color:tx,fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",boxSizing:"border-box"};
  const label=(txt)=><div style={{fontSize:11,color:mu,marginBottom:5}}>{txt}</div>;

  return (
    <div>
      <div style={{background:sf,border:`1px solid ${br}`,borderRadius:14,padding:22,marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>Basic Profile</div>
        <div style={{fontSize:11,color:mu,marginBottom:16}}>Visible on your career dashboard. Free for all users.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
          <div>{label("Preferred Name")}<input placeholder="What should we call you?" value={profile.preferredName||""} onChange={e=>upd("preferredName",e.target.value)} style={inpStyle}/></div>
          <div>{label("Current Job Title")}<input placeholder="e.g. Pharmacy Technician, CPhT" value={profile.currentJob||""} onChange={e=>upd("currentJob",e.target.value)} style={inpStyle}/></div>
          <div>{label("Current Workplace")}<input placeholder="e.g. CVS, St. Mary's Hospital" value={profile.workplace||""} onChange={e=>upd("workplace",e.target.value)} style={inpStyle}/></div>
        </div>
        <div style={{marginTop:10,fontSize:11,color:mu,fontStyle:"italic"}}>Changes save automatically as you type.</div>
      </div>

      {!isPro?(
        <div style={{background:"rgba(0,148,255,.06)",border:"1px solid rgba(0,148,255,.2)",borderRadius:14,padding:24,textAlign:"center"}}>
          <div style={{fontSize:22,marginBottom:8}}>🔒</div>
          <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:6}}>Advanced Profile — Pro Only</div>
          <div style={{fontSize:12,color:mu,marginBottom:16,maxWidth:360,margin:"0 auto 16px"}}>Upgrade to Pro to unlock employment history, certifications, resume notes and more.</div>
          <button onClick={()=>go("upgrade")} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Upgrade to Pro →</button>
        </div>
      ):(
        <>
          <div style={{background:sf,border:`1px solid ${br}`,borderRadius:14,padding:22,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>Current Role Description</div>
            <div style={{fontSize:11,color:mu,marginBottom:12}}>Briefly describe what you do in your current role.</div>
            <textarea placeholder="e.g. Responsible for controlled substance reconciliation, cart fills, and inpatient dispensing in a 400-bed hospital…" value={profile.jobDesc||""} onChange={e=>upd("jobDesc",e.target.value)} style={{...inpStyle,resize:"vertical",minHeight:90}}/>
          </div>

          <div style={{background:sf,border:`1px solid ${br}`,borderRadius:14,padding:22,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>Employment History</div>
              {!showJobForm&&<button onClick={()=>setShowJobForm(true)} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:8,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button>}
            </div>
            <div style={{fontSize:11,color:mu,marginBottom:16}}>Add previous or current positions with dates.</div>
            {(profile.employment||[]).length===0&&!showJobForm&&(
              <div style={{textAlign:"center",padding:"16px 0",color:mu,fontSize:12}}>No employment history yet. Click "+ Add" to get started.</div>
            )}
            {(profile.employment||[]).map(job=>(
              <div key={job.id} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${br}`,borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>{job.title}</div>
                    {job.workplace&&<div style={{fontSize:11,color:ac,marginTop:2}}>{job.workplace}</div>}
                    <div style={{fontSize:11,color:mu,marginTop:2}}>{job.start}{job.start&&(job.current||job.end)?" — ":""}{job.current?"Present":job.end}</div>
                    {job.desc&&<div style={{fontSize:12,color:"#c8d8f0",marginTop:6,lineHeight:1.6}}>{job.desc}</div>}
                  </div>
                  <button onClick={()=>removeJob(job.id)} style={{background:"none",border:"none",color:"rgba(255,107,107,.6)",fontSize:18,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
                </div>
              </div>
            ))}
            {showJobForm&&(
              <div style={{background:"rgba(0,201,167,.05)",border:"1px solid rgba(0,201,167,.2)",borderRadius:11,padding:16,marginTop:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:12}}>New Position</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:10}}>
                  <div>{label("Job Title *")}<input placeholder="e.g. Pharmacy Technician" value={newJob.title} onChange={e=>setNewJob(p=>({...p,title:e.target.value}))} style={inpStyle}/></div>
                  <div>{label("Workplace")}<input placeholder="e.g. Walgreens" value={newJob.workplace} onChange={e=>setNewJob(p=>({...p,workplace:e.target.value}))} style={inpStyle}/></div>
                  <div>{label("Start Date")}<input placeholder="e.g. Jan 2022" value={newJob.start} onChange={e=>setNewJob(p=>({...p,start:e.target.value}))} style={inpStyle}/></div>
                  <div>
                    {label("End Date")}
                    <input placeholder="e.g. Dec 2023" value={newJob.end} onChange={e=>setNewJob(p=>({...p,end:e.target.value}))} disabled={newJob.current} style={{...inpStyle,opacity:newJob.current?0.4:1}}/>
                    <label style={{display:"flex",alignItems:"center",gap:6,marginTop:6,cursor:"pointer"}}>
                      <input type="checkbox" checked={newJob.current} onChange={e=>setNewJob(p=>({...p,current:e.target.checked,end:""}))} style={{accentColor:ac}}/>
                      <span style={{fontSize:11,color:mu}}>Currently working here</span>
                    </label>
                  </div>
                </div>
                <div style={{marginBottom:12}}>
                  {label("Brief Description (optional)")}
                  <textarea placeholder="Key responsibilities or achievements…" value={newJob.desc} onChange={e=>setNewJob(p=>({...p,desc:e.target.value}))} style={{...inpStyle,resize:"vertical",minHeight:60}}/>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={addJob} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",opacity:newJob.title.trim()?1:0.4}}>Save Position</button>
                  <button onClick={()=>setShowJobForm(false)} style={{background:sf,color:tx,border:`1px solid ${br}`,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div style={{background:sf,border:`1px solid ${br}`,borderRadius:14,padding:22,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>Certifications</div>
            <div style={{fontSize:11,color:mu,marginBottom:14}}>List your pharmacy certifications (e.g. CPhT, CPhT-Adv, BPS specialty).</div>
            {(profile.certifications||["","",""]).map((cert,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                <div style={{fontSize:11,color:mu,width:20,textAlign:"right",flexShrink:0}}>{i+1}.</div>
                <input placeholder={i===0?"e.g. CPhT":i===1?"e.g. CPhT-Adv":"e.g. BPS Specialty"} value={cert}
                  onChange={e=>{const updated=[...(profile.certifications||["","",""])];updated[i]=e.target.value;upd("certifications",updated);}}
                  style={{...inpStyle,flex:1}}/>
              </div>
            ))}
            <button onClick={()=>upd("certifications",[...(profile.certifications||["","",""]),""]) }
              style={{background:"none",border:"none",color:ac,fontSize:12,fontWeight:600,cursor:"pointer",marginTop:4,padding:0}}>+ Add another certification</button>
          </div>

          <div style={{background:sf,border:`1px solid ${br}`,borderRadius:14,padding:22,marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:4}}>Resume Notes</div>
            <div style={{fontSize:11,color:mu,marginBottom:12}}>Use this space to draft resume bullet points, skills, or anything you want to remember when updating your resume.</div>
            <textarea
              placeholder="e.g. Key skills: controlled substance management, IV workflow, automated dispensing systems…"
              value={profile.resumeNote||""}
              onChange={e=>upd("resumeNote",e.target.value)}
              style={{...inpStyle,resize:"vertical",minHeight:130}}
            />
            <div style={{marginTop:10,fontSize:11,color:mu,fontStyle:"italic"}}>Tip: Keep track of accomplishments as they happen. Don't wait until you need your resume to start writing!</div>
          </div>

          <div style={{textAlign:"center",padding:"32px 24px",background:"rgba(0,201,167,.04)",border:`1px solid rgba(0,201,167,.15)`,borderRadius:14,marginBottom:16}}>
            <div style={{fontSize:36,marginBottom:12}}>📄</div>
            <div style={{display:"inline-block",marginBottom:12}}><Tag label="Coming Soon" color="#a855f7"/></div>
            <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:8}}>Resume Upload</div>
            <div style={{fontSize:13,color:mu,maxWidth:380,margin:"0 auto 16px",lineHeight:1.8}}>
              Upload your resume as a PDF and keep it on file. Once the AI Career Assistant launches, it will pull from your resume to give you personalized advice, help you write bullet points, and prep you for interviews.
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,maxWidth:420,margin:"0 auto",textAlign:"left"}}>
              {[{icon:"📤",label:"Upload PDF resume"},{icon:"📁",label:"Store multiple versions"},{icon:"🤖",label:"AI reads your resume"},{icon:"✍️",label:"Personalized advice"}].map((f,i)=>(
                <div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:9,padding:"9px 12px",fontSize:11,color:mu,display:"flex",alignItems:"center",gap:7}}>
                  <span>{f.icon}</span>{f.label}
                </div>
              ))}
            </div>
            <div style={{marginTop:16,fontSize:11,color:mu}}>This feature is on the way. Stay tuned!</div>
          </div>
        </>
      )}
    </div>
  );
}

function FreeNotes({notes,setNotes,form,setForm,pop}){
  const empty={subject:"",body:""};

  const saveNote=()=>{
    if(!form?.body?.trim()) return;
    if(form.id){
      setNotes(prev=>prev.map(n=>n.id===form.id?{...n,subject:form.subject,body:form.body,updatedAt:Date.now()}:n));
      pop("Note updated!");
    } else {
      setNotes(prev=>[{id:Date.now().toString(),subject:form.subject||"Untitled",body:form.body,createdAt:Date.now()},...prev]);
      pop("Note saved!");
    }
    setForm(null);
  };

  const deleteNote=(id)=>{
    setNotes(prev=>prev.filter(n=>n.id!==id));
    pop("Note deleted.");
  };

  if(form!==null) return (
    <div>
      <button onClick={()=>setForm(null)} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:5}}>← Back to notes</button>
      <div style={{fontSize:16,fontWeight:800,color:"#fff",marginBottom:16}}>{form.id?"Edit Note":"New Note"}</div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:mu,marginBottom:5}}>Subject</div>
        <input placeholder="e.g. Study tips, Work reminders…" value={form.subject||""} onChange={e=>setForm(f=>({...f,subject:e.target.value}))}
          style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:10,color:tx,fontSize:14,padding:"10px 13px",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      </div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:mu,marginBottom:5}}>Note</div>
        <textarea placeholder="Write anything…" value={form.body||""} onChange={e=>setForm(f=>({...f,body:e.target.value}))}
          style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:10,color:tx,fontSize:14,padding:"10px 13px",outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",minHeight:180}}/>
      </div>
      <div style={{display:"flex",gap:9}}>
        <button onClick={saveNote} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer",opacity:form.body?.trim()?1:0.4}}>
          {form.id?"Save Changes":"Save Note"}
        </button>
        <button onClick={()=>setForm(null)} style={{background:sf,color:tx,border:`1px solid ${br}`,borderRadius:10,padding:"10px 18px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div style={{fontSize:13,color:mu}}>{notes.length===0?"No notes yet. Create your first one!":`${notes.length} note${notes.length!==1?"s":""}`}</div>
        <button onClick={()=>setForm(empty)} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>+ Create Note</button>
      </div>
      {notes.length===0&&(
        <div style={{textAlign:"center",padding:"40px 0",color:mu}}>
          <div style={{fontSize:40,marginBottom:12}}>🗒️</div>
          <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:6}}>Your personal notepad</div>
          <div style={{fontSize:12,color:mu,marginBottom:20}}>Jot down anything — study tips, work reminders, questions to ask your pharmacist.</div>
          <button onClick={()=>setForm(empty)} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:14,fontWeight:700,cursor:"pointer"}}>+ Create your first note</button>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {notes.map(n=>(
          <div key={n.id} style={{background:sf,border:`1px solid ${br}`,borderRadius:12,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{n.subject||"Untitled"}</div>
              <div style={{display:"flex",gap:8,flexShrink:0}}>
                <button onClick={()=>setForm({...n})} style={{background:"none",border:"none",color:ac,fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>deleteNote(n.id)} style={{background:"none",border:"none",color:"rgba(255,107,107,.7)",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>
              </div>
            </div>
            <div style={{fontSize:13,color:"#c8d8f0",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{n.body}</div>
            <div style={{fontSize:10,color:mu,marginTop:8}}>{new Date(n.updatedAt||n.createdAt).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudyTracker({tracker,set}){
  const weeks=[{k:"w1",l:"Week 1 — Math & Workflow"},{k:"w2",l:"Week 2 — Law & Safety"},{k:"w3",l:"Week 3 — Drug Classes"},{k:"w4",l:"Week 4 — Practice Exams"}];
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const toggle=(wk,d)=>set(p=>({...p,[wk]:{...p[wk],[d]:!p[wk]?.[d]}}));
  const total=28,dn=weeks.reduce((a,w)=>a+days.filter(d=>tracker[w.k]?.[d]).length,0);
  return <div>
    <div style={{fontSize:12,color:mu,marginBottom:6}}>Tap each day you study to check it off.</div>
    <div style={{fontSize:12,color:ac,fontWeight:700,marginBottom:16}}>{dn}/{total} days completed</div>
    {weeks.map(w=><div key={w.k} style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:16,marginBottom:11}}>
      <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:11}}>{w.l}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{days.map(d=>{const on=tracker[w.k]?.[d];return <button key={d} onClick={()=>toggle(w.k,d)} style={{width:40,height:40,borderRadius:8,border:on?"none":`1px solid ${br}`,background:on?`linear-gradient(135deg,${ac},${bl})`:sf,color:on?"#fff":mu,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"monospace"}}>{d}</button>;})}</div>
    </div>)}
  </div>;
}

function MonthPlan({plan,set,pop}){
  const weeks=[{k:"w1",l:"Week 1 Goals",p:"e.g. Learn the layout, observe workflow…"},{k:"w2",l:"Week 2 Skills to Build",p:"e.g. Insurance processing, data entry speed…"},{k:"w3",l:"Week 3 Reflections",p:"e.g. What improved? What still feels unclear?"},{k:"w4",l:"Week 4 Questions to Ask",p:"e.g. Questions for your pharmacist or supervisor…"}];
  return <div>
    <div style={{fontSize:12,color:mu,marginBottom:16}}>Set intentions for each week of your first month. Auto-saves when you click away.</div>
    {weeks.map(w=><div key={w.k} style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:6}}>{w.l}</div>
      <textarea style={{width:"100%",background:"rgba(255,255,255,.05)",border:`1px solid ${br}`,borderRadius:9,color:tx,fontSize:13,padding:"9px 12px",outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",minHeight:76}} placeholder={w.p} value={plan[w.k]||""} onChange={e=>set(p=>({...p,[w.k]:e.target.value}))} onBlur={()=>pop("Saved!")}/>
    </div>)}
  </div>;
}
