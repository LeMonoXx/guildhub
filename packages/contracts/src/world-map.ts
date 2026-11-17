import { z } from "zod";

/** The baker's world map output under `/assets/maps/v1/`. */
export const WORLD_MAP_ATLAS = "maps/v1/atlas.json";

const mapImageSchema = z.object({
  path: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** Fractions of the continent map, 0..1 from its top left. */
const mapRectSchema = z.object({
  left: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
});

export const worldMapZoneSchema = z.object({
  uiMapId: z.number().int().positive(),
  name: z.string(),
  areaIds: z.array(z.number().int().positive()),
  rect: mapRectSchema,
  image: mapImageSchema.nullable(),
});

export const worldMapContinentSchema = z.object({
  uiMapId: z.number().int().positive(),
  name: z.string(),
  image: mapImageSchema,
  zones: z.array(worldMapZoneSchema),
});

export const worldMapAtlasSchema = z.object({
  version: z.literal(1),
  build: z.string(),
  continents: z.array(worldMapContinentSchema),
});

export type WorldMapZone = z.infer<typeof worldMapZoneSchema>;
export type WorldMapContinent = z.infer<typeof worldMapContinentSchema>;
export type WorldMapAtlas = z.infer<typeof worldMapAtlasSchema>;
