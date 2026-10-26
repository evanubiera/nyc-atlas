export interface Limitation {
  id: string;
  heading: string;
  body: JSX.Element;
}

/**
 * The limitations specs/007 requires the UI to state in plain language. They
 * live as data so the panel stays a layout concern and the wording stays
 * reviewable in one place.
 */
export const KNOWN_LIMITATIONS: Limitation[] = [
  {
    id: 'reverse-causality',
    heading: 'Reverse causality.',
    body: (
      <>
        Institutions follow safety and property values at least as much as they might produce
        them. Cross-sectional data cannot separate the directions.
      </>
    ),
  },
  {
    id: 'reporting-bias',
    heading: 'Reporting bias.',
    body: (
      <>
        Complaint counts measure <em>reported</em> crime. Reporting falls where institutional
        trust is lowest — often the same neighborhoods with the least cultural investment.
        Shooting data is used as the primary outcome because it is far less sensitive to this.
      </>
    ),
  },
  {
    id: 'enforcement-driven',
    heading: 'Enforcement-driven categories.',
    body: (
      <>
        Drug, disorder, traffic and administrative counts reflect police deployment as much as
        behaviour, so they are off by default.
      </>
    ),
  },
  {
    id: 'exposure-coverage',
    heading: 'Coverage bias in the exposure.',
    body: (
      <>
        The DCLA directory lists largely city-funded organizations and under-counts informal
        cultural space — church basements, social clubs, studios — most severely in low-income
        neighborhoods.
      </>
    ),
  },
  {
    id: 'grocery-self-report',
    heading: 'Self-report in the grocery measures.',
    body: (
      <>
        Supermarket counts rest on floor area that licensees state and nobody audits, and the
        store grade is a sanitation result — whether a store is clean — not a judgement of what
        it sells or charges.
      </>
    ),
  },
  {
    id: 'schools-are-places',
    heading: 'Schools are places, not pupils.',
    body: (
      <>
        School figures describe the schools located in a neighborhood, weighted by the students
        they test. Choice and screening move students across neighborhood lines in both
        directions, so this is not how the children who live there are doing.
      </>
    ),
  },
  {
    id: 'residual-confounding',
    heading: 'Residual confounding is certain.',
    body: (
      <>
        Redlining and historical disinvestment are common causes of both low cultural investment
        and present-day violence, and are not measured here.
      </>
    ),
  },
  {
    id: 'maup',
    heading: 'MAUP.',
    body: (
      <>
        Results can change with the choice of geography; a Community-District view is provided
        as a sensitivity check.
      </>
    ),
  },
];
