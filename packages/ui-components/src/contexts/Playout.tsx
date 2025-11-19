import React, {
  useState,
  createContext,
  useContext,
  ReactNode,
  Dispatch,
  SetStateAction,
} from 'react';

const defaultProgress = 0;
const defaultIsPlaying = false;
const defaultSelectionStart = 0;
const defaultSelectionEnd = 0;

const defaultPlayout = {
  progress: defaultProgress,
  isPlaying: defaultIsPlaying,
  selectionStart: defaultSelectionStart,
  selectionEnd: defaultSelectionEnd,
};

const PlayoutStatusContext = createContext(defaultPlayout);

type PlayoutStatusUpdate = {
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setProgress: Dispatch<SetStateAction<number>>;
  setSelection: (start: number, end: number) => void;
};
const PlayoutStatusUpdateContext = createContext<PlayoutStatusUpdate>({
  setIsPlaying: () => {},
  setProgress: () => {},
  setSelection: () => {},
});

type Props = {
  children: ReactNode;
};
export const PlayoutProvider = ({ children }: Props) => {
  const [isPlaying, setIsPlaying] = useState(defaultIsPlaying);
  const [progress, setProgress] = useState(defaultProgress);
  const [selectionStart, setSelectionStart] = useState(defaultSelectionStart);
  const [selectionEnd, setSelectionEnd] = useState(defaultSelectionEnd);

  const setSelection = (start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  return (
    <PlayoutStatusUpdateContext.Provider value={{ setIsPlaying, setProgress, setSelection }}>
      <PlayoutStatusContext.Provider value={{ isPlaying, progress, selectionStart, selectionEnd }}>
        {children}
      </PlayoutStatusContext.Provider>
    </PlayoutStatusUpdateContext.Provider>
  );
};

export const usePlayoutStatus = () => useContext(PlayoutStatusContext);
export const usePlayoutStatusUpdate = () =>
  useContext(PlayoutStatusUpdateContext);
