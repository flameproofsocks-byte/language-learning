import type { WordRelation } from './relations'

export const MANDARIN_RELATIONS: WordRelation[] = [

  // ── ANTONYMS (red) ──────────────────────────────────────────────────────────
  { from: 'zh073', to: 'zh074', type: 'antonym' },  // dà ↔ xiǎo (big/small)
  { from: 'zh075', to: 'zh076', type: 'antonym' },  // duō ↔ shǎo (many/few)
  { from: 'zh077', to: 'zh078', type: 'antonym' },  // kuài ↔ màn (fast/slow)
  { from: 'zh081', to: 'zh082', type: 'antonym' },  // guì ↔ piányí (expensive/cheap)
  { from: 'zh083', to: 'zh084', type: 'antonym' },  // lěng ↔ rè (cold/hot)
  { from: 'zh016', to: 'zh017', type: 'antonym' },  // lái ↔ qù (come/go)
  { from: 'zh029', to: 'zh030', type: 'antonym' },  // kāi ↔ guān (open/close)
  { from: 'zh064', to: 'zh066', type: 'antonym' },  // jīntiān ↔ zuótiān (today/yesterday)
  { from: 'zh064', to: 'zh065', type: 'antonym' },  // jīntiān ↔ míngtiān (today/tomorrow)
  { from: 'zh067', to: 'zh068', type: 'antonym' },  // shàngwǔ ↔ xiàwǔ (morning/afternoon)
  { from: 'zh085', to: 'zh072', type: 'antonym' },  // bù ↔ hǎo (not/good)
  { from: 'zh141', to: 'zh142', type: 'antonym' },  // lǎo ↔ xīn (old/new)
  { from: 'zh144', to: 'zh149', type: 'antonym' },  // gāo ↔ ǎi (tall/short)
  { from: 'zh145', to: 'zh146', type: 'antonym' },  // duì ↔ cuò (correct/wrong)
  { from: 'zh160', to: 'zh161', type: 'antonym' },  // yuǎn ↔ zhèlǐ (far/here)
  { from: 'zh027', to: 'zh028', type: 'antonym' },  // shuìjiào ↔ qǐchuáng (sleep/get up)
  { from: 'zh104', to: 'zh119', type: 'antonym' },  // huí ↔ dào (return/arrive)

  // ── SYNONYMS (green) ────────────────────────────────────────────────────────
  { from: 'zh010', to: 'zh011', type: 'synonym' },  // huì ↔ néng (can/able)
  { from: 'zh010', to: 'zh012', type: 'synonym' },  // huì ↔ kěyǐ (can/may)
  { from: 'zh009', to: 'zh019', type: 'synonym' },  // yào ↔ xiǎng (want/would like)
  { from: 'zh020', to: 'zh021', type: 'synonym' },  // xǐhuān ↔ ài (like/love)
  { from: 'zh085', to: 'zh086', type: 'synonym' },  // bù ↔ méi (not/haven't)
  { from: 'zh087', to: 'zh091', type: 'synonym' },  // hěn ↔ fēicháng (very/extremely)
  { from: 'zh090', to: 'zh091', type: 'synonym' },  // tài ↔ fēicháng (too/extremely)
  { from: 'zh153', to: 'zh156', type: 'synonym' },  // zuì ↔ tèbié (most/especially)
  { from: 'zh013', to: 'zh015', type: 'synonym' },  // shuō ↔ tīng (speak/listen — communication pair)
  { from: 'zh018', to: 'zh103', type: 'synonym' },  // zhīdào ↔ dǒng (know/understand)
  { from: 'zh147', to: 'zh148', type: 'synonym' },  // máng ↔ lèi (busy/tired — similar state)
  { from: 'zh113', to: 'zh107', type: 'synonym' },  // zǒu ↔ pǎo (walk/run)
  { from: 'zh041', to: 'zh164', type: 'synonym' },  // zhè ↔ zhège (this/this one)

  // ── CATEGORY (blue) — same semantic type ────────────────────────────────────

  // Pronouns
  { from: 'zh034', to: 'zh035', type: 'category' }, // wǒ ↔ nǐ
  { from: 'zh034', to: 'zh038', type: 'category' }, // wǒ ↔ wǒmen
  { from: 'zh036', to: 'zh037', type: 'category' }, // tā (m) ↔ tā (f)
  { from: 'zh036', to: 'zh040', type: 'category' }, // tā ↔ tāmen
  { from: 'zh038', to: 'zh039', type: 'category' }, // wǒmen ↔ nǐmen
  { from: 'zh041', to: 'zh042', type: 'category' }, // zhè ↔ nà (this/that)

  // Family
  { from: 'zh047', to: 'zh048', type: 'category' }, // māma ↔ bàba
  { from: 'zh133', to: 'zh134', type: 'category' }, // érzi ↔ nǚér (son/daughter)
  { from: 'zh135', to: 'zh136', type: 'category' }, // zhàngfu ↔ qīzi (husband/wife)
  { from: 'zh047', to: 'zh133', type: 'category' }, // māma ↔ érzi
  { from: 'zh048', to: 'zh134', type: 'category' }, // bàba ↔ nǚér

  // Time words
  { from: 'zh064', to: 'zh065', type: 'category' }, // jīntiān ↔ míngtiān
  { from: 'zh064', to: 'zh066', type: 'category' }, // jīntiān ↔ zuótiān
  { from: 'zh069', to: 'zh070', type: 'category' }, // nián ↔ yuè (year/month)
  { from: 'zh070', to: 'zh071', type: 'category' }, // yuè ↔ rì (month/day)
  { from: 'zh067', to: 'zh068', type: 'category' }, // shàngwǔ ↔ xiàwǔ
  { from: 'zh063', to: 'zh124', type: 'category' }, // shíjiān ↔ xiǎoshí (time/hour)

  // Technology
  { from: 'zh059', to: 'zh060', type: 'category' }, // diànhuà ↔ diànshì
  { from: 'zh060', to: 'zh061', type: 'category' }, // diànshì ↔ diànnǎo

  // Transport
  { from: 'zh057', to: 'zh125', type: 'category' }, // chē ↔ huǒchē (car/train)
  { from: 'zh058', to: 'zh125', type: 'category' }, // fēijī ↔ huǒchē (plane/train)
  { from: 'zh057', to: 'zh058', type: 'category' }, // chē ↔ fēijī

  // People at school/work
  { from: 'zh045', to: 'zh046', type: 'category' }, // lǎoshī ↔ xuésheng
  { from: 'zh046', to: 'zh137', type: 'category' }, // xuésheng ↔ tóngxué

  // Adjective intensifiers
  { from: 'zh087', to: 'zh090', type: 'category' }, // hěn ↔ tài (very/too)
  { from: 'zh155', to: 'zh087', type: 'category' }, // gèng ↔ hěn (even more/very)

  // Can/ability verbs
  { from: 'zh010', to: 'zh011', type: 'category' }, // huì ↔ néng
  { from: 'zh011', to: 'zh012', type: 'category' }, // néng ↔ kěyǐ

  // Eating/drinking verbs
  { from: 'zh022', to: 'zh023', type: 'category' }, // chī ↔ hē (eat/drink)
  { from: 'zh022', to: 'zh024', type: 'category' }, // chī ↔ mǎi (eat/buy)

  // Verb/noun root pairs
  { from: 'zh025', to: 'zh050', type: 'category' }, // xuéxí ↔ xuéxiào (study/school)
  { from: 'zh026', to: 'zh126', type: 'category' }, // gōngzuò ↔ gōngsī (work/company)

  // ── DOMAIN (purple, dashed) — same real-world topic ─────────────────────────

  // Food & drink
  { from: 'zh022', to: 'zh055', type: 'domain' },   // chī ↔ fàn (eat/rice)
  { from: 'zh022', to: 'zh129', type: 'domain' },   // chī ↔ cài (eat/dish)
  { from: 'zh023', to: 'zh054', type: 'domain' },   // hē ↔ shuǐ (drink/water)
  { from: 'zh023', to: 'zh130', type: 'domain' },   // hē ↔ kāfēi (drink/coffee)
  { from: 'zh023', to: 'zh131', type: 'domain' },   // hē ↔ chá (drink/tea)
  { from: 'zh055', to: 'zh129', type: 'domain' },   // fàn ↔ cài (rice/dish)
  { from: 'zh130', to: 'zh131', type: 'domain' },   // kāfēi ↔ chá (coffee/tea)
  { from: 'zh054', to: 'zh055', type: 'domain' },   // shuǐ ↔ fàn (water/food)

  // Education
  { from: 'zh025', to: 'zh045', type: 'domain' },   // xuéxí ↔ lǎoshī
  { from: 'zh025', to: 'zh046', type: 'domain' },   // xuéxí ↔ xuésheng
  { from: 'zh050', to: 'zh045', type: 'domain' },   // xuéxiào ↔ lǎoshī
  { from: 'zh050', to: 'zh046', type: 'domain' },   // xuéxiào ↔ xuésheng
  { from: 'zh050', to: 'zh137', type: 'domain' },   // xuéxiào ↔ tóngxué
  { from: 'zh118', to: 'zh050', type: 'domain' },   // jiāo ↔ xuéxiào (teach/school)
  { from: 'zh053', to: 'zh050', type: 'domain' },   // shū ↔ xuéxiào (book/school)
  { from: 'zh167', to: 'zh025', type: 'domain' },   // bān ↔ xuéxí (class/study)

  // Work
  { from: 'zh026', to: 'zh056', type: 'domain' },   // gōngzuò ↔ qián (work/money)
  { from: 'zh024', to: 'zh056', type: 'domain' },   // mǎi ↔ qián (buy/money)
  { from: 'zh126', to: 'zh056', type: 'domain' },   // gōngsī ↔ qián (company/money)

  // Health / body
  { from: 'zh127', to: 'zh148', type: 'domain' },   // yīyuàn ↔ lèi (hospital/tired)
  { from: 'zh138', to: 'zh148', type: 'domain' },   // shēntǐ ↔ lèi (body/tired)
  { from: 'zh138', to: 'zh147', type: 'domain' },   // shēntǐ ↔ máng (body/busy)
  { from: 'zh127', to: 'zh138', type: 'domain' },   // yīyuàn ↔ shēntǐ (hospital/body)

  // Travel / places
  { from: 'zh049', to: 'zh051', type: 'domain' },   // jiā ↔ Zhōngguó
  { from: 'zh052', to: 'zh051', type: 'domain' },   // Běijīng ↔ Zhōngguó
  { from: 'zh057', to: 'zh017', type: 'domain' },   // chē ↔ qù (car/go)
  { from: 'zh125', to: 'zh017', type: 'domain' },   // huǒchē ↔ qù (train/go)
  { from: 'zh128', to: 'zh024', type: 'domain' },   // chāoshì ↔ mǎi (supermarket/buy)

  // Communication
  { from: 'zh059', to: 'zh013', type: 'domain' },   // diànhuà ↔ shuō (phone/speak)
  { from: 'zh013', to: 'zh116', type: 'domain' },   // shuō ↔ wèn (speak/ask)
  { from: 'zh116', to: 'zh123', type: 'domain' },   // wèn ↔ wèntí (ask/problem)
]
