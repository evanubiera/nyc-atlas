import { CRIME_CATEGORIES, CRIME_CATEGORY_META, type CrimeCategory } from '@nyc-atlas/shared';
import { useAppDispatch, useAppSelector } from '../store/hooks.js';
import { useMetricsQuery, type MetricsInput } from '../store/atlasApi.js';
import {
  setCategory,
  setExposure,
  setExtrude,
  setInstitutionScope,
  setMapMode,
  setShowInstitutions,
} from '../features/filters/filtersSlice.js';
import { EXPOSURE_MEASURES, INSTITUTION_SCOPES, MAP_MODES } from './mapModes.ts';
import {
  Check,
  Checks,
  ControlRow,
  Field,
  FieldLabel,
  SegButton,
  Segmented,
  Select,
} from './controlStyles.ts';

const OUTCOME_CATEGORIES = CRIME_CATEGORIES.filter((category) => category !== 'UNKNOWN');

function categoryLabel(category: CrimeCategory): string {
  const meta = CRIME_CATEGORY_META[category];
  return meta.isEnforcementDriven ? `${meta.label} (enforcement-driven)` : meta.label;
}

function OutcomeField(): JSX.Element {
  const dispatch = useAppDispatch();
  const category = useAppSelector((state) => state.filters.category);

  return (
    <Field>
      <FieldLabel htmlFor="category">Outcome</FieldLabel>
      <Select
        id="category"
        value={category}
        onChange={(event) => dispatch(setCategory(event.target.value as CrimeCategory))}
      >
        {OUTCOME_CATEGORIES.map((option) => (
          <option key={option} value={option}>
            {categoryLabel(option)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ExposureField({ rateMode }: { rateMode: boolean }): JSX.Element {
  const dispatch = useAppDispatch();
  const exposure = useAppSelector((state) => state.filters.exposure);

  return (
    <Field>
      <FieldLabel htmlFor="exposure">Cultural access</FieldLabel>
      <Select
        id="exposure"
        value={exposure}
        onChange={(event) => dispatch(setExposure(event.target.value as never))}
        disabled={!rateMode}
        title={rateMode ? undefined : 'Per-capita measures need a Census key'}
      >
        {EXPOSURE_MEASURES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ScopeField(): JSX.Element {
  const dispatch = useAppDispatch();
  const scope = useAppSelector((state) => state.filters.institutionScope);

  return (
    <Field>
      <FieldLabel htmlFor="scope">Institutions</FieldLabel>
      <Select
        id="scope"
        value={scope}
        onChange={(event) => dispatch(setInstitutionScope(event.target.value as never))}
      >
        {INSTITUTION_SCOPES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function MapModeField(): JSX.Element {
  const dispatch = useAppDispatch();
  const mapMode = useAppSelector((state) => state.filters.mapMode);

  return (
    <Field>
      <FieldLabel>Map shows</FieldLabel>
      <Segmented role="group" aria-label="Map encoding">
        {MAP_MODES.map((mode) => (
          <SegButton
            key={mode.value}
            type="button"
            title={mode.hint}
            $active={mapMode === mode.value}
            onClick={() => dispatch(setMapMode(mode.value))}
          >
            {mode.label}
          </SegButton>
        ))}
      </Segmented>
    </Field>
  );
}

function LayerChecks(): JSX.Element {
  const dispatch = useAppDispatch();
  const { showInstitutions, extrude } = useAppSelector((state) => state.filters);

  return (
    <Checks>
      <Check>
        <input
          type="checkbox"
          checked={showInstitutions}
          onChange={(event) => dispatch(setShowInstitutions(event.target.checked))}
        />
        Institutions
      </Check>
      <Check>
        <input
          type="checkbox"
          checked={extrude}
          onChange={(event) => dispatch(setExtrude(event.target.checked))}
        />
        3D
      </Check>
    </Checks>
  );
}

export function AtlasControls({ input }: { input: MetricsInput }): JSX.Element {
  const { data } = useMetricsQuery(input);
  const rateMode = data?.outcomeMode === 'RATE_PER_100K';

  return (
    <ControlRow>
      <OutcomeField />
      <ExposureField rateMode={rateMode} />
      <ScopeField />
      <MapModeField />
      <LayerChecks />
    </ControlRow>
  );
}
