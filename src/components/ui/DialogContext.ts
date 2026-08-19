import { createContext, useContext } from 'react';

export type DialogType = 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'danger';

export interface DialogOptions {
  type: DialogType;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>;
  alert: (message: string, type?: DialogType) => Promise<boolean>;
  confirm: (message: string, title?: string, isDanger?: boolean) => Promise<boolean>;
  success: (message: string) => Promise<boolean>;
  error: (message: string) => Promise<boolean>;
  loading: (message: string) => void;
  close: () => void;
}

export const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
