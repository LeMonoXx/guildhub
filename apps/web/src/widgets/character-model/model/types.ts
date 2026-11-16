export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureLayer {
  textureType: number;
  layer: number;
  blendMode: number;
  section: Rect & { sectionType: number };
  fileDataId: number;
  itemId?: number;
  slot?: number;
}

export interface CharacterLook {
  build: string;
  race: number;
  sex: number;
  modelFileDataId: number;
  textures: { textureType: number; width: number; height: number }[];
  layers: TextureLayer[];
  sections: (Rect & { sectionType: number })[];
  sectionLayers: {
    sectionType: number;
    textureType: number;
    blendMode: number;
  }[];
  geosets: number[];
  options?: {
    flags?: number;
    geosets?: number[];
  }[];
}

export interface ItemEffect {
  attachmentId: number;
  modelFileDataId: number;
}

export interface ResolvedItem {
  itemId: number;
  name: string;
  inventoryType: number | null;
  equipSlot: number | null;
  geosetGroup: number[];
  helmHideGeosetGroups: number[];
  helmHides?: { group: number; keepWithOptionFlags: number }[];
  models: {
    slot: number;
    models: { fileDataId: number; position?: number }[];
    textures: { fileDataId: number }[];
  }[];
  bodyTextures: {
    section: number;
    textures: { fileDataId: number }[];
  }[];
  geosets?: { group: number; geoset: number }[];
  effects?: ItemEffect[];
  bodyReplaceableTextures?: Record<string, number>;
  attachments?: {
    slot: number;
    attachmentId: number;
    modelFileDataId: number;
    textureFileDataId: number | null;
  }[];
  sheatheType?: number | null;
  itemSubclass?: number | null;
  error?: string;
}

export interface ModelMeta {
  fileDataId: number;
  textures: {
    index: number;
    type: number;
    flags: number;
    fileDataId: number | null;
    textureCoordIndex?: number | null;
    textureWeightIndex?: number | null;
    textureTransformIndex?: number | null;
  }[];
  geosets: {
    submeshIndex: number;
    geosetId: number;
    textureUnits?: {
      blendMode?: number;
      materialFlags?: number;
      colorIndex?: number | null;
      textures: {
        textureIndex: number;
        type: number;
        fileDataId: number | null;
        textureCoordIndex?: number | null;
        textureWeightIndex?: number | null;
        textureTransformIndex?: number | null;
      }[];
    }[];
  }[];
  animations?: {
    name?: string;
    id?: number;
    variation?: number;
    globalSequence?: number;
    durationMs: number;
  }[];
  materialAnimations?: MaterialAnimation[];
  bones?: { node: string; flags: number }[];
  particles?: ParticleEmitterMeta[];
}

export type MaterialAnimationKind =
  | "color.rgb"
  | "color.alpha"
  | "transparency.alpha"
  | "textureTransform.translation"
  | "textureTransform.rotation"
  | "textureTransform.scaling";

export interface MaterialAnimation {
  kind: MaterialAnimationKind;
  targetIndex: number;
  sequenceId?: number | null;
  variation?: number | null;
  globalSequence?: number | null;
  durationMs: number;
  interpolation: "none" | "linear" | "bezier" | "hermite";
  keys: number[][];
}

export interface ParticleTrack {
  durationMs: number;
  interpolation: number;
  keys: number[][];
}

export interface ParticleCurve {
  times: number[];
  values: (number | number[])[];
}

export interface ParticleEmitterMeta {
  index: number;
  flags: number;
  bone: number;
  boneNode: string | null;
  offsetGltf: number[];
  textureIndex: number;
  textureFileDataId: number | null;
  blendMode: number;
  emitterType: number;
  rows: number;
  columns: number;
  tracks: Partial<
    Record<
      | "emissionSpeed"
      | "speedVariation"
      | "verticalRange"
      | "horizontalRange"
      | "gravity"
      | "lifespan"
      | "emissionRate"
      | "areaX"
      | "areaY"
      | "zSource",
      ParticleTrack
    >
  >;
  lifespanVariation: number;
  emissionRateVariation: number;
  color?: ParticleCurve | null;
  alpha?: ParticleCurve | null;
  scale?: ParticleCurve | null;
  scaleVariation: number[];
  headCell?: ParticleCurve | null;
  drag: number;
}

export interface FixedLookManifest {
  schemaVersion: number;
  build: string;
  outputVersion: number;
  look: CharacterLook;
  items: ResolvedItem[];
  body: { path: string; fileDataId: number };
  bodyMetadata: string;
  animations: { id: number; name: string; path: string }[];
}
