import Image from "next/image";
import Link from "next/link";

type Props = {
  href?: string;
  size?: "sm" | "nav" | "md" | "lg";
  showWordmark?: boolean;
  /** Override wordmark visibility, e.g. "" to always show */
  wordmarkClassName?: string;
  className?: string;
};

const sizes = {
  sm: { icon: 32, text: "text-lg" },
  nav: { icon: 44, text: "text-lg" },
  md: { icon: 40, text: "text-xl" },
  lg: { icon: 52, text: "text-2xl" },
};

/** Pass href="" to show logo without a link (use a nav Home link instead). */
export function BrandLogo({
  href = "/",
  size = "md",
  showWordmark = true,
  wordmarkClassName = "hidden sm:inline",
  className = "",
}: Props) {
  const s = sizes[size];

  const content = (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <span className="inline-flex shrink-0 items-center justify-center" style={{ width: s.icon, height: s.icon }}>
        <Image
          src="/assets/logo-icon.png"
          alt=""
          width={s.icon}
          height={s.icon}
          className="object-contain"
          style={{ background: "none" }}
          priority
          quality={90}
        />
      </span>
      {showWordmark && (
        <span className={`${s.text} font-black tracking-[0.12em] leading-none ${wordmarkClassName}`}>
          THE CLOVER
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
