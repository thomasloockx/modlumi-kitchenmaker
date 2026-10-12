// SPDX-License-Identifier: GPL-3.0-or-later
//
// KitchenMaker for Modlumi, after IngeTrazo KitchenMaker V.2 for SketchUp: parametric kitchen
// cabinets, rows, a continuous worktop with sink and hob cutouts, a cut list and a cost report.
//
// - The KitchenMaker panel picks a cabinet from the library and sets its parameters.
// - The Place Cabinet tool puts that cabinet down where you click, with inference; X turns it.
// - Selecting a cabinet or worktop shows its parameters in Properties, where changes rebuild it.
// - Commands, also in the right-click menu, open or close cabinets, swap hinges, change finishes,
//   align rows and lay a continuous worktop. Reports show in dialogs and export to CSV.
//
// The interface follows the user's language (English or French); stored values stay in English.

import * as recipe from "./recipe.js";
import * as build from "./build.js";
import { t, names, setLocale } from "./i18n.js";

/**
 * @typedef {import("./recipe.js").Cabinet} Cabinet
 * @typedef {import("./recipe.js").Worktop} Worktop
 * @typedef {import("./recipe.js").Cutout} Cutout
 * @typedef {import("./recipe.js").CutoutKind} CutoutKind
 * @typedef {import("./recipe.js").Family} Family
 * @typedef {import("./recipe.js").Field} Field
 * @typedef {import("./build.js").Placed} Placed
 */

const model = modlumi.activeModel;
const kTitle = "KitchenMaker";
const mm = (/** @type {number} */ value) => value / 1000;
/** The preview's color. */
const kPreview = { r: 0.93, g: 0.61, b: 0.22 };

/** The library choice and the cabinet the panel and the Place Cabinet tool build. */
const library = { family: /** @type {Family} */ ("Base"), preset: 0 };
/** @type {Cabinet} */
let next;
/** Where the panel's coordinate placement puts the next cabinet. */
const placement = { x: 0, y: 0, z: 0, rotation: 0, gap: 0 };
/** The Place Cabinet tool's state. */
const placing = { point: /** @type {modlumi.Point3d | null} */ (null), rotation: 0 };
/**
 * Properties edits that don't make a cabinet or worktop yet, by group, with the parameters they
 * started from, so the user can keep typing until it is valid again.
 * @type {Map<number, { base: string, draft: Cabinet | Worktop }>}
 */
const drafts = new Map();

// ---------------------------------------------------------------------------------- helpers

/** The library's presets of a family, with their labels. @param {Family} family */
function getPresets(family) {
  return recipe.stylesOf(family).flatMap((style) => recipe.widthsOf(family).map((width) => {
    const size = model.formatLength(width);
    return {
      label: `${names.style(style)} - ${size}`,
      cabinet: recipe.preset(family, style, width, t("{family} {style} {width}",
        { family: names.family(family), style: names.style(style).toLowerCase(), width: Math.round(width * 1000) })),
    };
  }));
}

/**
 * A dropdown of translated names for stored English values.
 * @template {string} T
 * @param {modlumi.Ui} ui @param {string} label @param {T} value @param {readonly T[]} values
 * @param {(value: T) => string} name @param {modlumi.WidgetOptions} [options]
 * @returns {T}
 */
function choose(ui, label, value, values, name, options) {
  const shown = values.map(name);
  const chosen = ui.dropdown(label, name(value), shown, options);
  return values[shown.indexOf(chosen)] ?? value;
}

/** The error of a field, for its widget's error option. @param {recipe.KitchenError | null} error @param {Field} field */
const errorOf = (error, field) => (error !== null && error.field === field ? error.message : null);

/**
 * Draws a cabinet's parameters and returns them, changed where the user edited them. Fields the
 * recipe refuses show why under them.
 * @param {modlumi.Ui} ui @param {Cabinet} c @returns {Cabinet}
 */
function drawCabinet(ui, c) {
  const error = recipe.check(c);
  const e = (/** @type {Field} */ field) => ({ error: errorOf(error, field) });
  const r = { ...c };
  ui.section(t("Cabinet"), () => {
    r.name = ui.textField(t("Name"), c.name, e("name"));
    r.family = choose(ui, t("Family"), c.family, recipe.FAMILIES, names.family, e("family"));
    r.style = choose(ui, t("Front"), c.style, recipe.STYLES, names.style, e("style"));
    r.width = ui.length(t("Width"), c.width, { min: 0, ...e("width") });
    r.depth = ui.length(t("Depth"), c.depth, { min: 0, ...e("depth") });
    r.height = ui.length(t("Height"), c.height, { min: 0, ...e("height") });
    r.thickness = ui.length(t("Panel thickness"), c.thickness, { min: 0, ...e("thickness") });
    r.plinth = ui.length(t("Plinth"), c.plinth, { min: 0, disabled: recipe.isWall(r.family), ...e("plinth") });
    r.shelves = ui.integer(t("Shelves"), c.shelves, { min: 0, max: 8, ...e("shelves") });
    r.drawers = ui.integer(t("Drawers"), c.drawers, { min: 1, max: 8, disabled: r.style !== "Drawers", ...e("drawers") });
    r.finish = choose(ui, t("Front finish"), c.finish, Object.keys(recipe.FINISHES), names.finish, e("finish"));
    r.hinge = /** @type {"Left" | "Right"} */ (choose(ui, t("Hinge"), c.hinge, ["Left", "Right"], names.hinge,
      { disabled: !recipe.isHinged(r.style), tip: t("Hinge side of a single door") }));
  });
  ui.section(t("Details"), () => {
    const shownDegrees = Math.round((c.opening * 180) / Math.PI);
    const degrees = ui.slider(t("Opening"), shownDegrees, {
      min: 0, max: 110, integer: true, suffix: "°", tip: t("Opens the doors and pulls out the drawers, for views"),
      ...e("opening"),
    });
    // The slider shows whole degrees; the stored angle changes only when the user moves it.
    if (degrees !== shownDegrees) r.opening = (degrees * Math.PI) / 180;
    r.gap = ui.length(t("Front gap"), c.gap, { min: 0, ...e("gap") });
    r.handles = ui.checkbox(t("Handles"), c.handles);
    r.worktop = ui.checkbox(t("Worktop"), c.worktop, { disabled: recipe.isWall(r.family), ...e("worktop") });
    ui.disabled(!r.worktop, () => {
      r.topFinish = choose(ui, t("Worktop finish"), c.topFinish, Object.keys(recipe.TOPS), names.top, e("topFinish"));
      r.topThickness = ui.length(t("Worktop thickness"), c.topThickness, { min: 0, ...e("topThickness") });
      r.overhang = ui.length(t("Front overhang"), c.overhang, { min: 0, ...e("overhang") });
      r.backsplash = ui.length(t("Backsplash"), c.backsplash, { min: 0, ...e("backsplash") });
    });
  });
  ui.section(t("Price"), () => {
    r.price = ui.number(t("Unit price"), c.price, {
      min: 0, decimals: 2, tip: t("Whole cabinet, worktop and hardware included"), ...e("price"),
    });
    r.currency = ui.textField(t("Currency"), c.currency, e("currency"));
  }, { open: false });
  if (recipe.isWall(r.family) && !recipe.isWall(c.family)) {
    // Wall cabinets hang without a plinth or worktop.
    Object.assign(r, { plinth: 0, worktop: false });
  }
  if (error !== null && error.field === null) ui.text(error.message, { tone: "error" });
  return r;
}

/** @param {unknown} a @param {unknown} b */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** @param {unknown} error */
function isUserError(error) {
  return error instanceof recipe.KitchenError || error instanceof modlumi.ModelError;
}

/** Millimeters to a tenth, for CSV columns in millimeters. @param {number} meters */
const toMm = (meters) => Math.round(meters * 10000) / 10;

/**
 * Text a spreadsheet would read as a formula gets a leading quote; other values pass as they are.
 * @param {unknown} value
 */
const safeCell = (value) => (typeof value === "string" && /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value);

/** @param {modlumi.PluginContext} context */
export function activate(context) {
  setLocale(context.locale);
  build.setEntityData(context.entityData);
  recipe.setLengthFormat((meters) => model.formatLength(meters));
  next = getPresets("Base")[0].cabinet;

  /** An amount of money in the user's number format. @param {number} cents */
  const formatMoney = (cents) => context.formatNumber(cents / 100, { decimals: 2 });

  /** Runs an action and shows the user why it couldn't run. @param {() => void} action */
  function attempt(action) {
    try {
      action();
    } catch (error) {
      if (!isUserError(error)) throw error;
      context.alert(/** @type {Error} */ (error).message, { title: kTitle });
    }
  }

  /**
   * Selects the cabinets and worktops that are in the context being edited, and turns the camera
   * to all of them.
   * @param {readonly Placed[]} places
   */
  function showInModel(places) {
    const live = places.filter((p) => p.element.isValid);
    const selectable = live.filter((p) => p.selectable);
    model.selection.clear();
    for (const { element } of selectable) model.selection.add(element);
    if (selectable.length < live.length) {
      context.showMessage(t("Some of these are inside other groups; open them to select them."));
    }
    const bounds = build.getWorldBounds(live);
    if (bounds === null) return;
    const camera = context.viewport.camera;
    const direction = camera.target.vectorTo(camera.eye).normalize();
    const fov = (camera.fieldOfView * Math.PI) / 180;
    // Far enough that open doors and neighbors don't fill the view.
    const distance = Math.max(bounds.diagonal, mm(800)) / Math.tan(fov / 2);
    const center = bounds.center;
    const eye = new modlumi.Point3d(center.x + direction.x * distance, center.y + direction.y * distance,
      center.z + direction.z * distance);
    context.viewport.setCamera(new modlumi.Camera(eye, center, {
      up: camera.up, perspective: camera.perspective, fieldOfView: camera.fieldOfView,
    }), { duration: 0.4 });
  }

  // ------------------------------------------------------------------------------ the panel

  /** Adds the panel's cabinet at the panel's coordinates. */
  function addAtCoordinates() {
    const pose = build.getPose([placement.x, placement.y, placement.z], placement.rotation);
    model.operation(t("Add Cabinet"), () => build.addCabinet(next, pose));
  }

  /** Adds the panel's cabinet beside the selected one. @param {"left" | "right"} side */
  function addBeside(side) {
    const selected = build.getSelectedCabinets();
    if (selected.length !== 1) throw new recipe.KitchenError(t("Select one KitchenMaker cabinet."));
    const pose = build.getPoseBeside(selected[0], next, placement.gap, side, placement.z);
    model.operation(t("Add Cabinet Beside"), () => build.addCabinet(next, pose));
  }

  const panel = context.addPanel({
    id: "kitchen",
    title: kTitle,
    width: 360,
    height: 640,
    draw(ui) {
      ui.section(t("Library"), () => {
        const family = choose(ui, t("Category"), library.family, recipe.FAMILIES, names.family);
        const presets = getPresets(family);
        const labels = presets.map((p) => p.label);
        const shown = family === library.family ? library.preset : 0;
        const chosen = Math.max(0, labels.indexOf(ui.dropdown(t("Model"), labels[shown], labels)));
        const preset = family === library.family ? chosen : 0;
        if (family !== library.family || preset !== library.preset) {
          library.family = family;
          library.preset = preset;
          next = { ...presets[preset].cabinet };
          placement.z = recipe.isWall(family) ? 1.5 : 0;
        }
      });
      next = drawCabinet(ui, next);
      const valid = recipe.check(next) === null;
      ui.section(t("Placement"), () => {
        if (ui.button(t("Place with the Mouse"), { primary: true, disabled: !valid })) tool.select();
        ui.spacing();
        placement.x = ui.length("X", placement.x);
        placement.y = ui.length("Y", placement.y);
        placement.z = ui.length("Z", placement.z, { tip: t("Height to place at; 1.5 m for a wall cabinet") });
        placement.rotation = ui.angle(t("Rotation"), placement.rotation, { tip: t("About the vertical axis") });
        if (ui.button(t("Add at Coordinates"), { disabled: !valid })) attempt(addAtCoordinates);
        ui.spacing();
        placement.gap = ui.length(t("Gap to the selection"), placement.gap, { min: 0 });
        const one = build.getSelectedCabinets().length === 1;
        ui.row(() => {
          if (ui.button(t("Left of Selection"), { disabled: !valid || !one })) attempt(() => addBeside("left"));
          if (ui.button(t("Right of Selection"), { disabled: !valid || !one })) attempt(() => addBeside("right"));
        });
      });
    },
  });

  // ------------------------------------------------------------------- the placement tool

  /** @type {{ at: [number, number, number], size: [number, number, number] }[]} */
  let preview = [];
  let previewOf = "";
  const turn = () => {
    placing.rotation = (placing.rotation + Math.PI / 2) % (2 * Math.PI);
  };
  const tool = context.registerTool({
    id: "place",
    title: t("Place Cabinet"),
    tip: t("Puts the KitchenMaker panel's cabinet down where you click."),
    icon: "icons/place.svg",
    toolbar: true,
    activate() {
      placing.point = null;
      placing.rotation = placement.rotation;
      tool.status = t("Click to place the cabinet; X turns it by 90°, or type an angle. Esc stops.");
    },
    onMouseMove(event) {
      placing.point = event.point?.position ?? null;
    },
    onMouseUp(event) {
      placing.point = event.point?.position ?? placing.point;
      if (placing.point === null) return;
      const pose = build.getPose(placing.point, placing.rotation);
      attempt(() => model.operation(t("Place Cabinet"), () => build.addCabinet(next, pose)));
      // One cabinet per pick, like the original; the Select tool shows it in Properties.
      context.selectDefaultTool();
    },
    onKeyDown(event) {
      if (event.key === "x" && !event.repeat) turn();
    },
    onValue(text) {
      const degrees = Number(text.replace(",", ".").replace("°", "").trim());
      if (!Number.isFinite(degrees)) {
        context.showMessage(t("Type a rotation in degrees, such as 90."));
        return;
      }
      placing.rotation = (degrees * Math.PI) / 180;
    },
    onCancel() {
      placing.point = null;
      if (reason === "escape") context.selectDefaultTool();
    },
    options(ui) {
      ui.readOnly(t("Cabinet"), next.name);
      placing.rotation = ui.angle(t("Rotation"), placing.rotation, { tip: t("About the vertical axis; X turns it by 90°") });
      if (ui.button(t("Edit the Cabinet..."))) panel.show();
    },
    draw(view) {
      if (placing.point === null) return;
      const key = JSON.stringify(next);
      if (key !== previewOf) {
        previewOf = key;
        try {
          preview = build.getPreviewBoxes(next);
        } catch (error) {
          if (!isUserError(error)) throw error;
          preview = [];
        }
      }
      // Previews take points in the coordinates of the context being edited, like the pointer's.
      const transformation = build.getPose(placing.point, placing.rotation);
      for (const { at, size } of preview) view.box(at, size, { color: kPreview, width: 1.5, transformation });
    },
  });

  // ---------------------------------------------------------------------------- Properties

  /**
   * The draft of a container when the user's last edit didn't make a valid object, or the stored
   * value.
   * @template {Cabinet | Worktop} T
   * @param {modlumi.Group} container @param {T} stored @returns {T}
   */
  function getShown(container, stored) {
    const pending = drafts.get(container.entityId);
    return pending?.base === JSON.stringify(stored) ? /** @type {T} */ (pending.draft) : stored;
  }

  context.addPropertiesSection({
    id: "cabinet-properties",
    title: t("KitchenMaker Cabinet"),
    when: (container) => build.getCabinet(container) !== null,
    draw(ui, container) {
      const group = /** @type {modlumi.Group} */ (container);
      const cabinet = /** @type {Cabinet} */ (build.getCabinet(group));
      const shown = getShown(group, cabinet);
      const changed = drawCabinet(ui, shown);
      if (!same(changed, shown)) {
        if (recipe.check(changed) === null) {
          drafts.delete(group.entityId);
          attempt(() => model.operation(t("Edit Cabinet"), () => build.rebuildCabinet(group, changed)));
        } else {
          drafts.set(group.entityId, { base: JSON.stringify(cabinet), draft: changed });
        }
      }
      ui.row(() => {
        if (ui.button(t("Open / Close"))) {
          attempt(() => build.changeCabinets(t("Open / Close"), [group], recipe.toggleOpening));
        }
        if (ui.button(t("Swap Hinge"))) {
          attempt(() => build.changeCabinets(t("Swap Hinge"), [group], recipe.swapHinge));
        }
      });
    },
  });

  /**
   * Draws a worktop cutout's fields and returns it, changed where the user edited it.
   * @param {modlumi.Ui} ui @param {Cutout} cut @param {string | null} error
   */
  function drawCutout(ui, cut, error) {
    return {
      kind: choose(ui, t("Kind"), cut.kind, /** @type {CutoutKind[]} */ (["sink", "hob"]), names.cutout),
      x: ui.length(t("From the left end"), cut.x, { min: 0 }),
      y: ui.length(t("From the front edge"), cut.y, { min: 0 }),
      width: ui.length(t("Width"), cut.width, { min: 0, error }),
      depth: ui.length(t("Depth"), cut.depth, { min: 0 }),
    };
  }

  /** A new cutout of a kind, centered along a worktop. @param {Worktop} top @param {CutoutKind} kind */
  function newCutout(top, kind) {
    const [width, depth] = recipe.CUTOUT_SIZES[kind];
    return { kind, x: Math.max(recipe.kCutoutClearance, (top.length - width) / 2), y: mm(70), width, depth };
  }

  context.addPropertiesSection({
    id: "worktop-properties",
    title: t("KitchenMaker Worktop"),
    when: (container) => build.getWorktop(container) !== null,
    draw(ui, container) {
      const group = /** @type {modlumi.Group} */ (container);
      const worktop = /** @type {Worktop} */ (build.getWorktop(group));
      const shown = getShown(group, worktop);
      ui.readOnly(t("Length"), model.formatLength(shown.length));
      ui.readOnly(t("Depth"), model.formatLength(shown.depth));
      const r = { ...shown };
      r.topFinish = choose(ui, t("Finish"), shown.topFinish, Object.keys(recipe.TOPS), names.top);
      r.thickness = ui.length(t("Thickness"), shown.thickness, { min: 0 });
      r.overhang = ui.length(t("Front overhang"), shown.overhang, { min: 0 });
      r.backsplash = ui.length(t("Backsplash"), shown.backsplash, { min: 0 });
      r.cutouts = ui.list(t("Cutouts"), shown.cutouts, (cut, index) => {
        const own = recipe.checkCutout(shown, cut);
        const near = shown.cutouts.some((other, i) => i !== index && recipe.overlap(cut, other));
        return drawCutout(ui, cut, own ?? (near ? t("Too close to another cutout.") : null));
      }, {
        add: () => newCutout(shown, shown.cutouts.some((c) => c.kind === "sink") ? "hob" : "sink"),
        remove: true, addLabel: t("Add Cutout"), removeLabel: t("Remove"),
        error: shown.cutouts.length > recipe.kMaxCutouts ? t("At most {n} cutouts.", { n: recipe.kMaxCutouts }) : null,
      });
      if (r.cutouts.length > recipe.kMaxCutouts) r.cutouts = r.cutouts.slice(0, recipe.kMaxCutouts);
      if (!same(r, shown)) {
        try {
          recipe.validateWorktop(r);
          drafts.delete(group.entityId);
          attempt(() => build.rebuildWorktop(group, r));
        } catch (error) {
          if (!(error instanceof recipe.KitchenError)) throw error;
          drafts.set(group.entityId, { base: JSON.stringify(worktop), draft: r });
        }
      }
      ui.text(t("To move it with the cabinets, select them and this worktop, then use Continuous Worktop."),
        { tone: "muted" });
    },
  });

  // ------------------------------------------------------------------------------- dialogs

  /** Asks for a front finish for the selected cabinets. */
  function showFinishes() {
    const groups = build.getSelectedCabinets();
    let finish = /** @type {Cabinet} */ (build.getCabinet(groups[0])).finish;
    context.showDialog({
      id: "finishes",
      title: t("Finishes"),
      draw(ui) {
        ui.text(t("{n} cabinet(s) selected", { n: groups.length }), { tone: "muted" });
        finish = choose(ui, t("Front finish"), finish, Object.keys(recipe.FINISHES), names.finish);
        if (ui.button(t("Apply"), { primary: true })) {
          attempt(() => build.changeCabinets(t("Finishes"), groups.filter((g) => g.isValid), (c) => ({ ...c, finish })));
          ui.close();
        }
      },
    });
  }

  /** Asks how to line up the selected cabinets. */
  function showAlign() {
    const groups = build.getSelectedCabinets();
    const state = { gap: 0, align: /** @type {"back" | "front"} */ ("back") };
    context.showDialog({
      id: "align",
      title: t("Align in a Row"),
      draw(ui) {
        const tooBig = state.gap > mm(50) ? t("{what}: {range}.", {
          what: t("Gap"), range: t("{lo} to {hi}", { lo: model.formatLength(0), hi: model.formatLength(mm(50)) }),
        }) : null;
        state.gap = ui.length(t("Gap between cabinets"), state.gap, { min: 0, error: tooBig });
        state.align = choose(ui, t("Align"), state.align, /** @type {("back" | "front")[]} */ (["back", "front"]),
          names.align);
        if (ui.button(t("Align"), { primary: true, disabled: tooBig !== null })) {
          attempt(() => build.alignRow(groups.filter((g) => g.isValid), state.gap, state.align));
          ui.close();
        }
      },
    });
  }

  /**
   * Asks for a continuous worktop over the selected cabinets, with its cutouts, each centered on a
   * cabinet of the row and shifted by an offset.
   */
  function showWorktop() {
    const groups = build.getSelectedCabinets();
    const old = build.getSelectedWorktops();
    const previous = old.length > 0 ? build.getWorktop(old[0]) : null;
    const plan = build.planWorktop(groups, { topFinish: "Light stone", thickness: mm(30), overhang: 0, backsplash: 0 });
    const cabinets = plan.items.map((item) => item.cabinet);
    const source = cabinets.find((c) => c.worktop) ?? cabinets[0];
    const supports = plan.items.map((item, i) => `${i + 1}. ${item.cabinet.name}`);
    const options = {
      topFinish: previous?.topFinish ?? source.topFinish,
      thickness: previous?.thickness ?? source.topThickness,
      overhang: previous?.overhang ?? source.overhang,
      backsplash: previous?.backsplash ?? Math.max(...cabinets.map((c) => c.backsplash)),
    };
    const x0 = plan.items[0].x;
    /** @typedef {{ kind: CutoutKind, support: number, width: number, depth: number, offset: number, front: number }} Placement */
    /** Where a cutout centered on a support cabinet, shifted by offset, starts along the worktop. @param {Placement} cut */
    const startOf = (cut) => {
      const item = plan.items[cut.support];
      return item.x + item.cabinet.width / 2 + cut.offset - cut.width / 2 - x0;
    };
    /** @type {Placement[]} */
    let cuts = (previous?.cutouts ?? []).map((had) => {
      const center = x0 + had.x + had.width / 2;
      const support = Math.max(0, plan.items.findIndex((i) => center >= i.x && center <= i.x + i.cabinet.width));
      const item = plan.items[support];
      return { kind: had.kind, support, width: had.width, depth: had.depth, front: had.y,
        offset: center - (item.x + item.cabinet.width / 2) };
    });
    /** The worktop with the dialog's options and cutouts. */
    const getWorktop = () => {
      const fresh = build.planWorktop(groups.filter((g) => g.isValid), options);
      fresh.worktop.cutouts = cuts.map((cut) => ({
        kind: cut.kind, x: startOf(cut), y: cut.front, width: cut.width, depth: cut.depth,
      }));
      return fresh;
    };
    let error = "";
    context.showDialog({
      id: "worktop",
      title: t("Continuous Worktop"),
      draw(ui) {
        options.topFinish = choose(ui, t("Finish"), options.topFinish, Object.keys(recipe.TOPS), names.top);
        options.thickness = ui.length(t("Thickness"), options.thickness, { min: 0 });
        options.overhang = ui.length(t("Front overhang"), options.overhang, { min: 0 });
        options.backsplash = ui.length(t("Backsplash"), options.backsplash, { min: 0 });
        const top = { ...plan.worktop, ...options, thickness: options.thickness };
        const placed = cuts.map((cut) => ({ kind: cut.kind, x: startOf(cut), y: cut.front, width: cut.width,
          depth: cut.depth }));
        cuts = ui.list(t("Cutouts"), cuts, (cut, index) => {
          const own = recipe.checkCutout(top, placed[index]);
          const near = placed.some((other, i) => i !== index && recipe.overlap(placed[index], other));
          return {
            kind: choose(ui, t("Kind"), cut.kind, /** @type {CutoutKind[]} */ (["sink", "hob"]), names.cutout),
            support: Math.max(0, supports.indexOf(ui.dropdown(t("Support cabinet"), supports[cut.support], supports))),
            width: ui.length(t("Width"), cut.width, { min: 0, error: own ?? (near ? t("Too close to another cutout.") : null) }),
            depth: ui.length(t("Depth"), cut.depth, { min: 0 }),
            offset: ui.length(t("Horizontal offset"), cut.offset, { tip: t("From the middle of the support cabinet") }),
            front: ui.length(t("From the front edge"), cut.front, { min: 0 }),
          };
        }, {
          add: () => {
            const kind = cuts.some((c) => c.kind === "sink") ? "hob" : "sink";
            const [width, depth] = recipe.CUTOUT_SIZES[kind];
            return { kind, support: 0, width, depth, offset: 0, front: mm(70) };
          },
          remove: true, addLabel: t("Add Cutout"), removeLabel: t("Remove"),
          error: cuts.length > recipe.kMaxCutouts ? t("At most {n} cutouts.", { n: recipe.kMaxCutouts }) : null,
        });
        if (error !== "") ui.text(error, { tone: "error" });
        if (ui.button(t("Create Worktop"), { primary: true })) {
          try {
            const { worktop, pose } = getWorktop();
            build.addWorktop(groups, old, worktop, pose);
            ui.close();
          } catch (e) {
            if (!isUserError(e)) throw e;
            error = /** @type {Error} */ (e).message;
          }
        }
      },
    });
  }

  /** The cut list of the model, with where its cabinets and worktops are. */
  function getCutList() {
    const all = build.getAllInModel();
    if (all.cabinets.length === 0 && all.worktops.length === 0) {
      throw new recipe.KitchenError(t("There are no KitchenMaker cabinets in the model."));
    }
    return { all, rows: recipe.getCutList(all.cabinets, all.worktops) };
  }

  /** CSV rows of the cut list, in millimeters. @param {ReturnType<typeof getCutList>["rows"]} rows */
  const cutListCsv = (rows) => [
    [t("Ref."), t("Designation"), t("Material"), t("Length mm"), t("Width mm"), t("Thickness mm"), t("Qty"),
      t("Cabinets")],
    ...rows.map((row, i) => [i + 1, row.designation, names.material(row.kind, row.finish),
      ...row.size.map(toMm), row.quantity, row.sources.join(", ")]),
  ];

  /** The cost report of the model, with where its cabinets are. */
  function getCostReport() {
    const all = build.getAllInModel();
    return { all, report: recipe.getCostReport(all.cabinets) };
  }

  /** CSV rows of the cost report, lengths in millimeters. @param {ReturnType<typeof getCostReport>["report"]} report */
  const costReportCsv = (report) => [
    [t("Name"), t("Family"), t("Front"), t("Width mm"), t("Depth mm"), t("Height mm"), t("Finish"), t("Worktop"),
      t("Qty"), t("Currency"), t("Unit price"), t("Total")],
    ...report.rows.map(({ cabinet: c, quantity, currency, unitCents, totalCents }) => [c.name, names.family(c.family),
      names.style(c.style), toMm(c.width), toMm(c.depth), toMm(c.height), names.finish(c.finish),
      c.worktop ? t("Yes") : t("No"), quantity, currency, unitCents / 100, totalCents / 100]),
  ];

  /**
   * Asks where to save a CSV file and writes it in the user's spreadsheet format, with a byte order
   * mark so Excel reads accents.
   * @param {string} name @param {readonly (readonly unknown[])[]} rows header first
   */
  async function saveCsv(name, rows) {
    const file = await context.files.save({
      title: t("Export as CSV"), name, filters: [{ name: t("CSV spreadsheet"), extensions: ["csv"] }],
    });
    if (file === null) return;
    file.writeText(`﻿${context.formatCsv(rows.map((row) => row.map(safeCell)))}`);
    context.showMessage(t("{n} rows written to {file}", { n: rows.length - 1, file: file.name }));
  }

  /** Whether the user let the plugin show file dialogs, which exports need. */
  const canExport = () => context.permissions.filesDialog;
  /** Options of an export button: disabled, and saying why, without the file dialog permission. */
  const exportButton = () => ({
    primary: true, disabled: !canExport(),
    tip: canExport() ? t("Saves a CSV file for spreadsheets.") :
      t("Allow file dialogs for KitchenMaker in Extensions > Manage Extensions to export."),
  });

  /**
   * Starts a CSV export from a panel or dialog button, whose draw can't wait for the file dialog,
   * and tells the user if it fails.
   * @param {string} name @param {readonly (readonly unknown[])[]} rows
   */
  function startExport(name, rows) {
    saveCsv(name, rows).catch((error) => {
      context.alert(error instanceof Error ? error.message : String(error), { title: kTitle });
    });
  }

  /** Shows the cut list of the whole model. */
  function showCutList() {
    let { all, rows } = getCutList();
    context.showDialog({
      id: "cut-list",
      title: t("Cut List"),
      width: 900,
      height: 580,
      draw(ui) {
        ui.text(t("Finished sizes, length ≥ width ≥ thickness, but cutouts as width, depth, thickness; identical " +
          "parts grouped. Edge banding, grain and nesting aren't covered. Double-click a row to show its cabinets."),
        { tone: "muted" });
        warnScaled(ui, [...all.cabinetPlaces, ...all.worktopPlaces]);
        ui.table(t("Parts"), [t("Ref."), t("Designation"), t("Material"), { title: t("Length"), numeric: true },
          { title: t("Width"), numeric: true }, { title: t("Thickness"), numeric: true }, { title: t("Qty"), numeric: true },
          t("Cabinets")], rows.map((row, i) => ({
          id: String(i),
          cells: [i + 1, row.designation, names.material(row.kind, row.finish), ...row.size.map(model.formatLength),
            row.quantity, row.sources.join(", ")],
        })), null, {
          visibleRows: 14,
          onActivate(id) {
            const row = rows[Number(id)];
            showInModel([...row.cabinets.map((i) => all.cabinetPlaces[i]), ...row.worktops.map((i) => all.worktopPlaces[i])]);
          },
        });
        ui.heading(t("Totals by material"));
        ui.table(t("Totals"), [t("Material"), { title: t("Parts"), numeric: true }, { title: t("Area"), numeric: true }],
          recipe.getCutSummary(rows).map((sum, i) => ({
            id: String(i), cells: [names.material(sum.kind, sum.finish), sum.parts, model.formatArea(sum.area)],
          })), null, { visibleRows: 6 });
        ui.row(() => {
          if (ui.button(t("Export CSV..."), exportButton())) startExport(t("cut-list.csv"), cutListCsv(rows));
          if (ui.button(t("Refresh"))) attempt(() => ({ all, rows } = getCutList()));
        });
      },
    });
  }

  /** Shows the cost report of the whole model. */
  function showCostReport() {
    let { all, report } = getCostReport();
    context.showDialog({
      id: "cost-report",
      title: t("Cost Report"),
      width: 900,
      height: 500,
      draw(ui) {
        ui.text(t("Every cabinet of the model, nested groups included. An estimate: taxes, labor, waste and " +
          "installation aren't included. Double-click a row to show its cabinets."), { tone: "muted" });
        ui.table(t("Cabinets"), [t("Name"), t("Family"), t("Front"), { title: t("Width"), numeric: true },
          { title: t("Depth"), numeric: true }, { title: t("Height"), numeric: true }, t("Finish"), t("Worktop"),
          { title: t("Qty"), numeric: true }, t("Currency"), { title: t("Unit price"), numeric: true },
          { title: t("Total"), numeric: true }], report.rows.map((row, i) => ({
          id: String(i),
          cells: [row.cabinet.name, names.family(row.cabinet.family), names.style(row.cabinet.style),
            model.formatLength(row.cabinet.width), model.formatLength(row.cabinet.depth),
            model.formatLength(row.cabinet.height), names.finish(row.cabinet.finish),
            row.cabinet.worktop ? t("Yes") : t("No"), row.quantity, row.currency, formatMoney(row.unitCents),
            formatMoney(row.totalCents)],
        })), null, {
          visibleRows: 12,
          onActivate: (id) => showInModel(report.rows[Number(id)].indices.map((i) => all.cabinetPlaces[i])),
        });
        const totals = [...report.totals].sort(([a], [b]) => a.localeCompare(b))
          .map(([currency, cents]) => `${formatMoney(cents)} ${currency}`);
        ui.readOnly(t("Total"), totals.length > 0 ? totals.join(" + ") : t("no cabinets"));
        ui.row(() => {
          if (ui.button(t("Export CSV..."), exportButton())) {
            startExport(t("kitchen-cost-report.csv"), costReportCsv(report));
          }
          if (ui.button(t("Refresh"))) ({ all, report } = getCostReport());
        });
      },
    });
  }

  // ------------------------------------------------------------------------------ commands

  const oneCabinet = () => build.getSelectedCabinets().length === 1;
  const anyCabinet = () => build.getSelectedCabinets().length > 0;

  context.registerCommand({
    id: "library", title: t("Library"), tip: t("Opens the KitchenMaker panel: pick and set up a cabinet."),
    icon: "icons/library.svg", toolbar: true, run: () => panel.show(),
  });
  context.registerCommand({
    id: "add-right", title: t("Add to the Right"), tip: t("Adds the panel's cabinet right of the selected cabinet."),
    icon: "icons/add-next.svg", toolbar: true, when: "selection", contextMenu: true, isEnabled: oneCabinet,
    run: () => attempt(() => addBeside("right")),
  });
  context.registerCommand({
    id: "add-left", title: t("Add to the Left"), tip: t("Adds the panel's cabinet left of the selected cabinet."),
    when: "selection", contextMenu: true, isEnabled: oneCabinet, run: () => attempt(() => addBeside("left")),
  });
  context.registerCommand({
    id: "open-close", title: t("Open / Close"), tip: t("Opens or closes the doors and drawers of the selected cabinets."),
    icon: "icons/open-close.svg", toolbar: true, when: "selection", contextMenu: true, isEnabled: anyCabinet,
    run: () => attempt(() => build.changeCabinets(t("Open / Close"), build.getSelectedCabinets(), recipe.toggleOpening)),
  });
  context.registerCommand({
    id: "swap-hinge", title: t("Swap Hinge"),
    tip: t("Swaps the hinge side, or the blind side of a corner, of the selected cabinets."),
    icon: "icons/swap-hinge.svg", toolbar: true, when: "selection", contextMenu: true, isEnabled: anyCabinet,
    run: () => attempt(() => build.changeCabinets(t("Swap Hinge"), build.getSelectedCabinets(), recipe.swapHinge)),
  });
  context.registerCommand({
    id: "finishes", title: t("Finishes..."), tip: t("Changes the front finish of the selected cabinets."),
    icon: "icons/finishes.svg", toolbar: true, when: "selection", contextMenu: true, isEnabled: anyCabinet,
    run: showFinishes,
  });
  context.registerCommand({
    id: "align", title: t("Align in a Row..."), tip: t("Puts the selected cabinets side by side."),
    icon: "icons/align.svg", toolbar: true, when: "selection", contextMenu: true,
    isEnabled: () => build.getSelectedCabinets().length >= 2, run: () => attempt(showAlign),
  });
  context.registerCommand({
    id: "worktop", title: t("Continuous Worktop..."),
    tip: t("Lays one worktop, with sink and hob, over the selected row of base cabinets."),
    icon: "icons/worktop.svg", toolbar: true, when: "selection", contextMenu: true, isEnabled: anyCabinet,
    run: () => attempt(showWorktop),
  });
  context.registerCommand({
    id: "cut-list", title: t("Cut List"), tip: t("Lists the panels to cut for every cabinet of the model."),
    icon: "icons/cut-list.svg", toolbar: true, run: () => attempt(showCutList),
  });
  context.registerCommand({
    id: "cost-report", title: t("Cost Report"), tip: t("Prices every cabinet of the model."),
    icon: "icons/report.svg", toolbar: true, run: () => attempt(showCostReport),
  });
  context.registerCommand({
    id: "export-cut-list", title: t("Export Cut List..."), tip: t("Saves the cut list as CSV, in millimeters."),
    isEnabled: canExport,
    async run() {
      await saveCsv(t("cut-list.csv"), cutListCsv(getCutList().rows));
    },
  });
  context.registerCommand({
    id: "export-cost-report", title: t("Export Cost Report..."), tip: t("Saves the cost report as CSV."),
    isEnabled: canExport,
    async run() {
      await saveCsv(t("kitchen-cost-report.csv"), costReportCsv(getCostReport().report));
    },
  });
}
