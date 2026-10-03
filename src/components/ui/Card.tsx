import type { ReactNode } from "react";

type CardProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  media?: ReactNode;
  icon?: ReactNode;
};

export function Card({
  title,
  description,
  children,
  className = "",
  media,
  icon,
}: CardProps) {
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm ${className}`.trim()}
    >
      {media}
      <div className="flex flex-1 flex-col p-6">
        {icon ? <div className="mb-4 text-zayan-orange">{icon}</div> : null}
        <h3 className="text-lg font-semibold text-zayan-blue">{title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-muted">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </article>
  );
}
