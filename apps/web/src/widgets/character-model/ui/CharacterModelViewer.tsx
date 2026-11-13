import { useEffect, useRef, useState } from "react";
import { prepareFixedCharacter } from "../model/prepare-fixed-character";
import { createCharacterStage } from "./stage";

type Status = "loading" | "ready" | "error";

export function CharacterModelViewer() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Loading fixed look…");

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    const stage = createCharacterStage(container);
    let previousTime: number | undefined;
    let frame = 0;
    const render = (time: number) => {
      const delta =
        previousTime === undefined
          ? 0
          : Math.min((time - previousTime) / 1000, 0.1);
      previousTime = time;
      stage.tick(delta);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    void prepareFixedCharacter()
      .then(({ character, manifest }) => {
        if (disposed) {
          character.dispose();
          return;
        }
        stage.show(character);
        setStatus("ready");
        setMessage(
          character.notices.length
            ? character.notices.join("; ")
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
      cancelAnimationFrame(frame);
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
