import React from 'react';
import { TripPlanningPage } from './TripPlanningPage';
import { TimelinePage } from '@/features/timeline/TimelinePage';
import { TripBucketListPage } from './TripBucketListPage';
import { TripDiscoveryPage } from './TripDiscoveryPage';
import { TripWeatherPage } from './TripWeatherPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import type { WorkspacePanelKey } from './useWorkspacePanelStore';

export function WorkspaceFeaturePanel({ panelKey }: { panelKey: WorkspacePanelKey }) {
  let panel: React.ReactNode = null;
  if (panelKey === 'planning')    panel = <TripPlanningPage />;
  if (panelKey === 'timeline')    panel = <TimelinePage />;
  if (panelKey === 'bucket-list') panel = <TripBucketListPage />;
  if (panelKey === 'discovery')   panel = <TripDiscoveryPage />;
  if (panelKey === 'weather')     panel = <TripWeatherPage />;
  if (panelKey === 'expenses')    panel = <ExpensesPage />;
  return (
    <PanelErrorBoundary panelKey={panelKey}>
      {panel}
    </PanelErrorBoundary>
  );
}

