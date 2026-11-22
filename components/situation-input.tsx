"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EXAMPLES = [
  "I'm 19, studying B.Tech in Hyderabad, family income about ₹1.5 lakh a year",
  "I'm a Class 12 student in Telangana, my family is from a Scheduled Caste",
  "I'm 27, working, and my annual income is ₹9 lakh",
];

export default function SituationInput() {
  const router = useRouter();
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string>("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Please describe your situation first.");
      return;
    }
    setError("");
    router.push("/discover?q=" + encodeURIComponent(trimmed));
  }

  function handleSpeak() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError(
        "Voice input is not supported in this browser. Please type your situation.",
      );
      return;
    }
    setError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.lang = "en-IN";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onerror = () => {
      setError(
        "Microphone permission was not granted or failed. You can type instead.",
      );
    };
    recognition.start();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm"
    >
      <label htmlFor="situation" className="font-medium text-navy">
        Describe your situation
      </label>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="rounded-full border border-teal/30 bg-teal/5 px-3 py-1 text-left text-xs font-medium text-teal hover:bg-teal/10"
          >
            {example}
          </button>
        ))}
      </div>
      <textarea
        id="situation"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. I'm 19, studying B.Tech in Hyderabad, family income about ₹1.5 lakh a year. What scholarships can I apply for?"
        className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-navy placeholder:text-navy/50 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal-light"
      />
      <p className="-mt-2 text-right text-xs text-navy/60">
        {text.length} characters
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="rounded-md bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal/90"
        >
          Find My Schemes
        </button>
        <button
          type="button"
          onClick={handleSpeak}
          className="rounded-md border border-navy/20 bg-white px-5 py-2.5 font-semibold text-navy hover:bg-navy/5"
        >
          Speak
        </button>
      </div>
    </form>
  );
}

