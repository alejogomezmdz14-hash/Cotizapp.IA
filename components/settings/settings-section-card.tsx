import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsSectionCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  children?: React.ReactNode;
  className?: string;
};

export function SettingsSectionCard({
  title,
  description,
  icon: Icon,
  href,
  children,
  className,
}: SettingsSectionCardProps) {
  const content = (
    <>
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-token/80 bg-background text-accent-token">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {href ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ? <div className="mt-5 space-y-4 border-t border-token/70 pt-5">{children}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block rounded-[1.75rem] border border-token/80 bg-background/70 p-5 transition hover:border-[rgb(var(--accent-rgb)/0.28)] hover:bg-background/90",
          className,
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <section
      className={cn(
        "rounded-[1.75rem] border border-token/80 bg-background/70 p-5",
        className,
      )}
    >
      {content}
    </section>
  );
}
