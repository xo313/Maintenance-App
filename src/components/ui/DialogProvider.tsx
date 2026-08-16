import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info, AlertCircle, X, Loader2 } from 'lucide-react';

export type DialogType = 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'danger';

export interface DialogOptions {
  type: DialogType;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => Promise<boolean>;
  alert: (message: string, type?: DialogType) => Promise<boolean>;
  confirm: (message: string, title?: string, isDanger?: boolean) => Promise<boolean>;
  success: (message: string) => Promise<boolean>;
  error: (message: string) => Promise<boolean>;
  loading: (message: string) => void;
  close: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

// Map backend error codes to user-friendly messages
const errorMap: Record<string, string> = {
  DATABASE_SAVE_FAILED: "تعذر حفظ البيانات. لم يتم اعتماد التغيير.",
  BACKUP_HASH_MISMATCH: "النسخة الاحتياطية تالفة أو تم تعديلها.",
  MONTH_CLOSE_SAVE_FAILED: "تعذر حفظ إغلاق الشهر. لم يتم اعتماد الإغلاق.",
  INVALID_NEW_CAPITAL: "قيمة رأس المال غير صحيحة.",
  UNKNOWN_TECHNICIAN: "الفني المحدد غير موجود.",
  DEBT_ALREADY_PAID: "هذه العملية مسددة مسبقًا.",
  NOT_FOUND: "العنصر غير موجود.",
  CANNOT_EDIT_PAST_MONTH: "لا يمكن تعديل عمليات من شهر مغلق.",
  CANNOT_DELETE_PAST_MONTH: "لا يمكن حذف عمليات من شهر مغلق."
};

const getFriendlyMessage = (msg: string): string => {
  return errorMap[msg] || msg;
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const resolveRef = useRef<(value: boolean) => void>(() => {});
  
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const showDialog = (opts: DialogOptions): Promise<boolean> => {
    // Prevent opening a new dialog if it's already loading or open
    if (isOpen || loadingMessage) {
      console.warn("A dialog is already open. Ignoring new dialog request.");
      return Promise.resolve(false);
    }
    setOptions({
      ...opts,
      message: getFriendlyMessage(opts.message)
    });
    setIsOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  };

  const handleClose = (result: boolean) => {
    setIsOpen(false);
    resolveRef.current(result);
  };

  const closeProgrammatic = () => {
    setLoadingMessage(null);
    if (isOpen) {
      setIsOpen(false);
      resolveRef.current(false);
    }
  };

  const alert = (message: string, type: DialogType = 'info') => {
    return showDialog({ type, message, confirmText: 'حسنًا' });
  };

  const success = (message: string) => {
    return showDialog({ type: 'success', title: 'تم بنجاح', message, confirmText: 'حسنًا' });
  };

  const error = (message: string) => {
    return showDialog({ type: 'error', title: 'خطأ', message, confirmText: 'حسنًا' });
  };

  const loading = (message: string) => {
    setLoadingMessage(message);
  };

  const confirm = (message: string, title = 'تأكيد', isDanger = false) => {
    return showDialog({
      type: isDanger ? 'danger' : 'confirm',
      title,
      message,
      confirmText: isDanger ? 'تأكيد' : 'نعم',
      cancelText: 'إلغاء'
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (loadingMessage) return;
      if (!isOpen || !options) return;

      if (e.key === 'Escape') {
        handleClose(false);
      } else if (e.key === 'Enter') {
        // Prevent enter from triggering if focus is on cancel button
        if (document.activeElement?.getAttribute('data-action') === 'cancel') {
          handleClose(false);
        } else {
          handleClose(true);
        }
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Auto focus confirm button
      setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options]);

  const getIcon = () => {
    switch (options?.type) {
      case 'success': return <CheckCircle size={48} className="text-success mb-4 mx-auto" style={{ color: 'var(--success)' }} />;
      case 'error': return <AlertCircle size={48} className="text-danger mb-4 mx-auto" style={{ color: 'var(--danger)' }} />;
      case 'danger': return <AlertTriangle size={48} className="text-danger mb-4 mx-auto" style={{ color: 'var(--danger)' }} />;
      case 'warning': return <AlertTriangle size={48} className="text-warning mb-4 mx-auto" style={{ color: '#f59e0b' }} />;
      case 'confirm': return <Info size={48} className="text-primary mb-4 mx-auto" style={{ color: 'var(--primary)' }} />;
      case 'info': return <Info size={48} className="text-primary mb-4 mx-auto" style={{ color: 'var(--primary)' }} />;
      default: return null;
    }
  };

  return (
    <DialogContext.Provider value={{ showDialog, alert, confirm, success, error, loading, close: closeProgrammatic }}>
      {children}
      {isOpen && options && (
        <div 
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          onClick={() => {
            // Do not close on overlay click for confirms or danger to prevent accidental actions
            if (options.type !== 'confirm' && options.type !== 'danger') {
              handleClose(false);
            }
          }}
          style={{ zIndex: 9999 }}
        >
          <div 
            className="modal-content text-center" 
            ref={modalRef}
            onClick={e => e.stopPropagation()}
            style={{ 
              animation: 'fadeIn 0.2s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {options.type !== 'confirm' && options.type !== 'danger' && (
               <button 
                 onClick={() => handleClose(false)}
                 style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                 aria-label="إغلاق"
               >
                 <X size={24} />
               </button>
            )}
            
            {getIcon()}
            
            {options.title && (
              <h2 id="dialog-title" style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
                {options.title}
              </h2>
            )}
            
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {options.message}
            </p>
            
            <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center', marginTop: '1rem' }}>
              {(options.type === 'confirm' || options.type === 'danger') && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleClose(false)}
                  data-action="cancel"
                  style={{ flex: 1 }}
                >
                  {options.cancelText || 'إلغاء'}
                </button>
              )}
              
              <button 
                ref={confirmBtnRef}
                className={`btn ${options.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                onClick={() => handleClose(true)}
                data-action="confirm"
                style={{ flex: 1 }}
              >
                {options.confirmText || 'حسنًا'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loadingMessage && (
        <div 
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loading-title"
          style={{ zIndex: 10000 }}
        >
          <div 
            className="modal-content text-center" 
            style={{ 
              animation: 'fadeIn 0.2s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Loader2 size={48} className="text-primary mb-4 mx-auto spinner" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <h2 id="loading-title" style={{ color: 'var(--text-main)', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
              جاري المعالجة...
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {loadingMessage}
            </p>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
