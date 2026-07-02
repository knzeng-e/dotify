// Navigation provider - owns the shell's view/route state (which page is active,
// whether the artist portal is open, which public artist profile is being viewed,
// and the desktop rail collapse) plus the history integration (navigateToView,
// openArtistStudio, and the popstate listener). Pulled out of App.tsx so route
// state stops being threaded into useCatalog/useSession and the views. Depends on
// nothing else in the stack. Fail closed: the accessor throws outside the provider.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { historyStateObject, initialView, isArtistPortalPath, viewFromHistoryState } from '../routing';
import { getInitialRoomCode } from '../../features/rooms/roomState';
import type { View } from '../../types';

function getInitialView(): View {
  return initialView(Boolean(getInitialRoomCode()));
}

type NavigationValue = {
  activeView: View;
  setActiveView: Dispatch<SetStateAction<View>>;
  isArtistPortal: boolean;
  setIsArtistPortal: Dispatch<SetStateAction<boolean>>;
  publicArtistName: string | null;
  setPublicArtistName: Dispatch<SetStateAction<string | null>>;
  railCollapsed: boolean;
  setRailCollapsed: Dispatch<SetStateAction<boolean>>;
  navigateToView: (nextView: View, options?: { replace?: boolean }) => void;
  openArtistStudio: () => void;
};

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<View>(() => getInitialView());
  const [isArtistPortal, setIsArtistPortal] = useState(() => isArtistPortalPath(window.location.pathname));
  const [publicArtistName, setPublicArtistName] = useState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);

  const navigateToView = useCallback(
    (nextView: View, options: { replace?: boolean } = {}) => {
      setPublicArtistName(null);
      setActiveView(nextView);
      const nextState = { ...historyStateObject(window.history.state), dotifyView: nextView };
      if (options.replace || activeView === nextView) {
        window.history.replaceState(nextState, '', window.location.href);
        return;
      }
      window.history.pushState(nextState, '', window.location.href);
    },
    [activeView]
  );

  const openArtistStudio = useCallback(() => {
    setPublicArtistName(null);
    setIsArtistPortal(true);
    const nextState = { ...historyStateObject(window.history.state), dotifyView: activeView };
    if (isArtistPortal) {
      window.history.replaceState(nextState, '', '/artists');
    } else {
      window.history.pushState(nextState, '', '/artists');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView, isArtistPortal]);

  // Seed the current history entry and keep view/portal state in sync with the
  // browser back/forward buttons.
  useEffect(() => {
    window.history.replaceState({ ...historyStateObject(window.history.state), dotifyView: getInitialView() }, '', window.location.href);
    const onPopState = (event: PopStateEvent) => {
      setIsArtistPortal(isArtistPortalPath(window.location.pathname));
      setActiveView(viewFromHistoryState(event.state, getInitialView()));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const value = useMemo<NavigationValue>(
    () => ({
      activeView,
      setActiveView,
      isArtistPortal,
      setIsArtistPortal,
      publicArtistName,
      setPublicArtistName,
      railCollapsed,
      setRailCollapsed,
      navigateToView,
      openArtistStudio
    }),
    [activeView, isArtistPortal, publicArtistName, railCollapsed, navigateToView, openArtistStudio]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used within a NavigationProvider.');
  return value;
}
