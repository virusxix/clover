import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  dark?: boolean;
};

/** Reusable glassmorphism surface with grey drop shadow */
export function GlassCard({ children, className = "", dark = false }: Props) {
  return (
    <div className={`${dark ? "glass-dark" : "glass"} rounded-card-lg ${className}`}>
      {children}
    </div>
  );
}
