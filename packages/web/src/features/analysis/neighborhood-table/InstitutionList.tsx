import type { InstitutionPoint } from '../../../store/atlasApi.js';
import { pluralize, titleCaseFromShout } from '../../../format/values.ts';
import {
  byDisplayName,
  describeInstitutionKind,
  describeInstitutionSource,
} from './institutions.ts';
import { Item, ItemKind, ItemName, List, PanelHead, PanelWarn } from './tableStyles.ts';

interface InstitutionListProps {
  neighborhoodName: string;
  reportedCount: number;
  institutions: InstitutionPoint[];
}

export function InstitutionList({
  neighborhoodName,
  reportedCount,
  institutions,
}: InstitutionListProps): JSX.Element {
  const listable = institutions.length;

  return (
    <>
      <PanelHead>
        {pluralize(reportedCount, 'cultural institution')} in {neighborhoodName}
        {listable !== reportedCount && (
          <PanelWarn>
            {' '}
            — {listable} can be listed; the rest could not be resolved to this neighborhood
            from their own coordinates
          </PanelWarn>
        )}
      </PanelHead>

      <List>
        {[...institutions].sort(byDisplayName).map((institution) => (
          <Item key={institution.id} title={describeInstitutionSource(institution)}>
            <ItemName>{titleCaseFromShout(institution.name)}</ItemName>
            <ItemKind>{describeInstitutionKind(institution)}</ItemKind>
          </Item>
        ))}
      </List>
    </>
  );
}
