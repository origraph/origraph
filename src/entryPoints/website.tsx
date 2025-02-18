import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Route, Router, Switch } from 'wouter';
import '../../node_modules/normalize.css/normalize.css';
import '../core-styles/ui.css';
import { Editor } from '../pages/Editor/Editor.tsx';
import { Redirect404 } from '../pages/Redirect404/Redirect404.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router base="/app">
      <Switch>
        <Route path="/">
          <Editor />
        </Route>
        <Route>
          <Redirect404 />
        </Route>
      </Switch>
    </Router>
  </StrictMode>
);
