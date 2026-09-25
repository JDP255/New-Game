// All narrative text — an original mythology. Biblical themes (creation by a Word, the fall of pride,
// mercy, sacrifice, redemption) are echoed, never quoted. In-world scripture is "The Canticle".

export const CHAPTERS = [
  {
    id: 1, numeral: 'I', title: 'The Unbroken Wing', realm: 'The Aerie of Kim',
    verse: 'Before the first dawn there was a Voice, and the Voice was not alone. It sang, and the singing became the world.', ref: 'The Canticle, Leaf of Beginnings',
  },
  {
    id: 2, numeral: 'II', title: 'The Vale Without Song', realm: 'Ashmourn, the Shepherds’ Vale',
    verse: 'Fear is a fog that tells you the road has ended. Walk anyway. The road has not heard the news.', ref: 'Sayings of the Lanternkeepers',
  },
  {
    id: 3, numeral: 'III', title: 'The Many-in-One', realm: 'The Fields of Elah-Kim',
    verse: 'Size is the first thing the eye believes, and the last thing that matters.', ref: 'The Canticle, Leaf of the Small',
  },
  {
    id: 4, numeral: 'IV', title: 'The Silent Walls', realm: 'Kor-Jerah, City of Stone Oaths',
    verse: 'A wall built by forgetting falls to a single remembered name.', ref: 'Inscription beneath the Bell of Kor',
  },
  {
    id: 5, numeral: 'V', title: 'The Forge of Ash', realm: 'The Furnace of Molochar',
    verse: 'He wanted a fire hotter than the Lantern. He got one. There was nothing left of him to feel it.', ref: 'The Lament of the Smiths',
  },
  {
    id: 6, numeral: 'VI', title: 'The Drowned Sky', realm: 'The Obsidian Sea of Tehom',
    verse: 'Every tear the fallen wept for what they chose ran downhill, and pooled, and learned to hunger.', ref: 'Sea-charts of the Last Mariner',
  },
  {
    id: 7, numeral: 'VII', title: 'The Last Lantern', realm: 'The Spire of Ascension',
    verse: 'He climbed to take the light. It had always been given freely. That was the part he could not bear.', ref: 'The Canticle, Leaf of the Fall',
  },
];

// The six Oathmarks: vows etched into a Wingbearer's armour, each one earned, each one a power.
export const ARMOR = {
  belt: { name: 'Oathmark of Truth', desc: 'Etched upon the belt: "I will not lie, not even to spare myself." Glory gathers 50% faster.', ref: 'First Vow of the Wingbearer' },
  breastplate: { name: 'Oathmark of the Steadfast Heart', desc: 'Etched over the heart: "I will stand where others ran." +40 maximum Vigor.', ref: 'Second Vow of the Wingbearer' },
  shoes: { name: 'Oathmark of the Swift Tiding', desc: 'Etched upon the greaves: "Where hope is needed, I will already be on my way." A second air-dash and a faster sprint.', ref: 'Third Vow of the Wingbearer' },
  shield: { name: 'Oathmark of Shelter', desc: 'Etched upon the gauntlet: "What is thrown at the weak, I will throw back." Parries reflect bolts and the parry window widens.', ref: 'Fourth Vow of the Wingbearer' },
  helmet: { name: 'Oathmark of Rising', desc: 'Etched upon the brow: "I will fall. I will not stay fallen." Once per trial, you rise again.', ref: 'Fifth Vow of the Wingbearer' },
  sword: { name: 'Oathmark of the Voice', desc: 'Etched upon Veritas: "I will speak only what was first spoken to me." Judgment strikes twice as hard; heavy blows send out waves of light.', ref: 'Sixth Vow of the Wingbearer' },
};
export const ARMOR_BY_CHAPTER = { 1: 'belt', 2: 'breastplate', 3: 'shoes', 4: 'shield', 5: 'helmet', 6: 'sword' };

// Leaves of the Canticle — 3 per chapter. Original scripture and reflections of the world of Kim.
export const SCROLLS = [
  // I — Kim
  { title: 'The Anthem', verse: 'The Voice sang one note, and it was light. It sang a second, and it was longing. From the two it wove every living thing.', ref: 'Canticle 1:1',
    text: 'The elders teach that everything alive is made of light and longing in some measure. The Wingbearers were given more longing than most — which is why they fly.' },
  { title: 'The Lifting', verse: 'And the Voice lifted the land of Kim upon its breath and set it above the clouds, as a promise kept in plain sight.', ref: 'Canticle 2:4',
    text: 'Kim was not lifted because its people were better. It was lifted so that the ones below would always be able to look up and see that promises are kept.' },
  { title: 'The Ninth Feather', verse: 'Eight feathers to bear the body, and a ninth that bears nothing — for the ninth is for the one who falls beside you.', ref: 'Rule of the Wingbearers',
    text: 'Every Wingbearer’s wing carries one feather that is never used for flight. When a brother falls, you pluck it and lay it in his hand. Valkimsmor has laid down three hundred and eleven.' },
  // II — Ashmourn
  { title: 'The Lanternkeepers', verse: 'Keep the flame small and keep it close. A great fire is seen by many; a small one is carried by one to the one who needs it.', ref: 'Sayings of the Lanternkeepers',
    text: 'The shepherds of Ashmourn were not warriors. They kept five hearths burning along the vale so that no traveller would ever walk more than an hour in the dark. Zekeriah’s fog came for the hearths first.' },
  { title: 'The Fog of Unmaking', verse: 'It does not wound. It only whispers: you are alone, you were always alone, you will die alone. And the whisper is the wound.', ref: 'Canticle 9:2',
    text: 'The Hollowing begins as doubt. Those who breathe the fog long enough forget the sound of their own names. After that, it is easy to hand them a new one.' },
  { title: 'The Shepherd’s Count', verse: 'Ninety-nine in the fold, and the shepherd went out into the night. Not because one is worth more than ninety-nine — but because one is worth going out for.', ref: 'Sayings of the Lanternkeepers',
    text: 'The last shepherd of Ashmourn walked into the fog to find a single lost lamb. He never came back. But every brazier in the vale was lit the night he left, and no one knows by whom.' },
  // III — Elah-Kim
  { title: 'The Many-in-One', verse: 'He took a hundred frightened men, and told them that together they would never be afraid again. And they believed him, and became one thing.', ref: 'Chronicle of the Rootlands',
    text: 'Gorlath is not one giant. He is a hundred soldiers of Zerkskis fused into a single body by the Hollowing — each surrendering his name for the promise of never feeling small. They still feel small. All hundred of them.' },
  { title: 'The Small Things', verse: 'The Voice has always preferred the small things: a seed, a spark, a child, a single feather on the wind. Pride builds towers; the Voice plants.', ref: 'Canticle 14:7',
    text: 'The armies of Kim waited forty days for someone large enough to face Gorlath. They were waiting for the wrong thing.' },
  { title: 'The Breaking of the Many', verse: 'Strike the heart of the many, and the one will become many again.', ref: 'Prophecy of Elder Ithiel',
    text: 'When a Hollowed soul is struck down by a Wingbearer, the darkness breaks — and what rises is not a corpse, but a light. The Order has always known its swords were never meant to kill.' },
  // IV — Kor-Jerah
  { title: 'The Stone Oath', verse: 'Swear never to remember, and the stone will never fall. Remember once, and it will not stand another hour.', ref: 'Law of Kor-Jerah',
    text: 'The walls of Kor were not built of stone alone. Each block was sealed with an oath of forgetting sworn by a citizen of the city. The walls are made of ten thousand lost names.' },
  { title: 'The Seven Bells', verse: 'Seven bells were cast from the first silver of Kim and hung outside the city, for the day its people would wish to go home.', ref: 'Chronicle of the Rootlands',
    text: 'Each bell is tuned to a note of the Anthem. Ring one, and the citizens of Kor hear something they cannot name. Ring seven, and they remember everything.' },
  { title: 'The Lamp in the Window', verse: 'She kept a lamp burning in her window through every year of the forgetting, though she could not remember whom she was waiting for.', ref: 'The Tale of Mira',
    text: 'Mira of Kor sheltered two scouts of Kim when no one else in the city would. When the walls fell, her house — built into the wall itself — stood untouched. The stones remembered her name even when she did not.' },
  // V — The Forge
  { title: 'The Smith of Kim', verse: 'He was the finest smith the isles ever knew, and he asked the Voice for one thing: a fire that would never go out.', ref: 'The Lament of the Smiths',
    text: 'Molochar once forged the blades of the Wingbearers. Veritas itself came from his anvil. When the Voice did not answer him quickly enough, he took the question to Zekeriah instead.' },
  { title: 'Refinement', verse: 'The fire does not make the gold. It only finds out which part of you was gold all along.', ref: 'Sayings of the Forge',
    text: 'Smiths of Kim do not fear heat. They fear impurity. Molochar forgot the difference, and began to burn things only to watch them burn.' },
  { title: 'The Stranger in the Flame', verse: 'There are fires you must walk through alone. None of them are the ones you think.', ref: 'Canticle 21:3',
    text: 'Every Wingbearer who has walked into the Forge of Ash and walked back out says the same thing: that halfway through, someone was walking beside them. None of them can describe his face.' },
  // VI — Tehom
  { title: 'The Sea of Tears', verse: 'When the first of the fallen understood what they had given away, they wept, and the weeping did not stop, and the sea did not stop rising.', ref: 'Sea-charts of the Last Mariner',
    text: 'The Obsidian Sea is not water. It is grief that no one ever comforted. Tehomar, the beast of the deep, was born in it, and feeds on every sorrow that is carried alone.' },
  { title: 'The Eye of the Wing', verse: 'In the heart of every storm there is a stillness. Fly there, and the storm will break around you like a wave around a stone.', ref: 'Flight-lore of the Wingbearers',
    text: 'The Order teaches that calm is not the absence of the storm. It is the refusal to let the storm decide which way you face.' },
  { title: 'The Offer', verse: 'Kneel, and I will give you back everything you lost. Only kneel.', ref: 'Words of Zekeriah over Tehom',
    text: 'Every tyrant makes the same offer. What they will give you is always what you lost. What they ask for is always the reason you were worth giving it to.' },
  // VII — The Spire
  { title: 'The First Wingbearer', verse: 'He was the brightest of us. He asked to hear the Voice without trusting it, and so he reached for the Ember itself — and his wings became smoke.', ref: 'Canticle 30:1',
    text: 'Zekeriah was the first Wingbearer, and the teacher of every knight who came after him. Valkimsmor was his last and best student. It was Valkimsmor who was standing beside him the night he fell — and did not stop him.' },
  { title: 'The Spire of Ascension', verse: 'Stone upon stone, name upon name, he builds a stair to the Last Lantern, meaning to swallow the light of the world and never again need to ask for it.', ref: 'Chronicle of the Rootlands',
    text: 'The Spire is built from the walls of every home in Zerkskis. Each stone was given willingly by a Hollowed soul who was promised that the dark would end when the tower was finished.' },
  { title: 'The Last Leaf', verse: 'And the Voice said to the ones who had fallen furthest: I did not lift the land away from you. I lifted it so you could see the way home.', ref: 'Canticle, the Final Leaf',
    text: 'The last page of the Canticle has always been left blank in every copy. The elders say it is waiting to be written by someone who chooses mercy when vengeance would be easier.' },
];

export const RELICS = [
  { name: 'The First Feather', text: 'Shed by the Voice’s own breath when Kim was lifted. It is warm to the touch and has never once fallen when released — it simply waits in the air for you to take it back.' },
  { name: 'The Shepherd’s Horn-Lamp', text: 'Carried by the last shepherd of Ashmourn. Its flame burns cold and blue and cannot be put out by any fog. It is still looking for a lost lamb.' },
  { name: 'The Hundredth Name', text: 'A single iron tag, stamped with a name, pulled from the chest of Gorlath. Ninety-nine names had been scratched off. This one, somehow, held on.' },
  { name: 'Mira’s Lamp', text: 'The lamp that burned in a window of Kor through every year of the forgetting. When lit, it shows the name of whoever holds it, written in light upon the wall.' },
  { name: 'The Unburnt Apron', text: 'The leather apron of Molochar from the days he was only a smith of Kim. It came out of the Forge of Ash without a single scorch mark. It still smells of cedar.' },
  { name: 'The Comforted Tear', text: 'A single pearl drawn from the Obsidian Sea. It is the only tear in Tehom that someone ever wiped away — and so it turned to light instead of hunger.' },
  { name: 'Zekeriah’s First Feather', text: 'White, and whole, from before the fall. He kept it hidden at the top of his Spire all these years. He never could bring himself to burn it.' },
];

// Deep lore codex, unlocked as you progress (key = chapter it unlocks at).
export const CODEX = [
  { ch: 1, cat: 'History', title: 'The First Voice and the Anthem', text: 'Before anything was, there was the First Voice — not a god who shouts, but one who sings. Its song, the Anthem, is still playing beneath every sound in the world. The Wingbearers say that in perfect silence, high above the clouds, you can hear it.' },
  { ch: 1, cat: 'History', title: 'The Lifting of Kim', text: 'In the second age the Voice lifted the land of Kim upon its breath and set it above the clouds. Those who went up became the Kimari. Those who stayed to tend the deep roots of the world became the Rootfolk. For a thousand years the two peoples traded, married and sang together. There was no word yet for "Zerkskis".' },
  { ch: 1, cat: 'Places', title: 'The Aerie of Kim', text: 'A thousand floating isles held aloft by the breath of the Voice, bound together by golden updrafts called the Rivers of Breath. The golden trees of Kim bloom only in sunlight from the Last Lantern, and have begun, for the first time in history, to drop their leaves.' },
  { ch: 1, cat: 'Order', title: 'The Wingbearers', text: 'Knights of Kim given wings from the Ember of Dawn, a fragment of the first light. A Wingbearer swears six Oathmarks over a lifetime and keeps the Rule of the Ninth Feather. At their height they numbered three hundred and twelve. Now there is one.' },
  { ch: 1, cat: 'People', title: 'Valkimsmor', text: 'In the old tongue: Val (oath), Kim (the lifted land), Smor (unbroken). He was an orphan of the Rootlands, carried up to Kim as a child by the Wingbearer who would later become his teacher — Zekeriah. He speaks rarely. He has never once broken a vow. He believes this makes up for the one night he stood still.' },
  { ch: 1, cat: 'People', title: 'Elder Ithiel', text: 'Keeper of the Cathedral of the Anthem and the oldest living soul in Kim. She remembers when Zekeriah was a boy who asked too many questions. She still prays for him by name every morning, which no one else in Kim will do.' },
  { ch: 2, cat: 'History', title: 'The Fall of the First Wingbearer', text: 'Zekeriah could hear the Anthem more clearly than anyone. It was not enough. He wanted to hear the Voice speak to him — plainly, now, on his terms. One night he climbed to the Ember of Dawn to take it. The Ember did not resist him. It simply burned. His wings became smoke, and he fell through the clouds to the Rootlands.' },
  { ch: 2, cat: 'History', title: 'The Hollowing', text: 'Among the Rootfolk, Zekeriah offered a gift: an end to fear. All it cost was a name. Those who accepted were filled with a quiet darkness that made them brave, obedient and tireless — and slowly erased who they had been. The Rootfolk became the Zerkskis, "the people of the dark", and forgot that the name was once an insult.' },
  { ch: 3, cat: 'People', title: 'Gorlath, the Many-in-One', text: 'Forged from a hundred Hollowed soldiers who each wished never to feel small again. The Hollowing welded them into a single colossus. Each of his footsteps is a hundred men walking in step. Each of his roars is a hundred men screaming in one voice.' },
  { ch: 3, cat: 'People', title: 'Captain Dorian of the Isles', text: 'Commander of the last army of Kim — farmers, bell-ringers and fletchers with borrowed spears. Brave, bitter, and ashamed that for forty days he could not make himself walk down into the valley.' },
  { ch: 4, cat: 'Places', title: 'Kor-Jerah', text: 'Once the greatest city of the Rootfolk, famous for its bell-foundries. Under the Hollowing its people swore the Stone Oath — to forget their past in exchange for walls that could never fall. The walls did not fall. The people inside them simply stopped being anyone at all.' },
  { ch: 5, cat: 'People', title: 'Molochar', text: 'The Smith of Kim who forged Veritas. He asked the Voice for a fire that would never go out and grew tired of waiting for an answer. Zekeriah gave him one. Now he is the fire — a furnace in the shape of a man, forging the weapons of the Hollowed day and night.' },
  { ch: 5, cat: 'Mysteries', title: 'The Stranger in the Flame', text: 'A figure of pure light who appears beside those who walk into fire for someone else. He never speaks. He is never seen twice by the same person. The Canticle does not name him, and the elders will not guess.' },
  { ch: 6, cat: 'Places', title: 'The Obsidian Sea of Tehom', text: 'Where the Rootlands dip lowest, the tears of the Hollowed gathered into a black sea. It has tides that follow despair rather than the moon. Ships that cross it must never carry anyone who is weeping alone.' },
  { ch: 6, cat: 'People', title: 'Tehomar, the Deep That Hungers', text: 'A serpent grown from uncomforted grief. It is ancient, enormous, and not truly evil — it is simply what loneliness becomes when it is left long enough in the dark.' },
  { ch: 7, cat: 'People', title: 'Zekeriah, Lord of Zerkskis', text: 'The First Wingbearer. The Teacher. The Fallen. He believes the Voice abandoned him because it never answered him directly, and he has spent three hundred years building a stair to the Last Lantern to take the light by force. He has never stopped keeping one white feather.' },
  { ch: 7, cat: 'Places', title: 'The Last Lantern', text: 'The sun of Kim — the final unbroken piece of the first light, hung in the sky by the Voice. Every year it has dimmed a little as the Spire grows taller. When the Spire is complete, Zekeriah will swallow it, and there will be no more dawns for anyone.' },
];

export const DEATH_QUOTES = [
  ['I will fall. I will not stay fallen.', 'Fifth Vow of the Wingbearer'],
  ['The ground is only a place to push against.', 'Flight-lore of the Wingbearers'],
  ['Three hundred and eleven feathers laid down. Not one of them was laid down for good.', 'Elder Ithiel'],
  ['The Voice has never once counted how many times you fell. Only whether you got up.', 'Canticle 12:9'],
];

export const TIPS = [
  'Hold JUMP in the air to glide. Golden Rivers of Breath carry you higher.',
  'Perfect parries (Q) as a foe strikes slow time and open them to a devastating riposte.',
  'Heavy attacks and Wing Dives break the guard of armored Brutes.',
  'Glory builds as you fight. When the halo is full, press F to call down Judgment.',
  'Every 12 Seraph Feathers grant an extra wing-beat and more Vigor.',
  'Leaves of the Canticle are often hidden where only wings can reach.',
  'Struck-down Hollowed release souls of light that heal you — mercy sustains the merciful.',
  'Lock on to a foe with TAB or middle mouse. You are untouchable mid-dash.',
];
