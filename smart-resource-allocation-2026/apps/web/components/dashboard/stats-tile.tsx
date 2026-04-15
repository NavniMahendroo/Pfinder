import { Card } from "@/components/ui/card";

type Props = {
  title: string;
  value: string;
  change: string;
};

export function StatsTile({ title, value, change }: Props) {
  return (
    <Card className="animate-float-up">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs font-medium text-emerald-600">{change}</p>
    </Card>
  );
}
