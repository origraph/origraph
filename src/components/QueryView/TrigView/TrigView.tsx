import hamburger from '../../../assets/hamburger.svg';
import showDesktop from '../../../assets/showDesktop.svg';
import { ViewState } from '../../../pages/Editor/Editor';
import { Button } from '../../basic-ui/Button';
import '../QueryView.css';
import './TrigView.css';

function TrigView(queryState: ViewState) {
  return (
    <div className="TrigView QueryView">
      <nav>
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
      </nav>
      <textarea value={queryState.queryIri} />
    </div>
  );
}

export default TrigView;
