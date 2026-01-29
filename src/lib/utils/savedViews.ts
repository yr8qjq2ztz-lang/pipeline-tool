/**
 * Saved Views System
 * Allows users to save and restore filter combinations
 */

export interface SavedView {
  id: string;
  name: string;
  filters: {
    branch?: string;
    stage?: string;
    closeWindow?: "all" | "next30" | "next60" | "past";
    probBand?: "all" | "0-30" | "31-60" | "61-100";
    health?: "all" | "at-risk" | "caution" | "healthy";
    search?: string;
  };
  createdAt: Date;
}

const STORAGE_KEY = "pipeline_saved_views";

const devError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.error(...args);
};

export function getSavedViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // Validate it's an array and contains valid SavedView objects
    if (!Array.isArray(parsed)) return [];
    
    return parsed.filter(v => 
      v && typeof v === 'object' && v.id && v.name && v.filters
    ).map((v) => ({
      ...v,
      createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
    }));
  } catch (error) {
    console.warn("Failed to parse saved views:", error);
    return [];
  }
}

export function saveView(name: string, filters: SavedView["filters"]): SavedView {
  // Validate inputs
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error("View name is required");
  }
  if (!filters || typeof filters !== 'object') {
    throw new Error("Filters must be provided");
  }

  try {
    const views = getSavedViews();
    
    const newView: SavedView = {
      id: `view_${Date.now()}`,
      name: name.trim(),
      filters,
      createdAt: new Date(),
    };

    views.push(newView);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    
    return newView;
  } catch (error) {
    devError("Failed to save view:", error);
    throw new Error("Failed to save view. Check browser storage limits.");
  }
}

export function deleteView(id: string): void {
  if (!id || typeof id !== 'string') {
    console.warn("Invalid view ID provided");
    return;
  }
  
  try {
    const views = getSavedViews();
    const filtered = views.filter((v) => v.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    devError("Failed to delete view:", error);
  }
}

export function updateViewName(id: string, newName: string): void {
  if (!id || typeof id !== 'string') {
    console.warn("Invalid view ID provided");
    return;
  }
  if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
    console.warn("Invalid view name provided");
    return;
  }
  
  try {
    const views = getSavedViews();
    const view = views.find((v) => v.id === id);
    
    if (view) {
      view.name = newName.trim();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    } else {
      console.warn("View not found:", id);
    }
  } catch (error) {
    devError("Failed to update view name:", error);
  }
}
