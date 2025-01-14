import { Button } from '../../components/basic-ui/Button';

export const Funding = () => {
  return (
    <>
      <p>If you find this utility useful,</p>
      <h1>
        please consider <span className="yellow">supporting us</span>
      </h1>
      <p>
        A regular, small donation is the most effective way to keep the lights
        on, and it&apos;s a strong signal to us to keep this free for everyone
      </p>
      <h2>
        more details on our <Button className="yellow">patreon</Button>
      </h2>
      <p>Or, if your budget is more ad-hoc, you can also</p>
      <h2>
        contribute a one-time <Button className="yellow">donation</Button>
      </h2>
      <p>
        If you have an enterprise need, we offer world-class consulting and data
        science training workshops
      </p>
      <h2>
        purchase our <Button className="yellow">professional services</Button>
      </h2>
      <p>Want to know where your money would be going?</p>
      <h2>
        learn more <Button className="yellow">about us</Button>
      </h2>
    </>
  );
};
