export interface Updatable {
  update(delta: number): void;
}

export interface Seekable {
  setTime(time: number): void;
}

export interface Resettable {
  reset(): void;
}

export interface Disposable {
  dispose(): void;
}

export type TimelineParticipant = Updatable &
  Seekable &
  Resettable &
  Disposable;
