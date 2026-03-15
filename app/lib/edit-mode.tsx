import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface EditModeContextValue {
  editMode: boolean;
  toggleEditMode: () => void;
  disableEditMode: () => void;
}

const EditModeContext = createContext<EditModeContextValue | undefined>(
  undefined,
);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("editMode") === "true";
    } catch {
      return false;
    }
  });

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("editMode", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const disableEditMode = useCallback(() => {
    setEditMode(false);
    try {
      localStorage.setItem("editMode", "false");
    } catch {
      // ignore
    }
  }, []);

  return (
    <EditModeContext.Provider
      value={{ editMode, toggleEditMode, disableEditMode }}
    >
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode(): EditModeContextValue {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    throw new Error("useEditMode must be used within EditModeProvider");
  }
  return ctx;
}
