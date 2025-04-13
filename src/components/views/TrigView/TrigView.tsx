import { Editor, loader } from '@monaco-editor/react';
import {
  CSSProperties,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  PerspectiveAspect,
  ViewType,
  VOCABULARY,
} from '../../../constants/vocabulary';
import {
  BaseViewState,
  QueryPhase,
  usePerspective,
} from '../../../state/Perspectives';
import { quadsToTrig } from '../../../utils/core/quadsToTrig';
import { useDataForAspect } from '../../../utils/core/useDataForAspect';
import { useDidValueChange } from '../../../utils/core/useDidValueChange';
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
  const { tempShrinkStaticSizes } = useContext(SpaceDividerContext);

  const [localDisplayText, setLocalDisplayText] =
    useState<string>('Loading...');
  const [parsedSavedDisplayText, setParsedSavedDisplayText] = useState<
    string | null
  >(null);

  const { query, savedQuads, isEditingEnabled } = useDataForAspect({
    perspectiveIri,
    perspectiveAspect,
  });

  const { savedDisplayText, language, parsePromise } = useMemo(() => {
    if (!query) {
      return {
        savedDisplayText: 'Loading...',
        language: MONACO_LANGUAGE.Text,
        parsePromise: null,
      };
    } else if (query.phase !== QueryPhase.COMPLETED) {
      return {
        savedDisplayText: query.phase,
        language: MONACO_LANGUAGE.Text,
        parsePromise: null,
      };
    } else if (savedQuads.length) {
      setParsedSavedDisplayText(null);
      if (perspectiveAspect === PerspectiveAspect.QueryDefinition) {
        return {
          savedDisplayText: 'Parsing...',
          parsePromise:
            perspective.resultsPage?.getSparql().then(
              (
                sparql
              ) => `#TODO: we should derive this from meta-sparql savedQuads!
            ${sparql}`
            ) || null,
          language: MONACO_LANGUAGE.SPARQL,
        };
      } else {
        return {
          savedDisplayText: 'Parsing...',
          parsePromise: quadsToTrig(savedQuads),
          language: MONACO_LANGUAGE.TriG,
        };
      }
    } else {
      return {
        savedDisplayText: 'No results',
        language: MONACO_LANGUAGE.Text,
        parsePromise: null,
      };
    }
  }, [perspective.resultsPage, perspectiveAspect, query, savedQuads]);

  useEffect(() => {
    if (parsedSavedDisplayText === null && parsePromise !== null) {
      (async () => {
        setParsedSavedDisplayText(await parsePromise);
      })();
    }
  }, [parsePromise, parsedSavedDisplayText]);

  const finalSavedDisplayText = useMemo(
    () =>
      parsedSavedDisplayText === null
        ? savedDisplayText
        : parsedSavedDisplayText,
    [parsedSavedDisplayText, savedDisplayText]
  );
  const didFinalSavedDisplayTextChange = useDidValueChange({
    value: finalSavedDisplayText,
  });

  useEffect(() => {
    if (didFinalSavedDisplayTextChange) {
      // TODO: be careful not to nuke this during a re-query after a debounced edit;
      // will probably want a TitleBar indicator instead of trying to use the text
      // to say things like Loading...
      setLocalDisplayText(finalSavedDisplayText);
    }
  }, [didFinalSavedDisplayTextChange, finalSavedDisplayText]);

  const handleTextEdit = useCallback(
    (newText: string) => {
      // TODO: save the edit to quadstore instead of setLocalDisplayText
      // Probably worth debouncing...
      setLocalDisplayText(newText);
    },
    [setLocalDisplayText]
  );

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
          value={localDisplayText}
          onChange={(newValue) => handleTextEdit(newValue || '')}
          options={{
            readOnly: !isEditingEnabled,
          }}
        />
      </div>
    </div>
  );
};
