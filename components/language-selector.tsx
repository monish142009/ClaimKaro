"use client";

import { useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "claimkaro-lang";
const LANGUAGES = ["en", "te", "hi"] as const;

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string {
  const saved = localStorage.getItem(STORAGE_KEY) ?? "en";
  return (LANGUAGES as readonly string[]).includes(saved) ? saved : "en";
}

function getServerSnapshot(): string {
  return "en";
}

export default function LanguageSelector() {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [status, setStatus] = useState<string>("");

  function handleChange(value: string) {
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    setStatus(
      "Saved. Full interface translation is not available yet — the site is shown in English.",
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label htmlFor="language" className="font-medium text-navy">
        Language
      </label>
      <select
        id="language"
        value={language}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full max-w-xs rounded-md border border-navy/20 bg-white px-3 py-2 text-navy focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal-light"
      >
        <option value="en">English</option>
        <option value="te">Telugu</option>
        <option value="hi">Hindi</option>
      </select>
      {status && (
        <p role="status" className="text-navy/70">
          {status}
        </p>
      )}
    </div>
  );
}
