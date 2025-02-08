import { FC } from 'react';
import patreonLogo from '../../assets/patreon.svg';
import { Icon } from '../../components/basic-ui/Icon';
import '../../core-styles/simple-page.css';

export const Funding: FC = () => {
  return (
    <div className="simplePage">
      <p>If you find this utility useful,</p>
      <h2>
        please consider <span className="yellow accent">supporting us</span>
      </h2>
      <p>
        A regular, small donation is the most effective way to keep the lights
        on, and it&apos;s a strong signal to us to keep this free for everyone
      </p>
      <h3>
        more details on our{' '}
        <a className="yellow button" href="https://patreon.com/Origraph">
          <Icon src={patreonLogo} />
          patreon
        </a>
      </h3>
      {/*
      TODO: enable Stripe for this, so people don't have to create a patreon account
      <p>Or, if your budget is more ad-hoc, you can also</p>
      <h3>
        contribute a one-time <Button className="yellow">tip</Button>
      </h3>
      */}
      <p>
        If you have an enterprise need, we offer world-class consulting and data
        science training workshops;
      </p>
      <h3>
        inquire about our{' '}
        <a className="yellow button" href="mailto:info@origraph.net">
          professional services
        </a>
      </h3>
      {/*
      TODO: make an About Us example dataset!
      <p>Want to know where your money would be going?</p>
      <h3>
        learn more <Button className="yellow">about us</Button>
      </h3> */}
    </div>
  );
};
