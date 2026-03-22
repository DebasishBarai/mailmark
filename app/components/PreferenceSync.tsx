"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useThemeInternal } from "./ThemeProvider";

export default function PreferenceSync() {
  const { _applyFromDb, _setSaveToDb } = useThemeInternal();
  const user = useQuery(api.users.current);
  const updatePreferences = useMutation(api.users.updatePreferences);
  const syncedFromDb = useRef(false);

  // Register the save function so ThemeProvider can call it on changes
  useEffect(() => {
    _setSaveToDb((prefs) => {
      updatePreferences(prefs).catch(() => {});
    });
  }, [_setSaveToDb, updatePreferences]);

  // When user data loads, apply DB preferences once
  useEffect(() => {
    if (!user || syncedFromDb.current) return;
    syncedFromDb.current = true;

    _applyFromDb({
      prefTheme: user.prefTheme,
      prefDensity: user.prefDensity,
      prefWallpaper: user.prefWallpaper,
    });
  }, [user, _applyFromDb]);

  return null;
}
