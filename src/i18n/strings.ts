export type Lang = 'pt-BR' | 'en-US';
export type Keys =
  | 'account.title'
  | 'account.recentlyUsed'
  | 'account.myCard'
  | 'account.settings'
  | 'account.about'
  | 'account.signOut'
  | 'cards.title'
  | 'cards.add'
  | 'cards.numberPlaceholder'
  | 'cards.save'
  | 'cards.default'
  | 'cards.setDefault'
  | 'cards.remove'
  | 'cards.removeConfirm'
  | 'cards.maxTwo'
  | 'cards.brand.unknown'
  | 'cards.brand.visa'
  | 'cards.brand.mastercard'
  | 'cards.brand.amex'
  | 'settings.title'
  | 'settings.language'
  | 'settings.notifications'
  | 'settings.privacy'
  | 'settings.themeDisabled'
  | 'recentlyUsed.title'
  | 'recentlyUsed.empty'
  | 'about.title'
  | 'about.terms'
  | 'about.policy'
  ;

export const STRINGS: Record<Lang, Record<Keys, string>> = {
  'pt-BR': {
    'account.title': 'Conta',
    'account.recentlyUsed': 'Recentes',
    'account.myCard': 'Meu Cartão',
    'account.settings': 'Configurações',
    'account.about': 'Sobre nós',
    'account.signOut': 'Sair',
    'cards.title': 'Meu Cartão',
    'cards.add': 'Adicionar cartão',
    'cards.numberPlaceholder': 'Número do cartão',
    'cards.save': 'Salvar',
    'cards.default': 'Cartão padrão',
    'cards.setDefault': 'Definir padrão',
    'cards.remove': 'Remover',
    'cards.removeConfirm': 'Confirmar remoção?',
    'cards.maxTwo': 'Máximo de 2 cartões',
    'cards.brand.unknown': 'Bandeira desconhecida',
    'cards.brand.visa': 'Visa',
    'cards.brand.mastercard': 'Mastercard',
    'cards.brand.amex': 'Amex',
    'settings.title': 'Configurações',
    'settings.language': 'Idioma (pt-BR/en-US)',
    'settings.notifications': 'Notificações',
    'settings.privacy': 'Privacidade',
    'settings.themeDisabled': 'Tema (em breve)',
    'recentlyUsed.title': 'Recentes',
    'recentlyUsed.empty': 'Sem histórico ainda',
    'about.title': 'Sobre nós',
    'about.terms': 'Termos',
    'about.policy': 'Política',
  },
  'en-US': {
    'account.title': 'Account',
    'account.recentlyUsed': 'Recently Used',
    'account.myCard': 'My Card',
    'account.settings': 'Settings',
    'account.about': 'About us',
    'account.signOut': 'Sign out',
    'cards.title': 'My Card',
    'cards.add': 'Add card',
    'cards.numberPlaceholder': 'Card number',
    'cards.save': 'Save',
    'cards.default': 'Default card',
    'cards.setDefault': 'Set default',
    'cards.remove': 'Remove',
    'cards.removeConfirm': 'Confirm removal?',
    'cards.maxTwo': 'Maximum of 2 cards',
    'cards.brand.unknown': 'Unknown brand',
    'cards.brand.visa': 'Visa',
    'cards.brand.mastercard': 'Mastercard',
    'cards.brand.amex': 'Amex',
    'settings.title': 'Settings',
    'settings.language': 'Language (pt-BR/en-US)',
    'settings.notifications': 'Notifications',
    'settings.privacy': 'Privacy',
    'settings.themeDisabled': 'Theme (soon)',
    'recentlyUsed.title': 'Recently Used',
    'recentlyUsed.empty': 'No history yet',
    'about.title': 'About us',
    'about.terms': 'Terms',
    'about.policy': 'Policy',
  },
};