"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type FolderSectionRender = (collapsed: boolean) => ReactNode;

interface SidebarContextValue {
  folderSection: { render: FolderSectionRender } | null;
  setFolderSection: (section: { render: FolderSectionRender } | null) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  folderSection: null,
  setFolderSection: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [folderSection, setFolderSection] = useState<{ render: FolderSectionRender } | null>(null);

  return (
    <SidebarContext.Provider value={{ folderSection, setFolderSection }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
