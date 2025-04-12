import { CSSProperties, FC } from 'react';
import { ViewType } from '../../../constants/vocabulary';
import { BaseViewState } from '../../../state/Perspectives';
import { TitleBar } from '../../utils/TitleBar/TitleBar';

export type TreeTableViewState = BaseViewState & {
  viewType: ViewType.TreeTableView;
};

export const TreeTableView: FC<TreeTableViewState> = ({ viewIri, style }) => {
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
