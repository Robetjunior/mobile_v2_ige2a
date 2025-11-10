import { create } from 'zustand';

type FavoritesState = {
  ids: Set<string>;
  toggle: (id: string) => void;
  isFav: (id: string) => boolean;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: new Set<string>(),
  toggle: (id: string) => {
    const cur = new Set(get().ids);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    set({ ids: cur });
  },
  isFav: (id: string) => get().ids.has(id),
}));