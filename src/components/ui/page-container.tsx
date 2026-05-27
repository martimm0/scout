import type { HTMLAttributes } from "react";

export function PageContainer({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={["page-container", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
