export type Language = "en" | "es" | "fr";

export const LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
];

type TranslationKeys = {
  // Common
  appName: string;
  loading: string;
  error: string;
  success: string;
  cancel: string;
  confirm: string;
  save: string;
  delete: string;
  edit: string;
  back: string;
  next: string;
  done: string;
  close: string;
  retry: string;
  
  // Auth
  login: string;
  register: string;
  signOut: string;
  signOutConfirm: string;
  email: string;
  password: string;
  name: string;
  forgotPassword: string;
  noAccount: string;
  hasAccount: string;
  getStarted: string;
  
  // Navigation
  home: string;
  live: string;
  sports: string;
  history: string;
  profile: string;
  
  // Home Screen
  freeTipOfDay: string;
  premiumPredictions: string;
  viewAll: string;
  noPredictions: string;
  
  // Sports
  football: string;
  basketball: string;
  tennis: string;
  baseball: string;
  hockey: string;
  soccer: string;
  mma: string;
  boxing: string;
  golf: string;
  cricket: string;
  
  // Predictions
  probability: string;
  confidence: string;
  riskIndex: string;
  factors: string;
  prediction: string;
  matchTime: string;
  liveNow: string;
  upcoming: string;
  completed: string;
  correct: string;
  incorrect: string;
  pending: string;
  
  // Subscription
  premium: string;
  free: string;
  upgrade: string;
  subscribe: string;
  restorePurchases: string;
  noPurchasesFound: string;
  purchasesRestored: string;
  subscriptionActive: string;
  subscriptionExpires: string;
  perYear: string;
  
  // Settings
  settings: string;
  notifications: string;
  language: string;
  appearance: string;
  darkMode: string;
  lightMode: string;
  system: string;
  
  // Legal
  termsOfService: string;
  privacyPolicy: string;
  legal: string;
  
  // Profile
  version: string;
  subscription: string;
  
  // Messages
  welcomeTitle: string;
  welcomeSubtitle: string;
  noDataAvailable: string;
  pullToRefresh: string;
};

const translations: Record<Language, TranslationKeys> = {
  en: {
    // Common
    appName: "BetRight",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    back: "Back",
    next: "Next",
    done: "Done",
    close: "Close",
    retry: "Retry",
    
    // Auth
    login: "Log In",
    register: "Sign Up",
    signOut: "Sign Out",
    signOutConfirm: "Are you sure you want to sign out?",
    email: "Email",
    password: "Password",
    name: "Name",
    forgotPassword: "Forgot Password?",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    getStarted: "Get Started",
    
    // Navigation
    home: "Home",
    live: "Live",
    sports: "Sports",
    history: "History",
    profile: "Profile",
    
    // Home Screen
    freeTipOfDay: "Free Tip of the Day",
    premiumPredictions: "Premium Predictions",
    viewAll: "View All",
    noPredictions: "No predictions available",
    
    // Sports
    football: "Football",
    basketball: "Basketball",
    tennis: "Tennis",
    baseball: "Baseball",
    hockey: "Hockey",
    soccer: "Soccer",
    mma: "MMA",
    boxing: "Boxing",
    golf: "Golf",
    cricket: "Cricket",
    
    // Predictions
    probability: "Probability",
    confidence: "Confidence",
    riskIndex: "Risk Index",
    factors: "Key Factors",
    prediction: "Prediction",
    matchTime: "Match Time",
    liveNow: "Live Now",
    upcoming: "Upcoming",
    completed: "Completed",
    correct: "Correct",
    incorrect: "Incorrect",
    pending: "Pending",
    
    // Subscription
    premium: "Premium",
    free: "Free",
    upgrade: "Upgrade to Premium",
    subscribe: "Subscribe",
    restorePurchases: "Restore Purchases",
    noPurchasesFound: "No purchases found",
    purchasesRestored: "Purchases restored successfully",
    subscriptionActive: "Premium Active",
    subscriptionExpires: "Expires",
    perYear: "/year",
    
    // Settings
    settings: "Settings",
    notifications: "Notifications",
    language: "Language",
    appearance: "Appearance",
    darkMode: "Dark",
    lightMode: "Light",
    system: "System",
    
    // Legal
    termsOfService: "Terms of Service",
    privacyPolicy: "Privacy Policy",
    legal: "Legal",
    
    // Profile
    version: "Version",
    subscription: "Subscription",
    
    // Messages
    welcomeTitle: "AI-Powered Sports Predictions",
    welcomeSubtitle: "Get data-driven insights for smarter decisions",
    noDataAvailable: "No data available",
    pullToRefresh: "Pull to refresh",
  },
  
  es: {
    // Common
    appName: "BetRight",
    loading: "Cargando...",
    error: "Error",
    success: "Éxito",
    cancel: "Cancelar",
    confirm: "Confirmar",
    save: "Guardar",
    delete: "Eliminar",
    edit: "Editar",
    back: "Atrás",
    next: "Siguiente",
    done: "Listo",
    close: "Cerrar",
    retry: "Reintentar",
    
    // Auth
    login: "Iniciar Sesión",
    register: "Registrarse",
    signOut: "Cerrar Sesión",
    signOutConfirm: "¿Estás seguro de que quieres cerrar sesión?",
    email: "Correo Electrónico",
    password: "Contraseña",
    name: "Nombre",
    forgotPassword: "¿Olvidaste tu contraseña?",
    noAccount: "¿No tienes cuenta?",
    hasAccount: "¿Ya tienes cuenta?",
    getStarted: "Comenzar",
    
    // Navigation
    home: "Inicio",
    live: "En Vivo",
    sports: "Deportes",
    history: "Historial",
    profile: "Perfil",
    
    // Home Screen
    freeTipOfDay: "Consejo Gratis del Día",
    premiumPredictions: "Predicciones Premium",
    viewAll: "Ver Todo",
    noPredictions: "No hay predicciones disponibles",
    
    // Sports
    football: "Fútbol Americano",
    basketball: "Baloncesto",
    tennis: "Tenis",
    baseball: "Béisbol",
    hockey: "Hockey",
    soccer: "Fútbol",
    mma: "MMA",
    boxing: "Boxeo",
    golf: "Golf",
    cricket: "Críquet",
    
    // Predictions
    probability: "Probabilidad",
    confidence: "Confianza",
    riskIndex: "Índice de Riesgo",
    factors: "Factores Clave",
    prediction: "Predicción",
    matchTime: "Hora del Partido",
    liveNow: "En Vivo",
    upcoming: "Próximo",
    completed: "Completado",
    correct: "Correcto",
    incorrect: "Incorrecto",
    pending: "Pendiente",
    
    // Subscription
    premium: "Premium",
    free: "Gratis",
    upgrade: "Actualizar a Premium",
    subscribe: "Suscribirse",
    restorePurchases: "Restaurar Compras",
    noPurchasesFound: "No se encontraron compras",
    purchasesRestored: "Compras restauradas exitosamente",
    subscriptionActive: "Premium Activo",
    subscriptionExpires: "Expira",
    perYear: "/año",
    
    // Settings
    settings: "Configuración",
    notifications: "Notificaciones",
    language: "Idioma",
    appearance: "Apariencia",
    darkMode: "Oscuro",
    lightMode: "Claro",
    system: "Sistema",
    
    // Legal
    termsOfService: "Términos de Servicio",
    privacyPolicy: "Política de Privacidad",
    legal: "Legal",
    
    // Profile
    version: "Versión",
    subscription: "Suscripción",
    
    // Messages
    welcomeTitle: "Predicciones Deportivas con IA",
    welcomeSubtitle: "Obtén información basada en datos para decisiones más inteligentes",
    noDataAvailable: "No hay datos disponibles",
    pullToRefresh: "Desliza para actualizar",
  },
  
  fr: {
    // Common
    appName: "BetRight",
    loading: "Chargement...",
    error: "Erreur",
    success: "Succès",
    cancel: "Annuler",
    confirm: "Confirmer",
    save: "Enregistrer",
    delete: "Supprimer",
    edit: "Modifier",
    back: "Retour",
    next: "Suivant",
    done: "Terminé",
    close: "Fermer",
    retry: "Réessayer",
    
    // Auth
    login: "Connexion",
    register: "S'inscrire",
    signOut: "Déconnexion",
    signOutConfirm: "Êtes-vous sûr de vouloir vous déconnecter?",
    email: "Email",
    password: "Mot de passe",
    name: "Nom",
    forgotPassword: "Mot de passe oublié?",
    noAccount: "Pas de compte?",
    hasAccount: "Déjà un compte?",
    getStarted: "Commencer",
    
    // Navigation
    home: "Accueil",
    live: "En Direct",
    sports: "Sports",
    history: "Historique",
    profile: "Profil",
    
    // Home Screen
    freeTipOfDay: "Conseil Gratuit du Jour",
    premiumPredictions: "Prédictions Premium",
    viewAll: "Voir Tout",
    noPredictions: "Aucune prédiction disponible",
    
    // Sports
    football: "Football Américain",
    basketball: "Basketball",
    tennis: "Tennis",
    baseball: "Baseball",
    hockey: "Hockey",
    soccer: "Football",
    mma: "MMA",
    boxing: "Boxe",
    golf: "Golf",
    cricket: "Cricket",
    
    // Predictions
    probability: "Probabilité",
    confidence: "Confiance",
    riskIndex: "Indice de Risque",
    factors: "Facteurs Clés",
    prediction: "Prédiction",
    matchTime: "Heure du Match",
    liveNow: "En Direct",
    upcoming: "À Venir",
    completed: "Terminé",
    correct: "Correct",
    incorrect: "Incorrect",
    pending: "En Attente",
    
    // Subscription
    premium: "Premium",
    free: "Gratuit",
    upgrade: "Passer à Premium",
    subscribe: "S'abonner",
    restorePurchases: "Restaurer les Achats",
    noPurchasesFound: "Aucun achat trouvé",
    purchasesRestored: "Achats restaurés avec succès",
    subscriptionActive: "Premium Actif",
    subscriptionExpires: "Expire",
    perYear: "/an",
    
    // Settings
    settings: "Paramètres",
    notifications: "Notifications",
    language: "Langue",
    appearance: "Apparence",
    darkMode: "Sombre",
    lightMode: "Clair",
    system: "Système",
    
    // Legal
    termsOfService: "Conditions d'Utilisation",
    privacyPolicy: "Politique de Confidentialité",
    legal: "Légal",
    
    // Profile
    version: "Version",
    subscription: "Abonnement",
    
    // Messages
    welcomeTitle: "Prédictions Sportives par IA",
    welcomeSubtitle: "Obtenez des insights basés sur les données pour des décisions plus intelligentes",
    noDataAvailable: "Aucune donnée disponible",
    pullToRefresh: "Tirez pour actualiser",
  },
};

export function getTranslation(language: Language): TranslationKeys {
  return translations[language] || translations.en;
}

export function getLanguageName(code: Language): string {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? lang.nativeName : "English";
}
