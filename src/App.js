import { useState, useCallback, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

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

const RESOURCES = [
  { name:"PTCB", full:"Pharmacy Technician Certification Board", url:"https://www.ptcb.org", desc:"Primary national CPhT certification & advanced credentials", color:"#1a8fa8", cat:"Certification" },
  { name:"NHA",  full:"National Healthcareer Association", url:"https://www.nhanow.com", desc:"ExCPT certification — widely accepted nationally", color:"#2e9d68", cat:"Certification" },
  { name:"BPS",  full:"Board of Pharmacy Specialties", url:"https://www.bpsweb.org", desc:"Specialty certifications for advanced practice", color:"#4a7fc1", cat:"Certification" },
  { name:"ACPE", full:"Accreditation Council for Pharmacy Education", url:"https://www.acpe-accredit.org", desc:"Pharmacy program accreditation & CE standards", color:"#27ae60", cat:"Education" },
  { name:"ASHP", full:"American Society of Health-System Pharmacists", url:"https://www.ashp.org", desc:"Hospital pharmacy training, residencies & advocacy", color:"#8e44ad", cat:"Professional Org" },
  { name:"NPTA", full:"National Pharmacy Technician Association", url:"https://www.pharmacytechnician.org", desc:"CE credits, community & technician advocacy", color:"#c0392b", cat:"Professional Org" },
  { name:"APhA", full:"American Pharmacists Association", url:"https://www.pharmacist.com", desc:"CE, career development & pharmacy resources", color:"#d35400", cat:"Professional Org" },
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
        { id:"l1", title:"The Role Is Bigger Than It Looks", content:`Most outsiders see pill counting, ringing up prescriptions, and printing labels. That's surface-level.\n\nBehind the counter, technicians are:\n• Workflow stabilizers\n• Documentation protectors\n• Process enforcers\n• Inventory managers\n• Safety checkpoints\n\nIf you rush, the system breaks. If you document poorly, risk increases. If you ignore inconsistencies, errors multiply.\n\nYou are part of a regulated chain of safety.` },
        { id:"l2", title:"Retail vs Inpatient – Same Foundation, Different Pace", content:`RETAIL ENVIRONMENT\nRetail is visible and fast. You will manage:\n• Intake questions\n• Insurance processing\n• Patient expectations\n• Phone calls\n• Inventory gaps\n• Controlled substance documentation\n\nRetail requires: Speed with composure.\n\n────────────────────\n\nINPATIENT ENVIRONMENT\nInpatient is quieter but more system-driven. You may manage:\n• Automated dispensing systems\n• Cart fills\n• Medication restocking\n• Delivery coordination\n• Controlled substance accountability\n\nInpatient requires: Precision with documentation awareness.` },
        { id:"l3", title:"The Technician Mindset", content:`Three pillars define strong technicians:\n1. Accuracy before speed\n2. Ask before assuming\n3. Document clearly\n\nYou are not expected to know everything on day one.\nYou are expected to:\n• Learn\n• Escalate appropriately\n• Protect workflow\n\nFIRST DAY CHECKLIST\n────────────────────\n☐ Learn physical layout\n☐ Identify workflow\n☐ Observe before rushing\n☐ Ask about escalation process\n☐ Write down common abbreviations` },
      ]},
      { id:"m2", title:"Workflow 101", lessons:[
        { id:"l4", title:"Retail Workflow Deep Dive", content:`Retail workflow is cyclical:\n1. Intake\n2. Data entry\n3. Insurance adjudication\n4. Filling\n5. Pharmacist verification\n6. Pickup\n\nBreakdowns often occur during:\n• Incorrect insurance entry\n• Missing prescriber details\n• Prior authorization delays\n\nNew tech mistake: Trying to fix everything alone.\nStrong tech move: Identify bottleneck → escalate appropriately.` },
        { id:"l5", title:"Inpatient Workflow Deep Dive", content:`Inpatient flow depends heavily on systems:\n1. Provider order entry\n2. Pharmacist verification\n3. Automated dispensing\n4. Restock / cart fill\n5. Documentation\n\nEven though automation is involved, accountability remains human.` },
        { id:"l6", title:"Error Prevention", content:`Errors most commonly occur due to:\n• Distraction\n• Similar drug names\n• Similar packaging\n• Multitasking\n• Fatigue\n\nBuild habits:\n☐ Pause before finalizing entry\n☐ Read labels fully\n☐ Confirm quantities\n☐ Clarify unclear handwriting or order detail` },
      ]},
      { id:"m3", title:"Safety & Law Basics", lessons:[
        { id:"l7", title:"Why Regulation Exists", content:`Medications can:\n• Harm\n• Interact\n• Be misused\n• Be diverted\n\nRegulation protects:\n• Patients\n• Staff\n• Institutions\n• Licenses\n\nDocumentation is protection.` },
        { id:"l8", title:"Controlled Substance Awareness", content:`Technician role includes:\n• Accurate documentation\n• Following storage protocols\n• Maintaining count awareness\n• Reporting discrepancies\n\nNot included:\n• Independent clinical judgment\n• Policy interpretation\n• Override authority\n\nIf something feels off — escalate.` },
        { id:"l9", title:"Escalation as a Strength", content:`Escalating does not mean incompetence.\n\nEscalate when:\n• Counts don't match\n• Documentation conflicts\n• Orders seem unclear\n• A patient provides conflicting information\n\nEscalation prevents problems.` },
      ]},
      { id:"m4", title:"Communication Under Pressure", lessons:[
        { id:"l10", title:"Retail Communication Framework", content:`Use this formula:\nAcknowledge → Clarify → Set expectation\n\nExample:\n"I understand this is frustrating. Let me check the claim and see what's causing the delay."\n\nAvoid:\n• Blame language\n• Defensive tone` },
        { id:"l11", title:"Inpatient Communication Framework", content:`Focus on:\n• Clear time expectations\n• Direct but respectful tone\n• Documentation-backed responses\n\nExample:\n"I see the order was verified at 10:12. It is scheduled for restock at 11:00. Let me confirm status."` },
      ]},
      { id:"m5", title:"First Week Survival Guide", lessons:[
        { id:"l12", title:"First Week Priorities & Common Mistakes", content:`PRIORITIES:\n☐ Learn layout\n☐ Observe workflow rhythm\n☐ Identify escalation path\n☐ Understand controlled substance handling (high-level)\n☐ Write down new terms\n\nCOMMON FIRST-WEEK MISTAKES:\n• Trying to impress with speed\n• Avoiding questions\n• Panicking when unsure\n\nStrong tech behavior:\nCalm. Curious. Observant.` },
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
  { id:"retail", title:"Retail Foundations", icon:"🏪", desc:"From competent to competitive in a retail pharmacy",
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
  { id:"inpatient", title:"Inpatient Foundations", icon:"🏥", desc:"Automation, accountability & hospital pharmacy culture",
    modules:[
      { id:"i1", title:"Understanding Distribution Systems", lessons:[{ id:"i1l1", title:"Centralized vs Decentralized Systems", content:`• Centralized vs decentralized pharmacy\n• Automated dispensing system logic\n• Restock patterns\n• Risk points at each stage\n\nEven highly automated environments require human accountability at every step.` }]},
      { id:"i2", title:"Automation Awareness", lessons:[{ id:"i2l1", title:"Why Counts & Documentation Matter", content:`• Why counts matter\n• Documentation chain\n• Common discrepancy causes\n• Pattern recognition mindset\n\nUnderstand why each step exists. That mindset separates average techs from strong ones.` }]},
      { id:"i3", title:"Cart Fill & Workflow Efficiency", lessons:[{ id:"i3l1", title:"Prioritization, Communication & Documentation", content:`• Prioritization logic\n• Error prevention habits\n• Shift-to-shift communication\n• Documentation hygiene\n\nEvery handoff is a risk point. Document clearly.` }]},
      { id:"i4", title:"Controlled Substance Accountability", lessons:[{ id:"i4l1", title:"Reconciliation, Escalation & Documentation", content:`If a count is off:\nDo not fix it quietly.\nReport and document immediately.\n\nThis protects you, your team, and your license.` }]},
      { id:"i5", title:"Sterile Compounding Awareness", lessons:[{ id:"i5l1", title:"Cleanroom Principles (High-Level)", content:`• Cleanroom principles\n• Why environment matters\n• Documentation significance\n\nAlways defer to your facility's SOPs and licensed pharmacist supervision.` }]},
    ]
  },
  { id:"advanced", title:"Advanced Growth", icon:"🚀", desc:"Leadership, career pathways & long-term positioning",
    modules:[
      { id:"a1", title:"Thinking Beyond Task Completion", lessons:[{ id:"a1l1", title:"Process Awareness & Being Proactive", content:`• Process awareness\n• Identifying inefficiencies\n• Documentation clarity\n• Being proactive\n\nYou notice things before they become problems.` }]},
      { id:"a2", title:"Quality & Compliance Basics", lessons:[{ id:"a2l1", title:"What Audits Look For", content:`• What audits look for\n• Why documentation matters\n• Risk mindset\n• Professional accountability` }]},
      { id:"a3", title:"Leadership Without Title", lessons:[{ id:"a3l1", title:"Influence, Mentoring & Professional Boundaries", content:`You don't need a title to:\n• Mentor new techs\n• Model professionalism\n• Encourage documentation accuracy\n• Protect workflow culture\n\nReputation compounds over time.` }]},
      { id:"a4", title:"Career Pathways & Long-Term Positioning", lessons:[{ id:"a4l1", title:"Your Career Map", content:`PATHWAYS:\n• Retail → Hospital\n• Hospital → Specialist\n• Certification stacking\n• Resume framing\n• Interview confidence\n\nCertification stacking accelerates your trajectory. Each credential opens a new tier.` }]},
    ]
  },
];

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
  {id:"conversions",title:"Conversion Reference",icon:"⚖️"},
  {id:"drugclasses",title:"Drug Class Quick Reference",icon:"💊"},
  {id:"schedules",title:"CS Schedules",icon:"🔒"},
  {id:"abbrev",title:"Rx Abbreviations",icon:"📋"},
  {id:"tracker",title:"4-Week Study Tracker",icon:"📅"},
  {id:"firstmonth",title:"First Month Planner",icon:"🗓️"},
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
  { id:"m_adv",    label:"Advanced Growth",    icon:"🚀", desc:"Leadership & career strategy (Pro)",    lessonIds:["a1l1","a2l1","a3l1","a4l1"], pro:true },
];

const ALL_LESSONS = [...FREE_SECTIONS,...PRO_SECTIONS].flatMap(s=>s.modules.flatMap(m=>m.lessons));
const LESSON_MAP = Object.fromEntries(ALL_LESSONS.map(l=>[l.id,l]));

const MERCH_URL = "https://pharmtechgraphics.printify.me/";

const bg="#0a1628", sf="rgba(255,255,255,0.04)", br="rgba(255,255,255,0.09)";
const ac="#00c9a7", bl="#0094ff", tx="#e8f0fe", mu="#8899bb";

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

// ── CHANGE 1: Floating Feedback Button ──────────────────────────────────────
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
        message: msg.trim(),
        type,
        rating,
        uid: user?.uid || "anonymous",
        email: user?.email || "anonymous",
        displayName: user?.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOpen(false);
        setMsg("");
        setRating(0);
        setType("general");
        pop("Thanks for your feedback! 🙏");
      }, 1800);
    } catch {
      pop("Something went wrong. Please try again.");
    }
    setSending(false);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Share feedback"
        style={{
          position:"fixed", bottom:24, right:24, zIndex:900,
          background:`linear-gradient(135deg,${ac},${bl})`,
          color:"#fff", border:"none", borderRadius:50,
          width:52, height:52, fontSize:22, cursor:"pointer",
          boxShadow:"0 4px 20px rgba(0,201,167,.4)",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"transform .2s",
        }}
        onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
      >
        💬
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          style={{position:"fixed",inset:0,background:"rgba(5,10,22,.85)",zIndex:950,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:"0 24px 90px"}}
          onClick={e=>{ if(e.target===e.currentTarget) setOpen(false); }}
        >
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
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>Share Feedback</div>
                    <div style={{fontSize:11,color:mu,marginTop:2}}>Help us improve PharmTech Path</div>
                  </div>
                  <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:mu,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
                </div>

                {/* Star rating */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:mu,marginBottom:6}}>How's your experience?</div>
                  <div style={{display:"flex",gap:6}}>
                    {[1,2,3,4,5].map(s=>(
                      <button key={s} onClick={()=>setRating(s)} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",opacity:s<=rating?1:0.3,transition:"opacity .15s"}}>⭐</button>
                    ))}
                  </div>
                </div>

                {/* Type selector */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:mu,marginBottom:6}}>Type</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[["general","💬 General"],["bug","🐛 Bug"],["idea","💡 Idea"],["content","📚 Content"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setType(v)} style={{background:type===v?"rgba(0,201,167,.15)":sf,color:type===v?ac:mu,border:type===v?`1px solid rgba(0,201,167,.4)`:`1px solid ${br}`,borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Message */}
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
// ────────────────────────────────────────────────────────────────────────────

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

// ── CHANGE 2: Nav updated — Merch Store added, opens in new tab ──────────────
function Nav({view,go,user,isPro,out}){
  const items=[["learn","Learn"],["resources","Resources"],["tools","Tools"],["career","My Career"]];
  return <div style={{background:"rgba(10,22,40,.97)",backdropFilter:"blur(14px)",borderBottom:`1px solid ${br}`,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",position:"sticky",top:0,zIndex:200}}>
    <div onClick={()=>go("home")} style={{fontWeight:800,fontSize:18,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
      <span style={{color:ac}}>⬡</span>PharmTech<span style={{color:ac}}>Path</span>
      {isPro&&<Tag label="Pro"/>}
    </div>
    <div style={{display:"flex",gap:2,alignItems:"center",flexWrap:"wrap"}}>
      {items.map(([id,lb])=><button key={id} onClick={()=>go(id)} style={{background:view===id?"rgba(0,201,167,.12)":"transparent",color:view===id?ac:mu,border:view===id?`1px solid rgba(0,201,167,.3)`:"1px solid transparent",borderRadius:7,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{lb}</button>)}
      {/* Merch Store link — opens Printify store in new tab */}
      <a
        href={MERCH_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          background:"linear-gradient(135deg,rgba(168,85,247,.2),rgba(236,72,153,.15))",
          color:"#c084fc",
          border:"1px solid rgba(168,85,247,.35)",
          borderRadius:7,padding:"5px 10px",fontSize:12,fontWeight:700,
          cursor:"pointer",textDecoration:"none",whiteSpace:"nowrap",
        }}
      >
        👕 Merch
      </a>
      {user
        ?<button onClick={out} style={{background:"transparent",color:"#ff6b6b",border:"none",borderRadius:7,padding:"5px 10px",fontSize:12,fontWeight:600,cursor:"pointer"}}>Sign Out</button>
        :<button onClick={()=>go("auth")} style={{background:`linear-gradient(135deg,${ac},${bl})`,color:"#fff",border:"none",borderRadius:7,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Sign In</button>
      }
    </div>
  </div>;
}
// ────────────────────────────────────────────────────────────────────────────

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
  const [em,setEm]=useState(""); const [pw,setPw]=useState(""); const [nm,setNm]=useState(""); const [er,setEr]=useState("");
  const [cf,setCf]=useState({name:"",email:"",subject:"question",message:""});
  const [sent,setSent]=useState(false);
  const [careerTab,setCareerTab]=useState("roadmap");

  const pop=useCallback(m=>{setToast(m);setTimeout(()=>setToast(null),2600);},[]);

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
          if(data.legalAccepted) setLegalAccepted(true);
        }
      } else {
        setUser(null);setIsPro(false);setDone({});setNotes({});
      }
      setAuthLoading(false);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(user?.uid) saveUserData(user.uid,{completed:done,notes,tracker,planner:planData,isPro,legalAccepted});
  },[done,notes,tracker,planData,isPro,legalAccepted]);

  const sections=user&&isPro?[...FREE_SECTIONS,...PRO_SECTIONS]:FREE_SECTIONS;
  const allL=sections.flatMap(s=>s.modules.flatMap(m=>m.lessons));
  const doneN=allL.filter(l=>done[l.id]).length;
  const pct=allL.length?Math.round((doneN/allL.length)*100):0;

  const go=v=>{setSec(null);setMod(null);setLesson(null);setView(v);};
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
        await saveUserData(cred.user.uid,{email:em,displayName:nm||em.split("@")[0],isPro:false,completed:{},notes:{},createdAt:Date.now()});
      } else {
        await signInWithEmailAndPassword(auth,em,pw);
      }
      setEr(""); go("home"); pop("Welcome to PharmTech Path!");
    } catch(e){
      const msg=e.code==="auth/user-not-found"?"No account found with that email.":e.code==="auth/wrong-password"?"Incorrect password.":e.code==="auth/email-already-in-use"?"An account already exists with this email.":"Something went wrong. Please try again.";
      setEr(msg);
    }
  };

  // ── CHANGE 3: Mobile sign-in persistence fix ─────────────────────────────
  const doGoogle=async()=>{
    try{
      await setPersistence(auth, browserLocalPersistence);
      const cred=await signInWithPopup(auth,googleProvider);
      const data=await loadUserData(cred.user.uid);
      if(!data) await saveUserData(cred.user.uid,{email:cred.user.email,displayName:cred.user.displayName,isPro:false,completed:{},notes:{},createdAt:Date.now()});
      go("home"); pop("Welcome to PharmTech Path!");
    } catch(e){ setEr("Google sign-in failed. Please try again."); }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const doOut=async()=>{
    await signOut(auth);
    setUser(null);setIsPro(false);setDone({});setNotes({});go("home");
  };

  if(authLoading) return(
    <div style={{minHeight:"100vh",background:bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:ac,fontSize:14,fontWeight:700}}>Loading PharmTech Path…</div>
    </div>
  );

  const wrap=ch=>(
    <div style={{minHeight:"100vh",background:bg,color:tx,fontFamily:"'Segoe UI',system-ui,sans-serif",overflowX:"hidden"}}>
      {!legalAccepted&&<LegalPopup onAccept={()=>setLegalAccepted(true)}/>}
      <Nav view={view} go={go} user={user} isPro={isPro} out={doOut}/>
      {toast&&<Toast msg={toast}/>}
      <div style={{maxWidth:920,margin:"0 auto",padding:"24px 16px 80px"}}>{ch}</div>
      {/* CHANGE 1: Feedback button rendered on every page */}
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
        <div style={{marginBottom:16}}><div style={{fontSize:11,color:mu,marginBottom:4}}>Password</div><Inp type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAuth()}/></div>
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
        <div style={{color:bl,fontWeight:700,marginBottom:4}}>Sign in to save notes & track progress</div>
        <div style={{color:mu,fontSize:12,marginBottom:11}}>Create a free account to keep your progress.</div>
        <Bp ch="Sign In / Sign Up Free" on={()=>go("auth")}/>
      </div>
    )}
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
        const sl=s.modules.flatMap(m=>m.lessons),sd=sl.filter(l=>done[l.id]).length;
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
        <div style={{fontSize:12,color:mu}}>Retail, Inpatient, Advanced Growth + Bonus Tools</div>
      </div>}
    </div>
  </>);

  if(view==="resources"){
    const cats=["All",...Array.from(new Set(RESOURCES.map(r=>r.cat)))];
    const fil=resCat==="All"?RESOURCES:RESOURCES.filter(r=>r.cat===resCat);
    return wrap(<>
      <H1 ch="Professional Resources" sub="Official certification bodies, associations, regulatory agencies & reference tools"/>
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
        {toolId==="conversions"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:8}}>{CONVERSIONS.map((c,i)=><div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:9,padding:"11px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontFamily:"monospace",color:ac,fontWeight:700,fontSize:12}}>{c.f}</span><span style={{color:mu}}>→</span><span style={{fontFamily:"monospace",color:tx,fontWeight:700,fontSize:12}}>{c.t}</span></div>)}</div>}
        {toolId==="drugclasses"&&<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:"2px solid rgba(0,201,167,.3)"}}>{["Suffix","Class","Use","Examples"].map(h=><th key={h} style={{padding:"8px 11px",textAlign:"left",color:ac,fontWeight:700,fontFamily:"monospace",fontSize:10,letterSpacing:1,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{DRUG_CLASSES.map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${br}`,background:i%2===0?"rgba(255,255,255,.02)":"transparent"}}><td style={{padding:"8px 11px",color:ac,fontFamily:"monospace",fontWeight:700}}>{r.s}</td><td style={{padding:"8px 11px",color:"#fff",fontWeight:600}}>{r.c}</td><td style={{padding:"8px 11px",color:mu}}>{r.u}</td><td style={{padding:"8px 11px",color:"#c8d8f0"}}>{r.e}</td></tr>)}</tbody></table></div>}
        {toolId==="schedules"&&<div style={{display:"flex",flexDirection:"column",gap:11}}>{CS_SCHEDULES.map((s,i)=><div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:18}}><div style={{fontSize:14,fontWeight:800,color:ac,marginBottom:6}}>{s.s}</div><div style={{fontSize:12,color:"#c8d8f0",marginBottom:4}}><strong style={{color:"#fff"}}>Examples:</strong> {s.e}</div><div style={{fontSize:12,color:mu}}>{s.r}</div></div>)}<div style={{background:"rgba(255,107,107,.06)",border:"1px solid rgba(255,107,107,.2)",borderRadius:9,padding:12,fontSize:11,color:mu}}>⚠️ Schedule I substances have no accepted medical use and are not dispensed in pharmacies.</div></div>}
        {toolId==="abbrev"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8}}>{ABBREVS.map((a,i)=><div key={i} style={{background:sf,border:`1px solid ${br}`,borderRadius:9,padding:"10px 13px"}}><div style={{fontFamily:"monospace",color:ac,fontWeight:700,fontSize:13,marginBottom:2}}>{a.a}</div><div style={{fontSize:12,color:"#c8d8f0"}}>{a.m}</div></div>)}</div>}
        {toolId==="tracker"&&<StudyTracker tracker={tracker} set={setTracker}/>}
        {toolId==="firstmonth"&&<MonthPlan plan={planData} set={setPlanData} pop={pop}/>}
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
            <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{user.displayName||"Pharmacy Tech"}</div>
            <div style={{fontSize:12,color:mu,marginTop:2}}>{user.email}</div>
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

      <div style={{display:"flex",gap:6,marginBottom:20,background:"rgba(255,255,255,.03)",borderRadius:12,padding:4,border:`1px solid ${br}`}}>
        {[["roadmap","🗺️ Career Roadmap"],["notes","📝 My Notes"],["settings","⚙️ Account"]].map(([id,lb])=>(
          <button key={id} onClick={()=>setCareerTab(id)} style={{flex:1,background:careerTab===id?`linear-gradient(135deg,${ac},${bl})`:"transparent",color:careerTab===id?"#fff":mu,border:"none",borderRadius:9,padding:"9px 8px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all .2s"}}>{lb}</button>
        ))}
      </div>

      {careerTab==="roadmap"&&<CareerRoadmap done={done} isPro={isPro}/>}

      {careerTab==="notes"&&(
        <div>
          {allNoted.length===0
            ?<div style={{textAlign:"center",padding:"32px 0",color:mu}}><div style={{fontSize:34,marginBottom:9}}>📝</div>No notes yet. Open any lesson and start taking notes.</div>
            :allNoted.map(([lid,ln])=>(
              <div key={lid} style={{marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:ac,marginBottom:6}}>{LESSON_MAP[lid]?.title||lid}</div>
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
          <Bs ch="Sign Out" on={doOut} sx={{marginTop:14,width:"100%",color:"#ff6b6b",borderColor:"rgba(255,107,107,.3)"}}/>
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
        {label:"Free",price:"$0",icon:"🆓",features:["Explore Pharmacy (5 modules)","Getting Certified roadmap","14 resource links & cert guide","Basic progress tracking","Career roadmap overview"],cta:user&&!isPro?"Current Plan":"Sign Up Free",act:()=>!user&&go("auth")},
        {label:"Pro",price:"$9.99/mo",icon:"⭐",hi:true,features:["Everything in Free","Retail Foundations","Inpatient Foundations","Advanced Growth & Leadership","Drug class & conversion tables","Controlled substance schedules","Rx abbreviation reference","4-Week Study Tracker","First Month at Work Planner","Notes on every lesson","Full career roadmap & milestones","Progress synced across devices"],cta:isPro?"✓ Active":"Activate Pro (Demo)",act:()=>{if(!isPro){setIsPro(true);go("career");pop("Pro unlocked! 🎉");}}},
      ].map(p=>(
        <div key={p.label} style={{background:p.hi?"rgba(0,201,167,.07)":sf,border:p.hi?"2px solid rgba(0,201,167,.4)":`1px solid ${br}`,borderRadius:16,padding:24}}>
          <div style={{fontSize:24,marginBottom:6}}>{p.icon}</div>
          <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>{p.label}</div>
          <div style={{fontSize:24,fontWeight:900,color:p.hi?ac:tx,margin:"6px 0 16px"}}>{p.price}</div>
          <div style={{marginBottom:20}}>{p.features.map((f,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:8}}><span style={{color:ac,flexShrink:0}}>✓</span><span style={{fontSize:12,color:"#c8d8f0"}}>{f}</span></div>)}</div>
          {p.hi?<Bp ch={p.cta} on={p.act} sx={{width:"100%",padding:"11px 0"}}/>:<Bs ch={p.cta} on={p.act} sx={{width:"100%",padding:"11px 0"}}/>}
        </div>
      ))}
    </div>
  </>);

  if(view==="contact") return wrap(<>
    <button onClick={()=>go("home")} style={{background:"transparent",color:mu,border:"none",fontSize:13,cursor:"pointer",padding:"0 0 16px",display:"flex",alignItems:"center",gap:5}}>← Back</button>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:24}}>
      <div>
        <div style={{fontSize:19,fontWeight:800,color:"#fff",marginBottom:6}}>Contact & About</div>
        <div style={{fontSize:13,color:mu,marginBottom:20,lineHeight:1.7}}>PharmTech Path was built for pharmacy technicians — current, aspiring, and experienced — who want more than exam prep. This is the mentorship system that reshapes how you think about your career.</div>
        <div style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:16,marginBottom:11}}>
          <div style={{fontSize:11,fontWeight:700,color:ac,marginBottom:4}}>📧 Email Us Directly</div>
          <a href="mailto:pharmtechgraphics@gmail.com" style={{color:tx,fontSize:13,textDecoration:"none"}}>pharmtechgraphics@gmail.com</a>
        </div>
        <div style={{background:sf,border:`1px solid ${br}`,borderRadius:11,padding:16}}>
          <div style={{fontSize:11,fontWeight:700,color:ac,marginBottom:8}}>We love hearing about:</div>
          {["Content you want added","Topics needing more depth","Tools or features you need","Bugs or technical issues","Pro subscription questions"].map((item,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontSize:12,color:"#c8d8f0"}}><span style={{color:ac}}>→</span>{item}</div>)}
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
      {title:"Privacy Policy",body:`Last updated: ${new Date().toLocaleDateString()}\n\n1. INFORMATION WE COLLECT\n• Account info: email, display name\n• Usage data: lesson progress, notes you create\n\n2. HOW WE USE YOUR INFORMATION\n• To sync your learning progress across devices\n• To manage your account and subscription\n• To respond to contact form submissions\n• We do NOT sell your personal data to third parties\n\n3. YOUR RIGHTS\nRequest deletion of your account and data at any time:\npharmtechgraphics@gmail.com\n\n4. CHILDREN'S PRIVACY\nPharmTech Path is not directed at children under 13.`},
      {title:"Educational Disclaimer",body:`IMPORTANT — PLEASE READ\n\nPharmTech Path is an educational platform supporting career development for pharmacy technicians.\n\n1. NOT MEDICAL OR LEGAL ADVICE\nAll content is for educational purposes only. It does not constitute medical advice, clinical guidance, legal advice, or official pharmacy policy.\n\n2. NOT A SUBSTITUTE FOR FORMAL TRAINING\nPharmTech Path is not a substitute for accredited training programs, employer training, state board requirements, or licensed pharmacist supervision. Always defer to your facility's SOPs and supervising pharmacist.\n\n3. ACCURACY OF INFORMATION\nPharmacy regulations and certification requirements may change. Always verify with official sources.\n\n4. CONTROLLED SUBSTANCES\nInformation about controlled substances is for high-level awareness only.\n\n5. CERTIFICATION OUTCOMES\nPharmTech Path does not guarantee exam passage or employment outcomes.\n\nQuestions: pharmtechgraphics@gmail.com`},
    ].map(s=>(
      <div key={s.title} style={{background:sf,border:`1px solid ${br}`,borderRadius:13,padding:22,marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:12}}>{s.title}</div>
        <pre style={{fontSize:12,color:"#c8d8f0",whiteSpace:"pre-wrap",lineHeight:1.8,margin:0,fontFamily:"inherit"}}>{s.body}</pre>
      </div>
    ))}
  </>);

  // ── CHANGE 4: Home page merch banner → live Printify link ────────────────
  return (
    <div style={{minHeight:"100vh",background:bg,color:tx,fontFamily:"'Segoe UI',system-ui,sans-serif",overflowX:"hidden"}}>
      {!legalAccepted&&<LegalPopup onAccept={()=>setLegalAccepted(true)}/>}
      <Nav view={view} go={go} user={user} isPro={isPro} out={doOut}/>
      {toast&&<Toast msg={toast}/>}
      <FeedbackButton user={user} pop={pop}/>

      <div style={{textAlign:"center",padding:"56px 16px 32px",background:"radial-gradient(ellipse at 50% 0%,rgba(0,201,167,.08) 0%,transparent 66%)"}}>
        <span style={{display:"inline-block",background:"rgba(0,201,167,.1)",color:ac,border:"1px solid rgba(0,201,167,.25)",borderRadius:20,padding:"3px 13px",fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",fontFamily:"monospace"}}>A Mentorship System</span>
        <h1 style={{fontSize:"clamp(28px,6vw,50px)",fontWeight:800,color:"#fff",lineHeight:1.1,margin:"12px 0 11px"}}><span style={{color:ac}}>PharmTech</span> Path</h1>
        <p style={{fontSize:14,color:mu,maxWidth:460,margin:"0 auto 26px",lineHeight:1.6}}>What no one explained to you about pharmacy — structured, strategic, and built for real career growth.</p>
        <div style={{display:"flex",gap:9,justifyContent:"center",flexWrap:"wrap"}}>
          <Bp ch="Start Learning →" on={()=>go("learn")}/>
          {!user&&<Bs ch="Sign In / Sign Up" on={()=>go("auth")}/>}
        </div>
      </div>

      <div style={{maxWidth:920,margin:"0 auto",padding:"0 16px 20px"}}>
        {user&&<div style={{background:"rgba(0,201,167,.08)",border:"1px solid rgba(0,201,167,.2)",borderRadius:12,padding:"13px 18px",marginBottom:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:9}}>
          <div><div style={{fontSize:13,fontWeight:700,color:ac}}>Welcome back{user.displayName?`, ${user.displayName.split(" ")[0]}`:""}! {isPro?"⭐ Pro":""}</div><div style={{fontSize:11,color:mu,marginTop:2}}>{doneN}/{allL.length} lessons complete — {pct}% through your path</div></div>
          <Ring p={pct} size={46} sw={3}/>
        </div>}

        <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:13}}>Where do you want to go?</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:11,marginBottom:28}}>
          {[
            {icon:"📚",title:"Learning Path",desc:"Modules from day one to advanced growth",action:()=>go("learn"),color:ac},
            {icon:"🔗",title:"Resources",desc:"14 official sites — PTCB, NHA, FDA & more",action:()=>go("resources"),color:bl},
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

        {/* CHANGE 4: Merch banner now links to live Printify store */}
        <a href={MERCH_URL} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none",display:"block",marginBottom:22}}>
          <div style={{background:"linear-gradient(135deg,rgba(168,85,247,.1),rgba(236,72,153,.08))",border:"1px solid rgba(168,85,247,.3)",borderRadius:16,padding:24,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16,cursor:"pointer",transition:"border-color .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(168,85,247,.6)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(168,85,247,.3)"}
          >
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:36}}>👕</div>
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

        {!user&&<div style={{background:`linear-gradient(135deg,rgba(0,201,167,.08),rgba(0,148,255,.08))`,border:"1px solid rgba(0,201,167,.2)",borderRadius:16,padding:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div><div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:4}}>Save your progress across devices</div><div style={{fontSize:12,color:mu,maxWidth:340}}>Create a free account to sync notes, track lessons, and unlock Pro when you're ready.</div></div>
          <Bp ch="Sign Up Free →" on={()=>go("auth")}/>
        </div>}
        {user&&!isPro&&<div style={{background:`linear-gradient(135deg,rgba(0,201,167,.08),rgba(0,148,255,.08))`,border:"1px solid rgba(0,201,167,.2)",borderRadius:16,padding:22,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
          <div><div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:4}}>Ready to go deeper?</div><div style={{fontSize:12,color:mu,maxWidth:340}}>Unlock Retail, Inpatient, Advanced Growth, Bonus Tools & full career roadmap.</div></div>
          <Bp ch="Upgrade to Pro →" on={()=>go("upgrade")}/>
        </div>}

        <Footer go={go}/>
      </div>
    </div>
  );
  // ─────────────────────────────────────────────────────────────────────────
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
