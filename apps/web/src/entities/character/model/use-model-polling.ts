import { useRef } from "react";
import { modelsPollInterval, type PolledModel } from "./model-poll";

/** A `refetchInterval` that keeps asking while any model in the response still bakes. */
export function useModelPolling<T>(
  modelsOf: (data: T) => readonly PolledModel[],
): (query: {
  readonly state: { readonly data: T | undefined };
}) => number | false {
  const pendingSince = useRef<number | undefined>(undefined);
  return (query) => {
    const data = query.state.data;
    const models = data === undefined ? [] : modelsOf(data);
    if (!models.some((model) => model?.status === "pending")) {
      pendingSince.current = undefined;
      return false;
    }
    pendingSince.current ??= Date.now();
    return modelsPollInterval(models, Date.now() - pendingSince.current);
  };
}
