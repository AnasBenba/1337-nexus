import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy demo page redirected to the production Pitches page.
 * All developer testing toolbars and mock user fixtures have been removed.
 */
export const RefineProjectDemoPage: React.FC = () => {
  return <Navigate to="/pitches" replace />;
};

export default RefineProjectDemoPage;
