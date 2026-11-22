"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";
import { useStoredProfileId } from "../tracker/use-stored-profile-id";

type ReminderRow = {
  id: string;
  title: string;
  remindAt: string;
  source: "CUSTOM" | "VERIFIED_DEADLINE";
  done: boolean;
  scheme: { slug: string; name: string; shortName: string | null } | null;
};

type SchemeOption = { slug: string; name: string };

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type NotificationState = NotificationPermission | "unsupported";

const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";
const JSON_HEADERS = { "Content-Type": "application/json" } as const;
const DUE_CHECK_MS = 30_000;

const cardClass = "rounded-2xl border border-navy/10 bg-white p-6 shadow-sm";
const inputClass =
  "mt-1 block w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-60";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:cursor-not-allowed disabled:opacity-60";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-md border border-navy/20 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-60";
const buttonDanger =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60";

const SOURCE_LABEL: Record<ReminderRow["source"], string> = {
  CUSTOM: "Your own date",
  VERIFIED_DEADLINE: "Verified scheme deadline",
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    // Body was not JSON; use the fallback.
  }
  return fallback;
}

async function fetchReminders(profileId: string): Promise<Result<ReminderRow[]>> {
  try {
    const params = new URLSearchParams({ profileId });
    const res = await fetch(`/api/reminders?${params.toString()}`);
    if (!res.ok) return { ok: false, error: await readError(res, "Could not load your reminders.") };
    const data = (await res.json()) as { reminders: ReminderRow[] };
    return { ok: true, value: data.reminders };
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

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN");
}

function subscribeToPermission(): () => void {
  return () => {};
}

function getPermissionSnapshot(): NotificationState {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function getServerPermissionSnapshot(): NotificationState {
  return "unsupported";
}

export function RemindersClient() {
  const profileId = useStoredProfileId();
  const [reminders, setReminders] = useState<ReminderRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [schemes, setSchemes] = useState<SchemeOption[]>([]);
  const [requestedPermission, setRequestedPermission] = useState<NotificationState | null>(null);
  const livePermission = useSyncExternalStore(
    subscribeToPermission,
    getPermissionSnapshot,
    getServerPermissionSnapshot,
  );
  const permission = requestedPermission ?? livePermission;
  const [now, setNow] = useState(() => Date.now());

  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [schemeSlug, setSchemeSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) return;
    let active = true;
    fetchReminders(profileId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setReminders(result.value);
        setLoadError(null);
      } else {
        setLoadError(result.error);
      }
    });
    return () => {
      active = false;
    };
  }, [profileId]);

  useEffect(() => {
    let active = true;
    fetch("/api/schemes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { schemes?: SchemeOption[] } | null) => {
        if (!active || !data || !Array.isArray(data.schemes)) return;
        setSchemes(data.schemes.map((s) => ({ slug: s.slug, name: s.name })));
      })
      .catch(() => {
        // The scheme list is optional; reminders can still be added without one.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), DUE_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  async function refresh(id: string) {
    const result = await fetchReminders(id);
    if (result.ok) {
      setReminders(result.value);
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

  function handleToggleDone(reminder: ReminderRow, done: boolean) {
    void mutate(reminder.id, `/api/reminders/${reminder.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ done }),
    });
  }

  function handleDelete(reminder: ReminderRow) {
    if (!window.confirm(`Delete the reminder "${reminder.title}"?`)) return;
    void mutate(reminder.id, `/api/reminders/${reminder.id}`, { method: "DELETE" });
  }

  // Browser permission is requested only from this click handler, never on page load.
  async function enableNotifications() {
    if (!("Notification" in window)) {
      setRequestedPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setRequestedPermission(result);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileId) return;
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      setFormError("Enter a title for the reminder.");
      return;
    }
    if (remindAt === "") {
      setFormError("Choose a date and time for the reminder.");
      return;
    }
    const when = new Date(remindAt);
    if (Number.isNaN(when.getTime())) {
      setFormError("Choose a valid date and time for the reminder.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const result = await sendRequest("/api/reminders", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        profileId,
        title: trimmedTitle,
        remindAt: when.toISOString(),
        schemeSlug: schemeSlug === "" ? null : schemeSlug,
        source: "CUSTOM",
      }),
    });
    if (result.ok) {
      setTitle("");
      setRemindAt("");
      setSchemeSlug("");
      await refresh(profileId);
    } else {
      setFormError(result.error);
    }
    setSubmitting(false);
  }

  if (profileId === undefined) {
    return <p className="mt-8 text-sm text-navy/70">Loading reminders…</p>;
  }

  if (profileId === null) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-6 text-center text-navy/80">
        <p>Save your profile on the Discover page first to add reminders.</p>
        <Link
          href="/discover"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90"
        >
          Go to Discover
        </Link>
      </div>
    );
  }

  const dueReminders =
    reminders?.filter((r) => !r.done && Date.parse(r.remindAt) <= now) ?? [];

  return (
    <div className="mt-8 space-y-8">
      <section className={cardClass} aria-labelledby="notify-heading">
        <h2 id="notify-heading" className="text-lg font-semibold text-navy">
          Browser notifications
        </h2>
        <p className="mt-2 text-sm text-navy/80">
          When notifications are allowed, due reminders appear as a banner on this page while it is open. This works
          without a service worker, and ClaimKaro does not send background or push notifications.
        </p>
        <div className="mt-4">
          {permission === "unsupported" && (
            <p className="text-sm text-navy/80">Browser notifications are not supported in this browser.</p>
          )}
          {permission === "default" && (
            <button type="button" onClick={enableNotifications} className={buttonSecondary}>
              Enable browser notifications
            </button>
          )}
          {permission === "denied" && (
            <p className="text-sm text-navy/80">
              Browser notifications are blocked. You can allow them in your browser&apos;s site settings.
            </p>
          )}
          {permission === "granted" && <p className="text-sm text-teal">Browser notifications are enabled.</p>}
        </div>
      </section>

      {permission === "granted" && dueReminders.length > 0 && (
        <section role="status" aria-labelledby="due-heading" className="rounded-2xl bg-saffron/20 p-5">
          <h2 id="due-heading" className="text-base font-semibold text-amber-900">
            Due now
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {dueReminders.map((r) => (
              <li key={r.id}>
                {r.title} ({formatDateTime(r.remindAt)})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={cardClass} aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-lg font-semibold text-navy">
          Add a reminder
        </h2>
        <form onSubmit={handleAdd} className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="reminder-title" className="block text-sm font-medium text-navy">
              Title
            </label>
            <input
              id="reminder-title"
              type="text"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="For example: Submit income certificate"
            />
          </div>
          <div>
            <label htmlFor="reminder-when" className="block text-sm font-medium text-navy">
              Remind me on
            </label>
            <input
              id="reminder-when"
              type="datetime-local"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="reminder-scheme" className="block text-sm font-medium text-navy">
              Scheme (optional)
            </label>
            <select
              id="reminder-scheme"
              value={schemeSlug}
              onChange={(e) => setSchemeSlug(e.target.value)}
              className={inputClass}
            >
              <option value="">No scheme</option>
              {schemes.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="block text-sm font-medium text-navy">Source</p>
            <p className="mt-2 text-sm text-navy/80">Your own date (CUSTOM)</p>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={submitting} className={buttonPrimary}>
              {submitting ? "Saving…" : "Add reminder"}
            </button>
          </div>
          {formError && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2">
              {formError}
            </p>
          )}
        </form>
        <p className="mt-4 text-xs text-navy/60">
          ClaimKaro does not invent deadlines. A reminder date is only the one you choose here.
        </p>
      </section>

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-lg font-semibold text-navy">
          Your reminders
        </h2>

        {actionError && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {actionError}
          </p>
        )}

        {reminders === null && loadError === null && (
          <p role="status" className="mt-3 text-sm text-navy/70">
            Loading reminders…
          </p>
        )}

        {loadError && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {loadError}
          </p>
        )}

        {reminders !== null && reminders.length === 0 && (
          <p className="mt-3 rounded-2xl border border-dashed border-teal/40 bg-teal/5 p-6 text-center text-navy/80">
            No reminders yet.
          </p>
        )}

        {reminders !== null && reminders.length > 0 && (
          <ul className="mt-4 space-y-3">
            {reminders.map((r) => {
              const isDue = !r.done && Date.parse(r.remindAt) <= now;
              const busy = busyId === r.id;
              return (
                <li key={r.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 p-4`}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={r.done}
                      disabled={busy}
                      onChange={(e) => handleToggleDone(r, e.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span>
                      <span className={`font-medium text-navy ${r.done ? "line-through opacity-60" : ""}`}>
                        {r.title}
                      </span>
                      {isDue && (
                        <span className="ml-2 rounded-full bg-saffron/40 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          Due
                        </span>
                      )}
                      {r.done && <span className="ml-2 text-xs text-navy/60">Done</span>}
                      <span className="block text-xs text-navy/70">
                        {formatDateTime(r.remindAt)} · {SOURCE_LABEL[r.source]}
                        {r.scheme ? ` · ${r.scheme.name}` : ""}
                      </span>
                    </span>
                  </label>
                  <button type="button" onClick={() => handleDelete(r)} disabled={busy} className={buttonDanger}>
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
