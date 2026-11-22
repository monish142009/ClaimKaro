"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStoredProfileId } from "./use-stored-profile-id";

type ApplicationStatus =
  | "INTERESTED"
  | "PREPARING_DOCUMENTS"
  | "READY_TO_APPLY"
  | "APPLIED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "INTERESTED", label: "Interested" },
  { value: "PREPARING_DOCUMENTS", label: "Preparing documents" },
  { value: "READY_TO_APPLY", label: "Ready to apply" },
  { value: "APPLIED", label: "Applied" },
  { value: "UNDER_REVIEW", label: "Under review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  INTERESTED: "Interested",
  PREPARING_DOCUMENTS: "Preparing documents",
  READY_TO_APPLY: "Ready to apply",
  APPLIED: "Applied",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

type TrackedApplication = {
  id: string;
  status: ApplicationStatus;
  followUpDate: string | null;
  notes: string | null;
  statusUpdatedAt: string;
  createdAt: string;
  scheme: {
    slug: string;
    name: string;
    shortName: string | null;
    department: string;
    applicationUrl: string | null;
    officialSourceUrl: string | null;
    deadline: string | null;
  };
  events: {
    id: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    createdAt: string;
  }[];
};

type PatchBody = {
  status?: ApplicationStatus;
  followUpDate?: string | null;
  notes?: string | null;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";
const JSON_HEADERS = { "Content-Type": "application/json" } as const;

const cardClass = "rounded-2xl border border-navy/10 bg-white p-6 shadow-sm";
const inputClass =
  "mt-1 block w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-md border border-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-60";
const buttonDanger =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    // Body was not JSON; use the fallback.
  }
  return fallback;
}

async function fetchApplications(profileId: string): Promise<Result<TrackedApplication[]>> {
  try {
    const params = new URLSearchParams({ profileId });
    const res = await fetch(`/api/tracker?${params.toString()}`);
    if (!res.ok) return { ok: false, error: await readError(res, "Could not load your applications.") };
    const data = (await res.json()) as { applications: TrackedApplication[] };
    return { ok: true, value: data.applications };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

async function sendRequest(url: string, init: RequestInit): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return { ok: false, error: await readError(res, "Something went wrong. Please try again.") };
    return { ok: true };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Local calendar date (yyyy-mm-dd) for a date input.
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateInputValue(value: string): string | null {
  if (value === "") return null;
  return new Date(`${value}T00:00:00`).toISOString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN");
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN");
}

export function TrackerClient() {
  const profileId = useStoredProfileId();
  const [apps, setApps] = useState<TrackedApplication[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    fetchApplications(profileId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setApps(result.value);
        setLoadError(null);
      } else {
        setLoadError(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, [profileId]);

  async function refresh(id: string) {
    const result = await fetchApplications(id);
    if (result.ok) {
      setApps(result.value);
      setLoadError(null);
    } else {
      setActionError(result.error);
    }
  }

  async function mutate(id: string, url: string, init: RequestInit) {
    if (!profileId) return;
    setBusyId(id);
    setActionError(null);
    const result = await sendRequest(url, init);
    if (result.ok) {
      await refresh(profileId);
    } else {
      setActionError(result.error);
    }
    setBusyId(null);
  }

  function handlePatch(id: string, body: PatchBody) {
    void mutate(id, `/api/tracker/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
  }

  function handleDelete(app: TrackedApplication) {
    if (!window.confirm(`Remove ${app.scheme.name} from your tracker? Its status history will be deleted too.`)) {
      return;
    }
    void mutate(app.id, `/api/tracker/${app.id}`, { method: "DELETE" });
  }

  if (profileId === undefined) {
    return <p className="mt-8 text-sm text-navy/70">Loading tracker…</p>;
  }

  if (profileId === null) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-6 text-center text-navy/80">
        <p>Save your profile on the Discover page first to track applications.</p>
        <Link
          href="/discover"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90"
        >
          Go to Discover
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <p className="rounded-md bg-saffron/15 px-3 py-2 text-sm text-amber-900">
        Government-side status is not verified automatically.
      </p>

      {actionError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {actionError}
        </p>
      )}

      {apps === null && loadError === null && (
        <p role="status" className="text-sm text-navy/70">
          Loading your applications…
        </p>
      )}

      {loadError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {loadError}
        </p>
      )}

      {apps !== null && apps.length === 0 && (
        <p className="rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-6 text-center text-navy/80">
          You are not tracking any schemes yet. Use &quot;Save to my tracker&quot; on the Discover page to add one.
        </p>
      )}

      {apps !== null && apps.length > 0 && (
        <ul className="space-y-6">
          {apps.map((app) => (
            <li key={app.id}>
              <ApplicationCard
                app={app}
                busy={busyId === app.id}
                onPatch={(body) => handlePatch(app.id, body)}
                onDelete={() => handleDelete(app)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  busy,
  onPatch,
  onDelete,
}: {
  app: TrackedApplication;
  busy: boolean;
  onPatch: (body: PatchBody) => void;
  onDelete: () => void;
}) {
  const [followUp, setFollowUp] = useState(() => toDateInputValue(app.followUpDate));
  const [notes, setNotes] = useState(() => app.notes ?? "");
  const scheme = app.scheme;
  const officialLink =
    scheme.applicationUrl !== null && isHttpUrl(scheme.applicationUrl) ? scheme.applicationUrl : null;
  const statusId = `status-${app.id}`;
  const followUpId = `followup-${app.id}`;
  const notesId = `notes-${app.id}`;

  return (
    <article className={cardClass} aria-labelledby={`app-${app.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`app-${app.id}`} className="text-lg font-semibold text-navy">
            <Link href={`/schemes/${scheme.slug}`} className="underline hover:text-teal">
              {scheme.name}
            </Link>
          </h2>
          <p className="mt-1 text-xs text-navy/70">{scheme.department}</p>
        </div>
        <button type="button" onClick={onDelete} disabled={busy} className={buttonDanger}>
          Remove from tracker
        </button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={statusId} className="block text-sm font-medium text-navy">
            Your status
          </label>
          <select
            id={statusId}
            value={app.status}
            disabled={busy}
            onChange={(e) => onPatch({ status: e.target.value as ApplicationStatus })}
            className={inputClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-navy/60">
            Last changed {formatDateTime(app.statusUpdatedAt)}. Entered by you, not verified.
          </p>
        </div>

        <div>
          <label htmlFor={followUpId} className="block text-sm font-medium text-navy">
            Follow-up date
          </label>
          <input
            id={followUpId}
            type="date"
            value={followUp}
            disabled={busy}
            onChange={(e) => {
              setFollowUp(e.target.value);
              onPatch({ followUpDate: fromDateInputValue(e.target.value) });
            }}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-navy/60">Clear the date to remove it.</p>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor={notesId} className="block text-sm font-medium text-navy">
          Notes (optional)
        </label>
        <textarea
          id={notesId}
          rows={3}
          maxLength={1000}
          value={notes}
          disabled={busy}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
        <div className="mt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch({ notes: notes.trim() === "" ? null : notes.trim() })}
            className={buttonSecondary}
          >
            Save notes
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-navy/10 pt-4 text-sm">
        <p>
          <span className="font-medium text-navy">Official application link: </span>
          {officialLink ? (
            <a
              href={officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal underline"
            >
              Open official application page
            </a>
          ) : (
            <span className="text-navy/70">Not recorded</span>
          )}
        </p>
        {scheme.deadline && (
          <p className="mt-1 text-navy/80">Recorded deadline: {formatDate(scheme.deadline)}</p>
        )}
      </div>

      <div className="mt-5 border-t border-navy/10 pt-4">
        <h3 className="text-sm font-semibold text-navy">Status history</h3>
        {app.events.length === 0 ? (
          <p className="mt-1 text-sm text-navy/70">No status changes recorded.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-sm text-navy/80">
            {app.events.map((event) => (
              <li key={event.id}>
                {event.fromStatus
                  ? `${STATUS_LABEL[event.fromStatus]} → ${STATUS_LABEL[event.toStatus]}`
                  : `Tracked as ${STATUS_LABEL[event.toStatus]}`}{" "}
                <span className="text-xs text-navy/60">({formatDateTime(event.createdAt)})</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}
