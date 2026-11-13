import { useEffect, useRef, useState } from "react";
import { prepareFixedCharacter } from "./renderer/prepare";
import { createCharacterStage } from "./renderer/stage";

type Status = "loading" | "ready" | "error";

export function Viewer() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Loading fixed look…");

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    const stage = createCharacterStage(container);

    void prepareFixedCharacter()
      .then(({ character: prepared, manifest }) => {
        if (disposed) {
          prepared.dispose();
          return;
        }
        stage.show(prepared);
        setStatus("ready");
        setMessage(
          prepared.notices.length
            ? prepared.notices.join("; ")
            : `Fixed look for build ${manifest.build}`,
        );
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Load failed");
        }
      });

    return () => {
      disposed = true;
      stage.dispose();
    };
  }, []);

  return (
    <main>
      <header>
        <p className="eyebrow">GuildHub</p>
        <h1>Character</h1>
      </header>
      <div
        ref={host}
        className="viewer"
        role="img"
        aria-label="Dressed fixed-look character. Drag to rotate and scroll to zoom."
        data-state={status}
      >
        {status !== "ready" && <div className="status">{message}</div>}
      </div>
      <p className={status === "error" ? "notice error" : "notice"}>
        {message}
      </p>
    </main>
  );
}
