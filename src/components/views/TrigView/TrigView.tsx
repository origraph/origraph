import { Editor, loader } from '@monaco-editor/react';
import { CSSProperties, FC, useContext, useEffect, useState } from 'react';
import {
  PerspectiveAspect,
  ViewType,
  VOCABULARY,
} from '../../../constants/vocabulary';
import {
  BaseViewState,
  PerspectiveContext,
  useJob,
  usePerspective,
} from '../../../state/Perspectives';
import { quadsToTrig } from '../../../utils/core/quadsToTrig';
import usePrevious from '../../../utils/core/usePrevious';
import { isDarkMode } from '../../../utils/ui/isDarkMode';
import { SpaceDividerContext } from '../../utils/SpaceDivider/SpaceDivider';
import { TitleBar } from '../../utils/TitleBar/TitleBar';
import '../views.css';
import './TrigView.css';

const TEMP_SHRINK_STATIC_SIZE = '10em';

loader.config({
  // Monaco tries to load files from a CDN; this would break the
  // app for offline uses, so we serve its files ourselves
  paths: { vs: globalThis.location.origin + '/vs' },
});

enum MONACO_LANGUAGE {
  Text = 'txt',
  TriG = 'TriG',
  SPARQL = 'SPARQL',
}

export type TrigViewState = BaseViewState & {
  viewType: ViewType.TrigView;
};

export const TrigView: FC<TrigViewState> = ({
  viewIri,
  perspectiveIri,
  perspectiveAspect,
  style,
  setDescription,
}) => {
  const perspective = usePerspective(perspectiveIri);
  const { jobManager } = useContext(PerspectiveContext);
  const { tempShrinkStaticSizes } = useContext(SpaceDividerContext);

  const [localDisplayText, setLocalDisplayText] =
    useState<string>('Loading...');

  const [savedDisplayText, setSavedDisplayText] =
    useState<string>(localDisplayText);
  const [language, setLanguage] = useState<MONACO_LANGUAGE>(
    MONACO_LANGUAGE.Text
  );
  const [isEditingEnabled, setIsEditingEnabled] = useState<boolean>(false);

  const metadataJob = useJob(perspective.metadataQuery?.jobIri);
  const resultsJob = useJob(perspective.resultsQuery?.jobIri);
  useEffect(() => {
    (async () => {
      switch (perspectiveAspect) {
        case PerspectiveAspect.PerspectiveQuery:
          if (perspective.resultsQuery) {
            setSavedDisplayText(`#TODO: this should actually be the TriG meta-sparql; need a separate view!
${await perspective.resultsQuery.getSparql()}`);
            setLanguage(MONACO_LANGUAGE.SPARQL);
            // TODO: don't enable this until it actually works
            // setIsEditingEnabled(true);
            setIsEditingEnabled(false);
          } else if (metadataJob?.isRunning) {
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
            setIsEditingEnabled(resultsJob ? !resultsJob.isRunning : false);
          } else {
            setSavedDisplayText('Loading metadata...');
            setLanguage(MONACO_LANGUAGE.Text);
            setIsEditingEnabled(false);
          }
      }
    })();
  }, [
    jobManager,
    perspective.resultsQuery,
    perspectiveAspect,
    metadataJob?.isRunning,
    resultsJob?.isRunning,
    resultsJob,
  ]);

  const previousLanguage = usePrevious(language);
  useEffect(() => {
    if (previousLanguage !== language) {
      setDescription({
        subtitle: `${VOCABULARY.labelsByIri[perspectiveAspect]} (${language})`,
      });
    }
  }, [language, perspectiveAspect, previousLanguage, setDescription]);

  return (
    <div
      className="TrigView origraph-view"
      style={(style || {}) as CSSProperties}
    >
      <TitleBar viewIri={viewIri} />
      <div className="TrigView-monaco-wrapper">
        <Editor
          theme={isDarkMode() ? 'vs-dark' : 'vs-light'}
          /*
          important: 5em sizes needs to be smaller than the min-height: 10em
          defined in CSS to make sure that old Monaco sizes won't interfere with
          SpaceDivider in unpredictable ways
          */
          height={tempShrinkStaticSizes ? TEMP_SHRINK_STATIC_SIZE : '100%'}
          width={tempShrinkStaticSizes ? TEMP_SHRINK_STATIC_SIZE : '100%'}
          language={language}
          value={savedDisplayText}
          onChange={(newValue) => setLocalDisplayText(newValue || '')}
          options={{
            readOnly: !isEditingEnabled,
          }}
        />
      </div>
    </div>
  );
};
