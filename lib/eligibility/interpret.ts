// Deterministic, English-only extraction of profile hints from free text. No network, no AI.
// Sensitive identifiers (Aadhaar-like digit runs, PAN-like codes) are stripped before matching
// and are never extracted.

import type { ProfileInput } from "./types";

export type ConfirmField = "age" | "state" | "educationLevel" | "annualIncome";

export const CONFIRMATION_FIELDS: ReadonlyArray<ConfirmField> = [
  "age",
  "state",
  "educationLevel",
  "annualIncome",
];

const QUESTIONS: Record<ConfirmField, string> = {
  age: "What is your age?",
  state: "Which state do you live in?",
  educationLevel: "What is your current education level?",
  annualIncome: "What is your family's approximate annual income in rupees?",
};

const RUPEE_PREFIX = "(?:\\b(?:rs\\.?|inr)|\u20B9)\\s*";

function sanitise(text: string): string {
  return text
    .replace(/\b\d{9,}\b/g, " ") // Aadhaar/bank-account-like digit runs
    .replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g, " "); // PAN-shaped codes
}

function extractAge(text: string): number | null {
  const patterns = [
    /\b(?:i\s*am|i'm|im|age[d]?)\s*:?\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:years?|yrs?)\s*old\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const age = Number(match[1]);
      if (age >= 1 && age <= 120) return age;
    }
  }
  return null;
}

const TELANGANA_HINTS = /telangana|hyderabad|secunderabad|warangal|karimnagar|nizamabad|khammam|nalgonda/;

function extractState(lower: string): string | null {
  if (TELANGANA_HINTS.test(lower)) return "Telangana";
  if (lower.includes("andhra")) return "Andhra Pradesh";
  return null;
}

function extractEducation(text: string): string | null {
  if (/\b(m\.?\s?tech|mba|m\.?\s?sc|postgraduate|post[- ]graduate|pg)\b/i.test(text)) return "PG";
  if (/\b(b\.?\s?tech|btech|engineering|degree|b\.?\s?sc|b\.?\s?com|ba|ug)\b/i.test(text)) return "UG";
  if (/\b(intermediate|inter|class\s*1[12])\b|\+2\b/i.test(text)) return "Class 11-12";
  return null;
}

function extractOccupation(text: string): string | null {
  return /\bstudents?\b/i.test(text) ? "Student" : null;
}

function extractIncome(text: string): number | null {
  const lakh = /(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/i.exec(text);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);

  const rupee = new RegExp(`${RUPEE_PREFIX}(\\d[\\d,]*)`, "i").exec(text);
  if (rupee) return Number(rupee[1].replace(/,/g, ""));

  const income = /income\D{0,40}?(\d[\d,]{3,})/i.exec(text);
  if (income) return Number(income[1].replace(/,/g, ""));

  return null;
}

/**
 * Extracts profile hints from a plain-English description and lists the
 * confirmation questions for anything still unknown.
 */
export function interpretDescription(text: string): {
  extracted: Partial<ProfileInput>;
  questions: string[];
} {
  const source = typeof text === "string" ? sanitise(text) : "";
  const extracted: Partial<ProfileInput> = {};

  const age = extractAge(source);
  if (age !== null) extracted.age = age;

  const state = extractState(source.toLowerCase());
  if (state !== null) extracted.state = state;

  const education = extractEducation(source);
  if (education !== null) extracted.educationLevel = education;

  const occupation = extractOccupation(source);
  if (occupation !== null) extracted.occupation = occupation;

  const income = extractIncome(source);
  if (income !== null) extracted.annualIncome = income;

  const questions = CONFIRMATION_FIELDS.filter((field) => extracted[field] == null).map(
    (field) => QUESTIONS[field],
  );

  return { extracted, questions };
}
