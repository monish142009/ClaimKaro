import { Suspense } from "react";
import { connection } from "next/server";
import { RemindersClient } from "../../components/reminders/reminders-client";

export default function RemindersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">Reminders</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-navy/80">
        Add your own dates to remember. Reminders appear on this page while it is open. ClaimKaro does not send emails,
        SMS or background notifications.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-navy/70">Loading reminders…</p>}>
        <RemindersContent />
      </Suspense>
    </div>
  );
}

async function RemindersContent() {
  await connection();
  return <RemindersClient />;
}
