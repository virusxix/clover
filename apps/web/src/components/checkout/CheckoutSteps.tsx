import Link from "next/link";

/**
 * Checkout step indicator
 * -----------------------
 * One job: show Bag → Checkout → Confirmation progress.
 */

const STEPS = [
  { n: 1, label: "Bag", href: "/cart" as string | null },
  { n: 2, label: "Checkout", href: "/checkout" as string | null },
  { n: 3, label: "Confirmation", href: null },
];

export function CheckoutSteps({ current }: { current: 2 | 3 }) {
  return (
    <nav
      className="flex items-center gap-2 sm:gap-3 text-xs font-semibold tracking-wide mb-8"
      aria-label="Checkout progress"
    >
      {STEPS.map((step, index) => (
        <span key={step.n} className="flex items-center gap-2 sm:gap-3">
          {index > 0 && <span className="text-soul-muted/40">/</span>}
          {step.href && step.n < current ? (
            <Link href={step.href} className="text-soul-muted hover:text-black transition-colors">
              {step.label}
            </Link>
          ) : (
            <span className={step.n === current ? "text-black" : "text-soul-muted"}>
              {step.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
