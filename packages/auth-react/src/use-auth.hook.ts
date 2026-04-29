import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './auth-context.js';

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error(
      'useAuth: no AuthContext in the tree. Wrap your app in <AuthProvider storage={...}>.',
    );
  }
  return value;
};
