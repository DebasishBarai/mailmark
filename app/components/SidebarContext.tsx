"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type FolderSectionRender = (collapsed: boolean) => ReactNode;

interface SidebarContextValue {
  folderSection: { render: FolderSectionRender } | null;
  setFolderSection: (section: { render: FolderSectionRender } | null) => void;
  closeMobile: () => void;
  setCloseMobile: (fn: () => void) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  folderSection: null,
  setFolderSection: () => {},
  closeMobile: () => {},
  setCloseMobile: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [folderSection, setFolderSection] = useState<{ render: FolderSectionRender } | null>(null);
  const [closeMobileFn, setCloseMobileFn] = useState<() => void>(() => () => {});

  const setCloseMobile = useCallback((fn: () => void) => {
    setCloseMobileFn(() => fn);
  }, []);

  return (
    <SidebarContext.Provider value={{ folderSection, setFolderSection, closeMobile: closeMobileFn, setCloseMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
