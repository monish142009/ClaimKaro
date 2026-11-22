import { Suspense } from "react";
import { connection } from "next/server";
import { TrackerClient } from "../../components/tracker/tracker-client";

export default function TrackerPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">Application tracker</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-navy/80">
        Statuses are entered by you. ClaimKaro does not check them against government systems.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-navy/70">Loading tracker…</p>}>
        <TrackerContent />
      </Suspense>
    </div>
  );
}

async function TrackerContent() {
  await connection();
  return <TrackerClient />;
}
