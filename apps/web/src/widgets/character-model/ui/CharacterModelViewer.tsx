import { useEffect, useRef, useState } from "react";
import { LoadProgress } from "../../../shared/ui";
import { AssetStore } from "../lib/asset-store";
import { prepareFixedCharacter } from "../model/prepare-fixed-character";
import { createCharacterStage } from "./stage";

type Status = "loading" | "ready" | "error";

export function CharacterModelViewer() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Loading fixed look…");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    const stage = createCharacterStage(container);
    const assets = new AssetStore();
    const stopProgress = assets.onProgress(({ fraction }) => {
      setProgress((shown) => Math.max(shown, fraction));
    });
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

    void prepareFixedCharacter(assets)
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
      stopProgress();
      stage.dispose();
      assets.dispose();
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
        {status === "loading" && (
          <div className="status">
            <LoadProgress label={message} fraction={progress} />
          </div>
        )}
        {status === "error" && <div className="status">{message}</div>}
      </div>
      <p className={status === "error" ? "notice error" : "notice"}>
        {message}
      </p>
    </main>
  );
}
