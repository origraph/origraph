import { CSSProperties, FC } from 'react';
import { ViewType } from '../../../constants/vocabulary';
import { BaseViewState } from '../../../state/Perspectives';
import { useDataForAspect } from '../../../utils/core/useDataForAspect';
import { TitleBar } from '../../utils/TitleBar/TitleBar';

export type TreeTableViewState = BaseViewState & {
  viewType: ViewType.TreeTableView;
};

export const TreeTableView: FC<TreeTableViewState> = ({
  viewIri,
  style,
  perspectiveIri,
  perspectiveAspect,
}) => {
  const { unsavedQuads: _unsavedQuads, saveQuads: _saveQuads } =
    useDataForAspect({
      perspectiveIri,
      perspectiveAspect,
    });
  // TODO: construct a sortable, editable table from unsavedQuads, with biofabric on the side

  // TODO: support soring by a hierarchy; will need to adapt + bring over the hierarchy-building
  // code from the old node-euler-link demo
  return (
    <div
      className="TreeTableView origraph-view"
      style={(style || {}) as CSSProperties}
    >
      <TitleBar viewIri={viewIri} />
      <div className="TreeTableView-content">TODO: table</div>
    </div>
  );
};
