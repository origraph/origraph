import { FC } from 'react';
import '../../core-styles/simple-page.css';

export const Missing: FC = () => {
  return (
    <div className="simplePage">
      <h1>404</h1>
      <p>
        Your browser&apos;s request is under consideration. Please&nbsp;
        <a href="mailto:support@origraph.com">contact us</a> if you think that
        it should be under{' '}
        <a href="https://www.dailymotion.com/video/x5v4rha?start=119">
          active consideration
        </a>
        .
      </p>
    </div>
  );
};
