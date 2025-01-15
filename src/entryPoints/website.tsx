import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Route, Switch } from 'wouter';
import '../core-styles/ui.css';
import { Editor } from '../pages/Editor/Editor.tsx';
import { Funding } from '../pages/Funding/Funding.tsx';
import { Missing } from '../pages/Missing/Missing.tsx';
import { WebsiteHome } from '../pages/WebsiteHome/WebsiteHome.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Switch>
      <Route path="/">
        <WebsiteHome />
      </Route>
      <Route path="/funding">
        <Funding />
      </Route>
      <Route path="/edit/:?projectIri">
        <Editor />
      </Route>
      <Route>
        <Missing />
      </Route>
    </Switch>
  </StrictMode>
);
