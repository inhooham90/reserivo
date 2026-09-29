/**
 * The starter menu offered by the guided service setup. Only ids and a typical
 * duration live here; names are under `settings.serviceSetup.catalog` in each
 * language, so a business picks services named in the language it works in.
 *
 * There are deliberately no prices: a guessed price would be published to
 * clients the moment someone forgot to change it, so the setup asks for every
 * one. Durations are only a starting point and are shown before saving.
 */
export const SERVICE_TEMPLATES = {
  hair: {
    womensCut: 60,
    mensCut: 30,
    kidsCut: 30,
    blowout: 45,
    rootTouchUp: 90,
    allOverColor: 120,
    partialHighlights: 120,
    fullHighlights: 150,
    balayage: 180,
    toner: 30,
    keratin: 150,
    updo: 60,
  },
  barber: {
    haircut: 30,
    skinFade: 45,
    beardTrim: 20,
    cutAndBeard: 45,
    hotTowelShave: 30,
    lineUp: 15,
  },
  nails: {
    manicure: 30,
    gelManicure: 45,
    pedicure: 45,
    gelPedicure: 60,
    acrylicFullSet: 75,
    acrylicFill: 60,
    dipPowder: 60,
    nailArt: 15,
    gelRemoval: 15,
  },
  lashesBrows: {
    classicLashes: 120,
    volumeLashes: 150,
    lashFill: 60,
    lashLift: 60,
    browShaping: 20,
    browTint: 15,
    browLamination: 45,
  },
  skin: {
    facial: 60,
    expressFacial: 30,
    chemicalPeel: 45,
    browWax: 15,
    lipWax: 10,
    legWax: 45,
    bikiniWax: 30,
  },
  massage: {
    swedish60: 60,
    swedish90: 90,
    deepTissue: 60,
    prenatal: 60,
    hotStone: 75,
  },
  general: {
    consultation: 15,
    session30: 30,
    session60: 60,
  },
} as const satisfies Record<string, Record<string, number>>;

export type TemplateGroup = keyof typeof SERVICE_TEMPLATES;
export const TEMPLATE_GROUPS = Object.keys(SERVICE_TEMPLATES) as TemplateGroup[];

/** One-tap durations on the price-and-time step; anything else is in the "Other" select. */
export const QUICK_DURATIONS = [15, 30, 45, 60, 90, 120] as const;
