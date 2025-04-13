import { Quad } from 'n3';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PerspectiveAspect } from '../../constants/vocabulary';
import { BaseIncrementalInput, Job } from '../../state/Jobs';
import {
  QueryIncrementalOutput,
  QueryPhase,
  QueryState,
  useJob,
  usePerspective,
} from '../../state/Perspectives';
import { useDidValueChange } from './useDidValueChange';

export const useDataForAspect = ({
  perspectiveIri,
  perspectiveAspect,
}: {
  perspectiveIri: string;
  perspectiveAspect: PerspectiveAspect;
}) => {
  const perspective = usePerspective(perspectiveIri);
  const queryDefinitionJob = useJob(perspective.queryDefinition?.jobIri);
  const resultsPageJob = useJob(perspective.resultsPage?.jobIri);

  const { query, job, savedQuads, isEditingEnabled } = useMemo((): {
    query: QueryState | null;
    job: Job<
      unknown,
      BaseIncrementalInput,
      QueryIncrementalOutput,
      unknown
    > | null;
    savedQuads: Quad[];
    isEditingEnabled: boolean;
  } => {
    const results =
      perspectiveAspect === PerspectiveAspect.QueryDefinition
        ? { query: perspective.queryDefinition, job: queryDefinitionJob }
        : { query: perspective.resultsPage, job: resultsPageJob };
    return {
      ...results,
      savedQuads: results.query?.currentQuads || [],
      isEditingEnabled:
        perspectiveAspect === PerspectiveAspect.ResultPage &&
        results.query?.phase === QueryPhase.COMPLETED,
    };
  }, [
    queryDefinitionJob,
    perspective.queryDefinition,
    perspective.resultsPage,
    perspectiveAspect,
    resultsPageJob,
  ]);

  const [pendingSave, setPendingSave] = useState<boolean>(false);
  const [unsavedQuads, setUnsavedQuads] = useState<Quad[]>(savedQuads);

  const saveQuads = useCallback((_quads: Quad[]) => {
    // TODO: write to quadstore!
    setPendingSave(true);
  }, []);

  const savedQuadsUpdated = useDidValueChange({ value: savedQuads });
  useEffect(() => {
    if (savedQuadsUpdated) {
      setUnsavedQuads(savedQuads);
      setPendingSave(false);
    }
  }, [savedQuads, savedQuadsUpdated]);

  return {
    query,
    job,
    savedQuads,
    unsavedQuads,
    saveQuads,
    isEditingEnabled,
    pendingSave,
  };
};
