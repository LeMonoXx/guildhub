import { z } from "zod";

export const instanceConfigSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug"),
  name: z.string().min(1),
  region: z.enum(["eu", "us", "kr", "tw", "cn"]),
  guild: z.object({
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase guild slug"),
    /** Up to eight members who stand on the home stage before rank order fills it. */
    featured: z.array(z.string().trim().min(1).max(64)).max(8).default([]),
  }),
});

export type InstanceConfig = z.infer<typeof instanceConfigSchema>;
