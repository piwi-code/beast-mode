import React, { createContext, useContext, useMemo } from 'react';
import { IWorkoutRepository } from '../interfaces/repositories';
import { DexieWorkoutRepository } from '../local/dexieRepository';

const RepositoryContext = createContext<IWorkoutRepository | null>(null);

export const RepositoryProvider: React.FC<{
  repository?: IWorkoutRepository;
  children: React.ReactNode;
}> = ({ repository, children }) => {
  const repoInstance = useMemo(
    () => repository ?? new DexieWorkoutRepository(),
    [repository]
  );

  return (
    <RepositoryContext.Provider value={repoInstance}>
      {children}
    </RepositoryContext.Provider>
  );
};

export function useWorkoutRepository(): IWorkoutRepository {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error('useWorkoutRepository must be used within a RepositoryProvider');
  }
  return ctx;
}
