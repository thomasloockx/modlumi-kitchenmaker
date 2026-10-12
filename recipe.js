// SPDX-License-Identifier: GPL-3.0-or-later
//
// The cabinet and worktop recipes of KitchenMaker, after IngeTrazo KitchenMaker V.2 for SketchUp.
// This module doesn't touch the model: it turns parameters into boxes, validates them and lists
// parts, so the model code, the placement preview and the reports all share one recipe.
//
// Lengths are in meters and angles in radians, like the rest of the Modlumi API. Cabinet
// coordinates: x along the width from the left side, y from the front toward the wall, z up from
// the floor. Stored values, such as families and finishes, stay in English; only what the user
// reads is translated.

import { t } from "./i18n.js";

/**
 * @typedef {"Base" | "Wall" | "Tall" | "High" | "Base corner" | "Wall corner" | "Filler"} Family
 * @typedef {"Single door" | "Double doors" | "Drawers" | "Drawer + doors" | "Open shelves" | "Glass doors"
 *   | "Appliance niche" | "Blind left" | "Blind right"} Style
 * @typedef {{
 *   version: 1, name: string, family: Family, style: Style,
 *   width: number, depth: number, height: number, thickness: number, gap: number, plinth: number,
 *   shelves: number, drawers: number, hinge: "Left" | "Right", opening: number, handles: boolean,
 *   finish: string, worktop: boolean, topFinish: string, topThickness: number, overhang: number,
 *   backsplash: number, price: number, currency: string,
 * }} Cabinet
 * @typedef {keyof Cabinet | "cutouts" | "length"} Field
 * @typedef {"body" | "drawerBox" | "front" | "glass" | "top" | "plinth" | "metal"} Role
 * @typedef {{ name: string, role: Role, at: [number, number, number], size: [number, number, number] }} Part
 * @typedef {{ name: string, kind: "door" | "drawer", pivot: number, right: boolean, parts: Part[] }} Front
 *   A door turns about the vertical line at x = pivot on the front plane; a drawer slides out.
 * @typedef {"sink" | "hob"} CutoutKind
 * @typedef {{ kind: CutoutKind, x: number, y: number, width: number, depth: number }} Cutout
 *   x from the worktop's left end and y from its front edge, overhang included.
 * @typedef {{
 *   version: 1, length: number, depth: number, overhang: number, thickness: number, backsplash: number,
 *   backThickness: number, topFinish: string, cutouts: Cutout[],
 * }} Worktop
 *   Origin: the row's front left corner without the overhang, at the underside of the worktop.
 * @typedef {"carcass" | "drawer_box" | "front" | "glass" | "top" | "plinth" | "hardware" | "cutout"} CutKind
 * @typedef {{
 *   designation: string, kind: CutKind, finish: string | null, size: [number, number, number],
 *   quantity: number, sources: string[], cabinets: number[], worktops: number[],
 * }} CutRow
 *   cabinets and worktops index the lists the cut list was made from.
 */

/** A recipe KitchenMaker can't build, with a message for the user and the field to fix. */
export class KitchenError extends Error {
  /** @param {string} message @param {Field | null} [field] */
  constructor(message, field = null) {
    super(message);
    this.name = "KitchenError";
    /** The parameter the message is about, to show it under that field; null for none. */
    this.field = field;
  }
}

/** Formats a length for messages; the plugin passes the model's own formatting. */
let formatLength = (/** @type {number} */ meters) => `${Math.round(meters * 1000)} mm`;

/** @param {(meters: number) => string} format */
export function setLengthFormat(format) {
  formatLength = format;
}

/** Millimeters to meters, to keep the recipe's workshop sizes readable. @param {number} value */
const mm = (value) => value / 1000;
/** @param {number} v @param {number} lo @param {number} hi */
const between = (v, lo, hi) => Number.isFinite(v) && v >= lo - 1e-9 && v <= hi + 1e-9;
/** "lo to hi" in the model's units. @param {number} lo @param {number} hi */
const range = (lo, hi) => t("{lo} to {hi}", { lo: formatLength(lo), hi: formatLength(hi) });
/**
 * Throws unless lo <= v <= hi.
 * @param {number} v @param {number} lo @param {number} hi @param {string} what @param {Field} field
 */
const need = (v, lo, hi, what, field) => {
  if (!between(v, lo, hi)) throw new KitchenError(t("{what}: {range}.", { what, range: range(lo, hi) }), field);
};
const kMaxOpening = (110 * Math.PI) / 180;
/** The cutouts' clearance from the worktop's edges and from each other. */
export const kCutoutClearance = mm(30);
/** Most cutouts one worktop takes. */
export const kMaxCutouts = 6;

/** @type {readonly Family[]} */
export const FAMILIES = ["Base", "Wall", "Tall", "High", "Base corner", "Wall corner", "Filler"];
/** @type {readonly Style[]} */
export const STYLES = ["Single door", "Double doors", "Drawers", "Drawer + doors", "Open shelves", "Glass doors",
  "Appliance niche", "Blind left", "Blind right"];
/** Front finishes and their colors. */
export const FINISHES = /** @type {const} */ ({
  "Warm white": { r: 0.91, g: 0.90, b: 0.86 }, "Graphite": { r: 0.20, g: 0.24, b: 0.28 },
  "Sand": { r: 0.70, g: 0.61, b: 0.47 }, "Sage": { r: 0.42, g: 0.53, b: 0.43 },
  "Ocean blue": { r: 0.17, g: 0.36, b: 0.52 }, "Walnut tone": { r: 0.42, g: 0.27, b: 0.16 },
});
/** Worktop finishes and their colors. */
export const TOPS = /** @type {const} */ ({
  "Light stone": { r: 0.77, g: 0.79, b: 0.78 }, "Dark stone": { r: 0.19, g: 0.20, b: 0.22 },
  "Timber tone": { r: 0.64, g: 0.45, b: 0.26 },
});
/** Colors of the parts that don't take a finish. */
export const ROLE_COLORS = /** @type {const} */ ({
  body: { r: 0.82, g: 0.81, b: 0.76 }, drawerBox: { r: 0.82, g: 0.81, b: 0.76 },
  plinth: { r: 0.23, g: 0.24, b: 0.25 }, metal: { r: 0.36, g: 0.40, b: 0.44 },
  glass: { r: 0.35, g: 0.68, b: 0.80, a: 0.35 },
});
/** Default sizes of the sink and hob cutouts. */
export const CUTOUT_SIZES = /** @type {const} */ ({ sink: [mm(780), mm(480)], hob: [mm(560), mm(490)] });
/** Cut list kinds, in the order the list shows them. */
export const CUT_ORDER = /** @type {readonly CutKind[]} */ (
  ["carcass", "drawer_box", "front", "glass", "top", "plinth", "hardware", "cutout"]);

/** @param {Family} family */
export const isWall = (family) => family === "Wall" || family === "Wall corner";
/** @param {Family} family */
export const isCorner = (family) => family === "Base corner" || family === "Wall corner";
/** Whether a cabinet of that style has one door, whose hinge side the user picks. @param {Style} style */
export const isHinged = (style) => style === "Single door" || style === "Appliance niche";

// ------------------------------------------------------------------------------------ presets

/** @returns {Cabinet} */
export function defaultCabinet() {
  return {
    version: 1, name: t("Base cabinet"), family: "Base", style: "Double doors",
    width: mm(600), depth: mm(600), height: mm(900), thickness: mm(18), gap: mm(2), plinth: mm(100),
    shelves: 1, drawers: 3, hinge: "Left", opening: 0, handles: true, finish: "Warm white",
    worktop: true, topFinish: "Light stone", topThickness: mm(30), overhang: mm(20), backsplash: 0,
    price: 0, currency: "USD",
  };
}

/** The styles the library offers for a family. @param {Family} family @returns {readonly Style[]} */
export function stylesOf(family) {
  if (isCorner(family)) return ["Blind left", "Blind right"];
  if (family === "Filler") return ["Single door"];
  if (family === "Base") return STYLES.slice(0, 7);
  if (family === "Wall") return STYLES.slice(0, 6);
  return ["Double doors", "Open shelves", "Appliance niche"];
}

/** The widths the library offers for a family. @param {Family} family */
export function widthsOf(family) {
  if (isCorner(family)) return [mm(900), mm(1200)];
  if (family === "Filler") return [mm(50), mm(100)];
  return [mm(600), mm(900)];
}

/**
 * A library cabinet: the family's usual sizes with a front style and width.
 * @param {Family} family @param {Style} style @param {number} width @param {string} name
 * @returns {Cabinet}
 */
export function preset(family, style, width, name) {
  const cabinet = { ...defaultCabinet(), family, style, width, name };
  if (isWall(family)) {
    Object.assign(cabinet, { depth: mm(350), height: mm(720), plinth: 0, worktop: false, shelves: 2 });
  } else if (family === "Tall" || family === "High") {
    Object.assign(cabinet, { height: family === "Tall" ? mm(2100) : mm(2400), worktop: false, shelves: 4 });
  } else if (family === "Filler") {
    Object.assign(cabinet, { shelves: 0, worktop: false });
  }
  return cabinet;
}

// ----------------------------------------------------------------------------------- validate

/** Returns why KitchenMaker can't build the cabinet, or null. @param {Cabinet} c @returns {KitchenError | null} */
export function check(c) {
  try {
    getParts(c);
    return null;
  } catch (error) {
    if (error instanceof KitchenError) return error;
    throw error;
  }
}

/** Throws KitchenError for a cabinet KitchenMaker can't build. @param {Cabinet} c */
function validate(c) {
  if (!FAMILIES.includes(c.family)) throw new KitchenError(t("Choose a supported cabinet family."), "family");
  if (!STYLES.includes(c.style)) throw new KitchenError(t("Choose a supported front style."), "style");
  if (!(c.finish in FINISHES)) throw new KitchenError(t("Unknown finish."), "finish");
  if (!(c.topFinish in TOPS)) throw new KitchenError(t("Unknown finish."), "topFinish");
  if (c.name.trim() === "" || c.name.length > 120) {
    throw new KitchenError(t("Enter a cabinet name (up to 120 characters)."), "name");
  }
  const { width: w, depth: d, height: h, thickness: t0, plinth: b } = c;
  need(w, mm(30), 3, t("Width"), "width");
  need(d, mm(100), 1.5, t("Depth"), "depth");
  need(h, mm(100), 3, t("Height"), "height");
  need(t0, mm(8), mm(40), t("Panel thickness"), "thickness");
  need(c.gap, mm(1), mm(6), t("Front gap"), "gap");
  need(b, 0, mm(300), t("Plinth"), "plinth");
  if (isWall(c.family) && b !== 0) throw new KitchenError(t("Wall cabinets have no plinth or worktop."), "plinth");
  if (isWall(c.family) && c.worktop) throw new KitchenError(t("Wall cabinets have no plinth or worktop."), "worktop");
  if (c.family !== "Filler") {
    if (w <= 2 * t0 + mm(40)) throw new KitchenError(t("The cabinet must leave room for its panels and an inside."), "width");
    if (d <= 3 * t0 + mm(40)) throw new KitchenError(t("The cabinet must leave room for its panels and an inside."), "depth");
    if (h - b <= 2 * t0 + mm(80)) {
      throw new KitchenError(t("The cabinet must leave room for its panels and an inside."), "height");
    }
  }
  if (c.family === "Filler" && b >= h) {
    throw new KitchenError(t("A filler must be taller than its plinth."), "height");
  }
  const blind = c.style === "Blind left" || c.style === "Blind right";
  if (isCorner(c.family) && !blind) {
    throw new KitchenError(t("Corner cabinets are blind corners, on the left or the right."), "style");
  }
  if (blind && w - d < mm(120)) {
    throw new KitchenError(t("A blind corner must be wider than deep by at least {size}.", { size: formatLength(mm(120)) }),
      "width");
  }
  if (!Number.isInteger(c.shelves) || !between(c.shelves, 0, 8)) {
    throw new KitchenError(t("Use 0 to 8 shelves."), "shelves");
  }
  if (!Number.isInteger(c.drawers) || !between(c.drawers, 1, 8)) {
    throw new KitchenError(t("Use 1 to 8 drawers."), "drawers");
  }
  if ((h - b - 2 * t0) / (c.shelves + 1) < t0 + mm(15)) {
    throw new KitchenError(t("Too many shelves for this cabinet height."), "shelves");
  }
  if ((c.style === "Drawers" || c.style === "Drawer + doors") && (h - b) / c.drawers < mm(80)) {
    throw new KitchenError(t("Drawer fronts must be at least {size} high.", { size: formatLength(mm(80)) }), "drawers");
  }
  if (!between(c.opening, 0, kMaxOpening)) throw new KitchenError(t("Opening: 0 to 110°."), "opening");
  need(c.topThickness, mm(10), mm(100), t("Worktop thickness"), "topThickness");
  need(c.overhang, 0, mm(100), t("Front overhang"), "overhang");
  need(c.backsplash, 0, mm(600), t("Backsplash"), "backsplash");
  if (!between(c.price, 0, 100_000_000)) throw new KitchenError(t("Enter a price of zero or more."), "price");
  if (c.currency.trim() === "" || c.currency.length > 12) {
    throw new KitchenError(t("Enter a currency (up to 12 characters)."), "currency");
  }
  if (c.style === "Appliance niche" && (h - b < mm(680) || w < mm(450))) {
    throw new KitchenError(t("An appliance niche needs {height} of usable height and {width} of width.",
      { height: formatLength(mm(680)), width: formatLength(mm(450)) }), h - b < mm(680) ? "height" : "width");
  }
}

// ------------------------------------------------------------------------------------- parts

/**
 * The cabinet's fixed parts and its fronts, closed. Throws KitchenError when the parameters don't
 * make a cabinet.
 * @param {Cabinet} c
 * @returns {{ parts: Part[], fronts: Front[] }}
 */
export function getParts(c) {
  validate(c);
  /** @type {Part[]} */
  const parts = [];
  /** @type {Front[]} */
  const fronts = [];
  /**
   * Adds a box from one corner to the opposite one.
   * @param {Part[]} list @param {string} name @param {Role} role
   * @param {number} x0 @param {number} y0 @param {number} z0
   * @param {number} x1 @param {number} y1 @param {number} z1
   */
  const box = (list, name, role, x0, y0, z0, x1, y1, z1) => {
    if (Math.min(x1 - x0, y1 - y0, z1 - z0) <= 1e-6) {
      throw new KitchenError(t("“{name}” has no usable thickness; adjust the dimensions.", { name }));
    }
    list.push({ name, role, at: [x0, y0, z0], size: [x1 - x0, y1 - y0, z1 - z0] });
  };
  const { width: w, depth: d, height: h, thickness: th, plinth: b, gap } = c;
  if (c.family === "Filler") {
    box(parts, t("Filler face"), "front", 0, 0, b, w, th, h);
    return { parts, fronts };
  }
  box(parts, t("Left side"), "body", 0, th, b, th, d, h);
  box(parts, t("Right side"), "body", w - th, th, b, w, d, h);
  box(parts, t("Bottom panel"), "body", th, th, b, w - th, d, b + th);
  box(parts, t("Back panel"), "body", th, d - th, b + th, w - th, d, h - th);
  box(parts, t("Top panel"), "body", th, th, h - th, w - th, d, h);
  if (b !== 0) {
    const plinthY = th + Math.min(mm(40), (d - 3 * th) / 4);
    box(parts, t("Recessed plinth"), "plinth", 0, plinthY, 0, w, plinthY + th, b);
    const frontY = plinthY + th + mm(5);
    const leg = Math.min(mm(40), (w - 2 * th) / 3, (d - frontY - th) / 3);
    [th, w - th - leg].forEach((x0, i) => {
      [frontY, d - th - leg].forEach((y0, j) => {
        box(parts, t("Leg {i}-{j}", { i: i + 1, j: j + 1 }), "metal", x0, y0, 0, x0 + leg, y0 + leg, b);
      });
    });
  }
  const style = c.style;
  if (style !== "Drawers" && style !== "Appliance niche") {
    const shelfTop = h - (style === "Drawer + doors" ? (h - b) * 0.23 : th);
    for (let n = 0; n < c.shelves; ++n) {
      const z = b + th + ((shelfTop - b - th) * (n + 1)) / (c.shelves + 1) - th / 2;
      box(parts, t("Shelf {n}", { n: n + 1 }), "body", th, th + mm(10), z, w - th, d - th, z + th);
    }
  }

  /**
   * Adds a door or drawer front over [x0, x1] x [z0, z1], with its handle and drawer box.
   * @param {string} name @param {number} x0 @param {number} x1 @param {number} z0 @param {number} z1
   * @param {{ right?: boolean, glass?: boolean, drawer?: boolean }} [options]
   */
  const front = (name, x0, x1, z0, z1, { right = false, glass = false, drawer = false } = {}) => {
    /** @type {Part[]} */
    const list = [];
    // French reads "Poignée tiroir 1" where English reads "Drawer 1 handle".
    const of = (/** @type {string} */ part) => t("{front} {part}", {
      front: name, part, Part: part.charAt(0).toUpperCase() + part.slice(1),
      lowerFront: name.charAt(0).toLowerCase() + name.slice(1),
    });
    if (glass) {
      const f = Math.min(mm(45), (x1 - x0) / 4, (z1 - z0) / 4);
      box(list, of(t("left frame")), "front", x0, 0, z0, x0 + f, th, z1);
      box(list, of(t("right frame")), "front", x1 - f, 0, z0, x1, th, z1);
      box(list, of(t("bottom frame")), "front", x0 + f, 0, z0, x1 - f, th, z0 + f);
      box(list, of(t("top frame")), "front", x0 + f, 0, z1 - f, x1 - f, th, z1);
      box(list, of(t("glass")), "glass", x0 + f, th / 2 - mm(2), z0 + f, x1 - f, th / 2 + mm(2), z1 - f);
    } else {
      box(list, name, "front", x0, 0, z0, x1, th, z1);
    }
    if (c.handles) {
      if (drawer) {
        const hw = Math.min(mm(120), (x1 - x0) * 0.45);
        const hx = (x0 + x1 - hw) / 2;
        const hz = z1 - Math.min(mm(40), (z1 - z0) / 3);
        box(list, of(t("handle")), "metal", hx, -mm(22), hz, hx + hw, -mm(12), hz + mm(8));
      } else {
        const inset = Math.min(mm(25), (x1 - x0) / 4);
        const hx = right ? x0 + inset : x1 - inset - mm(8);
        const hz = z0 + (z1 - z0) * 0.65;
        const hh = Math.min(mm(120), (z1 - z0) * 0.25);
        box(list, of(t("handle")), "metal", hx, -mm(22), hz, hx + mm(8), -mm(12), hz + hh);
      }
    }
    if (drawer) {
      const dw = Math.min(mm(12), th);
      const bh = Math.min(mm(130), (z1 - z0) * 0.65);
      const lft = x0 + th;
      const rgt = x1 - th;
      const back = d - 2 * th;
      box(list, of(t("tray bottom")), "drawerBox", lft, th, z0 + mm(8), rgt, back, z0 + mm(8) + dw);
      box(list, of(t("tray left")), "drawerBox", lft, th, z0 + mm(8) + dw, lft + dw, back, z0 + bh);
      box(list, of(t("tray right")), "drawerBox", rgt - dw, th, z0 + mm(8) + dw, rgt, back, z0 + bh);
      box(list, of(t("tray back")), "drawerBox", lft + dw, back - dw, z0 + mm(8) + dw, rgt - dw, back, z0 + bh);
    }
    fronts.push({ name, kind: drawer ? "drawer" : "door", pivot: right ? x1 : x0, right, parts: list });
  };

  const low = b + gap;
  let high = h - gap;
  if (style === "Drawers" || style === "Drawer + doors") {
    const n = style === "Drawers" ? c.drawers : 1;
    const start = style === "Drawers" ? b : h - (h - b) * 0.23;
    for (let i = 0; i < n; ++i) {
      const z = start + ((h - start) * i) / n;
      const zz = start + ((h - start) * (i + 1)) / n;
      front(t("Drawer {n}", { n: i + 1 }), gap, w - gap, z + gap, zz - gap, { drawer: true });
    }
    high = start - gap;
  }
  if (style === "Appliance niche") {
    const nicheTop = b + mm(600);
    box(parts, t("Niche shelf"), "body", th, th, nicheTop, w - th, d - th, nicheTop + th);
    front(t("Upper door"), gap, w - gap, nicheTop + th + gap, h - gap, { right: c.hinge === "Right" });
  } else if (style === "Blind left") {
    box(parts, t("Blind corner panel"), "front", gap, 0, low, d - gap, th, high);
    front(t("Corner door"), d + gap, w - gap, low, high, { right: true });
  } else if (style === "Blind right") {
    box(parts, t("Blind corner panel"), "front", w - d + gap, 0, low, w - gap, th, high);
    front(t("Corner door"), gap, w - d - gap, low, high);
  } else if (style === "Double doors" || style === "Drawer + doors" || style === "Glass doors") {
    const glass = style === "Glass doors";
    front(t("Left door"), gap, w / 2 - gap / 2, low, high, { glass });
    front(t("Right door"), w / 2 + gap / 2, w - gap, low, high, { right: true, glass });
  } else if (style === "Single door") {
    front(t("Door"), gap, w - gap, low, high, { right: c.hinge === "Right" });
  }
  if (c.worktop) {
    box(parts, t("Worktop"), "top", 0, -c.overhang, h, w, d, h + c.topThickness);
    if (c.backsplash !== 0) {
      box(parts, t("Backsplash"), "top", 0, d - th, h + c.topThickness, w, d, h + c.topThickness + c.backsplash);
    }
  }
  return { parts, fronts };
}

/**
 * How far a front moves when the cabinet is open: a door's turn in radians about its hinge,
 * counterclockwise seen from above, or a drawer's slide toward the front in meters.
 * @param {Cabinet} c @param {Front} front
 */
export function getFrontMotion(c, front) {
  if (front.kind === "drawer") return (c.opening / kMaxOpening) * c.depth * 0.65;
  return front.right ? c.opening : -c.opening;
}

/** The parameters with the doors and drawers opened, or closed when they were open. @param {Cabinet} c */
export function toggleOpening(c) {
  return { ...c, opening: c.opening > 0 ? 0 : Math.PI / 2 };
}

/** The parameters with the hinge, or the blind side of a corner, swapped. @param {Cabinet} c */
export function swapHinge(c) {
  /** @type {Cabinet} */
  const swapped = { ...c, hinge: c.hinge === "Left" ? "Right" : "Left" };
  if (c.style === "Blind left") swapped.style = "Blind right";
  if (c.style === "Blind right") swapped.style = "Blind left";
  return swapped;
}

// ------------------------------------------------------------------ KitchenMaker for SketchUp

/** The attribute dictionary KitchenMaker V.1 and V.2 for SketchUp keep a cabinet's parameters in. */
export const SKETCHUP_CABINET = "ingetrazo_kitchen_maker";
/** The attribute dictionary KitchenMaker V.2 for SketchUp keeps a continuous worktop's parameters in. */
export const SKETCHUP_WORKTOP = "ingetrazo_kitchenmaker_v2_worktop";

/**
 * Reads the "parameters" JSON text KitchenMaker for SketchUp stores: lengths in millimeters,
 * angles in degrees and snake_case keys. Settings missing from it keep their fallback.
 * @param {unknown} json
 */
function readSketchUp(json) {
  let value = null;
  try {
    value = typeof json === "string" ? JSON.parse(json) : null;
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const p = /** @type {Record<string, unknown>} */ (value);
  /** A setting that is wrong becomes NaN or "", which validation refuses. */
  const number = (/** @type {string} */ key, /** @type {number} */ fallback) =>
    p[key] === undefined ? fallback : typeof p[key] === "number" ? p[key] : NaN;
  return {
    /** @param {string} key @param {string} fallback */
    text: (key, fallback) => (p[key] === undefined ? fallback : typeof p[key] === "string" ? p[key] : ""),
    number,
    /** @param {string} key @param {number} fallback Meters. */
    length: (key, fallback) => (p[key] === undefined ? fallback : mm(number(key, NaN))),
    /** @param {string} key @param {boolean} fallback */
    flag: (key, fallback) => (typeof p[key] === "boolean" ? p[key] : fallback),
    /** @param {string} key */
    list: (key) => (Array.isArray(p[key]) ? p[key] : []),
  };
}

/**
 * The cabinet KitchenMaker for SketchUp stored as "parameters", or null when this port can't
 * build it. Settings that KitchenMaker V.1 didn't store take their defaults.
 * @param {unknown} json @returns {Cabinet | null}
 */
export function cabinetFromSketchUp(json) {
  const p = readSketchUp(json);
  if (p === null) return null;
  const d = defaultCabinet();
  /** @type {Cabinet} */
  const cabinet = {
    version: 1, name: p.text("name", d.name), family: /** @type {Family} */ (p.text("family", d.family)),
    style: /** @type {Style} */ (p.text("style", d.style)), width: p.length("width", d.width),
    depth: p.length("depth", d.depth), height: p.length("height", d.height),
    thickness: p.length("thickness", d.thickness), gap: p.length("gap", d.gap), plinth: p.length("plinth", d.plinth),
    shelves: p.number("shelves", d.shelves), drawers: p.number("drawers", d.drawers),
    hinge: /** @type {"Left" | "Right"} */ (p.text("hinge", d.hinge)),
    opening: (p.number("opening", 0) * Math.PI) / 180, handles: p.flag("handles", d.handles),
    finish: p.text("finish", d.finish), worktop: p.flag("worktop", d.worktop),
    topFinish: p.text("top_finish", d.topFinish), topThickness: p.length("top_thickness", d.topThickness),
    overhang: p.length("overhang", d.overhang), backsplash: p.length("backsplash", d.backsplash),
    price: p.number("price", d.price), currency: p.text("currency", d.currency),
  };
  return check(cabinet) === null ? cabinet : null;
}

/**
 * The continuous worktop KitchenMaker for SketchUp stored as "parameters", or null when this
 * port can't build it.
 * @param {unknown} json @returns {Worktop | null}
 */
export function worktopFromSketchUp(json) {
  const p = readSketchUp(json);
  if (p === null) return null;
  /** @type {Worktop} */
  const top = {
    version: 1, length: p.length("length", NaN), depth: p.length("depth", NaN), overhang: p.length("overhang", NaN),
    thickness: p.length("thickness", NaN), backsplash: p.length("backsplash", 0),
    backThickness: p.length("back_thickness", NaN), topFinish: p.text("top_finish", ""),
    cutouts: p.list("cutouts").map((/** @type {unknown} */ value) => {
      const c = readSketchUp(JSON.stringify(value));
      return {
        kind: /** @type {CutoutKind} */ (c?.text("kind", "") ?? ""), x: c?.length("x", NaN) ?? NaN,
        y: c?.length("y", NaN) ?? NaN, width: c?.length("width", NaN) ?? NaN, depth: c?.length("depth", NaN) ?? NaN,
      };
    }),
  };
  return checkWorktop(top) === null ? top : null;
}

// ---------------------------------------------------------------------- continuous worktop

/** Throws KitchenError for a worktop KitchenMaker can't build. @param {Worktop} top */
export function validateWorktop(top) {
  if (!(top.topFinish in TOPS)) throw new KitchenError(t("Unknown finish."), "topFinish");
  need(top.length, mm(50), 20, t("Worktop length"), "length");
  need(top.depth, mm(100), 3, t("Depth"), "depth");
  need(top.thickness, mm(10), mm(100), t("Thickness"), "thickness");
  need(top.overhang, 0, mm(100), t("Front overhang"), "overhang");
  need(top.backsplash, 0, mm(600), t("Backsplash"), "backsplash");
  need(top.backThickness, mm(8), mm(40), t("Backsplash thickness"), "backsplash");
  if (top.cutouts.length > kMaxCutouts) {
    throw new KitchenError(t("At most {n} cutouts.", { n: kMaxCutouts }), "cutouts");
  }
  for (const cut of top.cutouts) {
    const problem = checkCutout(top, cut);
    if (problem !== null) throw new KitchenError(problem, "cutouts");
  }
  top.cutouts.forEach((a, i) => {
    for (const b of top.cutouts.slice(i + 1)) {
      if (overlap(a, b)) {
        throw new KitchenError(t("Cutouts must be at least {size} apart.", { size: formatLength(kCutoutClearance) }),
          "cutouts");
      }
    }
  });
}

/** Returns why KitchenMaker can't build the worktop, or null. @param {Worktop} top @returns {KitchenError | null} */
export function checkWorktop(top) {
  try {
    validateWorktop(top);
    return null;
  } catch (error) {
    if (error instanceof KitchenError) return error;
    throw error;
  }
}

/** Whether two cutouts are closer than the clearance. @param {Cutout} a @param {Cutout} b */
export function overlap(a, b) {
  const clear = kCutoutClearance;
  const apartX = a.x + a.width + clear <= b.x + 1e-9 || b.x + b.width + clear <= a.x + 1e-9;
  const apartY = a.y + a.depth + clear <= b.y + 1e-9 || b.y + b.depth + clear <= a.y + 1e-9;
  return !apartX && !apartY;
}

/**
 * Why one cutout doesn't fit the worktop, or null.
 * @param {Worktop} top @param {Cutout} cut @returns {string | null}
 */
export function checkCutout(top, cut) {
  if (!between(cut.width, mm(100), 2)) return t("{what}: {range}.", { what: t("Width"), range: range(mm(100), 2) });
  if (!between(cut.depth, mm(100), mm(900))) {
    return t("{what}: {range}.", { what: t("Depth"), range: range(mm(100), mm(900)) });
  }
  const clear = kCutoutClearance;
  if (cut.x < clear - 1e-9 || cut.x + cut.width > top.length - clear + 1e-9 || cut.y < clear - 1e-9 ||
    cut.y + cut.depth > top.depth + top.overhang - clear + 1e-9) {
    return t("A cutout must stay at least {size} from the edges of the worktop.", { size: formatLength(clear) });
  }
  return null;
}

/**
 * The worktop slab and backsplash, without cutouts; the model cuts those with a boolean.
 * @param {Worktop} top
 * @returns {Part[]}
 */
export function getWorktopParts(top) {
  validateWorktop(top);
  /** @type {Part[]} */
  const parts = [{ name: t("Worktop"), role: "top", at: [0, -top.overhang, 0],
    size: [top.length, top.depth + top.overhang, top.thickness] }];
  if (top.backsplash !== 0) {
    parts.push({ name: t("Backsplash"), role: "top", at: [0, top.depth - top.backThickness, top.thickness],
      size: [top.length, top.backThickness, top.backsplash] });
  }
  return parts;
}

// -------------------------------------------------------------------------------- reports

/** Cut list kind of a part. @param {Part} part @returns {CutKind} */
function getCutKind(part) {
  switch (part.role) {
    case "front": return "front";
    case "top": return "top";
    case "plinth": return "plinth";
    case "glass": return "glass";
    case "metal": return "hardware";
    case "drawerBox": return "drawer_box";
    default: return "carcass";
  }
}

/** Rounds to a tenth of a millimeter, so equal parts group despite float noise. @param {number} v */
const roundSize = (v) => Math.round(v * 10000) / 10000;

/**
 * The cut list of cabinets and continuous worktops: finished sizes, longest first, with identical
 * parts grouped. Edge banding, grain and nesting aren't covered.
 * @param {readonly Cabinet[]} cabinets
 * @param {readonly Worktop[]} worktops
 * @returns {CutRow[]}
 */
export function getCutList(cabinets, worktops) {
  /** @type {Map<string, CutRow>} */
  const rows = new Map();
  /**
   * @param {CutKind} kind @param {string | null} finish @param {string} designation
   * @param {number[]} size @param {string} source @param {boolean} repeatSources
   * @param {"cabinets" | "worktops"} list @param {number} index
   */
  const add = (kind, finish, designation, size, source, repeatSources, list, index) => {
    const rounded = size.map(roundSize);
    // A panel lists longest side first; a cutout keeps its width and depth, which say which way it goes.
    const sorted = /** @type {[number, number, number]} */ (kind === "cutout" ? rounded : rounded.sort((a, b) => b - a));
    const key = JSON.stringify([kind, finish, designation, sorted]);
    let row = rows.get(key);
    if (!row) {
      row = { designation, kind, finish, size: sorted, quantity: 0, sources: [], cabinets: [], worktops: [] };
      rows.set(key, row);
    }
    row.quantity += 1;
    if (repeatSources || !row.sources.includes(source)) row.sources.push(source);
    if (!row[list].includes(index)) row[list].push(index);
  };
  cabinets.forEach((cabinet, index) => {
    const { parts, fronts } = getParts(cabinet);
    for (const part of [...parts, ...fronts.flatMap((f) => f.parts)]) {
      const kind = getCutKind(part);
      const finish = kind === "front" ? cabinet.finish : kind === "top" ? cabinet.topFinish : null;
      add(kind, finish, part.name.replace(/\s*\d+(-\d+)?/g, "").trim(), part.size, cabinet.name, false,
        "cabinets", index);
    }
  });
  worktops.forEach((top, index) => {
    for (const part of getWorktopParts(top)) {
      add("top", top.topFinish, part.name, part.size, t("Continuous worktop"), false, "worktops", index);
    }
    for (const cut of top.cutouts) {
      add("cutout", null, cut.kind === "sink" ? t("Sink cutout") : t("Hob cutout"),
        [cut.width, cut.depth, top.thickness],
        t("Continuous worktop (x = {x}, y = {y})", { x: formatLength(cut.x), y: formatLength(cut.y) }),
        true, "worktops", index);
    }
  });
  return [...rows.values()].sort((a, b) =>
    CUT_ORDER.indexOf(a.kind) - CUT_ORDER.indexOf(b.kind) || (a.finish ?? "").localeCompare(b.finish ?? "") ||
    b.size[0] - a.size[0] || b.size[1] - a.size[1] || a.designation.localeCompare(b.designation));
}

/**
 * Totals per material: number of parts and area in square meters.
 * @param {readonly CutRow[]} rows
 * @returns {{ kind: CutKind, finish: string | null, parts: number, area: number }[]}
 */
export function getCutSummary(rows) {
  /** @type {Map<string, { kind: CutKind, finish: string | null, parts: number, area: number }>} */
  const sums = new Map();
  for (const row of rows) {
    if (row.kind === "cutout") continue;
    const key = JSON.stringify([row.kind, row.finish]);
    const sum = sums.get(key) ?? { kind: row.kind, finish: row.finish, parts: 0, area: 0 };
    sum.parts += row.quantity;
    sum.area += row.size[0] * row.size[1] * row.quantity;
    sums.set(key, sum);
  }
  return [...sums.values()];
}

/** A price in whole cents, rounded half up. @param {number} price */
export const toCents = (price) => Math.round(Number((price * 100).toFixed(6)));

/**
 * The cost report: identical cabinets grouped (opened or closed alike), and totals in cents per
 * currency. Each row lists the indices of its cabinets in the list given.
 * @param {readonly Cabinet[]} cabinets
 */
export function getCostReport(cabinets) {
  /** @type {Map<string, { cabinet: Cabinet, indices: number[] }>} */
  const groups = new Map();
  cabinets.forEach((cabinet, index) => {
    const key = JSON.stringify(Object.entries({ ...cabinet, opening: 0 }).sort(([a], [b]) => a.localeCompare(b)));
    const group = groups.get(key) ?? { cabinet, indices: [] };
    group.indices.push(index);
    groups.set(key, group);
  });
  const rows = [...groups.values()].map(({ cabinet, indices }) => ({
    cabinet, indices, quantity: indices.length, currency: cabinet.currency.trim(), unitCents: toCents(cabinet.price),
    totalCents: toCents(cabinet.price) * indices.length,
  }));
  rows.sort((a, b) => a.currency.localeCompare(b.currency) || a.cabinet.family.localeCompare(b.cabinet.family) ||
    a.cabinet.name.localeCompare(b.cabinet.name));
  // A Map, since currencies are whatever the user typed, "constructor" or "__proto__" included.
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.totalCents);
  return { rows, totals };
}
