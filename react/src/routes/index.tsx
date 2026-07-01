
/*import React from 'react';
import { useRoutes } from 'react-router-dom';
import { OpenRoutes } from './OpenRoutes';
import { ProtectedRoutes } from './ProtectedRoutes';

const AppRoutes: React.FC = () => {
  const routes = [...OpenRoutes, ...ProtectedRoutes];
  return useRoutes(routes);
};

export default AppRoutes;*/



import React, { Suspense } from 'react';
import { useRoutes } from 'react-router-dom';
import { OpenRoutes } from './OpenRoutes';
import { ProtectedRoutes } from './ProtectedRoutes';

const AppRoutes: React.FC = () => {
  // Build the combined route config (same as before)
  const routes = [...OpenRoutes, ...ProtectedRoutes];

  // Resolve to a React element
  const element = useRoutes(routes);

  // Wrap the element with Suspense so lazy-loaded pages show a loader
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      {element}
    </Suspense>
  );
};

export default AppRoutes;



