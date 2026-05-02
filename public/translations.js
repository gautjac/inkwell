// Inkwell — i18n translations
// Usage: t('key') returns the string in the current language
// Loads from Firestore if available, falls back to hardcoded values

const FIREBASE_API_KEY = 'AIzaSyBTAN4kfoaea6RCwN0qUfeTbfqBwXigEDw';
const FIREBASE_PROJECT = 'charlotte-dashboard';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// Default translations (fallback)
const DEFAULT_TRANSLATIONS = {
  en: {
    // Topbar
    'title.placeholder': 'Untitled Song…',
    'chip.key': 'Key of A',
    'chip.tempo': '92 BPM',
    'chip.mood': 'Melancholic',
    'btn.split': '⊞ Split',
    'btn.split.active': '⊟ Split',
    'btn.export': 'Export ▾',
    'btn.save': 'Save',
    'btn.saved': 'Saved ✓',
    'btn.player': '⏺ Player / Recorder',
    'btn.cowriter': 'Co-Writer',
    'export.txt': 'Plain text',
    'export.md': 'Markdown',
    'export.pdf': 'PDF',
    'settings.import': 'Import',
    'settings.export.txt': 'Export as Text',
    'settings.export.md': 'Export as Markdown',
    'settings.export.pdf': 'Export as PDF',
    'settings.tour': 'Feature tour',
    'settings.feedback': 'Send feedback',
    'mobile.editVoice': '✎ Edit voice profile',
    'mobile.tour': '🧭 Feature tour',
    'mobile.feedback': '💬 Send feedback',
    'plan.badge.upgrade': 'Upgrade',
    'plan.badge.getPro': 'Get Pro',

    // Sidebar
    'sidebar.structure': 'Song Structure',
    'sidebar.add': '+ Add Section',
    'sidebar.history': 'History',
    'sidebar.history.loading': 'Loading…',
    'sidebar.history.empty': 'No history yet',
    'sidebar.lines.one': ' line',
    'sidebar.lines.many': ' lines',

    // Editor
    'editor.placeholder.0': 'Start here…',
    'editor.placeholder.1': 'Keep going…',
    'section.badge.verse': 'Verse',
    'section.badge.chorus': 'Chorus',
    'section.badge.bridge': 'Bridge',
    'section.badge.outro': 'Outro',

    // Section defaults
    'section.verse1': 'Verse 1',
    'section.prechorus': 'Pre-Chorus',
    'section.chorus': 'Chorus',
    'section.verse2': 'Verse 2',
    'section.bridge': 'Bridge',
    'section.outro': 'Outro',
    'section.add.prompt': 'Section name:',
    'section.add.default': 'Bridge 2',

    // AI panel
    'ai.title': 'Co-Writer',
    'ai.subtitle': 'writing in your voice',
    'ai.empty': 'Select a line, then choose a tool above.',
    'ai.group.line': 'Line tools',
    'ai.group.section': 'Section tools',
    'ai.loading': 'Thinking…',

    // AI tools
    'tool.match.label': 'Match this rhythm',
    'tool.match.desc': '3 alternatives with the same syllable count',
    'tool.rhyme.label': 'Find rhymes',
    'tool.rhyme.desc': 'Rhymes + slant rhymes for the last word',
    'rhyme.all': 'All',
    'rhyme.perfect': 'Perfect',
    'rhyme.near': 'Near',
    'rhyme.anysyl': 'Any',
    'rhyme.none': 'No rhymes found for this filter',
    'rhyme.result': 'rhyme',
    'rhyme.results': 'rhymes',
    'tool.rewrite.label': 'Rewrite 3 ways',
    'tool.rewrite.desc': 'Same meaning, 3 different angles or images',
    'tool.prosody.label': 'Fix the flow',
    'tool.prosody.desc': 'Rewrite for natural melodic stress',
    'tool.phrases.label': 'Find phrases',
    'tool.phrases.desc': 'Idioms & sayings with this word',
    'tool.wordfamily.label': 'Word families',
    'tool.wordfamily.desc': 'Creative replacements beyond synonyms',
    'wordfamily.all': 'All',
    'wordfamily.primary': 'Primary',
    'wordfamily.extended': 'Extended',
    'wordfamily.intensifiers': 'Intensifiers',
    'wordfamily.empty': 'No words found',
    'tool.simile.label': 'As a simile',
    'tool.simile.desc': 'Rewrite using "like" or "as"',
    'tool.alliteration.label': 'Add alliteration',
    'tool.alliteration.desc': 'Repeat sounds for rhythm & punch',
    'intensifiers.title': 'Power Words',
    'intensifiers.verbs': 'Verbs',
    'intensifiers.adjectives': 'Adjectives',
    'tool.flow.label': 'Flow',
    'tool.flow.desc': 'Rhythm & stress analysis per line',
    'tool.fit.label': 'Fit',
    'tool.fit.desc': 'Rewrite line to match section syllable count',
    'tool.specific.label': 'Get specific',
    'tool.specific.desc': 'Questions to make your lyrics more concrete',
    'tool.perspective.label': 'Shift perspective',
    'tool.perspective.desc': 'Rewrite from a different POV',
    'tool.hook.label': 'Write a hook',
    'tool.hook.desc': 'Title-worthy lines from this section\'s theme',
    'tool.metaphor.label': 'Find a metaphor',
    'tool.metaphor.desc': 'Fresh unexpected images for this theme',
    'tool.bridge.label': 'Suggest a bridge',
    'tool.bridge.desc': 'Contrasting section before the final chorus',
    'tool.unstuck.label': 'I\'m stuck',
    'tool.unstuck.desc': '3 completely different directions',

    // AI modal "Use this"
    'modal.use.label': 'Use this line',
    'modal.use.btn': 'Use this',
    'modal.use.replace': '↺ Replace line',
    'modal.use.below': '↓ Insert below',
    'modal.use.cancel': 'Cancel',
    'modal.use.alert': 'Click a line in the editor first, then hit "Use this".',

    // Audio player
    'audio.import': '♫ Import track',
    'audio.loop.off': '⟲ Loop off',
    'audio.loop.on': '⟲ Loop on',
    'audio.loop.hint': 'turn loop on, then drag waveform to select',
    'audio.record': '● Record',
    'audio.stop': '⏹ Stop',
    'audio.takes.empty': 'No recordings yet — press ● Record to capture an idea',
    'audio.overdub': '+ Overdub',

    // Meta modal
    'meta.key.label': 'Key',
    'meta.tempo.label': 'Tempo (BPM)',
    'meta.mood.label': 'Mood',
    'meta.mood.add': 'Add a mood…',
    'meta.btn.set': 'Set',
    'meta.btn.cancel': 'Cancel',

    // Voice profiles
    'voice.none': 'No voice',
    'voice.header': 'Writing voices',
    'voice.edit': '✎ Edit this voice',
    'voice.new': '+ New voice profile',
    'voice.delete.confirm': 'Delete',

    // Onboarding
    'ob.welcome.eyebrow': 'Welcome to Inkwell',
    'ob.welcome.heading': 'Let\'s set up your\nwriting voice.',
    'ob.welcome.sub': 'A few questions will help the AI write with you, not for you — suggestions that sound like you, not like a robot.',
    'ob.welcome.btn': 'Let\'s do it →',
    'ob.profile.eyebrow': 'Step 1 of 7',
    'ob.profile.heading': 'Name this voice profile.',
    'ob.profile.sub': 'You can have multiple profiles — one for folk, one for pop, one for late-night sad songs. What\'s this one called?',
    'ob.profile.placeholder': 'e.g. Folk voice, Late-night pop, Country…',
    'ob.name.eyebrow': 'Step 2 of 7',
    'ob.name.heading': 'What do people call you?',
    'ob.name.sub': 'Just a name so Inkwell can address you properly.',
    'ob.name.placeholder': 'Your name…',
    'ob.done.eyebrow': 'Your writing voice',
    'ob.done.heading': 'Here\'s what the AI\nnow knows about you.',
    'ob.done.sub': 'You can update this anytime from the ✦ menu. Every suggestion will now be shaped by this profile.',
    'ob.done.btn': 'Start writing ✦',
    'ob.back': '← Back',
    'ob.continue': 'Continue →',
    'ob.skip': 'Skip this step',

    // Mood defaults
    'moods.default': 'Melancholic,Hopeful,Anthemic,Bittersweet,Raw,Dreamy,Urgent,Tender,Dark,Playful',

    // Song picker
    'song.untitled': 'Untitled Song',
    'song.new': '+ New song',
    'song.library': 'Your Songs',
    'song.count.one': 'song',
    'song.count.many': 'songs',
    'song.delete': 'Delete',
    'song.delete.confirm': 'Delete "{title}"?',
    'song.empty': 'No songs yet — start writing!',

    // History
    'history.restore': 'Restore',

    // Versioning
    'version.fork': '⑂ Fork',
    'version.delete': 'Delete version',

    // Scratch Pad
    'scratch.title': 'Collected',
    'scratch.empty': 'Star ⭐ suggestions to collect them here',
    'scratch.insert': 'Insert',
    'scratch.delete': '×',

    // AI Tool Info Modals
    'info.gotit': 'Got it',
    'info.match.title': 'Match this rhythm',
    'info.match.body': 'Counts the syllables in your selected line, then generates 3 alternative lines with the same count — so they\'ll fit your melody just as naturally as the original.\n\nThis is the prosody tool: it solves the classic problem of "I know the melody, but these words don\'t quite land on the right beats."',
    'info.match.tip': '<strong>Best used when:</strong> You have a line that works melodically but the words feel wrong, or you\'re staring at a blank line and know exactly how many syllables you need.',
    
    'info.rhyme.title': 'Find rhymes',
    'info.rhyme.body': 'Takes the last word of your selected line and returns rhyme options — including perfect rhymes, near-rhymes, and slant rhymes (words that share a sound but don\'t match exactly, like "home" and "alone").\n\nSlant rhymes often sound more natural and less forced than perfect rhymes, which is why the best songwriters lean on them heavily.',
    'info.rhyme.tip': '<strong>Pro tip:</strong> Click any rhyme word to drop it directly into the end of your selected line. Then edit the line to make it yours.',
    
    'info.rewrite.title': 'Rewrite 3 ways',
    'info.rewrite.body': 'Takes your selected line and rewrites it 3 times — keeping the same core meaning or emotion, but approaching it from a different angle each time: different image, different metaphor, different emotional register.\n\nThis is a great way to find the version of a line that feels most like you, without starting from scratch.',
    'info.rewrite.tip': '<strong>Best used when:</strong> You have a line that\'s almost right but not quite there — you know what you want to say, just not how to say it yet.',
    
    'info.prosody.title': 'Fix the flow (Prosody)',
    'info.prosody.body': 'Prosody is the relationship between where the natural stress falls in your words and where the strong beats fall in your melody. When they fight each other, the line feels awkward — even if the words are great.\n\nThis tool rewrites your selected line 3 ways, prioritising natural spoken stress, singable vowel sounds, and words that feel inevitable coming out of a singer\'s mouth.',
    'info.prosody.tip': '<strong>Example:</strong> "I remember the day that you left me behind" might stress the wrong syllables. A prosody fix might suggest "The day you left, I stood at the window" — same feeling, better fit.',
    
    'info.wordfamily.title': 'Word families',
    'info.wordfamily.body': 'A thesaurus gives you synonyms. Word families go further — words that could replace your target word MORE CREATIVELY, even if they\'re not exact synonyms.\n\nThis tool takes a key word from your line and returns three categories:\n• Primary: close synonyms that fit most contexts\n• Extended: unexpected replacements that add color\n• Intensifiers: stronger or softer versions for emphasis',
    'info.wordfamily.tip': '<strong>Example:</strong> "sad" → Primary: melancholy, sorrowful. Extended: hollow, fading, winter-grey. Intensifiers: devastated, gutted (stronger) or wistful, tender (softer).',
    
    'info.simile.title': 'Rewrite as a simile',
    'info.simile.body': 'A simile compares two things using "like" or "as" — it makes abstract emotions concrete and gives listeners a vivid mental image.\n\nThis tool takes your selected line and rewrites it 3 ways using simile, keeping the core emotion but making it land more tangibly.',
    'info.simile.tip': '<strong>Example:</strong> "I feel empty" → "I feel hollow like a bell that forgot how to ring"',
    
    'info.alliteration.title': 'Add alliteration',
    'info.alliteration.body': 'Alliteration — repeating consonant sounds at the start of words — creates rhythm, memorability, and punch. Think "wild and wicked" or "safe and sound."\n\nThis tool rewrites your selected line 3 ways with alliterative patterns woven in naturally.',
    'info.alliteration.tip': '<strong>Why it works:</strong> Our brains love patterns. Alliteration makes lyrics stickier without being obvious about it.',
    
    'info.flow.title': 'Flow — Rhythm Analysis',
    'info.flow.body': 'Every line of lyrics has a natural rhythm — stressed and unstressed syllables that create a pattern. When those patterns are consistent across lines, the section feels tight and singable.\n\nThis tool analyzes each line in your current section, showing the stress pattern (• stressed, ◦ unstressed) and a note on rhythmic consistency.',
    'info.flow.tip': '<strong>Best used when:</strong> You want to see if your section has a consistent rhythmic feel, or you\'re trying to figure out why one line feels "off" compared to the others.',

    'info.fit.title': 'Fit — Match Syllable Count',
    'info.fit.body': 'When one line in a section has noticeably more or fewer syllables than its neighbors, it can feel rhythmically awkward — even if the words are good.\n\nThis tool calculates the average syllable count of surrounding lines, then rewrites your selected line in 3 ways that hit that target count while preserving meaning.',
    'info.fit.tip': '<strong>Best used when:</strong> You have a line that feels too long or too short compared to the rest of the section, and you want to tighten the rhythm without changing the idea.',

    'info.phrases.title': 'Find phrases',
    'info.phrases.body': 'Every word carries baggage — idioms, sayings, clichés, and song hooks that have been attached to it over the years. Sometimes that\'s what you want: a familiar phrase twisted in a new direction.\n\nThis tool takes a key word from your selected line and returns 12-15 phrases, idioms, and expressions containing it. Use them as-is, flip them, or let them spark something unexpected.',
    'info.phrases.tip': '<strong>Example:</strong> Search "rain" and you get "right as rain", "rain on my parade", "purple rain", "let it rain", "singing in the rain" — raw material for your own twist.',
    
    'info.specific.title': 'Get specific',
    'info.specific.body': 'The #1 difference between amateur and professional lyrics is specificity. "I\'m so in love" tells us nothing. "You left your coffee on my desk for three days" tells us everything.\n\nThis tool reads your current section and asks 3 targeted questions to help you find the concrete, specific details hiding inside your abstract emotions: the exact moment, the object in the room, the sensory detail that makes it real.',
    'info.specific.tip': '<strong>Research finding:</strong> Over 80% of chart-topping songs succeed because of deeply personal, specific storytelling — not clever rhymes or big hooks.',
    
    'info.perspective.title': 'Shift perspective',
    'info.perspective.body': 'One of the most powerful moves in songwriting is changing who\'s speaking — or what\'s speaking.\n\nThis tool offers 2 different perspective rewrites of your section: second-person ("you did this to me"), third-person observer, an inanimate object in the scene, or your future self looking back. Each version reveals something the original couldn\'t.',
    'info.perspective.tip': '<strong>Classic example:</strong> "The River" by Bruce Springsteen is ostensibly about a couple — but it\'s really the river watching them. The object-perspective creates distance that makes the emotion hit harder.',
    
    'info.hook.title': 'Write a hook',
    'info.hook.body': 'A hook is the line people repeat after they leave. It\'s the song\'s title, its emotional core, its most memorable moment — usually 4–8 syllables, emotionally loaded, and specific enough to be surprising.\n\nThis tool reads your current section, identifies the emotional core, and generates 4 potential hook lines — the kind that would make someone want to hear the whole song.',
    'info.hook.tip': '<strong>What makes a great hook:</strong> Specific enough to be surprising, universal enough to be relatable. "Yesterday" works because everyone has a yesterday. "The Night We Met" works because it names a shared but particular moment.',
    
    'info.metaphor.title': 'Find a metaphor',
    'info.metaphor.body': 'Clichéd metaphors (storms, fire, broken hearts, open roads) slide past listeners without registering. A fresh, unexpected image makes them stop and feel.\n\nThis tool reads your section\'s core theme and suggests 3 original metaphors — concrete objects, unusual comparisons, or extended images that haven\'t been overused. Each comes with an example line so you can hear it in action.',
    'info.metaphor.tip': '<strong>Rule of thumb:</strong> If you\'ve heard the metaphor in 3 other songs, skip it. The goal is an image so specific it couldn\'t exist in anyone else\'s song.',
    
    'info.bridge.title': 'Suggest a bridge',
    'info.bridge.body': 'A bridge should feel like a revelation — a shift in time, perspective, or emotional register that makes the final chorus hit differently than the first one. It\'s the "but wait" moment of the song.\n\nThis tool reads your entire song, not just one section, and writes 3 full bridge drafts (4 lines each) that provide genuine contrast without feeling disconnected.',
    'info.bridge.tip': '<strong>Bridge checklist:</strong> Does it reveal something new? Does it change the emotional angle? Does it make the listener feel the final chorus was earned? If yes to all three, it\'s working.',
    
    'info.unstuck.title': 'I\'m stuck',
    'info.unstuck.body': 'When you\'re staring at the same lines and can\'t move forward, sometimes you need to blow up the approach entirely — not fix what\'s there, but try something completely different.\n\nThis tool reads your current section and offers 3 conceptual directions that are genuinely distinct from each other: different emotion, different metaphor, different structural idea. It gives you concepts, not lines — so you\'re still doing the writing.',
    'info.unstuck.tip': '<strong>Important:</strong> This tool gives you directions to explore, not lyrics to copy. Pick the one that sparks something and run with it in your own voice.',
  },

  fr: {
    // Topbar
    'title.placeholder': 'Chanson sans titre…',
    'chip.key': 'Tonalité La',
    'chip.tempo': '92 BPM',
    'chip.mood': 'Mélancolique',
    'btn.split': '⊞ Écran partagé',
    'btn.split.active': '⊟ Écran partagé',
    'btn.export': 'Exporter ▾',
    'btn.save': 'Enregistrer',
    'btn.saved': 'Enregistré ✓',
    'btn.player': '⏺ Lecteur / Enregistreur',
    'btn.cowriter': 'Co-auteur',
    'export.txt': 'Texte brut',
    'export.md': 'Markdown',
    'export.pdf': 'PDF',
    'settings.import': 'Importer',
    'settings.export.txt': 'Exporter en texte',
    'settings.export.md': 'Exporter en Markdown',
    'settings.export.pdf': 'Exporter en PDF',
    'settings.tour': 'Visite guid\u00e9e',
    'settings.feedback': 'Envoyer des commentaires',
    'mobile.editVoice': '\u270e Modifier le profil vocal',
    'mobile.tour': '\ud83e\udded Visite guid\u00e9e',
    'mobile.feedback': '\ud83d\udcac Envoyer des commentaires',
    'plan.badge.upgrade': 'Mettre \u00e0 niveau',
    'plan.badge.getPro': 'Passer \u00e0 Pro',

    // Sidebar
    'sidebar.structure': 'Structure de la chanson',
    'sidebar.add': '+ Ajouter une section',
    'sidebar.history': 'Historique',
    'sidebar.history.loading': 'Chargement…',
    'sidebar.history.empty': 'Aucun historique',
    'sidebar.lines.one': ' ligne',
    'sidebar.lines.many': ' lignes',

    // Editor
    'editor.placeholder.0': 'Commencer ici…',
    'editor.placeholder.1': 'Continuer…',
    'section.badge.verse': 'Couplet',
    'section.badge.chorus': 'Refrain',
    'section.badge.bridge': 'Pont',
    'section.badge.outro': 'Outro',

    // Section defaults
    'section.verse1': 'Couplet 1',
    'section.prechorus': 'Pré-refrain',
    'section.chorus': 'Refrain',
    'section.verse2': 'Couplet 2',
    'section.bridge': 'Pont',
    'section.outro': 'Outro',
    'section.add.prompt': 'Nom de la section :',
    'section.add.default': 'Pont 2',

    // AI panel
    'ai.title': 'Co-auteur',
    'ai.subtitle': 'dans ta voix',
    'ai.empty': 'Sélectionne une ligne, puis choisis un outil.',
    'ai.group.line': 'Outils de ligne',
    'ai.group.section': 'Outils de section',
    'ai.loading': 'En train de réfléchir…',

    // AI tools
    'tool.match.label': 'Même rythme',
    'tool.match.desc': '3 alternatives avec le même nombre de syllabes',
    'tool.rhyme.label': 'Trouver des rimes',
    'tool.rhyme.desc': 'Rimes parfaites et approximatives sur le dernier mot',
    'rhyme.all': 'Toutes',
    'rhyme.perfect': 'Parfaites',
    'rhyme.near': 'Proches',
    'rhyme.anysyl': 'Tout',
    'rhyme.none': 'Aucune rime trouvée pour ce filtre',
    'rhyme.result': 'rime',
    'rhyme.results': 'rimes',
    'tool.rewrite.label': 'Réécrire 3 façons',
    'tool.rewrite.desc': 'Même sens, 3 angles ou images différents',
    'tool.prosody.label': 'Améliorer le débit',
    'tool.prosody.desc': 'Réécrire pour une accentuation mélodique naturelle',
    'tool.phrases.label': 'Trouver des expressions',
    'tool.phrases.desc': 'Expressions et dictons avec ce mot',
    'tool.wordfamily.label': 'Familles de mots',
    'tool.wordfamily.desc': 'Remplacements créatifs au-delà des synonymes',
    'wordfamily.all': 'Tous',
    'wordfamily.primary': 'Primaire',
    'wordfamily.extended': 'Étendu',
    'wordfamily.intensifiers': 'Intensificateurs',
    'wordfamily.empty': 'Aucun mot trouvé',
    'tool.simile.label': 'En comparaison',
    'tool.simile.desc': 'Réécrire avec « comme »',
    'tool.alliteration.label': 'Ajouter allitération',
    'tool.alliteration.desc': 'Répéter des sons pour le rythme',
    'intensifiers.title': 'Mots puissants',
    'intensifiers.verbs': 'Verbes',
    'intensifiers.adjectives': 'Adjectifs',
    'tool.flow.label': 'Flow',
    'tool.flow.desc': 'Analyse du rythme et des accents par ligne',
    'tool.fit.label': 'Ajuster',
    'tool.fit.desc': 'Réécrire la ligne pour le nombre de syllabes de la section',
    'tool.specific.label': 'Être précis',
    'tool.specific.desc': 'Questions pour rendre les paroles plus concrètes',
    'tool.perspective.label': 'Changer de point de vue',
    'tool.perspective.desc': 'Réécrire d\'une perspective différente',
    'tool.hook.label': 'Écrire un hook',
    'tool.hook.desc': 'Lignes mémorables à partir du thème de la section',
    'tool.metaphor.label': 'Trouver une métaphore',
    'tool.metaphor.desc': 'Images fraîches et inattendues pour ce thème',
    'tool.bridge.label': 'Suggérer un pont',
    'tool.bridge.desc': 'Section contrastante avant le dernier refrain',
    'tool.unstuck.label': 'Je suis bloqué',
    'tool.unstuck.desc': '3 directions complètement différentes',

    // AI modal "Use this"
    'modal.use.label': 'Utiliser cette ligne',
    'modal.use.btn': 'Utiliser',
    'modal.use.replace': '↺ Remplacer la ligne',
    'modal.use.below': '↓ Insérer en dessous',
    'modal.use.cancel': 'Annuler',
    'modal.use.alert': 'Clique d\'abord sur une ligne, puis sur « Utiliser ».',

    // Audio player
    'audio.import': '♫ Importer une piste',
    'audio.loop.off': '⟲ Boucle désactivée',
    'audio.loop.on': '⟲ Boucle activée',
    'audio.loop.hint': 'active la boucle, puis glisse sur la forme d\'onde',
    'audio.record': '● Enregistrer',
    'audio.stop': '⏹ Arrêter',
    'audio.takes.empty': 'Aucun enregistrement — appuie sur ● Enregistrer',
    'audio.overdub': '+ Overdub',

    // Meta modal
    'meta.key.label': 'Tonalité',
    'meta.tempo.label': 'Tempo (BPM)',
    'meta.mood.label': 'Ambiance',
    'meta.mood.add': 'Ajouter une ambiance…',
    'meta.btn.set': 'Définir',
    'meta.btn.cancel': 'Annuler',

    // Voice profiles
    'voice.none': 'Aucune voix',
    'voice.header': 'Voix d\'écriture',
    'voice.edit': '✎ Modifier cette voix',
    'voice.new': '+ Nouveau profil de voix',
    'voice.delete.confirm': 'Supprimer',

    // Onboarding
    'ob.welcome.eyebrow': 'Bienvenue dans Inkwell',
    'ob.welcome.heading': 'Configurons ta\nvoix d\'écriture.',
    'ob.welcome.sub': 'Quelques questions aideront l\'IA à écrire avec toi, pas pour toi — des suggestions qui te ressemblent.',
    'ob.welcome.btn': 'Allons-y →',
    'ob.profile.eyebrow': 'Étape 1 sur 11',
    'ob.profile.heading': 'Nomme ce profil de voix.',
    'ob.profile.sub': 'Tu peux avoir plusieurs profils — un pour le folk, un pour la pop, un pour les chansons de fin de soirée.',
    'ob.profile.placeholder': 'ex. Voix folk, Pop nocturne, Country…',
    'ob.name.eyebrow': 'Étape 2 sur 11',
    'ob.name.heading': 'Comment t\'appelle-t-on ?',
    'ob.name.sub': 'Juste un prénom pour qu\'Inkwell puisse s\'adresser à toi.',
    'ob.name.placeholder': 'Ton prénom…',
    'ob.done.eyebrow': 'Ta voix d\'écriture',
    'ob.done.heading': 'Voici ce que l\'IA\nsait maintenant de toi.',
    'ob.done.sub': 'Tu peux mettre à jour cela à tout moment depuis le menu de voix. Chaque suggestion sera maintenant façonnée par ce profil.',
    'ob.done.btn': 'Commencer à écrire ✦',
    'ob.back': '← Retour',
    'ob.continue': 'Continuer →',
    'ob.skip': 'Passer cette étape',
    'ob.reset': '↺ Recommencer l\'intégration',

    // Mood defaults
    'moods.default': 'Mélancolique,Espoir,Anthémique,Doux-amer,Brut,Rêveur,Urgent,Tendre,Sombre,Joueur',

    // Song picker
    'song.untitled': 'Chanson sans titre',
    'song.new': '+ Nouvelle chanson',
    'song.library': 'Tes chansons',
    'song.count.one': 'chanson',
    'song.count.many': 'chansons',
    'song.delete': 'Supprimer',
    'song.delete.confirm': 'Supprimer « {title} » ?',
    'song.empty': 'Aucune chanson — commence à écrire !',

    // History
    'history.restore': 'Restaurer',

    // Versioning
    'version.fork': '⑂ Dupliquer',
    'version.delete': 'Supprimer la version',

    // Scratch Pad
    'scratch.title': 'Collectés',
    'scratch.empty': 'Clique ⭐ sur une suggestion pour la collecter ici',
    'scratch.insert': 'Insérer',
    'scratch.delete': '×',

    // AI Tool Info Modals
    'info.gotit': 'Compris',
    'info.match.title': 'Même rythme',
    'info.match.body': 'Compte les syllabes de ta ligne sélectionnée, puis génère 3 alternatives avec le même nombre — pour qu\'elles s\'adaptent aussi naturellement à ta mélodie que l\'originale.\n\nC\'est l\'outil de prosodie : il résout le problème classique de « je connais la mélodie, mais ces mots ne tombent pas sur les bons temps ».',
    'info.match.tip': '<strong>Idéal quand :</strong> Tu as une ligne qui fonctionne mélodiquement mais les mots ne sonnent pas bien, ou tu fixes une ligne vide en sachant exactement combien de syllabes tu as besoin.',
    
    'info.rhyme.title': 'Trouver des rimes',
    'info.rhyme.body': 'Prend le dernier mot de ta ligne sélectionnée et retourne des options de rimes — incluant des rimes parfaites, des rimes approximatives et des rimes pauvres (mots qui partagent un son sans correspondre exactement, comme « amour » et « toujours »).\n\nLes rimes approximatives sonnent souvent plus naturelles et moins forcées que les rimes parfaites, c\'est pourquoi les meilleurs auteurs-compositeurs s\'en servent beaucoup.',
    'info.rhyme.tip': '<strong>Astuce :</strong> Clique sur n\'importe quel mot pour l\'insérer directement à la fin de ta ligne. Ensuite, modifie la ligne pour la faire tienne.',
    
    'info.rewrite.title': 'Réécrire 3 façons',
    'info.rewrite.body': 'Prend ta ligne sélectionnée et la réécrit 3 fois — en gardant le même sens ou émotion de base, mais en l\'abordant sous un angle différent à chaque fois : image différente, métaphore différente, registre émotionnel différent.\n\nC\'est un excellent moyen de trouver la version d\'une ligne qui te ressemble le plus, sans repartir de zéro.',
    'info.rewrite.tip': '<strong>Idéal quand :</strong> Tu as une ligne qui est presque juste mais pas tout à fait — tu sais ce que tu veux dire, juste pas encore comment le dire.',
    
    'info.prosody.title': 'Améliorer le débit (Prosodie)',
    'info.prosody.body': 'La prosodie est la relation entre l\'accentuation naturelle de tes mots et les temps forts de ta mélodie. Quand ils s\'affrontent, la ligne semble maladroite — même si les mots sont excellents.\n\nCet outil réécrit ta ligne sélectionnée de 3 façons, en privilégiant l\'accentuation naturelle, les sons de voyelles chantables et les mots qui semblent inévitables dans la bouche d\'un chanteur.',
    'info.prosody.tip': '<strong>Exemple :</strong> « Je me souviens du jour où tu m\'as quitté » pourrait accentuer les mauvaises syllabes. Une correction de prosodie pourrait suggérer « Le jour où tu es parti, j\'étais à la fenêtre » — même sentiment, meilleur ajustement.',
    
    'info.wordfamily.title': 'Familles de mots',
    'info.wordfamily.body': 'Un dictionnaire des synonymes te donne des synonymes. Les familles de mots vont plus loin — des mots qui pourraient remplacer ton mot cible DE FAÇON PLUS CRÉATIVE, même s\'ils ne sont pas des synonymes exacts.\n\nCet outil prend un mot clé de ta ligne et retourne trois catégories :\n• Primaire : synonymes proches qui conviennent à la plupart des contextes\n• Étendu : remplacements inattendus qui ajoutent de la couleur\n• Intensificateurs : versions plus fortes ou plus douces pour l\'emphase',
    'info.wordfamily.tip': '<strong>Exemple :</strong> « triste » → Primaire : mélancolique, chagriné. Étendu : vide, fané, gris d\'hiver. Intensificateurs : dévasté, anéanti (plus fort) ou nostalgique, tendre (plus doux).',
    
    'info.simile.title': 'Réécrire en comparaison',
    'info.simile.body': 'Une comparaison relie deux choses en utilisant « comme » — elle rend les émotions abstraites concrètes et donne aux auditeurs une image mentale vivante.\n\nCet outil prend ta ligne sélectionnée et la réécrit de 3 façons en utilisant des comparaisons, en gardant l\'émotion de base mais en la rendant plus tangible.',
    'info.simile.tip': '<strong>Exemple :</strong> « Je me sens vide » → « Je me sens creux comme une cloche qui a oublié comment sonner »',
    
    'info.alliteration.title': 'Ajouter de l\'allitération',
    'info.alliteration.body': 'L\'allitération — répéter des sons consonantiques au début des mots — crée du rythme, de la mémorabilité et de l\'impact. Pense à « sans souci sous le soleil » ou « doucement dans le doux déclin ».\n\nCet outil réécrit ta ligne sélectionnée de 3 façons avec des motifs allitératifs tissés naturellement.',
    'info.alliteration.tip': '<strong>Pourquoi ça marche :</strong> Nos cerveaux adorent les motifs. L\'allitération rend les paroles plus accrocheuses sans que ce soit évident.',
    
    'info.flow.title': 'Flow — Analyse du rythme',
    'info.flow.body': 'Chaque ligne de paroles a un rythme naturel — des syllabes accentuées et non accentuées qui créent un motif. Quand ces motifs sont cohérents entre les lignes, la section semble serrée et chantable.\n\nCet outil analyse chaque ligne de ta section actuelle, montrant le schéma d\'accentuation (• accentué, ◦ non accentué) et une note sur la cohérence rythmique.',
    'info.flow.tip': '<strong>Idéal quand :</strong> Tu veux voir si ta section a un rythme cohérent, ou tu essaies de comprendre pourquoi une ligne semble « décalée » par rapport aux autres.',

    'info.fit.title': 'Ajuster — Nombre de syllabes',
    'info.fit.body': 'Quand une ligne dans une section a nettement plus ou moins de syllabes que ses voisines, elle peut sembler rythmiquement maladroite — même si les mots sont bons.\n\nCet outil calcule le nombre moyen de syllabes des lignes environnantes, puis réécrit ta ligne sélectionnée de 3 façons qui atteignent ce compte cible tout en préservant le sens.',
    'info.fit.tip': '<strong>Idéal quand :</strong> Tu as une ligne qui semble trop longue ou trop courte par rapport au reste de la section, et tu veux resserrer le rythme sans changer l\'idée.',

    'info.phrases.title': 'Trouver des expressions',
    'info.phrases.body': 'Chaque mot porte un bagage — expressions, dictons, clichés et hooks de chansons qui y sont attachés au fil des ans. Parfois c\'est ce que tu veux : une expression familière tordue dans une nouvelle direction.\n\nCet outil prend un mot clé de ta ligne sélectionnée et retourne 12-15 expressions, idiomes et locutions le contenant. Utilise-les tels quels, retourne-les, ou laisse-les déclencher quelque chose d\'inattendu.',
    'info.phrases.tip': '<strong>Exemple :</strong> Cherche « pluie » et tu obtiens « après la pluie le beau temps », « ennuyeux comme la pluie », « parler de la pluie et du beau temps » — matière première pour ta propre création.',
    
    'info.specific.title': 'Être précis',
    'info.specific.body': 'La différence #1 entre des paroles amateurs et professionnelles est la précision. « Je suis tellement amoureux » ne dit rien. « Tu as laissé ton café sur mon bureau pendant trois jours » dit tout.\n\nCet outil lit ta section actuelle et pose 3 questions ciblées pour t\'aider à trouver les détails concrets et spécifiques cachés dans tes émotions abstraites : le moment exact, l\'objet dans la pièce, le détail sensoriel qui rend tout réel.',
    'info.specific.tip': '<strong>Fait de recherche :</strong> Plus de 80% des chansons à succès réussissent grâce à une narration profondément personnelle et spécifique — pas grâce aux rimes intelligentes ou aux gros hooks.',
    
    'info.perspective.title': 'Changer de point de vue',
    'info.perspective.body': 'L\'un des mouvements les plus puissants en écriture de chansons est de changer qui parle — ou ce qui parle.\n\nCet outil propose 2 réécritures de ta section sous différentes perspectives : deuxième personne (« tu m\'as fait ça »), observateur à la troisième personne, un objet inanimé dans la scène, ou ton futur toi regardant en arrière. Chaque version révèle quelque chose que l\'originale ne pouvait pas.',
    'info.perspective.tip': '<strong>Exemple classique :</strong> « The River » de Bruce Springsteen parle ostensiblement d\'un couple — mais c\'est vraiment la rivière qui les regarde. La perspective-objet crée une distance qui fait frapper l\'émotion plus fort.',
    
    'info.hook.title': 'Écrire un hook',
    'info.hook.body': 'Un hook est la ligne que les gens répètent après être partis. C\'est le titre de la chanson, son cœur émotionnel, son moment le plus mémorable — généralement 4–8 syllabes, chargé émotionnellement et assez spécifique pour être surprenant.\n\nCet outil lit ta section actuelle, identifie le cœur émotionnel et génère 4 lignes de hook potentielles — le genre qui donnerait envie à quelqu\'un d\'écouter toute la chanson.',
    'info.hook.tip': '<strong>Ce qui fait un bon hook :</strong> Assez spécifique pour surprendre, assez universel pour être relatable. « Yesterday » fonctionne parce que tout le monde a un hier. « The Night We Met » fonctionne parce qu\'il nomme un moment partagé mais particulier.',
    
    'info.metaphor.title': 'Trouver une métaphore',
    'info.metaphor.body': 'Les métaphores clichées (tempêtes, feu, cœurs brisés, routes ouvertes) passent sans que les auditeurs les remarquent. Une image fraîche et inattendue les fait s\'arrêter et ressentir.\n\nCet outil lit le thème central de ta section et suggère 3 métaphores originales — objets concrets, comparaisons inhabituelles ou images étendues qui n\'ont pas été surexploitées. Chacune vient avec une ligne d\'exemple pour que tu puisses l\'entendre en action.',
    'info.metaphor.tip': '<strong>Règle de base :</strong> Si tu as entendu la métaphore dans 3 autres chansons, passe. L\'objectif est une image si spécifique qu\'elle ne pourrait exister dans la chanson de personne d\'autre.',
    
    'info.bridge.title': 'Suggérer un pont',
    'info.bridge.body': 'Un pont devrait donner l\'impression d\'une révélation — un changement de temps, de perspective ou de registre émotionnel qui fait que le dernier refrain frappe différemment du premier. C\'est le moment « mais attends » de la chanson.\n\nCet outil lit toute ta chanson, pas juste une section, et écrit 3 ébauches de pont complètes (4 lignes chacune) qui offrent un vrai contraste sans sembler déconnectées.',
    'info.bridge.tip': '<strong>Checklist du pont :</strong> Révèle-t-il quelque chose de nouveau ? Change-t-il l\'angle émotionnel ? Donne-t-il à l\'auditeur l\'impression que le dernier refrain a été mérité ? Si oui aux trois, ça marche.',
    
    'info.unstuck.title': 'Je suis bloqué',
    'info.unstuck.body': 'Quand tu fixes les mêmes lignes sans pouvoir avancer, parfois tu dois tout faire exploser — pas réparer ce qui est là, mais essayer quelque chose de complètement différent.\n\nCet outil lit ta section actuelle et propose 3 directions conceptuelles vraiment distinctes les unes des autres : émotion différente, métaphore différente, idée structurelle différente. Il te donne des concepts, pas des paroles — donc c\'est toujours toi qui écris.',
    'info.unstuck.tip': '<strong>Important :</strong> Cet outil te donne des directions à explorer, pas des paroles à copier. Choisis celle qui déclenche quelque chose et fonce avec ta propre voix.',
  }
};

// Live translations (loaded from Firestore, starts as copy of defaults)
let TRANSLATIONS = JSON.parse(JSON.stringify(DEFAULT_TRANSLATIONS));

// ── Load translations from Firestore ──────────────
async function loadTranslationsFromCloud() {
  try {
    const url = `${FIRESTORE_BASE}/inkwell_app/translations?key=${FIREBASE_API_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.fields?.en?.stringValue && data.fields?.fr?.stringValue) {
        const cloudEn = JSON.parse(data.fields.en.stringValue);
        const cloudFr = JSON.parse(data.fields.fr.stringValue);
        // Merge with defaults (cloud overrides defaults)
        TRANSLATIONS.en = { ...DEFAULT_TRANSLATIONS.en, ...cloudEn };
        TRANSLATIONS.fr = { ...DEFAULT_TRANSLATIONS.fr, ...cloudFr };
        // Loaded translations from cloud
        // Re-apply if page is already loaded
        if (document.readyState === 'complete') {
          applyTranslations();
        }
      }
    }
  } catch (err) {
    // Using default translations (cloud unavailable)
  }
}

// Load cloud translations on startup
loadTranslationsFromCloud();

// ── Current language ──────────────────────────────
let currentLang = (function(){ try { return localStorage.getItem('inkwell_lang') || 'en'; } catch(e) { return 'en'; } })();

function t(key) {
  return (TRANSLATIONS[currentLang] || TRANSLATIONS.en)[key]
      || DEFAULT_TRANSLATIONS.en[key]
      || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('inkwell_lang', lang);
  // Persist to Firestore prefs so it survives across devices/sessions
  if (typeof _prefs !== 'undefined' && _prefs.lang !== lang) {
    _prefs.lang = lang;
    if (typeof _savePrefs === 'function') _savePrefs();
  }
  applyTranslations();
}

// ── Apply to DOM ──────────────────────────────────
function applyTranslations() {
  // Sidebar
  const sbHeader = document.querySelector('.sidebar-header');
  if (sbHeader) sbHeader.textContent = t('sidebar.structure');
  const addSec = document.querySelector('.add-section-btn');
  if (addSec) addSec.textContent = t('sidebar.add');

  // AI panel title/subtitle
  const aiTitle = document.getElementById('aiTitleLabel') || document.querySelector('.ai-title');
  if (aiTitle) aiTitle.textContent = t('ai.title');
  const aiSub = document.getElementById('aiPanelSub') || document.querySelector('.ai-subtitle');
  if (aiSub) aiSub.textContent = t('ai.subtitle');

  // AI empty state
  const aiEmpty = document.getElementById('aiEmptyMsg') || document.querySelector('.ai-empty');
  if (aiEmpty) aiEmpty.textContent = t('ai.empty');

  // Audio controls
  const recBtn = document.getElementById('recBtn');
  if (recBtn && !recBtn.textContent.includes('⏹')) recBtn.textContent = t('audio.record');
  const importBtn = document.querySelector('.audio-upload-btn');
  if (importBtn) importBtn.textContent = t('audio.import');
  const loopTag = document.getElementById('loopToggleTag');
  if (loopTag) loopTag.textContent = loopTag.classList.contains('loop-on') ? t('audio.loop.on') : t('audio.loop.off');
  const loopHint = document.getElementById('loopRangeLabel');
  if (loopHint && !loopHint.dataset.hasRange) loopHint.textContent = t('audio.loop.hint');

  // Lang toggle button
  const langBtn = document.getElementById('langToggleBtn');
  if (langBtn) langBtn.textContent = currentLang === 'fr' ? 'EN' : 'FR';

  // Title placeholder
  const titleInp = document.getElementById('songTitle');
  if (titleInp) titleInp.placeholder = t('title.placeholder');

  // Save button
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn && !saveBtn.textContent.includes('✓')) saveBtn.textContent = t('btn.save');

  // Re-translate section names if they match default English names
  const sectionMap = {
    'Verse 1': t('section.verse1'), 'Verse 2': t('section.verse2'),
    'Pre-Chorus': t('section.prechorus'), 'Chorus': t('section.chorus'),
    'Bridge': t('section.bridge'), 'Outro': t('section.outro'),
    // FR back to EN
    'Couplet 1': t('section.verse1'), 'Couplet 2': t('section.verse2'),
    'Pré-refrain': t('section.prechorus'), 'Refrain': t('section.chorus'),
    'Pont': t('section.bridge'),
  };
  if (typeof sections !== 'undefined') {
    sections.forEach(sec => {
      if (sectionMap[sec.name]) sec.name = sectionMap[sec.name];
    });
    if (typeof renderSidebar === 'function') renderSidebar();
  }

  // Rebuild AI tools with new language
  if (typeof buildAITools === 'function') setTimeout(buildAITools, 0);
  if (typeof renderTakesList === 'function') renderTakesList();
  // Re-render editor to update placeholders
  if (typeof renderEditor === 'function') renderEditor();

  // Intensifiers panel title
  const intensifiersTitle = document.getElementById('intensifiersTitle');
  if (intensifiersTitle) intensifiersTitle.textContent = '⚡ ' + t('intensifiers.title');

  // Scratch pad
  const scratchTitle = document.getElementById('scratchTitle');
  if (scratchTitle) scratchTitle.textContent = t('scratch.title');
  const scratchEmpty = document.getElementById('scratchEmpty');
  if (scratchEmpty) scratchEmpty.textContent = t('scratch.empty');

  // Player/Recorder button
  const audioToggle = document.getElementById('audioToggleBtn');
  if (audioToggle) audioToggle.textContent = t('btn.player');

  // Split button
  const splitBtn = document.getElementById('splitBtn');
  if (splitBtn) {
    const isOpen = splitBtn.textContent.includes('⊟');
    splitBtn.textContent = isOpen ? t('btn.split.active') : t('btn.split');
  }

  // Export button
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) exportBtn.textContent = t('btn.export');

  // Export menu items
  const exportMenu = document.getElementById('exportMenu');
  if (exportMenu) {
    const items = exportMenu.querySelectorAll('div[onclick]');
    items.forEach(item => {
      if (item.onclick?.toString().includes("'txt'")) {
        item.innerHTML = '<span style="font-size:15px">📄</span> ' + t('export.txt');
      } else if (item.onclick?.toString().includes("'md'")) {
        item.innerHTML = '<span style="font-size:15px">✦</span> ' + t('export.md');
      } else if (item.onclick?.toString().includes("'pdf'")) {
        item.innerHTML = '<span style="font-size:15px">📑</span> ' + t('export.pdf');
      }
    });
  }

  // Fork button
  const forkBtn = document.getElementById('forkBtn');
  if (forkBtn) forkBtn.textContent = t('version.fork');

  // Settings menu items (Import, Export, Feature tour, Send feedback)
  const settingsItems = {
    settingsImportItem: 'settings.import',
    settingsExportTxtItem: 'settings.export.txt',
    settingsExportMdItem: 'settings.export.md',
    settingsExportPdfItem: 'settings.export.pdf',
    settingsTourItem: 'settings.tour',
    settingsFeedbackItem: 'settings.feedback',
  };
  Object.entries(settingsItems).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      const label = el.querySelector('[data-label]');
      if (label) label.textContent = t(key);
    }
  });

  // Co-Writer button
  const cowriterBtn = document.getElementById('cowriterBtn');
  if (cowriterBtn) cowriterBtn.textContent = '\u2726 ' + t('btn.cowriter');

  // Mobile menu items
  const mobileEditVoice = document.getElementById('mobileEditVoiceBtn');
  if (mobileEditVoice) mobileEditVoice.textContent = t('mobile.editVoice');
  const mobileTour = document.getElementById('mobileTourBtn');
  if (mobileTour) mobileTour.textContent = t('mobile.tour');
  const mobileFeedback = document.getElementById('mobileFeedbackBtn');
  if (mobileFeedback) mobileFeedback.textContent = t('mobile.feedback');

  // Refresh plan badge to localize Upgrade/Get Pro link
  if (typeof _applyPlanGates === 'function') _applyPlanGates();
}


// Expose globally
window.t = t;
window.setLang = setLang;
window.getLang = () => currentLang;
window.currentLang = window.getLang; // alias for compatibility
