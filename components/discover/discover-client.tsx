"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { CONFIRMATION_FIELDS, interpretDescription } from "../../lib/eligibility/interpret";
import type { EligibilityResult, ProfileInput, RuleOutcome, Verdict } from "../../lib/eligibility/types";

type FieldKey = "age" | "state" | "educationLevel" | "occupation" | "annualIncome";

const FIELD_ORDER: FieldKey[] = ["age", "state", "educationLevel", "occupation", "annualIncome"];

const FIELD_LABELS: Record<FieldKey, string> = {
  age: "Age",
  state: "State of residence",
  educationLevel: "Education level",
  occupation: "Occupation",
  annualIncome: "Annual family income (rupees)",
};

const PROFILE_ID_KEY = "claimkaro-profile-id";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

const inputClass =
  "mt-1 block w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-md border border-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-60";
const cardClass = "rounded-2xl border border-navy/10 bg-white p-6 shadow-sm";

const VERDICT_BADGE: Record<Verdict, { label: string; className: string }> = {
  LIKELY_ELIGIBLE: { label: "Likely eligible", className: "bg-teal text-white" },
  POSSIBLY_ELIGIBLE: { label: "Possibly eligible", className: "border-2 border-navy bg-white text-navy" },
  MORE_INFO_NEEDED: { label: "More information needed", className: "bg-saffron/30 text-amber-900" },
  NOT_ELIGIBLE: { label: "Not eligible on recorded rules", className: "bg-slate-200 text-slate-700" },
};

const NEXT_STEP: Record<Verdict, string> = {
  MORE_INFO_NEEDED: "Answer the missing questions above and check again.",
  LIKELY_ELIGIBLE: "Prepare the documents in your checklist, then check the official portal before applying.",
  POSSIBLY_ELIGIBLE: "Some rules need checking on the official portal.",
  NOT_ELIGIBLE: "A documented rule was not met. You can still check the official portal for updates.",
};

const NOT_VERIFIED = "Not verified — check the official portal";
const NO_OFFICIAL_LINK = "Official link not recorded yet";

type ProfilePayload = {
  age: number | null;
  state: string | null;
  educationLevel: string | null;
  occupation: string | null;
  annualIncome: number | null;
};

type WholeParse = { ok: true; value: number | null } | { ok: false };

type ChecklistItem = {
  id: string;
  documentName: string;
  status: "PENDING" | "DONE";
};

type ChecklistState = {
  status: "loading" | "ready" | "error";
  items: ChecklistItem[];
  note: string | null;
  error: string | null;
};

function extractedText(extracted: Partial<ProfileInput>, field: FieldKey): string {
  const value = extracted[field];
  return value === undefined || value === null ? "" : String(value);
}

// Blank means skipped (null). Anything else must be a whole number in range.
function parseWhole(raw: string, min: number, max: number): WholeParse {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const n = Number(trimmed);
  if (n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}

function parseText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readStoredProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PROFILE_ID_KEY);
  } catch {
    return null;
  }
}

function storeProfileId(id: string): void {
  try {
    window.localStorage.setItem(PROFILE_ID_KEY, id);
  } catch {
    // Storage may be blocked; the profile is still saved on the server for this session.
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    // Body was not JSON; use the fallback.
  }
  return fallback;
}

async function fetchChecklist(
  profileId: string,
  schemeSlug: string,
): Promise<{ ok: true; items: ChecklistItem[]; note: string | null } | { ok: false; error: string }> {
  try {
    const params = new URLSearchParams({ profileId, schemeSlug });
    const res = await fetch(`/api/checklists?${params.toString()}`);
    if (!res.ok) return { ok: false, error: await readError(res, "Could not load the checklist.") };
    const data = (await res.json()) as { items: ChecklistItem[]; note: string | null };
    return { ok: true, items: data.items, note: data.note };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}

export function DiscoverClient({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  // Only fields the user has edited are stored; everything else follows the description.
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [results, setResults] = useState<EligibilityResult[] | null>(null);
  const [schemeNames, setSchemeNames] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(() => readStoredProfileId());
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const interpreted = useMemo(() => interpretDescription(text), [text]);
  const missingFields = CONFIRMATION_FIELDS.filter((f) => interpreted.extracted[f] == null) as FieldKey[];

  function questionFor(field: FieldKey): string | undefined {
    const index = missingFields.indexOf(field);
    return index >= 0 ? interpreted.questions[index] : undefined;
  }

  function getValue(field: FieldKey): string {
    return field in values ? (values[field] ?? "") : extractedText(interpreted.extracted, field);
  }

  function setValue(field: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    let active = true;
    fetch("/api/schemes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { schemes?: { slug: string; name: string }[] } | null) => {
        if (!active || !data || !Array.isArray(data.schemes)) return;
        const names: Record<string, string> = {};
        for (const scheme of data.schemes) names[scheme.slug] = scheme.name;
        setSchemeNames(names);
      })
      .catch(() => {
        // Names are optional; the slug is shown instead.
      });
    return () => {
      active = false;
    };
  }, []);

  // Builds the profile body. Returns a user-facing message when a value is malformed.
  function buildPayload(): { ok: true; payload: ProfilePayload } | { ok: false; message: string } {
    const age = parseWhole(getValue("age"), 5, 120);
    if (!age.ok) return { ok: false, message: "Age must be a whole number between 5 and 120." };
    const income = parseWhole(getValue("annualIncome"), 0, 100000000);
    if (!income.ok) {
      return { ok: false, message: "Annual income must be whole rupees, without commas or decimals." };
    }
    return {
      ok: true,
      payload: {
        age: age.value,
        state: parseText(getValue("state")),
        educationLevel: parseText(getValue("educationLevel")),
        occupation: parseText(getValue("occupation")),
        annualIncome: income.value,
      },
    };
  }

  async function handleCheck() {
    const built = buildPayload();
    if (!built.ok) {
      setError(built.message);
      return;
    }
    const p = built.payload;
    if (Object.values(p).every((v) => v === null)) {
      setError("Describe your situation or fill in at least one detail before checking.");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/eligibility", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ profile: p }),
      });
      if (!res.ok) {
        setResults(null);
        setError(await readError(res, "Could not check eligibility. Please try again."));
        return;
      }
      const data = (await res.json()) as { results: EligibilityResult[] };
      setResults(data.results);
    } catch {
      setResults(null);
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSaveProfile() {
    const built = buildPayload();
    if (!built.ok) {
      setSaveError(built.message);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveNote(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(built.payload),
      });
      if (!res.ok) {
        setSaveError(await readError(res, "Could not save the profile. Please try again."));
        return;
      }
      const data = (await res.json()) as { profile: { id: string } };
      storeProfileId(data.profile.id);
      setProfileId(data.profile.id);
      setSaveNote("Profile saved on this device. Document checklists are now available.");
    } catch {
      setSaveError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className={cardClass} aria-labelledby="describe-heading">
        <h2 id="describe-heading" className="text-lg font-semibold text-navy">
          Describe your situation
        </h2>
        <label htmlFor="situation-text" className="mt-3 block text-sm font-medium text-navy">
          Your description
        </label>
        <textarea
          id="situation-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className={inputClass}
          placeholder="For example: I am 22 years old, a student in Telangana, with family income of 2 lakh per year."
        />
        <p className="mt-2 text-xs text-navy/70">
          Do not include Aadhaar, PAN or bank numbers. Details are read from this text to pre-fill the fields below.
        </p>
      </section>

      <section className={cardClass} aria-labelledby="confirm-heading">
        <h2 id="confirm-heading" className="text-lg font-semibold text-navy">
          Confirm your details
        </h2>
        <p className="mt-1 text-sm text-navy/70">
          Correct anything that is wrong. Leave a field blank to skip it.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {FIELD_ORDER.map((field) => {
            const question = questionFor(field);
            const fromText = interpreted.extracted[field] != null && !(field in values);
            const id = `field-${field}`;
            const isNumeric = field === "age" || field === "annualIncome";
            return (
              <div key={field}>
                <label htmlFor={id} className="block text-sm font-medium text-navy">
                  {question ?? FIELD_LABELS[field]}
                </label>
                {question && (
                  <span className="block text-xs text-navy/60">Not found in your description.</span>
                )}
                {fromText && (
                  <span className="block text-xs text-teal">Filled from your description. Edit if wrong.</span>
                )}
                <input
                  id={id}
                  type={isNumeric ? "number" : "text"}
                  min={isNumeric ? 0 : undefined}
                  step={isNumeric ? 1 : undefined}
                  value={getValue(field)}
                  onChange={(e) => setValue(field, e.target.value)}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            aria-busy={checking}
            className={buttonPrimary}
          >
            {checking ? "Checking…" : "Check likely eligibility"}
          </button>
          <button type="button" onClick={handleSaveProfile} disabled={saving} className={buttonSecondary}>
            {saving ? "Saving…" : "Save my profile"}
          </button>
        </div>
        {saveError && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {saveError}
          </p>
        )}
        {saveNote && (
          <p role="status" className="mt-4 text-sm text-teal">
            {saveNote}
          </p>
        )}
        <p className="mt-4 text-xs text-navy/60">
          Your profile contains only the details above. ClaimKaro never asks for Aadhaar, PAN, bank or phone numbers.
        </p>
      </section>

      <section aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-lg font-semibold text-navy">
          Results
        </h2>
        {results === null && (
          <p className="mt-3 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-6 text-center text-navy/80">
            Confirm your details and check likely eligibility to see results.
          </p>
        )}
        {results !== null && results.length === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-6 text-center text-navy/80">
            No schemes are recorded in ClaimKaro yet. Check the official portals directly.
          </p>
        )}
        {results !== null && results.length > 0 && (
          <div className="mt-4 space-y-6">
            {results.map((result) => (
              <ResultCard
                key={result.schemeSlug}
                result={result}
                schemeName={schemeNames[result.schemeSlug] ?? result.schemeSlug}
                profileId={profileId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResultCard({
  result,
  schemeName,
  profileId,
}: {
  result: EligibilityResult;
  schemeName: string;
  profileId: string | null;
}) {
  const badge = VERDICT_BADGE[result.verdict];
  return (
    <article className={cardClass} aria-labelledby={`scheme-${result.schemeSlug}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`scheme-${result.schemeSlug}`} className="text-lg font-semibold text-navy">
            {schemeName}
          </h3>
          <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <SaveToTrackerButton schemeSlug={result.schemeSlug} />
      </div>

      <p className="mt-4 font-medium text-navy">{result.headline}</p>
      <p className="mt-2 text-sm text-navy/70">{result.disclaimer}</p>
      {result.unverifiedBasis && (
        <p className="mt-3 rounded-md bg-saffron/15 px-3 py-2 text-sm text-amber-900">
          Rules for this scheme are drafts pending administrator verification.
        </p>
      )}

      <RuleSection title="Rules that match your details" rules={result.matched} />
      <RuleSection title="Rules not met" rules={result.failed} />
      <RuleSection title="Missing information" rules={result.missing} />
      <RuleSection title="Information-only rules" rules={result.info} />

      <div className="mt-6 border-t border-navy/10 pt-4">
        <h4 className="text-sm font-semibold text-navy">Official links</h4>
        <p className="mt-1 text-sm text-navy/80">{NO_OFFICIAL_LINK}.</p>
        <p className="mt-1 text-xs text-navy/60">
          The eligibility check does not return official links yet, so none are shown here. Find the scheme on its official portal.
        </p>
      </div>

      <div className="mt-6 border-t border-navy/10 pt-4">
        <h4 className="text-sm font-semibold text-navy">Next steps</h4>
        <p className="mt-1 text-sm text-navy/80">{NEXT_STEP[result.verdict]}</p>
      </div>

      <div className="mt-6 border-t border-navy/10 pt-4">
        <h4 className="text-sm font-semibold text-navy">Document checklist</h4>
        {profileId ? (
          <ChecklistPanel
            key={`${profileId}:${result.schemeSlug}`}
            profileId={profileId}
            schemeSlug={result.schemeSlug}
          />
        ) : (
          <p className="mt-1 text-sm text-navy/70">
            Save your profile above to create a document checklist for this scheme.
          </p>
        )}
      </div>
    </article>
  );
}

function SaveToTrackerButton({ schemeSlug }: { schemeSlug: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function handleSave() {
    const id = readStoredProfileId();
    if (!id) {
      setMessage({ tone: "error", text: "Save your profile first." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ profileId: id, schemeSlug, status: "INTERESTED" }),
      });
      if (!res.ok) {
        setMessage({ tone: "error", text: await readError(res, "Could not save to your tracker. Please try again.") });
        return;
      }
      setMessage({ tone: "ok", text: "Saved to tracker" });
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={handleSave} disabled={saving} aria-busy={saving} className={buttonSecondary}>
        {saving ? "Saving…" : "Save to my tracker"}
      </button>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-xs ${message.tone === "error" ? "text-red-800" : "text-teal"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function RuleSection({ title, rules }: { title: string; rules: RuleOutcome[] }) {
  if (rules.length === 0) return null;
  return (
    <div className="mt-6 border-t border-navy/10 pt-4">
      <h4 className="text-sm font-semibold text-navy">{title}</h4>
      <ul className="mt-2 space-y-3">
        {rules.map((rule, index) => (
          <li key={`${rule.key}-${index}`} className="text-sm">
            <p className="font-medium text-navy">
              {rule.label}
              {rule.basis === "DRAFT" && <span className="ml-2 text-xs text-amber-800">(draft rule)</span>}
            </p>
            <p className="text-navy/80">{rule.detail}</p>
            <EvidenceLine rule={rule} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceLine({ rule }: { rule: RuleOutcome }): ReactNode {
  const evidence = rule.evidence;
  if (!evidence) return <p className="text-xs text-navy/60">{NOT_VERIFIED}</p>;
  return (
    <p className="text-xs text-navy/70">
      Source:{" "}
      {isHttpUrl(evidence.sourceUrl) ? (
        <a
          href={evidence.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-teal underline"
        >
          {evidence.sourceTitle}
        </a>
      ) : (
        <span>{evidence.sourceTitle}</span>
      )}
    </p>
  );
}

function ChecklistPanel({ profileId, schemeSlug }: { profileId: string; schemeSlug: string }) {
  const [state, setState] = useState<ChecklistState>({
    status: "loading",
    items: [],
    note: null,
    error: null,
  });
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchChecklist(profileId, schemeSlug).then((result) => {
      if (!active) return;
      if (result.ok) {
        setState({ status: "ready", items: result.items, note: result.note, error: null });
      } else {
        setState({ status: "error", items: [], note: null, error: result.error });
      }
    });
    return () => {
      active = false;
    };
  }, [profileId, schemeSlug]);

  async function reload() {
    const result = await fetchChecklist(profileId, schemeSlug);
    if (result.ok) {
      setState({ status: "ready", items: result.items, note: result.note, error: null });
    } else {
      setActionError(result.error);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const documentName = newName.trim();
    if (documentName === "") {
      setActionError("Type the name of the document first.");
      return;
    }
    setAdding(true);
    setActionError(null);
    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ profileId, schemeSlug, documentName }),
      });
      if (!res.ok) {
        setActionError(await readError(res, "Could not add the document."));
        return;
      }
      const data = (await res.json()) as { item: ChecklistItem };
      setState((prev) => ({
        ...prev,
        note: null,
        items: [...prev.items, data.item].sort((a, b) => a.documentName.localeCompare(b.documentName)),
      }));
      setNewName("");
    } catch {
      setActionError("Could not reach the server. Check your connection and try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(item: ChecklistItem) {
    const next = item.status === "DONE" ? "PENDING" : "DONE";
    setBusyId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/checklists/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setActionError(await readError(res, "Could not update the document."));
        return;
      }
      const data = (await res.json()) as { item: ChecklistItem };
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) => (i.id === item.id ? { ...i, status: data.item.status } : i)),
      }));
    } catch {
      setActionError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(item: ChecklistItem) {
    setBusyId(item.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/checklists/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok) {
        setActionError(await readError(res, "Could not remove the document."));
        return;
      }
      setState((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== item.id) }));
      // Reload so the route's note returns when the list is now empty.
      await reload();
    } catch {
      setActionError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (state.status === "loading") {
    return <p className="mt-1 text-sm text-navy/70">Loading checklist…</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
        {state.error}
      </p>
    );
  }

  return (
    <div className="mt-2">
      {state.items.length === 0 && state.note && (
        <p className="rounded-md bg-navy/5 px-3 py-2 text-sm text-navy/80">{state.note}</p>
      )}
      {state.items.length > 0 && (
        <ul className="space-y-2">
          {state.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2 text-navy">
                <input
                  type="checkbox"
                  checked={item.status === "DONE"}
                  disabled={busyId === item.id}
                  onChange={() => handleToggle(item)}
                  className="h-4 w-4 accent-teal"
                />
                <span className={item.status === "DONE" ? "line-through text-navy/60" : undefined}>
                  {item.documentName}
                </span>
              </label>
              <button
                type="button"
                onClick={() => handleDelete(item)}
                disabled={busyId === item.id}
                className={buttonSecondary}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`doc-${schemeSlug}`} className="block text-xs font-medium text-navy">
            Add a document you need
          </label>
          <input
            id={`doc-${schemeSlug}`}
            type="text"
            value={newName}
            maxLength={120}
            onChange={(e) => setNewName(e.target.value)}
            className={inputClass}
            placeholder="Type a document name from the official portal"
          />
        </div>
        <button type="submit" disabled={adding} className={buttonSecondary}>
          {adding ? "Adding…" : "Add document"}
        </button>
      </form>
      <p className="mt-2 text-xs text-navy/60">
        ClaimKaro does not provide a built-in document list. Add the documents you find on the official portal.
      </p>
      {actionError && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      )}
    </div>
  );
}
