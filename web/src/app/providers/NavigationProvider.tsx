// Navigation provider - owns the shell's view/route state (which page is active,
// whether the artist portal is open, which public artist profile is being viewed,
// and the desktop rail collapse) plus the history integration (navigateToView,
// openArtistStudio, and the popstate listener). Pulled out of App.tsx so route
// state stops being threaded into useCatalog/useSession and the views. Route
// intent also retires delayed player captures before touching state/history.
// Fail closed: the accessor throws outside the provider.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react';
import {
  SHEET_HISTORY_KEY,
  historyStateObject,
  initialView,
  isArtistPortalPath,
  viewFromHistoryState,
  withoutRoomInvitation,
  type NavigationOptions
} from '../routing';
import { getInitialRoomCode } from '../../features/rooms/roomState';
import { animatePlayerNavigation, invalidatePlayerNavigation } from '../../features/player/playerMotion';
import type { View } from '../../shared/types';

// Invalidate at intent time, even if the destination equals the current route.
// Waiting for an effect would let a delayed capture push stale history first.
function useNavigationState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const setRouteValue = useCallback((next: SetStateAction<T>) => {
    invalidatePlayerNavigation();
    setValue(next);
  }, []);
  return [value, setRouteValue];
}

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
  openArtistProfile: (name: string) => void;
  closeArtistProfile: () => void;
  artistReturnLabel: string;
  railCollapsed: boolean;
  setRailCollapsed: Dispatch<SetStateAction<boolean>>;
  navigateToView: (nextView: View, options?: NavigationOptions) => void;
  openArtistStudio: () => void;
  clearRoomLink: () => void;
};

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useNavigationState<View>(() => getInitialView());
  const [isArtistPortal, setIsArtistPortal] = useNavigationState(() => isArtistPortalPath(window.location.pathname));
  const [publicArtistName, setPublicArtistName] = useNavigationState<string | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const artistNameRef = useRef(publicArtistName);
  useLayoutEffect(() => {
    artistNameRef.current = publicArtistName;
  }, [publicArtistName]);
  const [artistReturnLabel, setArtistReturnLabel] = useState('Back to discovery');
  const artistOrigin = useRef<{ top: number; name: string; label: string } | null>(null);
  const restoreArtistOrigin = useCallback(() => {
    const origin = artistOrigin.current;
    artistOrigin.current = null;
    setPublicArtistName(null);
    if (origin?.label === 'Back to listening')
      requestAnimationFrame(() => {
        // A newer navigation wins over this presentation-only scroll restoration.
        if (document.querySelector('.artist-profile-view')) return;
        window.scrollTo({ top: origin.top, behavior: 'instant' });
        const trigger = Array.from(document.querySelectorAll<HTMLButtonElement>('#main-content button')).find(
          button => button.textContent?.trim() === origin.name
        );
        trigger?.focus({ preventScroll: true });
      });
  }, [setPublicArtistName]);
  const openArtistProfile = useCallback(
    (name: string) => {
      const top = window.scrollY;
      // A contextual sheet hands its transient entry to the artist visit.
      // Do this at intent time: sheet cleanup must not pop a deferred animation.
      const replacingSheet = window.history.state?.[SHEET_HISTORY_KEY] !== undefined;
      const origin = { top, name, label: activeView === 'player' ? 'Back to listening' : 'Back to discovery' };
      const nextState = { ...historyStateObject(window.history.state), dotifyView: activeView, dotifyArtist: name, dotifyArtistOrigin: origin };
      if (replacingSheet) window.history.replaceState(nextState, '', window.location.href);
      else window.history.pushState(nextState, '', window.location.href);
      animatePlayerNavigation('inspect', () => {
        artistOrigin.current = origin;
        setArtistReturnLabel(origin.label);
        setPublicArtistName(name);
        requestAnimationFrame(() => {
          if (artistNameRef.current === name) window.scrollTo({ top: 0, behavior: 'instant' });
        });
      });
    },
    [activeView, setPublicArtistName]
  );
  const closeArtistProfile = useCallback(() => {
    // Popstate applies the reverse motion; one history entry represents this visit.
    if (historyStateObject(window.history.state).dotifyArtist) window.history.back();
    else animatePlayerNavigation('return', restoreArtistOrigin);
  }, [restoreArtistOrigin]);

  const navigateToView = useCallback(
    (nextView: View, options: NavigationOptions = {}) => {
      const leavingArtistPortal = isArtistPortal || isArtistPortalPath(window.location.pathname);
      artistOrigin.current = null;
      setPublicArtistName(null);
      setActiveView(nextView);
      if (leavingArtistPortal) setIsArtistPortal(false);
      const nextState: Record<string, unknown> = { ...historyStateObject(window.history.state), dotifyView: nextView };
      delete nextState.dotifyArtist;
      delete nextState.dotifyArtistOrigin;
      const nextUrl = leavingArtistPortal ? '/' : options.clearRoomLink ? withoutRoomInvitation(window.location.href) : window.location.href;
      if (options.replace || (!leavingArtistPortal && activeView === nextView)) {
        window.history.replaceState(nextState, '', nextUrl);
        return;
      }
      window.history.pushState(nextState, '', nextUrl);
    },
    [activeView, isArtistPortal, setActiveView, setIsArtistPortal, setPublicArtistName]
  );

  const clearRoomLink = useCallback(() => {
    invalidatePlayerNavigation();
    window.history.replaceState(historyStateObject(window.history.state), '', withoutRoomInvitation(window.location.href));
  }, []);

  const openArtistStudio = useCallback(() => {
    artistOrigin.current = null;
    setPublicArtistName(null);
    setIsArtistPortal(true);
    const nextState: Record<string, unknown> = { ...historyStateObject(window.history.state), dotifyView: activeView };
    delete nextState.dotifyArtist;
    delete nextState.dotifyArtistOrigin;
    if (isArtistPortal) {
      window.history.replaceState(nextState, '', '/artists');
    } else {
      window.history.pushState(nextState, '', '/artists');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView, isArtistPortal, setIsArtistPortal, setPublicArtistName]);

  // Seed the current history entry and keep view/portal state in sync with the
  // browser back/forward buttons.
  useEffect(() => {
    const initialState = historyStateObject(window.history.state);
    delete initialState.dotifyArtist;
    delete initialState.dotifyArtistOrigin;
    window.history.replaceState({ ...initialState, dotifyView: getInitialView() }, '', window.location.href);
    const onPopState = (event: PopStateEvent) => {
      const artist = historyStateObject(event.state).dotifyArtist;
      if (typeof artist === 'string') {
        if (artist === artistNameRef.current) return;
        animatePlayerNavigation('inspect', () => {
          const view = viewFromHistoryState(event.state, getInitialView());
          const origin = historyStateObject(event.state).dotifyArtistOrigin as { top?: unknown } | undefined;
          artistOrigin.current = {
            name: artist,
            top: typeof origin?.top === 'number' && Number.isFinite(origin.top) ? origin.top : 0,
            label: view === 'player' ? 'Back to listening' : 'Back to discovery'
          };
          setArtistReturnLabel(artistOrigin.current.label);
          setActiveView(view);
          setPublicArtistName(artist);
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
        return;
      }
      if (artistOrigin.current) {
        animatePlayerNavigation('return', () => {
          setIsArtistPortal(isArtistPortalPath(window.location.pathname));
          setActiveView(viewFromHistoryState(event.state, getInitialView()));
          restoreArtistOrigin();
        });
        return;
      }
      setPublicArtistName(null);
      setIsArtistPortal(isArtistPortalPath(window.location.pathname));
      setActiveView(viewFromHistoryState(event.state, getInitialView()));
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      invalidatePlayerNavigation();
    };
  }, [setActiveView, setIsArtistPortal, setPublicArtistName, restoreArtistOrigin]);

  const value = useMemo<NavigationValue>(
    () => ({
      activeView,
      setActiveView,
      isArtistPortal,
      setIsArtistPortal,
      publicArtistName,
      setPublicArtistName,
      openArtistProfile,
      closeArtistProfile,
      artistReturnLabel,
      railCollapsed,
      setRailCollapsed,
      navigateToView,
      openArtistStudio,
      clearRoomLink
    }),
    [
      activeView,
      isArtistPortal,
      publicArtistName,
      artistReturnLabel,
      railCollapsed,
      setActiveView,
      setIsArtistPortal,
      setPublicArtistName,
      navigateToView,
      openArtistStudio,
      clearRoomLink,
      openArtistProfile,
      closeArtistProfile
    ]
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const value = useContext(NavigationContext);
  if (!value) throw new Error('useNavigation must be used within a NavigationProvider.');
  return value;
}
