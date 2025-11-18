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

const defaultPlayout = {
  progress: defaultProgress,
  isPlaying: defaultIsPlaying,
};

const PlayoutStatusContext = createContext(defaultPlayout);

type PlayoutStatusUpdate = {
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setProgress: Dispatch<SetStateAction<number>>;
};
const PlayoutStatusUpdateContext = createContext<PlayoutStatusUpdate>({
  setIsPlaying: () => {},
  setProgress: () => {},
});

type Props = {
  children: ReactNode;
};
export const PlayoutProvider = ({ children }: Props) => {
  const [isPlaying, setIsPlaying] = useState(defaultIsPlaying);
  const [progress, setProgress] = useState(defaultProgress);

  return (
    <PlayoutStatusUpdateContext.Provider value={{ setIsPlaying, setProgress }}>
      <PlayoutStatusContext.Provider value={{ isPlaying, progress }}>
        {children}
      </PlayoutStatusContext.Provider>
    </PlayoutStatusUpdateContext.Provider>
  );
};

export const usePlayoutStatus = () => useContext(PlayoutStatusContext);
export const usePlayoutStatusUpdate = () =>
  useContext(PlayoutStatusUpdateContext);
