import React from 'react';

import { AuthLanding } from './AuthLanding';

interface LoginScreenProps {
  onBack?: () => void;
}

export function LoginScreen({ onBack }: LoginScreenProps) {
  return <AuthLanding initialView="login" onBack={onBack} />;
}
