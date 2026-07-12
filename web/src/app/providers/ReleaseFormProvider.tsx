// Release-form provider - owns the artist release draft and shared identity
// fields (title, description, artist name, price, royalty split, access mode,
// personhood level, cover file, Bulletin toggle, upload action, studio tab, and
// wizard step). Catalog selection and the artist console both read/write these,
// which is why they live above both consumers rather than inside either hook.
//
// It also owns the Bulletin manifest ref that useCatalog writes on track open.
// That ref was previously a write-only useRef in App.tsx (catalog wrote it, but
// nothing read it - the artist console displays its own separate manifest state),
// carried there to "break a circular dependency". Relocating it here removes that
// App-level hack while preserving behavior exactly: it stays a write sink until a
// later step gives it a reader. Fail closed: the accessor throws outside the provider.

import { createContext, useContext, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react';
import { DEFAULT_TRACK_TITLE } from '../../features/uploads/uploadModel';
import type { AccessMode, ArtistTab, AssetAction, PersonhoodLevel, ReleaseRoyaltySplitDraft, ReleaseStep } from '../../shared/types';

const DEFAULT_DESCRIPTION = 'Describe the story, rights context, and intended audience for this track.';

type ReleaseFormValue = {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  artistName: string;
  setArtistName: Dispatch<SetStateAction<string>>;
  priceDot: string;
  setPriceDot: Dispatch<SetStateAction<string>>;
  royaltyBps: number;
  setRoyaltyBps: Dispatch<SetStateAction<number>>;
  additionalRoyaltySplits: ReleaseRoyaltySplitDraft[];
  setAdditionalRoyaltySplits: Dispatch<SetStateAction<ReleaseRoyaltySplitDraft[]>>;
  accessMode: AccessMode;
  setAccessMode: Dispatch<SetStateAction<AccessMode>>;
  personhoodLevel: PersonhoodLevel;
  setPersonhoodLevel: Dispatch<SetStateAction<PersonhoodLevel>>;
  coverFile: File | null;
  setCoverFile: Dispatch<SetStateAction<File | null>>;
  uploadToBulletinEnabled: boolean;
  setUploadToBulletinEnabled: Dispatch<SetStateAction<boolean>>;
  assetAction: AssetAction;
  setAssetAction: Dispatch<SetStateAction<AssetAction>>;
  artistTab: ArtistTab;
  setArtistTab: Dispatch<SetStateAction<ArtistTab>>;
  releaseStep: ReleaseStep;
  setReleaseStep: Dispatch<SetStateAction<ReleaseStep>>;
  bulletinManifestRef: MutableRefObject<string>;
};

const ReleaseFormContext = createContext<ReleaseFormValue | null>(null);

export function ReleaseFormProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState(DEFAULT_TRACK_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [artistName, setArtistName] = useState('');
  const [priceDot, setPriceDot] = useState('0.5');
  const [royaltyBps, setRoyaltyBps] = useState(7000);
  const [additionalRoyaltySplits, setAdditionalRoyaltySplits] = useState<ReleaseRoyaltySplitDraft[]>([]);
  const [accessMode, setAccessMode] = useState<AccessMode>('human-free');
  const [personhoodLevel, setPersonhoodLevel] = useState<PersonhoodLevel>('DIM1');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadToBulletinEnabled, setUploadToBulletinEnabled] = useState(false);
  const [assetAction, setAssetAction] = useState<AssetAction>('idle');
  const [artistTab, setArtistTab] = useState<ArtistTab>('overview');
  const [releaseStep, setReleaseStep] = useState<ReleaseStep>('assets');
  const bulletinManifestRef = useRef('');

  const value = useMemo<ReleaseFormValue>(
    () => ({
      title,
      setTitle,
      description,
      setDescription,
      artistName,
      setArtistName,
      priceDot,
      setPriceDot,
      royaltyBps,
      setRoyaltyBps,
      additionalRoyaltySplits,
      setAdditionalRoyaltySplits,
      accessMode,
      setAccessMode,
      personhoodLevel,
      setPersonhoodLevel,
      coverFile,
      setCoverFile,
      uploadToBulletinEnabled,
      setUploadToBulletinEnabled,
      assetAction,
      setAssetAction,
      artistTab,
      setArtistTab,
      releaseStep,
      setReleaseStep,
      bulletinManifestRef
    }),
    [
      title,
      description,
      artistName,
      priceDot,
      royaltyBps,
      additionalRoyaltySplits,
      accessMode,
      personhoodLevel,
      coverFile,
      uploadToBulletinEnabled,
      assetAction,
      artistTab,
      releaseStep
    ]
  );

  return <ReleaseFormContext.Provider value={value}>{children}</ReleaseFormContext.Provider>;
}

export function useReleaseForm(): ReleaseFormValue {
  const value = useContext(ReleaseFormContext);
  if (!value) throw new Error('useReleaseForm must be used within a ReleaseFormProvider.');
  return value;
}
