'use client';
import { create } from 'zustand';
import type { TeamPlayer } from '../types';

interface TeamState {
  playingXI: string[];
  bench: string[];
  captain: string | null;
  viceCaptain: string | null;
  submittedTeamIds: string[];
  setPlayingXI: (ids: string[]) => void;
  setBench: (ids: string[]) => void;
  setCaptain: (id: string | null) => void;
  setViceCaptain: (id: string | null) => void;
  togglePlayerInXI: (player: TeamPlayer, allPlayers: TeamPlayer[]) => void;
  markTeamSubmitted: (teamId: string) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  playingXI: [],
  bench: [],
  captain: null,
  viceCaptain: null,
  submittedTeamIds: [],

  setPlayingXI: (ids) => set({ playingXI: ids }),
  setBench: (ids) => set({ bench: ids }),
  setCaptain: (id) => set({ captain: id }),
  setViceCaptain: (id) => set({ viceCaptain: id }),

  togglePlayerInXI: (player, allPlayers) => {
    const { playingXI, captain, viceCaptain } = get();
    let newXI: string[];

    if (playingXI.includes(player.id)) {
      // Remove from XI
      newXI = playingXI.filter((id) => id !== player.id);
      const updates: Partial<TeamState> = { playingXI: newXI };
      if (captain === player.id) updates.captain = null;
      if (viceCaptain === player.id) updates.viceCaptain = null;
      set(updates);
    } else if (playingXI.length < 11) {
      // Add to XI
      newXI = [...playingXI, player.id];
      set({ playingXI: newXI });
    }
    // If XI full (11), do nothing

    // Bench = remaining players not in XI
    const finalXI = get().playingXI;
    const bench = allPlayers.filter((p) => !finalXI.includes(p.id)).map((p) => p.id);
    set({ bench });
  },

  markTeamSubmitted: (teamId) =>
    set((state) => ({ submittedTeamIds: [...state.submittedTeamIds, teamId] })),

  clearTeam: () =>
    set({ playingXI: [], bench: [], captain: null, viceCaptain: null, submittedTeamIds: [] }),
}));
