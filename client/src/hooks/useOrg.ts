import { useContext } from 'react';
import { OrgContext } from '../context/OrgContext';
import type { OrgContextValue } from '../context/OrgContext';

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error('useOrg must be used within an <OrgProvider>');
  }
  return ctx;
}
