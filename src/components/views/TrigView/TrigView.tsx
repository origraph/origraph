import { Editor, loader } from '@monaco-editor/react';
import {
  CSSProperties,
  FC,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { PerspectiveAspect, ViewType } from '../../../constants/vocabulary';
import saveImg from '../../../logos/ui/save.svg?raw';
import {
  BaseViewState,
  PerspectiveContext,
  useJob,
  usePerspective,
} from '../../../state/Perspectives';
import { quadsToTrig } from '../../../utils/core/quadsToTrig';
import { isDarkMode } from '../../../utils/ui/isDarkMode';
import { MenuItemProps } from '../../basic-ui/Menu/Menu';
import { TitleBar } from '../../utils/TitleBar/TitleBar';
import '../views.css';
import './TrigView.css';

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
  perspectiveIri,
  perspectiveAspect,
  style,
}) => {
  const perspective = usePerspective(perspectiveIri);
  const { jobManager } = useContext(PerspectiveContext);

  const [localDisplayText, setLocalDisplayText] =
    useState<string>('Loading...');

  const [savedDisplayText, setSavedDisplayText] =
    useState<string>(localDisplayText);
  const [language, setLanguage] = useState<MONACO_LANGUAGE>(
    MONACO_LANGUAGE.Text
  );
  const [_isEditingEnabled, setIsEditingEnabled] = useState<boolean>(false);

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
            setIsEditingEnabled(true);
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

  const menuItemProps: (MenuItemProps & { key: string })[] = useMemo(
    () => [
      {
        key: 'save',
        collapse: false,
        disabled: true,
        className: 'minimal',
        leftIcons: [{ srcSvg: saveImg }],
        label: 'Save',
      },
    ],
    []
  );

  return (
    <div
      className="TrigView origraph-view"
      style={(style || {}) as CSSProperties}
    >
      <TitleBar
        title={perspectiveIri} // TODO: look up the label; don't use the iri
        subtitle={perspectiveAspect}
        menuItemProps={menuItemProps}
      />
      <div className="TrigView-monaco-wrapper">
        <Editor
          theme={isDarkMode() ? 'vs-dark' : 'vs-light'}
          language={language}
          value={savedDisplayText}
          onChange={(newValue) => setLocalDisplayText(newValue || '')}
        />
      </div>
    </div>
  );
};
