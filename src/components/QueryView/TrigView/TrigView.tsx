import { Editor } from '@monaco-editor/react';
import { FC, useEffect, useMemo, useState } from 'react';
import { PerspectiveAspect, ViewType } from '../../../constants/vocabulary';
import {
  BaseViewState,
  useJobManager,
  usePerspective,
} from '../../../state/Perspectives';
import { quadsToTrig } from '../../../utils/core/quadsToTrig';
import { isDarkMode } from '../../../utils/ui/isDarkMode';
import '../QueryView.css';
import './TrigView.css';

enum MONACO_LANGUAGE {
  Text = 'txt',
  TriG = 'TriG',
  SPARQL = 'SPARQL',
}

export type TrigViewState = BaseViewState & {
  viewType: ViewType.TrigView;
};

export const TrigView: FC<TrigViewState> = ({
  perspectiveIri,
  perspectiveAspect,
}) => {
  const perspective = usePerspective(perspectiveIri);
  const jobManager = useJobManager();

  console.log('Rendering TrigView', perspective);

  const [localDisplayText, setLocalDisplayText] =
    useState<string>('Loading...');

  const [savedDisplayText, setSavedDisplayText] =
    useState<string>(localDisplayText);
  const [language, setLanguage] = useState<MONACO_LANGUAGE>(
    MONACO_LANGUAGE.Text
  );
  const [isEditingEnabled, setIsEditingEnabled] = useState<boolean>(false);

  // Extra hook to silence exhaustive-deps about an extra dependency that won't
  // otherwise update correctly if jobIri changes
  const resultsQueryJobIri = useMemo(
    () => perspective.resultsQuery?.jobIri,
    [perspective.resultsQuery?.jobIri]
  );
  useEffect(() => {
    (async () => {
      switch (perspectiveAspect) {
        case PerspectiveAspect.PerspectiveQuery:
          if (perspective.resultsQuery) {
            setSavedDisplayText(`#TODO: this should actually be the TriG meta-sparql; need a separate view!
${await perspective.resultsQuery.getSparql()}`);
            setLanguage(MONACO_LANGUAGE.SPARQL);
            setIsEditingEnabled(true);
          } else if (
            perspective.metadataQuery?.jobIri &&
            jobManager.getJob(perspective.metadataQuery.jobIri)?.isRunning
          ) {
            setSavedDisplayText('Querying...');
            setLanguage(MONACO_LANGUAGE.Text);
            setIsEditingEnabled(false);
          } else {
            setSavedDisplayText('Initializing...');
            setLanguage(MONACO_LANGUAGE.Text);
            setIsEditingEnabled(false);
          }
          break;
        case PerspectiveAspect.ResultPage:
        default:
          if (perspective.resultsQuery) {
            setSavedDisplayText(
              await quadsToTrig(perspective.resultsQuery.currentQuads)
            );
            setLanguage(MONACO_LANGUAGE.TriG);
            setIsEditingEnabled(
              !(
                resultsQueryJobIri &&
                jobManager.getJob(resultsQueryJobIri)?.isRunning
              )
            );
          } else {
            setSavedDisplayText('Loading metadata...');
            setLanguage(MONACO_LANGUAGE.Text);
            setIsEditingEnabled(false);
          }
      }
    })();
  }, [
    jobManager,
    perspective.metadataQuery?.jobIri,
    perspective.resultsQuery,
    resultsQueryJobIri,
    perspectiveAspect,
  ]);

  // TODO: continue here; need to adapt TrigView for the new PerspectiveManager

  const [handleUpdate, setHandleUpdate] = useState<(update: string) => void>(
    (update: string) => {
      console.log(`uninitialized update: ${update}`);
    }
  );

  return (
    <div className="TrigView">
      {/* <nav>
        <Button
          className="minimal"
          collapse
          rightIcons={[{ src: showDesktop }]}
        >
          Overview
        </Button>
        <Button className="minimal" collapse rightIcons={[{ src: hamburger }]}>
          View
        </Button>
      </nav> */}
      <div className="TrigView-monaco-wrapper">
        <Editor
          theme={isDarkMode() ? 'vs-dark' : 'vs-light'}
          language={language}
          value={savedDisplayText}
          onChange={(newValue) => handleUpdate?.(newValue || '')}
        />
      </div>
    </div>
  );
};
