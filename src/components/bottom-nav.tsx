"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const ITEMS = [
  { href: "/", label: "Hoje", icon: "☀️", match: (p: string) => p === "/" },
  { href: "/mes", label: "Mês", icon: "📅", match: (p: string) => p.startsWith("/mes") },
  {
    href: "/lancamentos",
    label: "Lançamentos",
    icon: "🧾",
    match: (p: string) => p.startsWith("/lancamentos"),
  },
  {
    href: "/mais",
    label: "Mais",
    icon: "☰",
    match: (p: string) =>
      ["/mais", "/recorrentes", "/categorias", "/configuracoes"].some((x) => p.startsWith(x)),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cx(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px]",
                  active ? "font-semibold text-accent" : "text-muted",
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
