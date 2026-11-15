import type { LucideIcon } from "lucide-react";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

interface PawcarePlaceholderPageProps {
  title: string;
  icon: LucideIcon;
}

export function PawcarePlaceholderPage({ title, icon: Icon }: PawcarePlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Pawcare" title={title} description={`${title} tools for the Pawcare team.`} />
      <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-strong"><Icon size={22} aria-hidden="true" /></span>
        <h2 className="mt-4 text-base font-semibold text-primary">{title} workspace</h2>
        <p className="mt-1 max-w-sm text-sm leading-6 text-secondary">This Pawcare section is ready for its upcoming workflow.</p>
      </Card>
    </div>
  );
}
