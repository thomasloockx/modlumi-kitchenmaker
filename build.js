// SPDX-License-Identifier: GPL-3.0-or-later
//
// Builds KitchenMaker cabinets and worktops into the model. A cabinet is a group that holds its
// parameters as entity data and one solid group per part. Each door and drawer is a group of its
// own, turned about its hinge or slid out by its transformation, so the cabinet opens without
// changing the parts. Sink and hob cutouts are real holes, cut with a boolean.

import * as recipe from "./recipe.js";
import { t, names } from "./i18n.js";

/**
 * @typedef {import("./recipe.js").Cabinet} Cabinet
 * @typedef {import("./recipe.js").Worktop} Worktop
 * @typedef {import("./recipe.js").Part} Part
 * @typedef {import("./recipe.js").Role} Role
 * @typedef {{ type: "cabinet", cabinet: Cabinet } | { type: "worktop", worktop: Worktop }} Data
 * @typedef {{ type: "material", key: string }} MaterialData
 *   Marks a material KitchenMaker made; key, such as "front/Warm white", stays the same in every language.
 * @typedef {{ group: modlumi.Group, cabinet: Cabinet, x: number, y: number, z: number }} RowItem
 * @typedef {{
 *   element: modlumi.Group | modlumi.ComponentInstance, world: modlumi.Transformation, selectable: boolean,
 *   scaled: boolean,
 * }} Placed
 *   Where a cabinet or worktop of the model is: its world transformation, whether it is in the
 *   context being edited, where it can be selected, and whether it shows scaled or mirrored.
 */

const { Transformation } = modlumi;
const model = modlumi.activeModel;
/** @type {modlumi.Vector3dLike} */
const kUp = [0, 0, 1];

/** @type {modlumi.EntityData} */
let entityData;

/** Lets this module read and write the plugin's entity data. @param {modlumi.EntityData} data */
export function setEntityData(data) {
  entityData = data;
}

/** @param {modlumi.AnyEntity | undefined} element @returns {Cabinet | null} */
export function getCabinet(element) {
  if (!(element instanceof modlumi.Group)) return null;
  const data = /** @type {Data | undefined} */ (entityData.get(element));
  return data?.type === "cabinet" ? data.cabinet : null;
}

/** @param {modlumi.AnyEntity | undefined} element @returns {Worktop | null} */
export function getWorktop(element) {
  if (!(element instanceof modlumi.Group)) return null;
  const data = /** @type {Data | undefined} */ (entityData.get(element));
  return data?.type === "worktop" ? data.worktop : null;
}

/**
 * Whether a transformation scales, mirrors or skews what it places, which KitchenMaker's sizes
 * don't account for.
 * @param {modlumi.Transformation} transformation
 */
export function isScaled(transformation) {
  const { xAxis: x, yAxis: y, zAxis: z } = transformation;
  const unit = [x, y, z].every((axis) => Math.abs(axis.length - 1) < 1e-6);
  const square = Math.abs(x.dot(y)) < 1e-6 && Math.abs(y.dot(z)) < 1e-6 && Math.abs(z.dot(x)) < 1e-6;
  return !unit || !square || x.cross(y).dot(z) < 0;
}

/** Throws when a cabinet is scaled, as rows and placement beside it need its real size. @param {modlumi.Group} group */
function requireUnscaled(group) {
  if (isScaled(group.transformation)) {
    throw new recipe.KitchenError(t("“{name}” is scaled. Undo the scale and set its size in Properties instead.",
      { name: group.name || getCabinet(group)?.name || "" }));
  }
}

/** The ids of what the context being edited holds. */
const getActiveIds = () => new Set(model.activeEntities.toArray().map((e) => e.entityId));

/**
 * The cabinets, checked to still be cabinets in the context being edited. Throws when one was
 * deleted or the user opened another group since they were picked.
 * @param {readonly modlumi.Group[]} groups
 */
export function getLiveCabinets(groups) {
  const active = getActiveIds();
  const live = groups.filter((g) => g.isValid && active.has(g.entityId) && getCabinet(g) !== null);
  if (live.length !== groups.length) {
    throw new recipe.KitchenError(t("Some of these cabinets were deleted or aren't in the group being edited. " +
      "Select them again."));
  }
  return live;
}

/** The selected cabinets. */
export function getSelectedCabinets() {
  return /** @type {modlumi.Group[]} */ (model.selection.toArray().filter((e) => getCabinet(e) !== null));
}

/** The selected continuous worktops. */
export function getSelectedWorktops() {
  return /** @type {modlumi.Group[]} */ (model.selection.toArray().filter((e) => getWorktop(e) !== null));
}

/**
 * Every cabinet and continuous worktop in the model, in nested groups and components too, once per
 * instance placed, with where each one is.
 */
export function getAllInModel() {
  /** @type {Cabinet[]} */
  const cabinets = [];
  /** @type {Placed[]} */
  const cabinetPlaces = [];
  /** @type {Worktop[]} */
  const worktops = [];
  /** @type {Placed[]} */
  const worktopPlaces = [];
  const active = new Set(model.activeEntities.toArray().map((e) => e.entityId));
  /** @param {modlumi.Entities} entities @param {modlumi.Transformation} parent @param {boolean} inActive */
  const visit = (entities, parent, inActive) => {
    for (const element of entities) {
      if (!(element instanceof modlumi.Group || element instanceof modlumi.ComponentInstance)) continue;
      const world = parent.multiply(element.transformation);
      const place = { element, world, selectable: inActive && active.has(element.entityId), scaled: isScaled(world) };
      const data = /** @type {Data | undefined} */ (entityData.get(element));
      if (data?.type === "cabinet") {
        cabinets.push(data.cabinet);
        cabinetPlaces.push(place);
      } else if (data?.type === "worktop") {
        worktops.push(data.worktop);
        worktopPlaces.push(place);
      } else {
        const inside = model.activePath.some((open) => open.entityId === element.entityId);
        visit(element instanceof modlumi.Group ? element.entities : element.definition.entities, world,
          inActive || inside);
      }
    }
  };
  visit(model.entities, new Transformation(), model.activePath.length === 0);
  return { cabinets, cabinetPlaces, worktops, worktopPlaces };
}

/**
 * The world-space box around placed cabinets and worktops, or null when they have no geometry.
 * @param {readonly Placed[]} places
 */
export function getWorldBounds(places) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const { element, world } of places) {
    if (!element.isValid) continue;
    // Bounds are in the element's context, so the parent's transformation maps them to the world.
    const bounds = element.bounds;
    if (bounds === null) continue;
    const parent = world.multiply(element.transformation.inverse());
    for (let i = 0; i < 8; ++i) {
      const p = parent.multiply(new modlumi.Point3d(i & 1 ? bounds.max.x : bounds.min.x,
        i & 2 ? bounds.max.y : bounds.min.y, i & 4 ? bounds.max.z : bounds.min.z));
      [p.x, p.y, p.z].forEach((v, axis) => {
        min[axis] = Math.min(min[axis], v);
        max[axis] = Math.max(max[axis], v);
      });
    }
  }
  return min[0] === Infinity ? null : new modlumi.BoundingBox([min[0], min[1], min[2]], [max[0], max[1], max[2]]);
}

// ------------------------------------------------------------------------------- materials

/** Whether a material is KitchenMaker's of that key. @param {modlumi.Material} material @param {string} key */
const isMaterialOf = (material, key) => {
  const data = /** @type {MaterialData | undefined} */ (entityData.get(material));
  return data?.type === "material" && data.key === key;
};

/**
 * KitchenMaker's material of that key, added with the name and color when the model has none. It
 * is known by its entity data, not its name, so a user material of the same name stays apart and
 * switching languages doesn't add another. The user may rename or repaint it, and every cabinet
 * that uses it follows. It is looked up in the model each time rather than kept, because the
 * plugin outlives the document and a handle from a closed one can't be used.
 * @param {string} key @param {string} name @param {{ r: number, g: number, b: number, a?: number }} color
 */
function getMaterial(key, name, color) {
  let material = model.materials.find((m) => isMaterialOf(m, key));
  if (material === undefined) {
    material = model.addMaterial(name, { color });
    entityData.set(material, /** @type {MaterialData} */ ({ type: "material", key }));
  }
  return material;
}

/** @param {Role} role @param {{ finish?: string, topFinish?: string }} finishes */
function getPartMaterial(role, finishes) {
  if (role === "front") {
    const finish = finishes.finish ?? "Warm white";
    return getMaterial(`front/${finish}`, t("KitchenMaker front {finish}", { finish: names.finish(finish) }),
      recipe.FINISHES[/** @type {keyof typeof recipe.FINISHES} */ (finish)]);
  }
  if (role === "top") {
    const finish = finishes.topFinish ?? "Light stone";
    return getMaterial(`top/${finish}`, t("KitchenMaker worktop {finish}", { finish: names.top(finish) }),
      recipe.TOPS[/** @type {keyof typeof recipe.TOPS} */ (finish)]);
  }
  return getMaterial(role, t("KitchenMaker {part}", { part: names.role(role).toLowerCase() }), recipe.ROLE_COLORS[role]);
}

// --------------------------------------------------------------------------------- cabinets

/**
 * Adds a part as a solid box group.
 * @param {modlumi.Entities} entities @param {Part} part @param {{ finish?: string, topFinish?: string }} finishes
 */
function addPart(entities, part, finishes) {
  const group = entities.addBox(part.at, ...part.size);
  group.name = part.name;
  group.material = getPartMaterial(part.role, finishes);
  return group;
}

/** Fills an empty cabinet group's entities. @param {modlumi.Entities} entities @param {Cabinet} cabinet */
function fillCabinet(entities, cabinet) {
  const { parts, fronts } = recipe.getParts(cabinet);
  for (const part of parts) addPart(entities, part, cabinet);
  for (const front of fronts) {
    const group = entities.addGroup();
    group.name = front.name;
    for (const part of front.parts) addPart(group.entities, part, cabinet);
    const motion = recipe.getFrontMotion(cabinet, front);
    if (motion !== 0) {
      group.transform(front.kind === "drawer"
        ? Transformation.translation([0, -motion, 0])
        : Transformation.rotation([front.pivot, 0, 0], kUp, motion));
    }
  }
}

/** Empties a group's own definition, leaving copies alone. @param {modlumi.Group} group */
function clear(group) {
  group.makeUnique();
  for (const element of group.entities.toArray()) {
    if (element.isValid) group.entities.erase(element);
  }
}

/**
 * Adds a cabinet to the context being edited, placed by transformation, and selects it. Call it
 * inside an operation.
 * @param {Cabinet} cabinet @param {modlumi.Transformation} transformation
 */
export function addCabinet(cabinet, transformation) {
  recipe.getParts(cabinet);
  const group = model.activeEntities.addGroup();
  fillCabinet(group.entities, cabinet);
  group.name = cabinet.name;
  group.transformation = transformation;
  entityData.set(group, /** @type {Data} */ ({ type: "cabinet", cabinet }));
  model.selection.clear();
  model.selection.add(group);
  return group;
}

/** Rebuilds a cabinet from new parameters. Call it inside an operation. @param {modlumi.Group} group @param {Cabinet} cabinet */
export function rebuildCabinet(group, cabinet) {
  recipe.getParts(cabinet);
  clear(group);
  fillCabinet(group.entities, cabinet);
  group.name = cabinet.name;
  entityData.set(group, /** @type {Data} */ ({ type: "cabinet", cabinet }));
}

/**
 * Rebuilds each group with the parameters change returns, in one undo step. Every cabinet is
 * checked before the model changes.
 * @param {string} name @param {readonly modlumi.Group[]} groups @param {(cabinet: Cabinet) => Cabinet} change
 */
export function changeCabinets(name, groups, change) {
  const updates = getLiveCabinets(groups).map((group) => {
    const cabinet = change(/** @type {Cabinet} */ (getCabinet(group)));
    recipe.getParts(cabinet);
    return { group, cabinet };
  });
  model.operation(name, () => {
    for (const { group, cabinet } of updates) rebuildCabinet(group, cabinet);
  });
}

/**
 * Where a cabinet goes at a point, turned about the vertical axis.
 * @param {modlumi.Point3dLike} point @param {number} rotation
 */
export function getPose(point, rotation) {
  const [x, y, z] = point;
  return Transformation.translation([x, y, z]).multiply(Transformation.rotation([0, 0, 0], kUp, rotation));
}

/**
 * Where a cabinet goes beside another one, gap away, in the other cabinet's axes. A wall cabinet
 * beside a base cabinet, or the other way round, goes at height z instead of the other's.
 * @param {modlumi.Group} reference @param {Cabinet} cabinet @param {number} gap @param {"left" | "right"} side
 * @param {number} z
 */
export function getPoseBeside(reference, cabinet, gap, side, z) {
  requireUnscaled(reference);
  const other = /** @type {Cabinet} */ (getCabinet(reference));
  const dx = side === "left" ? -(cabinet.width + gap) : other.width + gap;
  const pose = reference.transformation.multiply(Transformation.translation([dx, 0, 0]));
  if (recipe.isWall(cabinet.family) === recipe.isWall(other.family)) return pose;
  return Transformation.translation([0, 0, z - pose.origin.z]).multiply(pose);
}

/**
 * The boxes of a closed cabinet in its own coordinates, for previews.
 * @param {Cabinet} cabinet @returns {{ at: [number, number, number], size: [number, number, number] }[]}
 */
export function getPreviewBoxes(cabinet) {
  const { parts, fronts } = recipe.getParts(cabinet);
  return [...parts, ...fronts.flatMap((f) => f.parts)].map(({ at, size }) => ({ at, size }));
}

// -------------------------------------------------------------------------------------- rows

/**
 * The cabinets in the axes of the leftmost one, sorted from left to right. Throws when they don't
 * face the same way.
 * @param {readonly modlumi.Group[]} groups
 * @returns {{ axes: modlumi.Transformation, items: RowItem[] }}
 */
export function getRow(groups) {
  const first = groups[0].transformation;
  const xAxis = first.xAxis.normalize();
  const along = (/** @type {modlumi.Group} */ g) => first.origin.vectorTo(g.transformation.origin).dot(xAxis);
  const anchor = groups.reduce((a, b) => (along(b) < along(a) ? b : a));
  const axes = anchor.transformation;
  const toRow = axes.inverse();
  const items = groups.map((group) => {
    requireUnscaled(group);
    const tr = group.transformation;
    if (tr.xAxis.normalize().dot(axes.xAxis.normalize()) < 0.9999 ||
      tr.zAxis.normalize().dot(axes.zAxis.normalize()) < 0.9999) {
      throw new recipe.KitchenError(t("The cabinets must face the same way to make a row."));
    }
    const p = toRow.multiply(tr.origin);
    return { group, cabinet: /** @type {Cabinet} */ (getCabinet(group)), x: p.x, y: p.y, z: p.z };
  });
  return { axes, items: items.sort((a, b) => a.x - b.x) };
}

/**
 * Lines cabinets up side by side, gap apart, against the wall or flush at the front.
 * @param {readonly modlumi.Group[]} groups @param {number} gap @param {"back" | "front"} align
 */
export function alignRow(groups, gap, align) {
  if (groups.length < 2) throw new recipe.KitchenError(t("Select at least two cabinets."));
  const { axes, items } = getRow(getLiveCabinets(groups));
  const first = items[0];
  const back = first.y + first.cabinet.depth;
  let x = first.x;
  const poses = items.map((item) => {
    const y = align === "back" ? back - item.cabinet.depth : first.y;
    const pose = axes.multiply(Transformation.translation([x, y, item.z]));
    x += item.cabinet.width + gap;
    return { group: item.group, pose };
  });
  model.operation(t("Align in a Row"), () => {
    for (const { group, pose } of poses) group.transformation = pose;
  });
}

// ---------------------------------------------------------------------- continuous worktop

/** Fills an empty worktop group's entities. @param {modlumi.Entities} entities @param {Worktop} worktop */
function fillWorktop(entities, worktop) {
  const [slab, ...rest] = recipe.getWorktopParts(worktop);
  let top = addPart(entities, slab, worktop);
  for (const cut of worktop.cutouts) {
    // Taller than the slab, so the boolean leaves no skin.
    const cutter = entities.addBox([cut.x, cut.y - worktop.overhang, -0.01], cut.width, cut.depth,
      worktop.thickness + 0.02);
    top = entities.subtract(top, cutter);
  }
  top.name = slab.name;
  top.material = getPartMaterial("top", worktop);
  for (const part of rest) addPart(entities, part, worktop);
}

/** Rebuilds a worktop from new parameters, in one undo step. @param {modlumi.Group} group @param {Worktop} worktop */
export function rebuildWorktop(group, worktop) {
  recipe.validateWorktop(worktop);
  model.operation(t("Edit Worktop"), () => {
    clear(group);
    fillWorktop(group.entities, worktop);
    entityData.set(group, /** @type {Data} */ ({ type: "worktop", worktop }));
  });
}

/**
 * Checks a row of base cabinets can take one worktop and returns it, without cutouts, with where
 * it goes.
 * @param {readonly modlumi.Group[]} groups
 * @param {{ topFinish: string, thickness: number, overhang: number, backsplash: number }} options
 */
export function planWorktop(groups, options) {
  if (groups.length === 0) throw new recipe.KitchenError(t("Select at least one cabinet of the row."));
  const { axes, items } = getRow(groups);
  if (items.some((item) => recipe.isWall(item.cabinet.family))) {
    throw new recipe.KitchenError(t("Leave wall cabinets out of the selection: the worktop covers base cabinets."));
  }
  const tops = items.map((item) => item.z + item.cabinet.height);
  const spread = Math.max(...tops) - Math.min(...tops);
  if (spread > 0.0005) {
    throw new recipe.KitchenError(t("The cabinets aren't all the same height ({size} apart).",
      { size: model.formatLength(spread) }));
  }
  for (let i = 1; i < items.length; ++i) {
    const gap = items[i].x - (items[i - 1].x + items[i - 1].cabinet.width);
    if (gap > 0.01 || gap < -0.001) {
      throw new recipe.KitchenError(t("The cabinets don't touch ({size} apart). Align them in a row first.",
        { size: model.formatLength(gap) }));
    }
  }
  const x0 = items[0].x;
  const y0 = Math.min(...items.map((item) => item.y));
  const y1 = Math.max(...items.map((item) => item.y + item.cabinet.depth));
  /** @type {Worktop} */
  const worktop = {
    version: 1, length: Math.max(...items.map((item) => item.x + item.cabinet.width)) - x0, depth: y1 - y0,
    overhang: options.overhang, thickness: options.thickness, backsplash: options.backsplash,
    backThickness: items[0].cabinet.thickness, topFinish: options.topFinish, cutouts: [],
  };
  return { worktop, items, pose: axes.multiply(Transformation.translation([x0, y0, tops[0]])) };
}

/**
 * Puts one worktop over a row of base cabinets, in place of their own worktops and of the old
 * continuous worktops given that are still in the context being edited. One undo step.
 * @param {readonly modlumi.Group[]} groups @param {readonly modlumi.Group[]} oldWorktops
 * @param {Worktop} worktop @param {modlumi.Transformation} pose
 */
export function addWorktop(groups, oldWorktops, worktop, pose) {
  recipe.validateWorktop(worktop);
  const active = getActiveIds();
  const old = oldWorktops.filter((g) => g.isValid && active.has(g.entityId) && getWorktop(g) !== null);
  const updates = getLiveCabinets(groups).map((group) => ({ group, cabinet: /** @type {Cabinet} */ (getCabinet(group)) }))
    .filter(({ cabinet }) => cabinet.worktop)
    .map(({ group, cabinet }) => ({ group, cabinet: { ...cabinet, worktop: false } }));
  return model.operation(t("Continuous Worktop"), () => {
    for (const top of old) model.activeEntities.erase(top);
    for (const { group, cabinet } of updates) rebuildCabinet(group, cabinet);
    const group = model.activeEntities.addGroup();
    fillWorktop(group.entities, worktop);
    group.name = t("Continuous worktop");
    group.transformation = pose;
    entityData.set(group, /** @type {Data} */ ({ type: "worktop", worktop }));
    model.selection.clear();
    model.selection.add(group);
    return group;
  });
}
