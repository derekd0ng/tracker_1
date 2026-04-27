import type { TabId } from './types';

export const TAB_TO_PATH: Record<TabId, string> = {
  home:       '/',
  dashboard:  '/dashboard',
  wellbeing:  '/wellbeing',
  medication: '/meds',
  habits:     '/habits',
  todo:       '/todos',
  diary:      '/diary',
};

const PATH_TO_TAB: Record<string, TabId> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab as TabId])
);

export function pathToTab(pathname: string): TabId {
  return PATH_TO_TAB[pathname] ?? 'home';
}
