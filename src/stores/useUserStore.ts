import { create } from 'zustand';

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'unknown';
export type UserCard = { id: string; brand: CardBrand; masked: string; last4: string; isDefault: boolean };

export type User = {
  id: string;
  publicId: string;
  name: string;
  avatarUrl?: string;
  hasPaymentCard: boolean;
  cards?: UserCard[];
};

type UserState = {
  user?: User;
  loading: boolean;
  error?: string;
  prefs: { language: 'pt-BR'|'en-US'; notifications: boolean };
  getUser: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  updatePrefs: (patch: Partial<{ language: 'pt-BR'|'en-US'; notifications: boolean }>) => void;
  signOut: () => Promise<void>;
  signInMock: (u?: Partial<User>) => void; // auxiliar para testes/dev
  addCard: (cardNumber: string) => { ok: boolean; message?: string };
  removeCard: (id: string) => void;
  setDefaultCard: (id: string) => void;
};

const MOCK_USER: User = {
  id: 'u-001',
  publicId: 'Go250922150835958',
  name: 'Jose Roberto',
  avatarUrl: undefined,
  hasPaymentCard: true,
  cards: [
    { id: 'c-visa-sample', brand: 'visa', masked: '**** **** **** 1111', last4: '1111', isDefault: true },
    { id: 'c-mc-sample', brand: 'mastercard', masked: '**** **** **** 4444', last4: '4444', isDefault: false },
  ],
};

export const useUserStore = create<UserState>((set, get) => ({
  user: MOCK_USER,
  loading: false,
  error: undefined,
  prefs: { language: 'pt-BR', notifications: true },
  getUser: async () => {
    set({ loading: true, error: undefined });
    try {
      // mock: manter usuário em memória; simular pequeno delay
      await new Promise((r) => setTimeout(r, 150));
      set({ user: get().user ?? MOCK_USER, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Falha ao carregar usuário', loading: false });
    }
  },
  updateUser: (patch) => {
    const current = get().user ?? MOCK_USER;
    set({ user: { ...current, ...patch } });
  },
  updatePrefs: (patch) => {
    set({ prefs: { ...get().prefs, ...patch } });
  },
  addCard: (cardNumber) => {
    const user = get().user ?? MOCK_USER;
    const cards = user.cards ?? [];
    if (cards.length >= 2) return { ok: false, message: 'Máximo de 2 cartões' };
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 16) return { ok: false, message: 'Cartão inválido' };
    const brand: CardBrand = detectBrand(digits);
    const last4 = digits.slice(-4);
    const masked = `**** **** **** ${last4}`;
    const id = `c-${Date.now()}`;
    const isDefault = cards.length === 0;
    const nextCards = [...cards, { id, brand, masked, last4, isDefault }];
    set({ user: { ...user, hasPaymentCard: nextCards.length > 0, cards: nextCards } });
    return { ok: true };
  },
  removeCard: (id) => {
    const user = get().user ?? MOCK_USER;
    const cards = (user.cards ?? []).filter((c) => c.id !== id);
    if (cards.length > 0) {
      // garantir um padrão
      cards[0] = { ...cards[0], isDefault: true };
    }
    set({ user: { ...user, hasPaymentCard: cards.length > 0, cards } });
  },
  setDefaultCard: (id) => {
    const user = get().user ?? MOCK_USER;
    const cards = (user.cards ?? []).map((c) => ({ ...c, isDefault: c.id === id }));
    set({ user: { ...user, cards } });
  },
  signOut: async () => {
    // limpar stores relacionadas aqui se necessário
    set({ loading: true });
    await new Promise((r) => setTimeout(r, 120));
    set({ user: undefined, loading: false });
  },
  signInMock: (u) => {
    const next: User = { ...MOCK_USER, ...(u || {}) } as User;
    set({ user: next });
  },
}));

function detectBrand(digits: string): CardBrand {
  if (/^4\d{12,18}$/.test(digits)) return 'visa';
  if (/^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/.test(digits)) return 'mastercard';
  if (/^(34|37)\d{13}$/.test(digits)) return 'amex';
  return 'unknown';
}