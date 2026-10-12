# KitchenMaker pour Modlumi

Armoires de cuisine paramétriques pour Modlumi, d'après **IngeTrazo KitchenMaker V.2** pour
SketchUp 2017. Licence GPL-3.0-or-later, comme l'original.

L'interface suit la langue de l'utilisateur : français ou anglais, comme l'original ; les autres
langues retombent sur l'anglais. Les nombres des rapports et des CSV suivent les réglages
régionaux (séparateur décimal, séparateur de colonnes du tableur). Les valeurs enregistrées dans
le modèle restent en anglais, si bien qu'un modèle s'ouvre dans n'importe quelle langue.

## Installation

Modlumi Desktop : **Extensions › Manage Extensions... › Install plugin...**, puis choisissez le
fichier `plugin.json` de ce dossier. Autorisez les « dialogues de fichiers » pour exporter les
CSV ; sans cette permission, les boutons d'export restent grisés et disent pourquoi.

Requiert une version de Modlumi qui offre les fonctions `viewport`, `files`, `toolSelection`,
`propertiesWhen`, `previewBoxes`, `materialLookup`, `formValidation`, `listWidget`, `locale` et
`numberFormat` ; une version plus ancienne refuse l'extension en le disant.

## Utilisation

- **Extensions › KitchenMaker › Bibliothèque** ouvre le panneau : catégorie, modèle, puis tous les
  réglages de l'armoire. Une valeur refusée s'affiche en rouge sous son champ.
- **Placer à la souris** (dans le panneau) ou **Placer une armoire** choisit l'outil de pose : un
  clic pose l'armoire avec l'inférence de Modlumi, **X** la tourne de 90°, et taper un angle puis
  Entrée la tourne de cet angle. Le panneau peut aussi la créer à des coordonnées exactes, ou à
  gauche ou à droite de l'armoire sélectionnée.
- Sélectionnez une armoire ou un plan de travail : ses réglages apparaissent dans **Propriétés**,
  et chaque changement le reconstruit (une seule étape d'annulation). Les découpes d'un plan s'y
  ajoutent, s'y retirent et s'y déplacent.
- Clic droit sur des armoires : Ajouter à droite / à gauche, Ouvrir / fermer, Inverser la
  charnière, Finitions…, Aligner en rangée…, Plan de travail continu….
- **Plan de travail continu…** pose un seul plan sur une rangée de meubles bas, avec autant de
  découpes d'évier ou de plaque que voulu (six au plus), chacune centrée sur un meuble support.
- **Liste de débit** et **Rapport de coûts** s'affichent dans des fenêtres. Double-cliquez une
  ligne pour sélectionner ses armoires et les montrer ; **Exporter en CSV…** les enregistre pour
  un tableur (longueurs en millimètres).

## Différences avec la version SketchUp

- Les longueurs suivent les unités du modèle Modlumi ; les CSV restent en millimètres.
- Les portes et tiroirs sont des groupes qui pivotent ou coulissent ; chaque pièce est un solide.
- L'évier et la plaque sont de vrais trous percés par booléen dans le plan de travail.
- Les armoires créées par la version SketchUp ne sont pas reconnues : Modlumi n'importe pas les
  dictionnaires d'attributs des fichiers .skp (ticket #132).
- Les armoires dans des groupes ou composants imbriqués figurent dans les rapports, mais le
  double-clic ne peut les sélectionner que si leur groupe est ouvert.

## CHANGES (2.2.0, par rapport à la 2.1.0)

- Interface en anglais et en français selon `context.locale` (la 2.1.0 était en français seul) ;
  noms des matériaux et des pièces dans la langue de l'utilisateur.
- Aperçu de l'outil de pose avec `view.box` au lieu de douze segments tracés à la main par boîte.
- Matériaux retrouvés avec `model.getMaterial` au lieu d'un parcours de `model.materials`.
- **X** tourne l'armoire de 90° pendant la pose, et un angle tapé la règle (la 2.1.0 n'avait que
  le champ Rotation de la carte d'outil). Le panneau sélectionne l'outil par un bouton.
- Erreurs de validation sous le champ en cause (option `error`) au lieu d'un message en bas.
- Deux sections Propriétés, armoire et plan, filtrées par `when` au lieu d'une section commune.
- Découpes en liste (`ui.list`) : nombre libre jusqu'à six, au lieu d'un évier et d'une plaque
  fixes ; elles se modifient aussi depuis les Propriétés du plan.
- Double-clic sur une ligne de la liste de débit ou du rapport de coûts (`onActivate`) :
  sélectionne les armoires et y amène la caméra.
- CSV avec `context.formatCsv` et montants avec `context.formatNumber`, selon les réglages
  régionaux, au lieu de points-virgules et de virgules décimales codés en dur. Boutons d'export
  dans les fenêtres de rapport, en plus des commandes.
