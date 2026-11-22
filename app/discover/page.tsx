import { Suspense } from "react";
import { connection } from "next/server";
import { DiscoverClient } from "../../components/discover/discover-client";

type DiscoverPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default function DiscoverPage({ searchParams }: DiscoverPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy">Discover schemes</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-navy/80">
        Describe your situation, confirm your details, and see which schemes you may be likely eligible for. Results
        show the rules we checked and what is still missing.
      </p>

      <Suspense fallback={<p className="mt-8 text-sm text-navy/70">Loading…</p>}>
        <DiscoverContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DiscoverContent({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await connection();
  const { q } = await searchParams;

  return <DiscoverClient initialText={q ?? ""} />;
}
