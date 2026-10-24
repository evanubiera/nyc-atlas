/**
 * Offense classification.
 *
 * The NYPD `ofns_desc` field is truncated at ~30 characters, and the truncation
 * is INCONSISTENT between the current and historic datasets. Verified 2026-10-24:
 * 75 distinct values across `5uac-w243` + `qgea-i56i`, including near-duplicate
 * pairs that would silently split a category if matched loosely:
 *
 *   'OTHER OFFENSES RELATED TO THEF'   vs  'OTHER OFFENSES RELATED TO THEFT'
 *   'OTHER STATE LAWS (NON PENAL LA'   vs  'OTHER STATE LAWS (NON PENAL LAW)'
 *   'ADMINISTRATIVE CODE'              vs  'ADMINISTRATIVE CODES'
 *   'INTOXICATED & IMPAIRED DRIVING'   vs  'INTOXICATED/IMPAIRED DRIVING'
 *   'KIDNAPPING' / 'KIDNAPPING & RELATED OFFENSES' / 'KIDNAPPING AND RELATED OFFENSES'
 *   'CHILD ABANDONMENT/NON SUPPORT'    vs  'CHILD ABANDONMENT/NON SUPPORT 1'
 *
 * Missing values are NOT SQL nulls. Verified 2026-10-24: `ofns_desc IS NULL`
 * matches ZERO rows, while `ofns_desc = '(null)'` matches 18,907 rows in the
 * historic set and 3 in the current set. The absent value is the literal
 * six-character string "(null)". A naive null check finds nothing and the
 * sentinel passes through as though it were a real offense category.
 *
 * Those rows are recoverable: they carry a usable `pd_desc` (e.g.
 * 'SALE OF UNAUTHORIZED RECORDING', 'CRIM POS WEAP 4') and `ky_cd`, so
 * `classifyOffense` accepts a `pd_desc` fallback rather than discarding them.
 *
 * Every variant is therefore mapped EXPLICITLY on its exact raw string. Never
 * normalize, prettify or prefix-match these — that is how the variants merge
 * incorrectly or fall through to UNKNOWN.
 */

export type CrimeCategory =
  | 'VIOLENT_PERSON'
  | 'VIOLENT_PROPERTY'
  | 'PROPERTY'
  | 'FRAUD'
  | 'WEAPONS'
  | 'DRUGS'
  | 'DISORDER'
  | 'TRAFFIC'
  | 'ADMINISTRATIVE'
  | 'SHOOTING'
  | 'UNKNOWN';

export const CRIME_CATEGORIES: readonly CrimeCategory[] = [
  'VIOLENT_PERSON',
  'VIOLENT_PROPERTY',
  'PROPERTY',
  'FRAUD',
  'WEAPONS',
  'DRUGS',
  'DISORDER',
  'TRAFFIC',
  'ADMINISTRATIVE',
  'SHOOTING',
  'UNKNOWN',
] as const;

export interface CrimeCategoryMeta {
  readonly label: string;
  readonly description: string;
  /**
   * True when the count reflects police deployment at least as much as
   * underlying behaviour. These are excluded from the default view and must
   * carry a caveat wherever shown. See specs/007-methodology.md §3.
   */
  readonly isEnforcementDriven: boolean;
}

export const CRIME_CATEGORY_META: Readonly<Record<CrimeCategory, CrimeCategoryMeta>> = {
  VIOLENT_PERSON: {
    label: 'Violence against a person',
    description: 'Homicide, rape, felony and misdemeanor assault, sex offenses, kidnapping.',
    isEnforcementDriven: false,
  },
  VIOLENT_PROPERTY: {
    label: 'Robbery & burglary',
    description: 'Property crimes involving force, the threat of force, or unlawful entry.',
    isEnforcementDriven: false,
  },
  PROPERTY: {
    label: 'Property crime',
    description: 'Larceny, motor vehicle theft, criminal mischief, arson, stolen property.',
    isEnforcementDriven: false,
  },
  FRAUD: {
    label: 'Fraud & forgery',
    description: 'Forgery, fraud, theft of services. Often reported where the victim lives or banks, not where the act occurred.',
    isEnforcementDriven: false,
  },
  WEAPONS: {
    label: 'Weapons offenses',
    description: 'Dangerous weapons possession and related offenses. Partly enforcement-driven: counts rise with stop activity.',
    isEnforcementDriven: true,
  },
  DRUGS: {
    label: 'Drug offenses',
    description: 'Enforcement-driven. Reflects where drug policing is concentrated, not where drug use occurs.',
    isEnforcementDriven: true,
  },
  DISORDER: {
    label: 'Disorder & quality of life',
    description: 'Harassment, trespass, public order offenses. Highly sensitive to both reporting propensity and enforcement priorities.',
    isEnforcementDriven: true,
  },
  TRAFFIC: {
    label: 'Traffic offenses',
    description: 'Enforcement-driven. Concentrates on arterial roads and checkpoint locations.',
    isEnforcementDriven: true,
  },
  ADMINISTRATIVE: {
    label: 'Administrative & other',
    description: 'Unclassified statute violations and offenses against public administration.',
    isEnforcementDriven: true,
  },
  SHOOTING: {
    label: 'Shooting incidents',
    description: 'The primary outcome measure. Least affected by reporting bias — a gunshot wound reaches a hospital regardless of trust in police.',
    isEnforcementDriven: false,
  },
  UNKNOWN: {
    label: 'Unclassified',
    description: 'Source value was null or absent from the mapping table. Surfaced rather than dropped.',
    isEnforcementDriven: false,
  },
};

/**
 * Exact-match map from raw `ofns_desc` to analysis category.
 * All 75 observed values across `5uac-w243` and `qgea-i56i` (verified 2026-10-24).
 */
export const OFFENSE_TO_CATEGORY: Readonly<Record<string, CrimeCategory>> = {
  // --- Violence against a person -------------------------------------------
  'MURDER & NON-NEGL. MANSLAUGHTER': 'VIOLENT_PERSON',
  'HOMICIDE-NEGLIGENT,UNCLASSIFIE': 'VIOLENT_PERSON',
  'HOMICIDE-NEGLIGENT-VEHICLE': 'VIOLENT_PERSON',
  RAPE: 'VIOLENT_PERSON',
  'FELONY ASSAULT': 'VIOLENT_PERSON',
  'ASSAULT 3 & RELATED OFFENSES': 'VIOLENT_PERSON',
  'SEX CRIMES': 'VIOLENT_PERSON',
  'FELONY SEX CRIMES': 'VIOLENT_PERSON',
  'OFFENSES AGAINST THE PERSON': 'VIOLENT_PERSON',
  KIDNAPPING: 'VIOLENT_PERSON',
  'KIDNAPPING & RELATED OFFENSES': 'VIOLENT_PERSON',
  'KIDNAPPING AND RELATED OFFENSES': 'VIOLENT_PERSON',
  'OFFENSES RELATED TO CHILDREN': 'VIOLENT_PERSON',
  'CHILD ABANDONMENT/NON SUPPORT': 'VIOLENT_PERSON',
  'CHILD ABANDONMENT/NON SUPPORT 1': 'VIOLENT_PERSON',
  'ENDAN WELFARE INCOMP': 'VIOLENT_PERSON',
  ABORTION: 'VIOLENT_PERSON',

  // --- Robbery & burglary ---------------------------------------------------
  ROBBERY: 'VIOLENT_PROPERTY',
  BURGLARY: 'VIOLENT_PROPERTY',

  // --- Property -------------------------------------------------------------
  'PETIT LARCENY': 'PROPERTY',
  'PETIT LARCENY OF MOTOR VEHICLE': 'PROPERTY',
  'GRAND LARCENY': 'PROPERTY',
  'GRAND LARCENY OF MOTOR VEHICLE': 'PROPERTY',
  'OTHER OFFENSES RELATED TO THEF': 'PROPERTY',
  'OTHER OFFENSES RELATED TO THEFT': 'PROPERTY',
  'CRIMINAL MISCHIEF & RELATED OF': 'PROPERTY',
  ARSON: 'PROPERTY',
  'POSSESSION OF STOLEN PROPERTY': 'PROPERTY',
  'UNAUTHORIZED USE OF A VEHICLE': 'PROPERTY',
  "BURGLAR'S TOOLS": 'PROPERTY',
  JOSTLING: 'PROPERTY',

  // --- Fraud ----------------------------------------------------------------
  FORGERY: 'FRAUD',
  FRAUDS: 'FRAUD',
  'THEFT-FRAUD': 'FRAUD',
  'OFFENSES INVOLVING FRAUD': 'FRAUD',
  'FRAUDULENT ACCOSTING': 'FRAUD',
  'THEFT OF SERVICES': 'FRAUD',

  // --- Weapons --------------------------------------------------------------
  'DANGEROUS WEAPONS': 'WEAPONS',
  'UNLAWFUL POSS. WEAP. ON SCHOOL': 'WEAPONS',

  // --- Drugs ----------------------------------------------------------------
  'DANGEROUS DRUGS': 'DRUGS',
  'CANNABIS RELATED OFFENSES': 'DRUGS',
  'UNDER THE INFLUENCE OF DRUGS': 'DRUGS',
  'LOITERING FOR DRUG PURPOSES': 'DRUGS',

  // --- Disorder / quality of life ------------------------------------------
  'HARRASSMENT 2': 'DISORDER',
  'OFF. AGNST PUB ORD SENSBLTY &': 'DISORDER',
  'CRIMINAL TRESPASS': 'DISORDER',
  'DISORDERLY CONDUCT': 'DISORDER',
  'ALCOHOLIC BEVERAGE CONTROL LAW': 'DISORDER',
  LOITERING: 'DISORDER',
  'LOITERING/DEVIATE SEX': 'DISORDER',
  'LOITERING/GAMBLING (CARDS, DIC': 'DISORDER',
  GAMBLING: 'DISORDER',
  'PROSTITUTION & RELATED OFFENSES': 'DISORDER',
  'DISRUPTION OF A RELIGIOUS SERV': 'DISORDER',
  'FORTUNE TELLING': 'DISORDER',
  'OFFENSES AGAINST PUBLIC SAFETY': 'DISORDER',
  'OFFENSES AGAINST MARRIAGE UNCL': 'DISORDER',

  // --- Traffic --------------------------------------------------------------
  'VEHICLE AND TRAFFIC LAWS': 'TRAFFIC',
  'INTOXICATED & IMPAIRED DRIVING': 'TRAFFIC',
  'INTOXICATED/IMPAIRED DRIVING': 'TRAFFIC',
  'OTHER TRAFFIC INFRACTION': 'TRAFFIC',

  // --- Administrative / unclassified ---------------------------------------
  'ADMINISTRATIVE CODE': 'ADMINISTRATIVE',
  'ADMINISTRATIVE CODES': 'ADMINISTRATIVE',
  'MISCELLANEOUS PENAL LAW': 'ADMINISTRATIVE',
  'OFFENSES AGAINST PUBLIC ADMINI': 'ADMINISTRATIVE',
  'OTHER STATE LAWS': 'ADMINISTRATIVE',
  'OTHER STATE LAWS (NON PENAL LA': 'ADMINISTRATIVE',
  'OTHER STATE LAWS (NON PENAL LAW)': 'ADMINISTRATIVE',
  'NYS LAWS-UNCLASSIFIED FELONY': 'ADMINISTRATIVE',
  'NYS LAWS-UNCLASSIFIED VIOLATION': 'ADMINISTRATIVE',
  'NEW YORK CITY HEALTH CODE': 'ADMINISTRATIVE',
  'AGRICULTURE & MRKTS LAW-UNCLASSIFIED': 'ADMINISTRATIVE',
  'ANTICIPATORY OFFENSES': 'ADMINISTRATIVE',
  'ESCAPE 3': 'ADMINISTRATIVE',
};

/**
 * String values that mean "missing" in NYPD exports despite not being SQL nulls.
 * `ofns_desc IS NULL` matches zero rows; the literal '(null)' matches ~18,910.
 */
export const NULL_SENTINEL_VALUES: ReadonlySet<string> = new Set(['(null)', 'null', 'NULL', 'N/A', '']);

export function isNullish(value: string | null | undefined): boolean {
  return value === null || value === undefined || NULL_SENTINEL_VALUES.has(value.trim());
}

/**
 * Inverse of `isNullish`, written as a type predicate so callers get narrowing.
 * A plain `!isNullish(x)` does not narrow `string | null | undefined` to `string`.
 */
export function hasValue(value: string | null | undefined): value is string {
  return !isNullish(value);
}

/**
 * Fallback classification from `pd_desc` for rows whose `ofns_desc` is the
 * '(null)' sentinel. `pd_desc` is the finer-grained internal code description
 * and is populated on those rows. Matched on substring because `pd_desc` has
 * far higher cardinality than `ofns_desc` and is not worth enumerating.
 *
 * Order matters: the first match wins, so narrower patterns come first.
 */
const PD_DESC_FALLBACK: readonly (readonly [pattern: string, category: CrimeCategory])[] = [
  ['WEAP', 'WEAPONS'],
  ['ASSAULT', 'VIOLENT_PERSON'],
  ['HOMICIDE', 'VIOLENT_PERSON'],
  ['MURDER', 'VIOLENT_PERSON'],
  ['RAPE', 'VIOLENT_PERSON'],
  ['SODOMY', 'VIOLENT_PERSON'],
  ['SEX', 'VIOLENT_PERSON'],
  ['OBSCENITY', 'DISORDER'],
  ['ROBBERY', 'VIOLENT_PROPERTY'],
  ['BURGLARY', 'VIOLENT_PROPERTY'],
  ['LARCENY', 'PROPERTY'],
  ['MISCHIEF', 'PROPERTY'],
  ['STOLEN', 'PROPERTY'],
  ['ARSON', 'PROPERTY'],
  ['FRAUD', 'FRAUD'],
  ['FORGERY', 'FRAUD'],
  ['DRUG', 'DRUGS'],
  ['MARIJUANA', 'DRUGS'],
  ['CONTROLLED SUBSTANCE', 'DRUGS'],
  ['TRESPASS', 'DISORDER'],
  ['HARASS', 'DISORDER'],
  ['FALSE REPORT', 'ADMINISTRATIVE'],
  ['UNAUTHORIZED RECORDING', 'PROPERTY'],
  ['TRAFFIC', 'TRAFFIC'],
  ['INTOXICAT', 'TRAFFIC'],
];

export interface OffenseClassification {
  readonly category: CrimeCategory;
  /** True when the raw value was present but absent from the mapping table. */
  readonly unmapped: boolean;
  /** True when the category came from the `pd_desc` fallback, not `ofns_desc`. */
  readonly viaFallback: boolean;
}

/**
 * Classifies an offense.
 *
 * Resolution order:
 *   1. Exact match on `ofns_desc`
 *   2. If `ofns_desc` is missing or a '(null)' sentinel, substring match on `pd_desc`
 *   3. UNKNOWN
 *
 * `unmapped` distinguishes "source said nothing" from "source said something we
 * do not recognise", so ingest can report genuinely new offense labels instead of
 * silently absorbing them. See specs/002-data-sources.md.
 */
export function classifyOffense(
  ofnsDesc: string | null | undefined,
  pdDesc?: string | null | undefined,
): OffenseClassification {
  if (hasValue(ofnsDesc)) {
    const mapped = OFFENSE_TO_CATEGORY[ofnsDesc.trim()];
    if (mapped !== undefined) {
      return { category: mapped, unmapped: false, viaFallback: false };
    }
    return { category: 'UNKNOWN', unmapped: true, viaFallback: false };
  }

  if (hasValue(pdDesc)) {
    const haystack = pdDesc.trim().toUpperCase();
    for (const [pattern, category] of PD_DESC_FALLBACK) {
      if (haystack.includes(pattern)) {
        return { category, unmapped: false, viaFallback: true };
      }
    }
  }

  return { category: 'UNKNOWN', unmapped: false, viaFallback: false };
}

/** Categories shown by default — the enforcement-driven ones are opt-in. */
export const DEFAULT_VISIBLE_CATEGORIES: readonly CrimeCategory[] = CRIME_CATEGORIES.filter(
  (c) => !CRIME_CATEGORY_META[c].isEnforcementDriven && c !== 'UNKNOWN',
);

/** Count of offense labels in the mapping table; asserted by the test suite. */
export const MAPPED_OFFENSE_COUNT = Object.keys(OFFENSE_TO_CATEGORY).length;
