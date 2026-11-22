"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover Schemes" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/my-applications", label: "My Applications" },
  { href: "/login", label: "Login" },
];

export default function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={
        mobile
          ? "flex flex-col gap-3 text-sm font-medium"
          : "flex flex-row gap-6 text-sm font-medium"
      }
    >
      {links.map((link) => {
        const isActive =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || (pathname ?? "").startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "text-teal underline underline-offset-4"
                : "text-navy hover:text-teal"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
