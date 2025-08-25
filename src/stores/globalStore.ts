import { create } from 'zustand';
import { User, Settings, Lead, Application } from '../types';

interface GlobalState {
  // User and settings
  user: User | null;
  settings: Settings | null;
  
  // Current selections
  selectedLead: Lead | null;
  selectedApplication: Application | null;
  
  // UI state
  sidebarOpen: boolean;
  loading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setSettings: (settings: Settings | null) => void;
  setSelectedLead: (lead: Lead | null) => void;
  setSelectedApplication: (application: Application | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  user: null,
  settings: null,
  selectedLead: null,
  selectedApplication: null,
  sidebarOpen: true,
  loading: false,
  
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),
  setSelectedLead: (selectedLead) => set({ selectedLead }),
  setSelectedApplication: (selectedApplication) => set({ selectedApplication }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setLoading: (loading) => set({ loading }),
}));

// Content Studio specific store
interface ContentStudioState {
  selectedTone: string;
  selectedLength: string;
  selectedSnippets: string[];
  selectedResume?: string;
  currentArtifact?: any;
  previewOpen: boolean;
  
  setSelectedTone: (tone: string) => void;
  setSelectedLength: (length: string) => void;
  setSelectedSnippets: (snippets: string[]) => void;
  setSelectedResume: (resume?: string) => void;
  setCurrentArtifact: (artifact?: any) => void;
  setPreviewOpen: (open: boolean) => void;
  reset: () => void;
}

export const useContentStudioStore = create<ContentStudioState>((set) => ({
  selectedTone: 'honest',
  selectedLength: 'medium',
  selectedSnippets: [],
  selectedResume: undefined,
  currentArtifact: undefined,
  previewOpen: false,
  
  setSelectedTone: (selectedTone) => set({ selectedTone }),
  setSelectedLength: (selectedLength) => set({ selectedLength }),
  setSelectedSnippets: (selectedSnippets) => set({ selectedSnippets }),
  setSelectedResume: (selectedResume) => set({ selectedResume }),
  setCurrentArtifact: (currentArtifact) => set({ currentArtifact }),
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  reset: () => set({
    selectedTone: 'honest',
    selectedLength: 'medium',
    selectedSnippets: [],
    selectedResume: undefined,
    currentArtifact: undefined,
    previewOpen: false,
  }),
}));