/**
 * The character set a user-imported font is subsetted to. It covers the
 * Latin, Greek and Cyrillic alphabets, punctuation and symbols, kana, the most
 * common CJK characters and everything already typed in the project. This
 * keeps a 20 MB CJK face under a few hundred kilobytes while still handling
 * everyday titles, captions and UI text.
 */
const COMMON_CJK = '的一是不了在人有我他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可她里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东政海口使教西再平真听世气信北少关并内加化由却代军产入先山五太水万市眼体别处总才场师书比住员九笑性通目华报立马命张活难神数件安表原车白应路期叫死常提感金何更反合放做系计或司利受光王果亲界及今京务制解各任至清物台象记边共风战干接它许八特觉望直服毛林题建南度统色字请交爱让认算论百吃义科怎元社术结六功指思非流每青管夫连远资队跟带花快条院变联言权往展该领传近留红治决周保达办运武半候七必城父强步完革深区即求品士转量空甚众技轻程告江语英基派满式李息写呢识极令黄德收脸钱党倒未持取设始版双历越史商千片容研像找友孩站广改议形委早房音火际则首单据导影失拿网香似斯专石若兵弟谁校读志飞观争究包组造落视济喜离虽坐集编宝谈府拉黑且随格尽剑讲布杀微怕母调局根曾准团段终乐切级克精哪官示冷域吗吧啊呢嗯';

const RANGES: [number, number][] = [
  [0x20, 0x24f], // Basic Latin, Latin-1, Latin Extended-A/B
  [0x2b0, 0x2ff], // IPA and spacing modifiers
  [0x300, 0x36f], // combining marks
  [0x370, 0x3ff], // Greek
  [0x400, 0x4ff], // Cyrillic
  [0x1e00, 0x1eff], // Latin Extended Additional
  [0x2000, 0x206f], // general punctuation
  [0x20a0, 0x20cf], // currency
  [0x2100, 0x214f], // letterlike symbols
  [0x2190, 0x21ff], // arrows
  [0x2200, 0x22ff], // mathematical operators
  [0x25a0, 0x25ff], // geometric shapes
  [0x2600, 0x26ff], // miscellaneous symbols
  [0x3000, 0x303f], // CJK punctuation
  [0x3040, 0x30ff], // hiragana and katakana
  [0xff61, 0xff9f], // halfwidth katakana
];

export function subsetCharacters(projectText = ''): string {
  let text = '';
  for (const [start, end] of RANGES) {
    for (let codePoint = start; codePoint <= end; codePoint++) text += String.fromCodePoint(codePoint);
  }
  return `${text}${COMMON_CJK}${projectText}`;
}
