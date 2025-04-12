import { TreeTableView } from './TreeTableView/TreeTableView';
import { TrigView } from './TrigView/TrigView';

export type ViewComponent = typeof TrigView | typeof TreeTableView;
