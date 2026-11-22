// Idempotent seed for ClaimKaro (Phase 2).
// Runs under tsx, so it builds its own PrismaClient instead of importing lib/db.ts.
//
// HONESTY: every scheme is seeded as UNVERIFIED with DRAFT rules. Applications and
// deadlines are not confirmed. applicationUrl / officialSourceUrl are only the official
// domain roots. No benefit amounts or deadlines are invented.
//
// Re-running: scheme rows are upserted by slug; rules + evidence are deleted and
// recreated per scheme so nothing duplicates; sample profiles are upserted by displayName.
// Re-running overwrites scheme descriptive fields and draft rules, so do not run it
// after an admin has verified rules in the same database.

import { PrismaClient, SchemeLevel, RuleType, RuleStatus, VerificationStatus } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

function resolveSqlitePath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  return url.startsWith("file:") ? url.slice("file:".length) : url;
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: resolveSqlitePath() }),
});

const SEED_ACTOR = "seed";
const DRAFT_EVIDENCE_TITLE = "Official portal (root) — rule not yet verified";
const DRAFT_EVIDENCE_NOTES =
  "Draft from public background knowledge; NOT confirmed against the official source. Admin must verify before publishing.";
const DEADLINE_NOTE = "Not verified. Check the official portal.";

type RuleSeed = {
  key: string;
  label: string;
  ruleType: RuleType;
  valueJson: string;
  required?: boolean;
  sensitive?: boolean;
};

type SchemeSeed = {
  slug: string;
  name: string;
  shortName: string;
  department: string;
  level: SchemeLevel;
  applicationUrl: string;
  rules: RuleSeed[];
};

const EDUCATION_RULE_ALL: RuleSeed = {
  key: "education_level_in",
  label: "Current level of study",
  ruleType: RuleType.ONE_OF,
  valueJson: JSON.stringify(["Class 11-12", "UG", "PG"]),
};

const INCOME_INFO_RULE: RuleSeed = {
  key: "income_max_annual",
  label: "Income ceiling: check official guidelines",
  ruleType: RuleType.INFO_ONLY,
  valueJson: "null",
};

const CATEGORY_LABEL = "Category (optional — you may choose Prefer not to say)";

const SCHEMES: SchemeSeed[] = [
  {
    slug: "post-matric-sc",
    name: "Post Matric Scholarship for Scheduled Caste Students",
    shortName: "PMS-SC",
    department: "Ministry of Social Justice and Empowerment",
    level: SchemeLevel.CENTRAL,
    applicationUrl: "https://scholarships.gov.in",
    rules: [
      EDUCATION_RULE_ALL,
      { key: "category_in", label: CATEGORY_LABEL, ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["SC"]), sensitive: true, required: false },
      INCOME_INFO_RULE,
    ],
  },
  {
    slug: "post-matric-st",
    name: "Post Matric Scholarship for Scheduled Tribe Students",
    shortName: "PMS-ST",
    department: "Ministry of Tribal Affairs",
    level: SchemeLevel.CENTRAL,
    applicationUrl: "https://scholarships.gov.in",
    rules: [
      EDUCATION_RULE_ALL,
      { key: "category_in", label: CATEGORY_LABEL, ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["ST"]), sensitive: true, required: false },
      INCOME_INFO_RULE,
    ],
  },
  {
    slug: "post-matric-bc",
    name: "Post Matric Scholarship for Backward Class Students",
    shortName: "PMS-BC",
    department: "Telangana BC Welfare Department (also central scheme portal)",
    level: SchemeLevel.STATE,
    applicationUrl: "https://scholarships.gov.in",
    rules: [
      { key: "state_is", label: "State of residence", ruleType: RuleType.EQUALS, valueJson: JSON.stringify("Telangana") },
      EDUCATION_RULE_ALL,
      { key: "category_in", label: CATEGORY_LABEL, ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["BC"]), sensitive: true, required: false },
      INCOME_INFO_RULE,
    ],
  },
  {
    slug: "telangana-fee-reimbursement",
    name: "Telangana Fee Reimbursement / Scholarship via EPASS",
    shortName: "TS-EPASS",
    department: "Government of Telangana, Social Welfare / BC / Minority Welfare departments",
    level: SchemeLevel.STATE,
    applicationUrl: "https://epass.telangana.gov.in",
    rules: [
      { key: "state_is", label: "State of residence", ruleType: RuleType.EQUALS, valueJson: JSON.stringify("Telangana") },
      { key: "education_level_in", label: "Current level of study (verify which courses are covered)", ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["UG", "PG"]) },
      INCOME_INFO_RULE,
    ],
  },
  {
    slug: "pm-yasasvi",
    name: "PM YASASVI Scholarship for OBC, EBC and DNT Students",
    shortName: "PM YASASVI",
    department: "Ministry of Social Justice and Empowerment",
    level: SchemeLevel.CENTRAL,
    applicationUrl: "https://scholarships.gov.in",
    rules: [
      EDUCATION_RULE_ALL,
      { key: "category_in", label: CATEGORY_LABEL, ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["OBC", "EBC", "DNT"]), sensitive: true, required: false },
      INCOME_INFO_RULE,
    ],
  },
  {
    slug: "central-sector-scholarship",
    name: "Central Sector Scholarship for Higher Education",
    shortName: "CSS",
    department: "Department of Higher Education, Ministry of Education",
    level: SchemeLevel.CENTRAL,
    applicationUrl: "https://scholarships.gov.in",
    rules: [
      { key: "education_level_in", label: "Current level of study (verify eligible courses)", ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["UG", "PG"]) },
      INCOME_INFO_RULE,
    ],
  },
  {
    slug: "pm-vidyalaxmi",
    name: "PM Vidya Lakshmi Education Loan Portal",
    shortName: "PM-Vidyalaxmi",
    department: "Ministry of Education",
    level: SchemeLevel.CENTRAL,
    applicationUrl: "https://www.vidyalakshmi.co.in",
    rules: [
      { key: "education_level_in", label: "Current level of study (verify eligible courses)", ruleType: RuleType.ONE_OF, valueJson: JSON.stringify(["UG", "PG"]) },
      { key: "loan_eligibility", label: "Loan eligibility: check official guidelines", ruleType: RuleType.INFO_ONLY, valueJson: "null" },
    ],
  },
  {
    slug: "aarogyasri",
    name: "Aarogyasri Health Care Trust (Telangana)",
    shortName: "Aarogyasri",
    department: "Government of Telangana, Health Department",
    level: SchemeLevel.STATE,
    applicationUrl: "https://aarogyasri.telangana.gov.in",
    rules: [
      { key: "state_is", label: "State of residence", ruleType: RuleType.EQUALS, valueJson: JSON.stringify("Telangana") },
      INCOME_INFO_RULE,
    ],
  },
];

async function seedSchemes(): Promise<void> {
  for (const s of SCHEMES) {
    const sourceUrl = s.applicationUrl;

    const scheme = await prisma.scheme.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        shortName: s.shortName,
        department: s.department,
        level: s.level,
        applicationUrl: s.applicationUrl,
        officialSourceUrl: sourceUrl,
      },
      create: {
        slug: s.slug,
        name: s.name,
        shortName: s.shortName,
        department: s.department,
        level: s.level,
        state: "Telangana",
        beneficiaryGroup: "STUDENT",
        description: "Scheme details not yet verified. Check the official portal.",
        benefitSummary: null,
        applicationUrl: s.applicationUrl,
        officialSourceUrl: sourceUrl,
        verificationStatus: VerificationStatus.UNVERIFIED,
        lastVerifiedAt: null,
        deadline: null,
        deadlineNote: DEADLINE_NOTE,
        published: false,
      },
    });

    // Recreate rules and evidence on every run so nothing is duplicated.
    await prisma.schemeRule.deleteMany({ where: { schemeId: scheme.id } });
    await prisma.schemeEvidence.deleteMany({ where: { schemeId: scheme.id } });

    const evidence = await prisma.schemeEvidence.create({
      data: {
        schemeId: scheme.id,
        sourceUrl,
        sourceTitle: DRAFT_EVIDENCE_TITLE,
        quotedText: null,
        verifiedAt: null,
        verifiedBy: null,
        notes: DRAFT_EVIDENCE_NOTES,
      },
    });

    for (const r of s.rules) {
      await prisma.schemeRule.create({
        data: {
          schemeId: scheme.id,
          key: r.key,
          label: r.label,
          ruleType: r.ruleType,
          valueJson: r.valueJson,
          required: r.required ?? true,
          sensitive: r.sensitive ?? false,
          evidenceId: evidence.id,
          status: RuleStatus.DRAFT,
        },
      });
    }

    const hasSeedRecord = await prisma.verificationRecord.findFirst({
      where: { schemeId: scheme.id, actor: SEED_ACTOR },
    });
    if (!hasSeedRecord) {
      await prisma.verificationRecord.create({
        data: {
          schemeId: scheme.id,
          action: "CREATED",
          note: "Seeded as UNVERIFIED draft from public background knowledge.",
          actor: SEED_ACTOR,
        },
      });
    }

    console.log(`seeded scheme: ${s.slug} (${s.rules.length} draft rules)`);
  }
}

type SampleProfile = {
  displayName: string;
  age: number | null;
  state: string | null;
  district: string | null;
  educationLevel: string | null;
  occupation: string | null;
  annualIncome: number | null;
  incomeBand: string | null;
  language: string;
};

async function upsertProfile(data: SampleProfile): Promise<void> {
  // Sample profiles contain only the fields above. No Aadhaar, PAN, bank, phone, OTP or ID.
  const payload = { ...data, isGuest: true };
  const existing = await prisma.userProfile.findFirst({
    where: { displayName: data.displayName },
  });
  if (existing) {
    await prisma.userProfile.update({ where: { id: existing.id }, data: payload });
  } else {
    await prisma.userProfile.create({ data: payload });
  }
  console.log(`seeded profile: ${data.displayName}`);
}

async function seedSampleProfiles(): Promise<void> {
  // (1) Designed to be likely eligible: UG student, income well under 2.5 lakh, Telangana resident.
  await upsertProfile({
    displayName: "[SAMPLE] Likely-eligible B.Tech student",
    age: 19,
    state: "Telangana",
    district: "Hyderabad",
    educationLevel: "UG",
    occupation: "Student",
    annualIncome: 150000,
    incomeBand: "BELOW_2_5_LAKH",
    language: "en",
  });

  // (2) Designed to need clarification: age and income are unknown, so rules cannot be decided.
  await upsertProfile({
    displayName: "[SAMPLE] Needs clarification",
    age: null,
    state: "Telangana",
    district: null,
    educationLevel: "Class 11-12",
    occupation: "Student",
    annualIncome: null,
    incomeBand: null,
    language: "en",
  });

  // (3) Designed to fail a documented rule: income_max_annual.
  // CAUTION: the income rules in this seed are INFO_ONLY (no confirmed numeric ceiling),
  // so this profile's "failure" is ILLUSTRATIVE ONLY and does not reflect an official rule.
  // Once an admin confirms a numeric income_max_annual rule, this profile should fail it.
  await upsertProfile({
    displayName: "[SAMPLE] Fails a documented rule",
    age: 27,
    state: "Telangana",
    district: "Warangal",
    educationLevel: "UG",
    occupation: "Student",
    annualIncome: 900000,
    incomeBand: "ABOVE_8_LAKH",
    language: "en",
  });
}

async function main(): Promise<void> {
  await seedSchemes();
  await seedSampleProfiles();
  console.log("seed complete");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
