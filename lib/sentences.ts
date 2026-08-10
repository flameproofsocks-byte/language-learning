// Sentence challenges for all supported languages.
//
// Each challenge shows an English prompt; the user assembles the answer from
// shuffled word tiles. Sentences are sorted by difficulty within each language
// (simple → harder) so that sentenceFamiliarityScore() has a meaningful range
// to work with when matching sentences to the user's familiarity setting.
//
// answer[]  — the correct token sequence (each element becomes one tile)
// hints{}   — token → English gloss shown on tiles the user hasn't revealed
//
// When adding a new language:
//   1. Add an export const <LANG>_SENTENCES array here
//   2. Add a branch in sentencesFor() below

import type { Language } from './language'

export interface SentenceChallenge {
  id: string
  english: string   // English prompt shown to the user
  answer: string[]  // correct word order — each element is one tile
  hints: Record<string, string>  // token → hint text (optional, shown on request)
}

export const SPANISH_SENTENCES: SentenceChallenge[] = [
  { id: 'es01', english: 'I want to eat',
    answer: ['Yo', 'quiero', 'comer'],
    hints: { 'quiero': 'I want' } },

  { id: 'es02', english: 'She speaks well',
    answer: ['Ella', 'habla', 'bien'],
    hints: { 'habla': 'speaks' } },

  { id: 'es03', english: 'I can read',
    answer: ['Yo', 'puedo', 'leer'],
    hints: { 'puedo': 'I can' } },

  { id: 'es04', english: 'The city is very big',
    answer: ['La', 'ciudad', 'es', 'muy', 'grande'],
    hints: { 'La': 'the (fem.)' } },

  { id: 'es05', english: 'I want to buy water',
    answer: ['Yo', 'quiero', 'comprar', 'agua'],
    hints: { 'quiero': 'I want' } },

  { id: 'es06', english: 'She is at home',
    answer: ['Ella', 'está', 'en', 'casa'],
    hints: { 'está': 'is (location/state)' } },

  { id: 'es07', english: 'We have a lot of work',
    answer: ['Nosotros', 'tenemos', 'mucho', 'trabajo'],
    hints: { 'tenemos': 'we have' } },

  { id: 'es08', english: 'He can read and write',
    answer: ['Él', 'puede', 'leer', 'y', 'escribir'],
    hints: { 'puede': 'he/she can' } },

  { id: 'es09', english: 'The child is happy',
    answer: ['El', 'niño', 'está', 'feliz'],
    hints: { 'El': 'the (masc.)', 'está': 'is (state)' } },

  { id: 'es10', english: 'I always drink water',
    answer: ['Yo', 'siempre', 'bebo', 'agua'],
    hints: { 'bebo': 'I drink' } },

  { id: 'es11', english: 'I go to the city',
    answer: ['Yo', 'voy', 'a', 'la', 'ciudad'],
    hints: { 'voy': 'I go', 'a': 'to', 'la': 'the (fem.)' } },

  { id: 'es12', english: 'The world is very big',
    answer: ['El', 'mundo', 'es', 'muy', 'grande'],
    hints: { 'El': 'the (masc.)' } },

  { id: 'es13', english: 'She is a good friend',
    answer: ['Ella', 'es', 'una', 'buena', 'amiga'],
    hints: { 'una': 'a (fem.)', 'buena': 'good (fem.)', 'amiga': 'friend (fem.)' } },

  { id: 'es14', english: 'I know how to write',
    answer: ['Yo', 'sé', 'escribir'],
    hints: { 'sé': 'I know (saber)' } },

  { id: 'es15', english: 'He works every day',
    answer: ['Él', 'trabaja', 'todos', 'los', 'días'],
    hints: { 'trabaja': 'works', 'todos': 'every/all', 'los': 'the (pl.)' } },

  { id: 'es16', english: 'We eat and drink',
    answer: ['Nosotros', 'comemos', 'y', 'bebemos'],
    hints: { 'comemos': 'we eat', 'bebemos': 'we drink' } },

  { id: 'es17', english: 'The new house is small',
    answer: ['La', 'casa', 'nueva', 'es', 'pequeña'],
    hints: { 'La': 'the (fem.)', 'nueva': 'new (fem.)', 'pequeña': 'small (fem.)' } },

  { id: 'es18', english: 'Today is a good day',
    answer: ['Hoy', 'es', 'un', 'buen', 'día'],
    hints: { 'Hoy': 'today', 'un': 'a (masc.)', 'buen': 'good (before noun)' } },

  { id: 'es19', english: 'They live in a big country',
    answer: ['Ellos', 'viven', 'en', 'un', 'país', 'grande'],
    hints: { 'viven': 'they live', 'un': 'a (masc.)' } },

  { id: 'es20', english: 'It is easy to learn',
    answer: ['Es', 'fácil', 'aprender'],
    hints: { 'aprender': 'to learn' } },

  // ── A2 sentences (medium — mix of A1 + A2 words) ──────────────────────────
  { id: 'es21', english: 'I need to buy food',
    answer: ['Yo', 'necesito', 'comprar', 'comida'],
    hints: { 'necesito': 'I need', 'comida': 'food' } },

  { id: 'es22', english: 'She wants to learn Spanish',
    answer: ['Ella', 'quiere', 'aprender', 'español'],
    hints: { 'quiere': 'she wants', 'aprender': 'to learn', 'español': 'Spanish' } },

  { id: 'es23', english: 'We have to finish the work',
    answer: ['Nosotros', 'tenemos', 'que', 'terminar', 'el', 'trabajo'],
    hints: { 'tenemos': 'we have', 'terminar': 'to finish', 'el': 'the (masc.)' } },

  { id: 'es24', english: 'He runs in the park every day',
    answer: ['Él', 'corre', 'en', 'el', 'parque', 'todos', 'los', 'días'],
    hints: { 'corre': 'runs', 'parque': 'park', 'todos': 'every', 'los': 'the (pl.)' } },

  { id: 'es25', english: 'I am looking for my book',
    answer: ['Yo', 'busco', 'mi', 'libro'],
    hints: { 'busco': 'I look for', 'mi': 'my', 'libro': 'book' } },

  { id: 'es26', english: 'She helps her friend',
    answer: ['Ella', 'ayuda', 'a', 'su', 'amiga'],
    hints: { 'ayuda': 'helps', 'su': 'her/his', 'amiga': 'friend (fem.)' } },

  { id: 'es27', english: 'We like to travel together',
    answer: ['Nos', 'gusta', 'viajar', 'juntos'],
    hints: { 'Nos': 'to us', 'gusta': 'pleases/like', 'viajar': 'to travel', 'juntos': 'together' } },

  { id: 'es28', english: 'The restaurant is near the park',
    answer: ['El', 'restaurante', 'está', 'cerca', 'del', 'parque'],
    hints: { 'restaurante': 'restaurant', 'está': 'is (location)', 'cerca': 'near', 'del': 'of the' } },

  { id: 'es29', english: 'I do not understand the question',
    answer: ['Yo', 'no', 'entiendo', 'la', 'pregunta'],
    hints: { 'no': 'not/no', 'entiendo': 'I understand', 'pregunta': 'question' } },

  { id: 'es30', english: 'He goes to bed late',
    answer: ['Él', 'se', 'duerme', 'tarde'],
    hints: { 'se': 'himself', 'duerme': 'goes to sleep', 'tarde': 'late' } },

  // ── B1 sentences (hard — mostly A2/B1 words) ──────────────────────────────
  { id: 'es31', english: 'I forgot the answer to the problem',
    answer: ['Yo', 'olvidé', 'la', 'respuesta', 'al', 'problema'],
    hints: { 'olvidé': 'I forgot', 'respuesta': 'answer', 'al': 'to the', 'problema': 'problem' } },

  { id: 'es32', english: 'She looks tired today',
    answer: ['Ella', 'parece', 'cansada', 'hoy'],
    hints: { 'parece': 'seems/looks', 'cansada': 'tired (fem.)', 'hoy': 'today' } },

  { id: 'es33', english: 'The train arrives early in the morning',
    answer: ['El', 'tren', 'llega', 'temprano', 'por', 'la', 'mañana'],
    hints: { 'tren': 'train', 'llega': 'arrives', 'temprano': 'early', 'mañana': 'morning' } },

  { id: 'es34', english: 'He won the game but lost his money',
    answer: ['Él', 'ganó', 'el', 'juego', 'pero', 'perdió', 'su', 'dinero'],
    hints: { 'ganó': 'won', 'juego': 'game', 'perdió': 'lost', 'su': 'his', 'dinero': 'money' } },

  { id: 'es35', english: 'I always forget to pay',
    answer: ['Yo', 'siempre', 'olvido', 'pagar'],
    hints: { 'olvido': 'I forget', 'pagar': 'to pay' } },

  { id: 'es36', english: 'She is learning a new language',
    answer: ['Ella', 'está', 'aprendiendo', 'una', 'lengua', 'nueva'],
    hints: { 'está': 'is (ongoing)', 'aprendiendo': 'learning', 'lengua': 'language' } },

  { id: 'es37', english: 'It is never too late to start',
    answer: ['Nunca', 'es', 'tarde', 'para', 'empezar'],
    hints: { 'Nunca': 'never', 'tarde': 'late', 'empezar': 'to start' } },

  { id: 'es38', english: 'The doctor works in the hospital',
    answer: ['El', 'médico', 'trabaja', 'en', 'el', 'hospital'],
    hints: { 'médico': 'doctor', 'trabaja': 'works', 'hospital': 'hospital' } },

  { id: 'es39', english: 'I feel tired but I cannot sleep',
    answer: ['Me', 'siento', 'cansado', 'pero', 'no', 'puedo', 'dormir'],
    hints: { 'Me': 'myself', 'siento': 'I feel', 'cansado': 'tired', 'dormir': 'to sleep' } },

  { id: 'es40', english: 'Maybe she will return tomorrow',
    answer: ['Quizás', 'ella', 'vuelva', 'mañana'],
    hints: { 'Quizás': 'maybe', 'vuelva': 'will return', 'mañana': 'tomorrow' } },

  { id: 'es41', english: 'I need to change my clothes before dinner',
    answer: ['Necesito', 'cambiar', 'mi', 'ropa', 'antes', 'de', 'la', 'cena'],
    hints: { 'Necesito': 'I need', 'cambiar': 'to change', 'mi': 'my', 'ropa': 'clothes', 'antes': 'before', 'cena': 'dinner' } },

  { id: 'es42', english: 'The idea seems important to me',
    answer: ['La', 'idea', 'me', 'parece', 'importante'],
    hints: { 'idea': 'idea', 'me': 'to me', 'parece': 'seems', 'importante': 'important' } },

  { id: 'es43', english: 'She still does not understand the story',
    answer: ['Ella', 'todavía', 'no', 'entiende', 'la', 'historia'],
    hints: { 'todavía': 'still', 'entiende': 'understands', 'historia': 'story' } },

  { id: 'es44', english: 'He tried to run but he was too slow',
    answer: ['Él', 'intentó', 'correr', 'pero', 'era', 'muy', 'lento'],
    hints: { 'intentó': 'he tried', 'correr': 'to run', 'era': 'was', 'lento': 'slow' } },

  { id: 'es45', english: 'We are always busy with work',
    answer: ['Nosotros', 'siempre', 'estamos', 'ocupados', 'con', 'el', 'trabajo'],
    hints: { 'estamos': 'we are', 'ocupados': 'busy (pl.)', 'trabajo': 'work' } },

  { id: 'es46', english: 'The hotel room is clean and comfortable',
    answer: ['La', 'habitación', 'del', 'hotel', 'está', 'limpia', 'y', 'cómoda'],
    hints: { 'habitación': 'room', 'del': 'of the', 'limpia': 'clean (fem.)', 'cómoda': 'comfortable (fem.)' } },

  { id: 'es47', english: 'I teach Spanish at the school',
    answer: ['Yo', 'enseño', 'español', 'en', 'la', 'escuela'],
    hints: { 'enseño': 'I teach', 'español': 'Spanish', 'escuela': 'school' } },

  { id: 'es48', english: 'She cooked dinner for the whole family',
    answer: ['Ella', 'cocinó', 'la', 'cena', 'para', 'toda', 'la', 'familia'],
    hints: { 'cocinó': 'cooked', 'cena': 'dinner', 'toda': 'all/whole', 'familia': 'family' } },

  { id: 'es49', english: 'It is possible to change the world',
    answer: ['Es', 'posible', 'cambiar', 'el', 'mundo'],
    hints: { 'posible': 'possible', 'cambiar': 'to change' } },

  { id: 'es50', english: 'I never forget a good story',
    answer: ['Yo', 'nunca', 'olvido', 'una', 'buena', 'historia'],
    hints: { 'nunca': 'never', 'olvido': 'I forget', 'historia': 'story' } },
]

export const MANDARIN_SENTENCES: SentenceChallenge[] = [
  { id: 'zh01', english: 'I want to eat',
    answer: ['wǒ', 'yào', 'chī', 'fàn'],
    hints: { 'yào': 'want/need', 'fàn': 'food/rice' } },

  { id: 'zh02', english: 'She is at home',
    answer: ['tā', 'zài', 'jiā'],
    hints: { 'tā': 'he/she', 'zài': 'at/in' } },

  { id: 'zh03', english: 'He is very good',
    answer: ['tā', 'hěn', 'hǎo'],
    hints: { 'tā': 'he/she', 'hěn': 'very' } },

  { id: 'zh04', english: 'I like to study',
    answer: ['wǒ', 'xǐhuān', 'xuéxí'],
    hints: { 'xǐhuān': 'to like' } },

  { id: 'zh05', english: 'We go to school',
    answer: ['wǒmen', 'qù', 'xuéxiào'],
    hints: {} },

  { id: 'zh06', english: 'She drinks water',
    answer: ['tā', 'hē', 'shuǐ'],
    hints: { 'tā': 'he/she' } },

  { id: 'zh07', english: 'Today is very hot',
    answer: ['jīntiān', 'hěn', 'rè'],
    hints: { 'hěn': 'very', 'rè': 'hot' } },

  { id: 'zh08', english: 'I can speak Chinese',
    answer: ['wǒ', 'huì', 'shuō', 'Zhōngwén'],
    hints: { 'huì': 'can/know how to', 'shuō': 'to speak', 'Zhōngwén': 'Chinese language' } },

  { id: 'zh09', english: 'He has many books',
    answer: ['tā', 'yǒu', 'hěn', 'duō', 'shū'],
    hints: { 'tā': 'he/she', 'yǒu': 'to have', 'duō': 'many' } },

  { id: 'zh10', english: 'I am not at home',
    answer: ['wǒ', 'bù', 'zài', 'jiā'],
    hints: { 'bù': 'not' } },

  { id: 'zh11', english: 'They like to read books',
    answer: ['tāmen', 'xǐhuān', 'kàn', 'shū'],
    hints: { 'kàn': 'to look/read' } },

  { id: 'zh12', english: 'Today is very cold',
    answer: ['jīntiān', 'hěn', 'lěng'],
    hints: { 'hěn': 'very', 'lěng': 'cold' } },

  { id: 'zh13', english: 'The food is very good',
    answer: ['fàn', 'hěn', 'hǎo'],
    hints: { 'fàn': 'food/rice', 'hěn': 'very' } },

  { id: 'zh14', english: 'I go to school',
    answer: ['wǒ', 'qù', 'xuéxiào'],
    hints: {} },

  { id: 'zh15', english: 'He is a good person',
    answer: ['tā', 'shì', 'hǎo', 'rén'],
    hints: { 'tā': 'he/she', 'shì': 'is (to be)', 'rén': 'person' } },

  // ── HSK 2 sentences (medium) ───────────────────────────────────────────────
  { id: 'zh16', english: 'Please wait here',
    answer: ['qǐng', 'zài', 'zhèlǐ', 'děng'],
    hints: { 'qǐng': 'please', 'zhèlǐ': 'here', 'děng': 'wait' } },

  { id: 'zh17', english: 'I do not understand this problem',
    answer: ['wǒ', 'bù', 'dǒng', 'zhège', 'wèntí'],
    hints: { 'dǒng': 'understand', 'zhège': 'this', 'wèntí': 'problem' } },

  { id: 'zh18', english: 'She often drinks coffee in the morning',
    answer: ['tā', 'chángcháng', 'zǎoshang', 'hē', 'kāfēi'],
    hints: { 'tā': 'he/she', 'chángcháng': 'often', 'zǎoshang': 'morning', 'kāfēi': 'coffee' } },

  { id: 'zh19', english: 'He can help you',
    answer: ['tā', 'néng', 'bāng', 'nǐ'],
    hints: { 'tā': 'he/she', 'néng': 'can', 'bāng': 'help' } },

  { id: 'zh20', english: 'We want to go back home',
    answer: ['wǒmen', 'xiǎng', 'huí', 'jiā'],
    hints: { 'huí': 'return/go back' } },

  { id: 'zh21', english: 'I already finished the work',
    answer: ['wǒ', 'yǐjīng', 'wán', 'le', 'gōngzuò'],
    hints: { 'yǐjīng': 'already', 'wán': 'finished', 'le': '(completed action)', 'gōngzuò': 'work' } },

  { id: 'zh22', english: 'She is the best student in the class',
    answer: ['tā', 'shì', 'bān', 'lǐ', 'zuì', 'hǎo', 'de', 'xuésheng'],
    hints: { 'tā': 'she', 'bān': 'class', 'lǐ': 'inside/in', 'zuì': 'most', 'de': '(linking particle)' } },

  { id: 'zh23', english: 'He takes the train to work',
    answer: ['tā', 'zuò', 'huǒchē', 'qù', 'gōngzuò'],
    hints: { 'tā': 'he', 'zuò': 'take/ride', 'huǒchē': 'train' } },

  { id: 'zh24', english: 'I want to use your phone',
    answer: ['wǒ', 'xiǎng', 'yòng', 'nǐ', 'de', 'diànhuà'],
    hints: { 'yòng': 'use', 'de': "(possessive particle)", 'diànhuà': 'phone' } },

  { id: 'zh25', english: 'They sing together every weekend',
    answer: ['tāmen', 'měi', 'gè', 'zhōumò', 'yīqǐ', 'chàng', 'gē'],
    hints: { 'měi': 'every', 'gè': '(measure word)', 'zhōumò': 'weekend', 'yīqǐ': 'together', 'chàng': 'sing', 'gē': 'song' } },

  // ── HSK 3 sentences (hard) ─────────────────────────────────────────────────
  { id: 'zh26', english: 'Learning Chinese is difficult but interesting',
    answer: ['xuéxí', 'Zhōngwén', 'hěn', 'nán', 'dàn', 'hěn', 'yǒuyìsi'],
    hints: { 'Zhōngwén': 'Chinese (language)', 'nán': 'difficult', 'dàn': 'but', 'yǒuyìsi': 'interesting' } },

  { id: 'zh27', english: 'My body is tired but my heart is happy',
    answer: ['wǒ', 'shēntǐ', 'hěn', 'lèi', 'dàn', 'xīnlǐ', 'hěn', 'gāoxìng'],
    hints: { 'shēntǐ': 'body', 'lèi': 'tired', 'dàn': 'but', 'xīnlǐ': 'heart/inside', 'gāoxìng': 'happy' } },

  { id: 'zh28', english: 'He immediately returned to the company',
    answer: ['tā', 'mǎshàng', 'huí', 'le', 'gōngsī'],
    hints: { 'tā': 'he', 'mǎshàng': 'immediately', 'le': '(completed action)', 'gōngsī': 'company' } },

  { id: 'zh29', english: 'She changed her clothes before going out',
    answer: ['tā', 'chūqù', 'qián', 'huàn', 'le', 'yīfú'],
    hints: { 'tā': 'she', 'chūqù': 'go out', 'qián': 'before', 'huàn': 'changed', 'le': '(completed action)', 'yīfú': 'clothes' } },

  { id: 'zh30', english: 'I only have one hour',
    answer: ['wǒ', 'zhǐ', 'yǒu', 'yī', 'gè', 'xiǎoshí'],
    hints: { 'zhǐ': 'only', 'gè': '(measure word)', 'xiǎoshí': 'hour' } },

  { id: 'zh31', english: 'This place is especially beautiful',
    answer: ['zhège', 'dìfang', 'tèbié', 'piàoliang'],
    hints: { 'zhège': 'this', 'dìfang': 'place', 'tèbié': 'especially', 'piàoliang': 'beautiful' } },

  { id: 'zh32', english: 'The teacher asks the students a question',
    answer: ['lǎoshī', 'wèn', 'xuésheng', 'yī', 'gè', 'wèntí'],
    hints: { 'wèn': 'asks', 'gè': '(measure word)', 'wèntí': 'question' } },

  { id: 'zh33', english: 'I have never been to the hospital',
    answer: ['wǒ', 'cónglái', 'méi', 'qù', 'guò', 'yīyuàn'],
    hints: { 'cónglái': 'ever/never', 'méi': 'not have', 'guò': '(experience marker)', 'yīyuàn': 'hospital' } },

  { id: 'zh34', english: 'He is even taller than his father',
    answer: ['tā', 'bǐ', 'bàba', 'gèng', 'gāo'],
    hints: { 'tā': 'he', 'bǐ': 'compared to', 'gèng': 'even more', 'gāo': 'tall' } },

  { id: 'zh35', english: 'She chose the correct answer',
    answer: ['tā', 'xuǎn', 'le', 'duì', 'de', 'dá\'àn'],
    hints: { 'tā': 'she', 'xuǎn': 'chose', 'le': '(completed action)', 'duì': 'correct', 'de': "(particle)", 'dá\'àn': 'answer' } },
]

export const INDONESIAN_SENTENCES: SentenceChallenge[] = [

  // ── Very simple (2–3 words, all very common) ────────────────────────────────
  { id: 'id01', english: 'I want to eat',
    answer: ['Saya', 'mau', 'makan'],
    hints: { 'Saya': 'I', 'mau': 'want to' } },

  { id: 'id02', english: 'I do not know',
    answer: ['Saya', 'tidak', 'tahu'],
    hints: { 'tidak': 'not/no' } },

  { id: 'id03', english: 'She is happy',
    answer: ['Dia', 'sangat', 'senang'],
    hints: { 'Dia': 'she/he', 'sangat': 'very' } },

  { id: 'id04', english: 'The house is big',
    answer: ['Rumah', 'itu', 'besar'],
    hints: { 'itu': 'that/the' } },

  { id: 'id05', english: 'I am tired',
    answer: ['Saya', 'sangat', 'lelah'],
    hints: { 'sangat': 'very', 'lelah': 'tired' } },

  { id: 'id06', english: 'I am hungry',
    answer: ['Saya', 'lapar'],
    hints: { 'lapar': 'hungry' } },

  { id: 'id07', english: 'I am thirsty',
    answer: ['Saya', 'haus'],
    hints: { 'haus': 'thirsty' } },

  { id: 'id08', english: 'They come',
    answer: ['Mereka', 'datang'],
    hints: { 'Mereka': 'they', 'datang': 'come' } },

  { id: 'id09', english: 'I can run',
    answer: ['Saya', 'bisa', 'lari'],
    hints: { 'bisa': 'can', 'lari': 'run' } },

  { id: 'id10', english: 'I like to read',
    answer: ['Saya', 'suka', 'baca'],
    hints: { 'suka': 'like' } },

  // ── Simple (4 words, mostly known) ─────────────────────────────────────────
  { id: 'id11', english: 'I want to drink water',
    answer: ['Saya', 'mau', 'minum', 'air'],
    hints: { 'minum': 'drink', 'air': 'water' } },

  { id: 'id12', english: 'I am studying now',
    answer: ['Saya', 'belajar', 'sekarang'],
    hints: { 'belajar': 'study', 'sekarang': 'now' } },

  { id: 'id13', english: 'We go to the market',
    answer: ['Kami', 'pergi', 'ke', 'pasar'],
    hints: { 'Kami': 'we', 'ke': 'to' } },

  { id: 'id14', english: 'The food is very good',
    answer: ['Makanan', 'ini', 'sangat', 'baik'],
    hints: { 'ini': 'this', 'sangat': 'very' } },

  { id: 'id15', english: 'They are looking for a friend',
    answer: ['Mereka', 'cari', 'teman'],
    hints: { 'Mereka': 'they', 'cari': 'look for' } },

  { id: 'id16', english: 'I want to buy food',
    answer: ['Saya', 'mau', 'beli', 'makanan'],
    hints: { 'beli': 'buy', 'makanan': 'food' } },

  { id: 'id17', english: 'My name is Brady',
    answer: ['Nama', 'saya', 'Brady'],
    hints: { 'Nama': 'name', 'saya': 'my/I' } },

  { id: 'id18', english: 'I do not like this',
    answer: ['Saya', 'tidak', 'suka', 'ini'],
    hints: { 'tidak': 'not', 'ini': 'this' } },

  { id: 'id19', english: 'The water is cold',
    answer: ['Air', 'ini', 'dingin'],
    hints: { 'ini': 'this', 'dingin': 'cold' } },

  { id: 'id20', english: 'I go to school',
    answer: ['Saya', 'pergi', 'ke', 'sekolah'],
    hints: { 'ke': 'to', 'sekolah': 'school' } },

  { id: 'id21', english: 'I wait here',
    answer: ['Saya', 'tunggu', 'di', 'sini'],
    hints: { 'tunggu': 'wait', 'di sini': 'here' } },

  { id: 'id22', english: 'She likes to eat',
    answer: ['Dia', 'suka', 'makan'],
    hints: { 'Dia': 'she/he', 'suka': 'likes' } },

  { id: 'id23', english: 'I already know',
    answer: ['Saya', 'sudah', 'tahu'],
    hints: { 'sudah': 'already' } },

  { id: 'id24', english: 'The chair is small',
    answer: ['Kursi', 'itu', 'kecil'],
    hints: { 'Kursi': 'chair', 'itu': 'that' } },

  { id: 'id25', english: 'I work every day',
    answer: ['Saya', 'kerja', 'setiap', 'hari'],
    hints: { 'kerja': 'work', 'setiap': 'every', 'hari': 'day' } },

  // ── Medium (4–5 words, some new) ────────────────────────────────────────────
  { id: 'id26', english: 'I can speak Indonesian',
    answer: ['Saya', 'bisa', 'bicara', 'bahasa', 'Indonesia'],
    hints: { 'bisa': 'can', 'bicara': 'speak', 'bahasa': 'language' } },

  { id: 'id27', english: 'I want to go to the city',
    answer: ['Saya', 'mau', 'pergi', 'ke', 'kota'],
    hints: { 'ke': 'to', 'kota': 'city' } },

  { id: 'id28', english: 'I do not want to go',
    answer: ['Saya', 'tidak', 'mau', 'pergi'],
    hints: { 'tidak': 'not' } },

  { id: 'id29', english: 'She is looking for the market',
    answer: ['Dia', 'cari', 'pasar'],
    hints: { 'Dia': 'she', 'cari': 'look for' } },

  { id: 'id30', english: 'We need money',
    answer: ['Kami', 'butuh', 'uang'],
    hints: { 'Kami': 'we', 'butuh': 'need', 'uang': 'money' } },

  { id: 'id31', english: 'I want to help you',
    answer: ['Saya', 'mau', 'bantu', 'kamu'],
    hints: { 'bantu': 'help', 'kamu': 'you' } },

  { id: 'id32', english: 'The problem is not big',
    answer: ['Masalah', 'ini', 'tidak', 'besar'],
    hints: { 'Masalah': 'problem', 'tidak': 'not' } },

  { id: 'id33', english: 'I think she is sad',
    answer: ['Saya', 'pikir', 'dia', 'sedih'],
    hints: { 'pikir': 'think', 'sedih': 'sad' } },

  { id: 'id34', english: 'They always come late',
    answer: ['Mereka', 'selalu', 'datang', 'terlambat'],
    hints: { 'selalu': 'always', 'terlambat': 'late' } },

  { id: 'id35', english: 'He is sitting at the table',
    answer: ['Dia', 'duduk', 'di', 'meja'],
    hints: { 'duduk': 'sit', 'di': 'at' } },

  { id: 'id36', english: 'I like this city very much',
    answer: ['Saya', 'sangat', 'suka', 'kota', 'ini'],
    hints: { 'sangat': 'very much', 'kota': 'city' } },

  { id: 'id37', english: 'Do you know where the market is?',
    answer: ['Kamu', 'tahu', 'di', 'mana', 'pasar'],
    hints: { 'Kamu': 'you', 'di mana': 'where' } },

  { id: 'id38', english: 'I have not eaten yet',
    answer: ['Saya', 'belum', 'makan'],
    hints: { 'belum': 'not yet' } },

  { id: 'id39', english: 'The restaurant is not far',
    answer: ['Restoran', 'itu', 'tidak', 'jauh'],
    hints: { 'Restoran': 'restaurant', 'jauh': 'far' } },

  { id: 'id40', english: 'I want to sleep now',
    answer: ['Saya', 'mau', 'tidur', 'sekarang'],
    hints: { 'tidur': 'sleep', 'sekarang': 'now' } },

  // ── Harder (5–6 words, more new vocabulary) ─────────────────────────────────
  { id: 'id41', english: 'I am looking for a good restaurant',
    answer: ['Saya', 'cari', 'restoran', 'yang', 'baik'],
    hints: { 'cari': 'look for', 'yang': 'that is', 'restoran': 'restaurant' } },

  { id: 'id42', english: 'They like to walk in the city',
    answer: ['Mereka', 'suka', 'jalan', 'di', 'kota'],
    hints: { 'jalan': 'walk', 'di': 'in' } },

  { id: 'id43', english: 'I cannot find my book',
    answer: ['Saya', 'tidak', 'bisa', 'cari', 'buku', 'saya'],
    hints: { 'buku': 'book' } },

  { id: 'id44', english: 'We always eat together',
    answer: ['Kami', 'selalu', 'makan', 'bersama'],
    hints: { 'selalu': 'always', 'bersama': 'together' } },

  { id: 'id45', english: 'She wants to study at school',
    answer: ['Dia', 'mau', 'belajar', 'di', 'sekolah'],
    hints: { 'belajar': 'study', 'sekolah': 'school' } },

  { id: 'id46', english: 'I think the food here is good',
    answer: ['Saya', 'pikir', 'makanan', 'di', 'sini', 'baik'],
    hints: { 'pikir': 'think', 'di sini': 'here' } },

  { id: 'id47', english: 'My family lives in a big house',
    answer: ['Keluarga', 'saya', 'tinggal', 'di', 'rumah', 'besar'],
    hints: { 'Keluarga': 'family', 'tinggal': 'live/stay' } },

  { id: 'id48', english: 'I do not understand this problem',
    answer: ['Saya', 'tidak', 'mengerti', 'masalah', 'ini'],
    hints: { 'mengerti': 'understand', 'masalah': 'problem' } },

  { id: 'id49', english: 'They are selling food at the market',
    answer: ['Mereka', 'jual', 'makanan', 'di', 'pasar'],
    hints: { 'jual': 'sell', 'pasar': 'market' } },

  { id: 'id50', english: 'I need help because the problem is difficult',
    answer: ['Saya', 'butuh', 'bantuan', 'karena', 'masalahnya', 'sulit'],
    hints: { 'butuh': 'need', 'bantuan': 'help', 'karena': 'because', 'masalahnya': 'the problem', 'sulit': 'difficult' } },
]

// Returns the full sentence pool for a language. The Dragon Game then applies
// sentenceFamiliarityScore() + orderByFamiliarity() to select the most appropriate
// sentence for the user's current knowledge level.
export function sentencesFor(lang: Language): SentenceChallenge[] {
  if (lang === 'zh') return MANDARIN_SENTENCES
  if (lang === 'id') return INDONESIAN_SENTENCES
  return SPANISH_SENTENCES
}
