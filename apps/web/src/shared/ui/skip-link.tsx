interface SkipLinkProps {
  readonly href: string;
  readonly children: string;
}

export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a className="skip-link" href={href}>
      {children}
    </a>
  );
}
