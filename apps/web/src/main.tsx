import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CharacterCinematic } from "./widgets/character-cinematic";
import { CharacterModelViewer } from "./widgets/character-model";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

const search = new URLSearchParams(location.search);
const showViewerFallback = search.has("viewer");
const requestedFrame = Number(search.get("frame"));
const previewTimeMs =
  search.has("frame") && Number.isFinite(requestedFrame)
    ? Math.max(0, requestedFrame)
    : undefined;

createRoot(root).render(
  <StrictMode>
    {showViewerFallback ? (
      <CharacterModelViewer />
    ) : (
      <CharacterCinematic
        scene="/cinematics/rogue-proof.scene.json"
        manifest="/assets/looks/fixed/look.json"
        assetBase="/assets/"
        posterTimeMs={4300}
        previewTimeMs={previewTimeMs}
        ariaLabel="Bloodfang rogue emerging from darkness in a silent smoke-bomb cinematic"
      />
    )}
  </StrictMode>,
);
