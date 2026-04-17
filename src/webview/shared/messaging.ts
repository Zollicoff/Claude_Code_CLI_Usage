import type { TimeRange } from '../../types';

export type WebviewMessage =
  | { command: 'refresh'; timeRange?: TimeRange }
  | { command: 'changeTimeRange'; timeRange: TimeRange }
  | { command: 'openDashboard' };
