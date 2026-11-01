// Les phrases de Pandi enregistrées avec ElevenLabs (voix « François Louis ») : le texte exact passé à
// say() -> le fichier assets/voix/<nom>.mp3. Une phrase absente d'ici est lue par la voix du téléphone.
// Changer une de ces phrases dans le code demande de la réenregistrer : la liste complète est dans
// voix-elevenlabs/textes.md (hors git).
export const VOIX = {
  // Pandi dit bonjour aux enfants (Decouverte.js, greetText)
  'Bonjour ! Je suis Pandi. Le matin et le soir, je fais la routine avec toi. Quand tu écoutes du premier coup, je danse de joie ! Avec tes pandi, tu choisiras des habits et des objets pour ton personnage. On commence ?': 'bonjour-un-matin-soir',
  'Bonjour les enfants ! Je suis Pandi. Le matin et le soir, je fais la routine avec vous. Quand vous écoutez du premier coup, je danse de joie ! Avec vos pandi, vous choisirez des habits et des objets pour votre personnage. On commence ?': 'bonjour-plusieurs-matin-soir',
  // La fête d'anniversaire (Anniversaire.js, words)
  'Joyeux anniversaire !': 'anniv-voeu',
  "Merci d'avoir fait la fête avec nous !": 'anniv-merci',
  'Encore une danse ? Joyeux anniversaire !': 'anniv-encore',
};

export const voixUrl = (nom) => new URL(`../../assets/voix/${nom}.mp3`, import.meta.url).href;
