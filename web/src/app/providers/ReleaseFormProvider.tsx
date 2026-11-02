// Shared release draft, used by catalog selection and the artist studio.
// Storage routing belongs to the publishing service, not the draft.

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { DEFAULT_TRACK_TITLE } from '../../features/uploads/uploadModel';
import { createEmptyReleaseMetadata } from '../../features/catalog/releaseMetadata';
import type { AccessMode, ArtistTab, AssetAction, PersonhoodLevel, ReleaseEditorialMetadata, ReleaseRoyaltySplitDraft, ReleaseStep } from '../../shared/types';

const DEFAULT_DESCRIPTION = '';

type ReleaseFormValue = {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  releaseMetadata: ReleaseEditorialMetadata;
  setReleaseMetadata: Dispatch<SetStateAction<ReleaseEditorialMetadata>>;
  durationSeconds: number | null;
  setDurationSeconds: Dispatch<SetStateAction<number | null>>;
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
  assetAction: AssetAction;
  setAssetAction: Dispatch<SetStateAction<AssetAction>>;
  artistTab: ArtistTab;
  setArtistTab: Dispatch<SetStateAction<ArtistTab>>;
  releaseStep: ReleaseStep;
  setReleaseStep: Dispatch<SetStateAction<ReleaseStep>>;
};

const ReleaseFormContext = createContext<ReleaseFormValue | null>(null);

export function ReleaseFormProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState(DEFAULT_TRACK_TITLE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [releaseMetadata, setReleaseMetadata] = useState<ReleaseEditorialMetadata>(createEmptyReleaseMetadata);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [artistName, setArtistName] = useState('');
  const [priceDot, setPriceDot] = useState('0.5');
  const [royaltyBps, setRoyaltyBps] = useState(7000);
  const [additionalRoyaltySplits, setAdditionalRoyaltySplits] = useState<ReleaseRoyaltySplitDraft[]>([]);
  const [accessMode, setAccessMode] = useState<AccessMode>('human-free');
  const [personhoodLevel, setPersonhoodLevel] = useState<PersonhoodLevel>('DIM1');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [assetAction, setAssetAction] = useState<AssetAction>('idle');
  const [artistTab, setArtistTab] = useState<ArtistTab>('overview');
  const [releaseStep, setReleaseStep] = useState<ReleaseStep>('assets');

  const value = useMemo<ReleaseFormValue>(
    () => ({
      title,
      setTitle,
      description,
      setDescription,
      releaseMetadata,
      setReleaseMetadata,
      durationSeconds,
      setDurationSeconds,
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
      assetAction,
      setAssetAction,
      artistTab,
      setArtistTab,
      releaseStep,
      setReleaseStep
    }),
    [
      title,
      description,
      releaseMetadata,
      durationSeconds,
      artistName,
      priceDot,
      royaltyBps,
      additionalRoyaltySplits,
      accessMode,
      personhoodLevel,
      coverFile,
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
