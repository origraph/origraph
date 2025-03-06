import { InstanceEditorVisibleItems } from './constructVisibleItems';

export const getInstanceEditorVisibleItem = ({
  iri,
  visibleItems,
  includeProxy,
}: {
  iri: string;
  visibleItems: InstanceEditorVisibleItems;
  includeProxy?: boolean;
}) => {
  let item = visibleItems.scopeLookupByIri[iri]
    ? visibleItems[visibleItems.scopeLookupByIri[iri]][iri] || null
    : null;
  if (item === null && includeProxy && visibleItems.proxiesByHiddenIri[iri]) {
    item = visibleItems.proxies[visibleItems.proxiesByHiddenIri[iri]] || null;
  }
  return item;
};
