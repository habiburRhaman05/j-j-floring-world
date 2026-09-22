import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  message?: string;
  className?: string;
}

export function EmptyState({ title, message, className }: EmptyStateProps) {
  return (
    <div className={cn("empty", className)}>
      <div className="empty-mark">{title}</div>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
