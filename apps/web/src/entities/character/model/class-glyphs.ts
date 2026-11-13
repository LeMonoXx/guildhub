export interface GlyphCircle {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

export interface Glyph {
  readonly paths: readonly string[];
  readonly circles?: readonly GlyphCircle[];
}

const fallback: Glyph = {
  paths: ["M12 3 20 8v8l-8 5-8-5V8Z"],
};

const glyphs: Record<string, Glyph> = {
  "1": {
    paths: [
      "M12 2.5 20 6v7.2c0 4.2-3.2 7.6-8 9.3-4.8-1.7-8-5.1-8-9.3V6Z",
      "M8.2 11.2 12 15.2l3.8-4",
    ],
  },
  "2": {
    paths: [
      "M11 3h2l.6 8.2 3.2 1.2v1.7H7.2v-1.7l3.2-1.2Z",
      "M7 15.4h10v1.6H7zM9.2 18.2h5.6v2.2H9.2z",
    ],
  },
  "3": {
    paths: ["M5 5.2 19.4 12 5 18.8V14l6.4-2L5 10Z", "M4.2 11.2h3.2v1.6H4.2z"],
  },
  "4": {
    paths: [
      "M6.2 4.5 11 12.8 8.6 19.5 5 18.2 7.8 12.4 4.6 6.2Z",
      "M17.8 4.5 13 12.8l2.4 6.7 3.6-1.3-2.8-5.8 3.2-6.2Z",
    ],
  },
  "5": {
    paths: ["M11.1 4h1.8v6.1H19v1.8h-6.1V18h-1.8v-6.1H5v-1.8h6.1Z"],
    circles: [{ cx: 12, cy: 12, r: 9 }],
  },
  "6": {
    paths: ["M12 3.2 20 12l-8 8.8L4 12Z", "M12 8.2 15.8 12 12 15.8 8.2 12Z"],
  },
  "7": {
    paths: [
      "M11.2 3.2h1.6v17.6h-1.6Z",
      "M7 7.2h10v1.7H7zM8.4 12.2h7.2v1.7H8.4z",
      "M12 3.2 16.8 7H7.2Z",
    ],
  },
  "8": {
    paths: [
      "M12 2.8 13.2 8l5.2.2L14 11.4 15.8 16 12 13.4 8.2 16 10 11.4 5.6 8.2 10.8 8Z",
    ],
  },
  "9": {
    paths: [
      "M12 4c4.2 0 7.2 2.6 7.2 6.2 0 4.4-4 6.2-7.2 10.2C8.8 16.4 4.8 14.6 4.8 10.2 4.8 6.6 7.8 4 12 4Zm0 3.2A3 3 0 1 0 12 13a3 3 0 0 0 0-5.8Z",
    ],
  },
  "10": {
    paths: [
      "M8.2 10.2c0-2 1.4-3.6 3.8-3.6s3.8 1.6 3.8 3.6v7.6H8.2Zm-2.6.8h2.2v7.2H5.6Zm10.6 0h2.2v7.2h-2.2Z",
    ],
  },
  "11": {
    paths: [
      "M12 4.2c2.4 3 6.8 4.4 6.8 8.6 0 3.4-2.8 6.4-6.8 6.4S5.2 16.2 5.2 12.8c0-4.2 4.4-5.6 6.8-8.6Z",
    ],
  },
  "12": {
    paths: [
      "M4.5 7.2 12 4.8l7.5 2.4-2.2 12.2L12 17.2 6.7 19.4Z",
      "M9.2 10.5h5.6v1.8H9.2z",
    ],
  },
  "13": {
    paths: [
      "M5 16.8c2.4-6.6 5.2-10.6 7-13.6 1.8 3 4.6 7 7 13.6-2.6-1.4-4.8-1.8-7-1.8s-4.4.4-7 1.8Z",
    ],
  },
};

export const classGlyph = (classId: string): Glyph =>
  glyphs[classId] ?? fallback;
