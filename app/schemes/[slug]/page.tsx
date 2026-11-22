import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

type SchemePageProps = {
  params: Promise<{ slug: string }>;
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  UNVERIFIED: { label: "Verification pending", className: "bg-amber-100 text-amber-800" },
  VERIFIED: { label: "Verified", className: "bg-emerald-100 text-emerald-800" },
  OUTDATED: { label: "Outdated — re-check", className: "bg-orange-100 text-orange-800" },
  RETIRED: { label: "Retired", className: "bg-slate-200 text-slate-700" },
};

const LEVEL_LABELS: Record<string, string> = {
  CENTRAL: "Central",
  STATE: "State",
};

const sectionClass = "rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

function formatDate(value: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// The database call lives in its own function so notFound() is called outside any try/catch.
async function loadScheme(slug: string) {
  try {
    const scheme = await prisma.scheme.findUnique({
      where: { slug },
      include: { rules: true },
    });
    return { ok: true as const, scheme };
  } catch {
    return { ok: false as const, scheme: null };
  }
}

function ExternalLink({ href }: { href: string | null }) {
  if (!href) {
    return <span className="text-slate-500">Not available</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-emerald-700 underline hover:text-emerald-800"
    >
      {href}
    </a>
  );
}

export default function SchemePage({ params }: SchemePageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading scheme…</p>}>
      <SchemeContent params={params} />
    </Suspense>
  );
}

async function SchemeContent({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const result = await loadScheme(slug);

  if (!result.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-medium text-slate-800">
            Scheme details are not available right now. Run npm run db:seed.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const scheme = result.scheme;
  if (!scheme) {
    notFound();
  }

  const badge = STATUS_BADGES[scheme.verificationStatus] ?? {
    label: scheme.verificationStatus,
    className: "bg-slate-200 text-slate-700",
  };
  const levelLabel = LEVEL_LABELS[scheme.level] ?? scheme.level;
  const lastVerified = formatDate(scheme.lastVerifiedAt) ?? "Not yet verified";
  const deadline = formatDate(scheme.deadline) ?? "Not verified — check the official portal";
  const benefit = scheme.benefitSummary ?? "Benefit details not verified — check the official portal";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <header>
        <p className="text-sm text-slate-500">
          {levelLabel} scheme ·{" "}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>{badge.label}</span>
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{scheme.name}</h1>
        <p className="mt-1 text-slate-600">{scheme.department}</p>
      </header>

      <section className={sectionClass}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-slate-500">Level</dt>
            <dd className="mt-1 text-slate-800">{levelLabel}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Status</dt>
            <dd className="mt-1 text-slate-800">{badge.label}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Official source</dt>
            <dd className="mt-1">
              <ExternalLink href={scheme.officialSourceUrl} />
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Application URL</dt>
            <dd className="mt-1">
              <ExternalLink href={scheme.applicationUrl} />
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Date last verified</dt>
            <dd className="mt-1 text-slate-800">{lastVerified}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-slate-500">Deadline</dt>
            <dd className="mt-1 text-slate-800">{deadline}</dd>
          </div>
        </dl>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-slate-900">Benefits</h2>
        <p className="mt-2 text-slate-700">{benefit}</p>
      </section>

      <section className={sectionClass}>
        <h2 className="text-lg font-semibold text-slate-900">Eligibility rules</h2>
        <p className="mt-2 text-sm text-slate-500">
          These rules are drafts pending administrator verification and are not used for matching yet.
        </p>
        {scheme.rules.length === 0 ? (
          <p className="mt-4 text-slate-700">No rules recorded</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {scheme.rules.map((rule) => (
              <li key={rule.id} className="py-3">
                <p className="font-medium text-slate-800">{rule.label}</p>
                <p className="text-sm text-slate-500">
                  Type: {rule.ruleType} · Status: {rule.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
