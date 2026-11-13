import { useEffect } from "react";

export function DocumentTitle({ value }: { readonly value: string }) {
  useEffect(() => {
    document.title = value;
  }, [value]);
  return null;
}
