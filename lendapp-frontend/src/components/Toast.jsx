import { useState, useCallback } from "react";

let toastFn = null;
export function useToast() {
  return toastFn;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  toastFn = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);
  return (
    <>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
