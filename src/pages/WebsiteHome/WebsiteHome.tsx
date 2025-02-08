import { FC, useMemo } from 'react';
import { Button } from '../../components/basic-ui/Button';
import { getAppIcon } from '../../utils/ui/getAppIcon';
import './WebsiteHome.css';

// const comunicaInterface = new ComunicaInterface();

export const WebsiteHome: FC = () => {
  // const params = useParams();

  const appIcon = useMemo(getAppIcon, []);

  return (
    <div className="WebsiteHome">
      <div className="left column">
        <div className="titleRow fullRow">
          <div>
            <h1>origraph</h1>
            <p>get creative with data</p>
          </div>
          <img
            src={appIcon}
            alt="origraph logo"
            className="logo right crossColumn"
          />
        </div>
        <p className="teal accent">
          Thanks for helping with beta testing! The main focus for{' '}
          <strong>
            <a href="https://github.com/origraph/origraph.github.io/issues">
              feedback
            </a>
          </strong>{' '}
          at the moment is the &ldquo;Excel for NoSQL data&rdquo; data editor;
          other stuff depends on getting this right first.
        </p>
      </div>
      <nav className="right column">
        <div className="logo"></div>
        <div className="main chunk">
          <a href="edit" className="button teal">
            Edit
          </a>
          <Button className="minimal purple">Train AI</Button>
          <Button className="minimal pink">Visualize</Button>
        </div>
        <div className="fullRow">
          <p className="left crossColumn">
            Keep this project free for everyone!
          </p>
          <a href="funding" className="button yellow">
            Support us
          </a>
        </div>
      </nav>
    </div>
  );
};
