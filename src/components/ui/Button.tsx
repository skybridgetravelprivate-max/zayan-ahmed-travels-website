import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "inverse";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-zayan-orange text-white hover:bg-zayan-orange-dark focus-visible:outline-zayan-orange",
  secondary:
    "bg-zayan-blue text-white hover:bg-zayan-blue-dark focus-visible:outline-zayan-blue",
  outline:
    "border border-zayan-blue bg-white text-zayan-blue hover:bg-zayan-blue/5 focus-visible:outline-zayan-blue",
  inverse:
    "border border-white/70 bg-transparent text-white hover:bg-white/10 focus-visible:outline-white",
};

const baseClass =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  href?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  href,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = `${baseClass} ${variantClass[variant]} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
