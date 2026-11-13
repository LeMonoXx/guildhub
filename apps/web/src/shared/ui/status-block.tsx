interface StatusBlockProps {
  readonly tone?: "neutral" | "error";
  readonly children: string;
}

export function StatusBlock({ tone = "neutral", children }: StatusBlockProps) {
  return (
    <p
      className={tone === "error" ? "status-block is-error" : "status-block"}
      role="status"
    >
      {children}
    </p>
  );
}
