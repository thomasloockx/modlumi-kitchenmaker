// SPDX-License-Identifier: GPL-3.0-or-later
//
// The text KitchenMaker shows, in the user's language. The original KitchenMaker V.2 ships English
// and French, and so does this port; other languages fall back to English. Messages are keyed by
// their English text, like gettext, with {name} placeholders. Stored values, such as families and
// finishes, stay in English, so models keep working whatever language edits them.

/** @typedef {"en" | "fr"} Language */

/** @type {Language} */
let language = "en";

/**
 * Picks the language from the user's locale, such as "fr-BE"; English unless it is French.
 * @param {string} locale
 */
export function setLocale(locale) {
  language = /^fr\b/i.test(locale) ? "fr" : "en";
}

/** @type {Readonly<Record<string, string>>} */
const kFrench = {
  "{lo} to {hi}": "{lo} à {hi}",
  "{what}: {range}.": "{what} : {range}.",
  "Base cabinet": "Meuble bas",
  "Choose a supported cabinet family.": "Choisissez une famille d'armoire prise en charge.",
  "Choose a supported front style.": "Choisissez un style de façade pris en charge.",
  "Unknown finish.": "Finition inconnue.",
  "Enter a cabinet name (up to 120 characters).": "Saisissez un nom d'armoire (120 caractères au plus).",
  "Width": "Largeur",
  "Depth": "Profondeur",
  "Height": "Hauteur",
  "Panel thickness": "Épaisseur des panneaux",
  "Front gap": "Jeu entre façades",
  "Plinth": "Plinthe",
  "Wall cabinets have no plinth or worktop.": "Les meubles hauts n'ont ni plinthe ni plan de travail.",
  "The cabinet must leave room for its panels and an inside.":
    "L'armoire doit laisser la place à ses panneaux et à un espace intérieur.",
  "A filler must be taller than its plinth.": "La hauteur du fileur doit dépasser celle de sa plinthe.",
  "Corner cabinets are blind corners, on the left or the right.":
    "Les meubles d'angle sont des angles aveugles, à gauche ou à droite.",
  "A blind corner must be wider than deep by at least {size}.":
    "Un angle aveugle doit être plus large que profond d'au moins {size}.",
  "Use 0 to 8 shelves.": "Utilisez 0 à 8 étagères.",
  "Use 1 to 8 drawers.": "Utilisez 1 à 8 tiroirs.",
  "Too many shelves for this cabinet height.": "Trop d'étagères pour cette hauteur d'armoire.",
  "Drawer fronts must be at least {size} high.": "Les façades de tiroir doivent mesurer au moins {size} de haut.",
  "Opening: 0 to 110°.": "Ouverture : 0 à 110°.",
  "Worktop thickness": "Épaisseur du plan",
  "Front overhang": "Débord en façade",
  "Backsplash": "Crédence",
  "Enter a price of zero or more.": "Saisissez un prix positif ou nul.",
  "Enter a currency (up to 12 characters).": "Saisissez une devise (12 caractères au plus).",
  "An appliance niche needs {height} of usable height and {width} of width.":
    "Une niche d'électroménager exige {height} de hauteur utile et {width} de largeur.",
  "“{name}” has no usable thickness; adjust the dimensions.":
    "« {name} » n'a pas d'épaisseur utilisable ; ajustez les dimensions.",
  "Filler face": "Face du fileur",
  "Left side": "Côté gauche",
  "Right side": "Côté droit",
  "Bottom panel": "Panneau bas",
  "Back panel": "Panneau arrière",
  "Top panel": "Panneau haut",
  "Recessed plinth": "Plinthe en retrait",
  "Leg {i}-{j}": "Pied {i}-{j}",
  "Shelf {n}": "Étagère {n}",
  "{front} {part}": "{front} {part}",
  "left frame": "cadre gauche",
  "right frame": "cadre droit",
  "bottom frame": "cadre bas",
  "top frame": "cadre haut",
  "glass": "vitre",
  "handle": "poignée",
  "tray bottom": "fond de bac",
  "tray left": "bac gauche",
  "tray right": "bac droit",
  "tray back": "bac arrière",
  "Drawer {n}": "Tiroir {n}",
  "Niche shelf": "Tablette de niche",
  "Upper door": "Porte haute",
  "Blind corner panel": "Joue aveugle d'angle",
  "Corner door": "Porte d'angle",
  "Left door": "Porte gauche",
  "Right door": "Porte droite",
  "Door": "Porte",
  "Worktop": "Plan de travail",
  "Worktop length": "Longueur du plan",
  "Thickness": "Épaisseur",
  "Backsplash thickness": "Épaisseur de crédence",
  "At most {n} cutouts.": "{n} découpes au plus.",
  "Cutouts must be at least {size} apart.": "Deux découpes doivent être distantes d'au moins {size}.",
  "A cutout must stay at least {size} from the edges of the worktop.":
    "Une découpe doit rester à {size} au moins des bords du plan.",
  "Continuous worktop": "Plan de travail continu",
  "Sink cutout": "Découpe évier",
  "Hob cutout": "Découpe plaque",
  "Continuous worktop (x = {x}, y = {y})": "Plan continu (x = {x}, y = {y})",
  "Front {finish}": "Façade {finish}",
  "Worktop {finish}": "Plan {finish}",
  "The cabinets must face the same way to make a row.":
    "Les armoires doivent avoir la même orientation pour former une rangée.",
  "Select at least two cabinets.": "Sélectionnez au moins deux armoires.",
  "Align in a Row": "Aligner en rangée",
  "Edit Worktop": "Modifier le plan de travail",
  "Select at least one cabinet of the row.": "Sélectionnez au moins une armoire de la rangée.",
  "Leave wall cabinets out of the selection: the worktop covers base cabinets.":
    "Retirez les meubles hauts de la sélection : le plan continu couvre les meubles bas.",
  "The cabinets aren't all the same height ({size} apart).":
    "Les armoires n'ont pas toutes la même hauteur (écart de {size}).",
  "The cabinets don't touch ({size} apart). Align them in a row first.":
    "Les armoires ne se touchent pas (jeu de {size}). Utilisez d'abord Aligner en rangée.",
  "Continuous Worktop": "Plan de travail continu",
  "{family} {style} {width}": "{family} {style} {width}",
  "Cabinet": "Armoire",
  "Name": "Nom",
  "Family": "Famille",
  "Front": "Façade",
  "Shelves": "Étagères",
  "Drawers": "Tiroirs",
  "Front finish": "Finition des façades",
  "Hinge": "Charnière",
  "Hinge side of a single door": "Côté des charnières d'une porte simple",
  "Details": "Détails",
  "Opening": "Ouverture",
  "Opens the doors and pulls out the drawers, for views": "Ouvre les portes et sort les tiroirs, pour les vues",
  "Handles": "Poignées",
  "Worktop finish": "Finition du plan",
  "Price": "Prix",
  "Unit price": "Prix unitaire",
  "Whole cabinet, worktop and hardware included": "Armoire complète, plan et quincaillerie compris",
  "Currency": "Devise",
  "Some of these are inside other groups; open them to select them.":
    "Certaines sont dans d'autres groupes ; ouvrez-les pour les sélectionner.",
  "Add Cabinet": "Créer une armoire",
  "Select one KitchenMaker cabinet.": "Sélectionnez une seule armoire KitchenMaker.",
  "Add Cabinet Beside": "Ajouter une armoire à côté",
  "Library": "Bibliothèque",
  "Category": "Catégorie",
  "Model": "Modèle",
  "Placement": "Placement",
  "Place with the Mouse": "Placer à la souris",
  "Height to place at; 1.5 m for a wall cabinet": "Hauteur de pose ; 1,5 m pour un meuble haut",
  "Rotation": "Rotation",
  "About the vertical axis": "Autour de l'axe vertical",
  "Add at Coordinates": "Créer aux coordonnées",
  "Gap to the selection": "Jeu avec la sélection",
  "Left of Selection": "À gauche de la sélection",
  "Right of Selection": "À droite de la sélection",
  "Place Cabinet": "Placer une armoire",
  "Puts the KitchenMaker panel's cabinet down where you click.":
    "Pose l'armoire du panneau KitchenMaker là où vous cliquez.",
  "Click to place the cabinet; X turns it by 90°, or type an angle. Esc stops.":
    "Cliquez pour poser l'armoire ; X la tourne de 90°, ou tapez un angle. Échap pour arrêter.",
  "Type a rotation in degrees, such as 90.": "Tapez une rotation en degrés, par exemple 90.",
  "About the vertical axis; X turns it by 90°": "Autour de l'axe vertical ; X la tourne de 90°",
  "Edit the Cabinet...": "Modifier l'armoire...",
  "KitchenMaker Cabinet": "Armoire KitchenMaker",
  "Edit Cabinet": "Modifier une armoire",
  "Open / Close": "Ouvrir / fermer",
  "Swap Hinge": "Inverser la charnière",
  "Kind": "Type",
  "From the left end": "Depuis l'extrémité gauche",
  "From the front edge": "Depuis le bord avant",
  "KitchenMaker Worktop": "Plan de travail KitchenMaker",
  "Length": "Longueur",
  "Finish": "Finition",
  "Cutouts": "Découpes",
  "Too close to another cutout.": "Trop près d'une autre découpe.",
  "Add Cutout": "Ajouter une découpe",
  "Remove": "Retirer",
  "To move it with the cabinets, select them and this worktop, then use Continuous Worktop.":
    "Pour le refaire sur les meubles, sélectionnez-les avec ce plan, puis Plan de travail continu.",
  "Finishes": "Finitions",
  "{n} cabinet(s) selected": "{n} armoire(s) sélectionnée(s)",
  "Apply": "Appliquer",
  "Gap": "Jeu",
  "Gap between cabinets": "Jeu entre armoires",
  "Align": "Aligner",
  "Support cabinet": "Meuble support",
  "Horizontal offset": "Décalage horizontal",
  "From the middle of the support cabinet": "Depuis le milieu du meuble support",
  "Create Worktop": "Créer le plan",
  "There are no KitchenMaker cabinets in the model.": "Aucune armoire KitchenMaker dans le modèle.",
  "Ref.": "Réf.",
  "Designation": "Désignation",
  "Material": "Matière",
  "Length mm": "Longueur mm",
  "Width mm": "Largeur mm",
  "Thickness mm": "Épaisseur mm",
  "Qty": "Qté",
  "Cabinets": "Armoires",
  "Depth mm": "Profondeur mm",
  "Height mm": "Hauteur mm",
  "Total": "Total",
  "Yes": "Oui",
  "No": "Non",
  "Export as CSV": "Exporter en CSV",
  "CSV spreadsheet": "Tableur CSV",
  "{n} rows written to {file}": "{n} lignes écrites dans {file}",
  "Cut List": "Liste de débit",
  "Finished sizes, length ≥ width ≥ thickness; identical parts grouped. Edge banding, grain and nesting aren't covered. Double-click a row to show its cabinets.":
    "Dimensions finies, longueur ≥ largeur ≥ épaisseur ; pièces identiques regroupées. Les chants, le sens " +
    "du fil et l'optimisation de découpe ne sont pas traités. Double-cliquez une ligne pour montrer ses armoires.",
  "Parts": "Pièces",
  "Totals by material": "Totaux par matière",
  "Totals": "Totaux",
  "Area": "Surface",
  "Export CSV...": "Exporter en CSV...",
  "cut-list.csv": "liste-de-debit.csv",
  "Refresh": "Actualiser",
  "Cost Report": "Rapport de coûts",
  "Every cabinet of the model, nested groups included. An estimate: taxes, labor, waste and installation aren't included. Double-click a row to show its cabinets.":
    "Toutes les armoires du modèle, groupes imbriqués compris. Estimation : taxes, main-d'œuvre, chutes et " +
    "pose non incluses. Double-cliquez une ligne pour montrer ses armoires.",
  "no cabinets": "aucune armoire",
  "kitchen-cost-report.csv": "rapport-couts-cuisine.csv",
  "Opens the KitchenMaker panel: pick and set up a cabinet.":
    "Ouvre le panneau KitchenMaker : choix et réglage de l'armoire.",
  "Add to the Right": "Ajouter à droite",
  "Adds the panel's cabinet right of the selected cabinet.":
    "Ajoute l'armoire du panneau à droite de l'armoire sélectionnée.",
  "Add to the Left": "Ajouter à gauche",
  "Adds the panel's cabinet left of the selected cabinet.":
    "Ajoute l'armoire du panneau à gauche de l'armoire sélectionnée.",
  "Opens or closes the doors and drawers of the selected cabinets.":
    "Ouvre ou ferme les portes et tiroirs des armoires sélectionnées.",
  "Swaps the hinge side, or the blind side of a corner, of the selected cabinets.":
    "Change le côté des charnières, ou de l'angle aveugle, des armoires sélectionnées.",
  "Finishes...": "Finitions...",
  "Changes the front finish of the selected cabinets.": "Change la finition des façades des armoires sélectionnées.",
  "Align in a Row...": "Aligner en rangée...",
  "Puts the selected cabinets side by side.": "Met les armoires sélectionnées côte à côte.",
  "Continuous Worktop...": "Plan de travail continu...",
  "Lays one worktop, with sink and hob, over the selected row of base cabinets.":
    "Pose un seul plan, avec évier et plaque, sur la rangée de meubles bas sélectionnée.",
  "Lists the panels to cut for every cabinet of the model.":
    "Liste les panneaux à découper pour toutes les armoires du modèle.",
  "Prices every cabinet of the model.": "Chiffre toutes les armoires du modèle.",
  "Export Cut List...": "Exporter la liste de débit...",
  "Saves the cut list as CSV, in millimeters.": "Enregistre la liste de débit en CSV, en millimètres.",
  "Export Cost Report...": "Exporter le rapport de coûts...",
  "Saves the cost report as CSV.": "Enregistre le rapport de coûts en CSV.",
  "Saves a CSV file for spreadsheets.": "Enregistre un fichier CSV pour tableur.",
  "Allow file dialogs for KitchenMaker in Extensions > Manage Extensions to export.":
    "Autorisez les dialogues de fichiers pour KitchenMaker dans Extensions > Manage Extensions pour exporter.",
};

/**
 * The text in the user's language, with each {name} replaced by vars[name].
 * @param {string} text English text @param {Readonly<Record<string, unknown>>} [vars]
 */
export function t(text, vars = {}) {
  const translated = language === "fr" ? kFrench[text] ?? text : text;
  return translated.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

/**
 * Display names of stored values, by language; English names are the stored values unless listed.
 * @type {Readonly<Record<string, Readonly<Record<Language, Readonly<Record<string, string>>>>>>}
 */
const kNames = {
  family: {
    en: { "Base": "Base", "Wall": "Wall", "Tall": "Tall", "High": "Extra tall" },
    fr: { "Base": "Meuble bas", "Wall": "Meuble haut", "Tall": "Colonne", "High": "Colonne haute",
      "Base corner": "Angle bas", "Wall corner": "Angle haut", "Filler": "Fileur" },
  },
  style: {
    en: {},
    fr: { "Single door": "Porte simple", "Double doors": "Deux portes", "Drawers": "Tiroirs",
      "Drawer + doors": "Tiroir + portes", "Open shelves": "Étagères ouvertes", "Glass doors": "Portes vitrées",
      "Appliance niche": "Niche électroménager", "Blind left": "Angle aveugle gauche",
      "Blind right": "Angle aveugle droit" },
  },
  finish: {
    en: {},
    fr: { "Warm white": "Blanc chaud", "Graphite": "Graphite", "Sand": "Sable", "Sage": "Sauge",
      "Ocean blue": "Bleu océan", "Walnut tone": "Ton noyer" },
  },
  top: {
    en: {},
    fr: { "Light stone": "Pierre claire", "Dark stone": "Pierre sombre", "Timber tone": "Ton bois" },
  },
  hinge: { en: {}, fr: { "Left": "Gauche", "Right": "Droite" } },
  align: {
    en: { back: "Back (wall)", front: "Front" },
    fr: { back: "Dos (mur)", front: "Façade" },
  },
  cutout: { en: { sink: "Sink", hob: "Hob" }, fr: { sink: "Évier", hob: "Plaque de cuisson" } },
  role: {
    en: { body: "Carcass", drawerBox: "Drawer box", plinth: "Plinth", metal: "Hardware", glass: "Glass",
      front: "Front", top: "Worktop" },
    fr: { body: "Caisson", drawerBox: "Bac de tiroir", plinth: "Plinthe", metal: "Quincaillerie", glass: "Verre",
      front: "Façade", top: "Plan de travail" },
  },
  kind: {
    en: { carcass: "Carcass", drawer_box: "Drawer box", front: "Front", glass: "Glass", top: "Worktop",
      plinth: "Plinth", hardware: "Hardware", cutout: "Cutout" },
    fr: { carcass: "Caisson", drawer_box: "Bac de tiroir", front: "Façade", glass: "Verre", top: "Plan de travail",
      plinth: "Plinthe", hardware: "Quincaillerie", cutout: "Découpe" },
  },
};

/** @param {string} map @returns {(value: string) => string} */
const nameIn = (map) => (value) => kNames[map][language][value] ?? kNames[map].en[value] ?? value;

/** Display names of stored values in the user's language. */
export const names = {
  family: nameIn("family"),
  style: nameIn("style"),
  finish: nameIn("finish"),
  top: nameIn("top"),
  hinge: nameIn("hinge"),
  align: nameIn("align"),
  cutout: nameIn("cutout"),
  role: nameIn("role"),
  /**
   * A cut list material: the kind of part, with its finish for fronts and worktops.
   * @param {string} kind @param {string | null} finish
   */
  material(kind, finish) {
    const label = nameIn("kind")(kind);
    if (finish === null) return label;
    return `${label} - ${kind === "top" ? nameIn("top")(finish) : nameIn("finish")(finish)}`;
  },
};
