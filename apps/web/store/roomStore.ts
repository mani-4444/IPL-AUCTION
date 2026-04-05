'use client';
import { create } from 'zustand';
import type { Room, Team } from '../types';

interface RoomState {
  room: Room | null;
  myUserId: string | null;
  myTeamId: string | null;
  setRoom: (room: Room) => void;
  setMyUser: (userId: string, teamId: string) => void;
  getMyTeam: () => Team | null;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  room: null,
  myUserId: null,
  myTeamId: null,

  setRoom: (room) => set({ room }),

  setMyUser: (userId, teamId) => set({ myUserId: userId, myTeamId: teamId }),

  getMyTeam: () => {
    const { room, myUserId } = get();
    if (!room || !myUserId) return null;
    return room.teams.find((t) => t.userId === myUserId) ?? null;
  },

  clearRoom: () => set({ room: null, myUserId: null, myTeamId: null }),
}));
