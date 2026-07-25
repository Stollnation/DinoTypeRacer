export const CONFIG = {
  title: "Dino Type Racer",
  storageKey: "typing-race:v1",
  calibrationSeconds: 60,
  colors: { navy: "#0d3b66", lemon: "#faf0ca", gold: "#f4d35e", sand: "#ee964b", tomato: "#f95738" },
  adaptiveRatios: [0.95, 0.99, 1.02, 1.05],
  fixedRatios: { easy: 0.75, normal: 1, hard: 1.15 },
  calibrationText: `Every steady practice session turns small movements into useful habits. Keep your shoulders relaxed and let your fingers travel lightly across the keys. Accuracy creates a rhythm that speed can follow. When a difficult word appears, stay calm, correct it, and continue. The goal is not to rush every letter but to build a pace you can trust. Morning light stretches across the path while runners gather near the starting line. A cool breeze moves through the trees and carries the sound of shoes against the track. Each racer has a different rhythm, yet everyone moves toward the same bright finish. Focus on the next character, then the next word, and allow the sentence to unfold naturally. Strong typing grows from patient repetition, clear attention, and the confidence to recover from mistakes. Keep looking ahead while your hands do the work. The road becomes easier when your eyes remain on the text and your breathing stays even. Practice rewards consistency more than a single burst of speed. Today is a useful starting point, and every future race offers another chance to move a little faster with a little more control.`,
};

export const THEMES = [
  { id: "sunset-sprint", name: "Sunset Sprint", themeColor: "#0d3b66" },
  { id: "stormy-teal", name: "Stormy Teal", themeColor: "#284b63" },
  { id: "coral-slate", name: "Coral Slate", themeColor: "#2d3142" },
  { id: "solar-rally", name: "Solar Rally", themeColor: "#003049" },
  { id: "pumpkin-coast", name: "Pumpkin Coast", themeColor: "#004e98" },
  { id: "forest-trail", name: "Forest Trail", themeColor: "#344e41" },
];

const GENERAL_CHALLENGES = [
  { id: 'general-01', title: 'Morning Warmup', category: 'General', enabled: true, text: 'Morning light runs along the track while every racer settles into a clean rhythm. Keep your hands relaxed, trust the next letter, and let accuracy pull the sentence forward.' },
  { id: 'general-02', title: 'Steady Climb', category: 'General', enabled: true, text: 'A strong pace begins with small decisions repeated well. Each corrected mistake teaches your fingers where to land, and each finished line adds another step up the hill.' },
  { id: 'general-03', title: 'Harbor Wind', category: 'General', enabled: true, text: 'A salt breeze moves across the harbor and rattles the flags above the starting line. The runners lean into the turn, listening for the rhythm hidden inside the noise.' },
  { id: 'general-04', title: 'Quiet Focus', category: 'General', enabled: true, text: 'The best practice often feels ordinary while it is happening. You breathe, read the next word, tap the right keys, and discover afterward that ordinary minutes became real progress.' },
  { id: 'general-05', title: 'Bright Finish', category: 'General', enabled: true, text: 'The finish stripe waits in the distance, clear and still. Your job is not to chase every letter at once, but to meet one character after another with calm attention.' },
  { id: 'general-06', title: 'Desert Shortcut', category: 'General', enabled: true, text: 'Dust lifts behind the racers as they follow a winding desert shortcut. A clever path only helps when each step is steady enough to carry speed without losing control.' },
  { id: 'general-07', title: 'Lantern Trail', category: 'General', enabled: true, text: 'Lanterns glow beside the trail as evening settles over the course. The path looks different in softer light, yet the rule remains simple: read carefully and keep moving.' },
  { id: 'general-08', title: 'Practice Signal', category: 'General', enabled: true, text: 'Every mistake is a signal, not a verdict. Notice it, correct it, and return to the sentence before frustration steals energy that belongs to the race.' },
  { id: 'general-09', title: 'Thunder Run', category: 'General', enabled: true, text: 'Clouds gather over the grandstand while the runners stretch at the line. The first rumble sounds distant, but the track already feels charged with motion.' },
  { id: 'general-10', title: 'Patient Speed', category: 'General', enabled: true, text: 'Speed that ignores accuracy collapses quickly. Patient speed lasts longer because it knows where the letters are and refuses to waste motion on panic.' },
  { id: 'general-11', title: 'Map Room', category: 'General', enabled: true, text: 'A dusty map lies open on the table, marked with routes no one has tried in years. The winning path begins where curiosity meets careful planning.' },
  { id: 'general-12', title: 'Green Valley', category: 'General', enabled: true, text: 'The valley opens wide below the ridge, full of bright grass and wandering streams. Even a difficult race feels lighter when the road gives you room to breathe.' },
  { id: 'general-13', title: 'Clockwork Steps', category: 'General', enabled: true, text: 'The old clock above the station ticks in a stubborn rhythm. Match that steadiness with your hands, and the passage will move forward like gears finding their teeth.' },
  { id: 'general-14', title: 'Hidden Gate', category: 'General', enabled: true, text: 'The hidden gate is not opened by force, but by noticing the small stone that everyone else missed. Careful attention turns a wall into a doorway.' },
  { id: 'general-15', title: 'Rainy Practice', category: 'General', enabled: true, text: 'Rain taps against the window while the keyboard clicks inside. The weather may change the mood, but steady practice keeps its own bright shelter.' },
  { id: 'general-16', title: 'Long Bridge', category: 'General', enabled: true, text: 'The bridge stretches farther than it first appeared, but every plank supports the next step. Long passages work the same way when you stop measuring the whole distance.' },
  { id: 'general-17', title: 'Campfire Plan', category: 'General', enabled: true, text: 'Around the campfire, every racer explains a different plan for tomorrow. The best one is simple enough to remember when the starting horn sounds.' },
  { id: 'general-18', title: 'River Bend', category: 'General', enabled: true, text: 'The river bends sharply near the old mill, pulling the current into a silver curve. Good typing follows the bend without fighting the shape of the sentence.' },
  { id: 'general-19', title: 'Second Wind', category: 'General', enabled: true, text: 'The second wind arrives quietly, often after the part where stopping sounded reasonable. Keep typing through that moment and let the rhythm find you again.' },
  { id: 'general-20', title: 'Workshop Light', category: 'General', enabled: true, text: 'A warm workshop light falls across scattered tools and half-finished ideas. Skill grows here, where patient hands return to the work until it finally fits.' },
  { id: 'general-21', title: 'Open Field', category: 'General', enabled: true, text: 'The course crosses an open field where there is nothing to hide behind. That can feel intimidating, but clear space also means a clean view of the finish.' },
  { id: 'general-22', title: 'Small Compass', category: 'General', enabled: true, text: 'A small compass is useful because it answers one question again and again. Practice works the same way when you let accuracy point you back toward progress.' },
  { id: 'general-23', title: 'Midnight Train', category: 'General', enabled: true, text: 'The midnight train carries tired travelers through towns of yellow windows and quiet streets. Its steady wheels remind you that motion can be calm and still arrive on time.' },
  { id: 'general-24', title: 'Garden Steps', category: 'General', enabled: true, text: 'Stone steps climb through a garden crowded with leaves and blue flowers. Each step is plain by itself, but together they lift you somewhere worth seeing.' },
  { id: 'general-25', title: 'Rooftop Race', category: 'General', enabled: true, text: 'From the rooftops, the city looks like a puzzle of lights and lanes. The fastest runner is the one who can see the next safe landing.' },
  { id: 'general-26', title: 'Fresh Page', category: 'General', enabled: true, text: 'A fresh page can feel empty or inviting depending on your courage. Begin with one clean sentence, and the blank space starts working with you.' },
  { id: 'general-27', title: 'Signal Fire', category: 'General', enabled: true, text: 'A signal fire burns on the ridge, telling distant friends that the path is safe. Clear writing does the same thing for readers who arrive later.' },
  { id: 'general-28', title: 'Old Library', category: 'General', enabled: true, text: 'The old library smells like dust, raincoats, and stories that refused to disappear. Every shelf seems to whisper that patience can outlast noise.' },
  { id: 'general-29', title: 'Canyon Echo', category: 'General', enabled: true, text: 'Your footsteps echo between canyon walls, returning slightly changed each time. Practice is an echo too, repeating the lesson until your hands finally believe it.' },
  { id: 'general-30', title: 'Fast Learner', category: 'General', enabled: true, text: 'A fast learner is not someone who never misses. A fast learner notices the miss quickly, changes course, and keeps enough confidence to try again.' },
  { id: 'general-31', title: 'Blue Horizon', category: 'General', enabled: true, text: 'The horizon turns blue where the road disappears into morning haze. You cannot see the whole route yet, but the next few steps are visible enough.' },
  { id: 'general-32', title: 'Puzzle Box', category: 'General', enabled: true, text: 'The puzzle box opens only when every piece moves in the right order. Typing a sentence asks for the same respectful attention to sequence.' },
  { id: 'general-33', title: 'Festival Race', category: 'General', enabled: true, text: 'Drums roll near the festival gate as banners snap in the wind. The crowd is loud, but the racer hears only breath, footsteps, and the next letter.' },
  { id: 'general-34', title: 'Careful Sparks', category: 'General', enabled: true, text: 'A bright idea can arrive like a spark, but useful work keeps it alive. Protect the spark with structure, patience, and enough focus to finish.' },
  { id: 'general-35', title: 'Mountain Light', category: 'General', enabled: true, text: 'Sunlight reaches the mountain peaks before the valley floor. Progress sometimes works that way, showing a little brightness before the whole path becomes clear.' },
  { id: 'general-36', title: 'Tidy Desk', category: 'General', enabled: true, text: 'A tidy desk will not type the paragraph for you, but it can remove one more distraction. Clear space gives attention a better place to stand.' },
  { id: 'general-37', title: 'Deep Breath', category: 'General', enabled: true, text: 'Before the race begins, take one deep breath and let your shoulders drop. A relaxed start gives your hands permission to move with less noise.' },
  { id: 'general-38', title: 'Treasure Note', category: 'General', enabled: true, text: 'The treasure note was written in plain language because the finder would already have enough trouble. Good instructions respect the person who has to use them.' },
  { id: 'general-39', title: 'Hilltop Signal', category: 'General', enabled: true, text: 'From the hilltop, you can see every curve of the course below. Planning is useful, but the race still happens one step and one letter at a time.' },
  { id: 'general-40', title: 'Brave Revision', category: 'General', enabled: true, text: 'Revision is bravery in practical clothes. It admits that the first attempt was not perfect and still believes the next version can be better.' },
  { id: 'general-41', title: 'Silver Keys', category: 'General', enabled: true, text: 'The silver keys hang beside the door, each one shaped for a different lock. Knowledge works best when you choose the right tool for the right moment.' },
  { id: 'general-42', title: 'Sunny Detour', category: 'General', enabled: true, text: 'A sunny detour leads the runners past orange trees and quiet fences. The longer path may still be useful if it keeps your pace steady.' },
  { id: 'general-43', title: 'Storm Shelter', category: 'General', enabled: true, text: 'The storm shelter is built before the sky turns dark. Good habits are built the same way, ready to help when pressure arrives.' },
  { id: 'general-44', title: 'Clear Water', category: 'General', enabled: true, text: 'Clear water reveals the stones beneath the surface. Clear thinking does something similar, showing which problem is real and which one only looked frightening.' },
  { id: 'general-45', title: 'Letter Bridge', category: 'General', enabled: true, text: 'Letters become words, words become sentences, and sentences become a bridge between two minds. Cross it carefully, and the other side will understand you.' },
  { id: 'general-46', title: 'Trail Markers', category: 'General', enabled: true, text: 'Trail markers are small, but they keep travelers from wandering into trouble. Punctuation plays a similar role when a sentence needs direction.' },
  { id: 'general-47', title: 'Golden Hour', category: 'General', enabled: true, text: 'Golden hour turns the track warm and forgiving, though the race is still real. Use the friendly light, but do not forget to watch the lane.' },
  { id: 'general-48', title: 'Corner Turn', category: 'General', enabled: true, text: 'The corner turn is where careless runners drift wide. Slow your thoughts for one moment, aim cleanly, and carry better speed out of the bend.' },
  { id: 'general-49', title: 'Last Lantern', category: 'General', enabled: true, text: 'The last lantern beside the path is enough to show the gate. You do not need every answer before taking the next useful step.' },
  { id: 'general-50', title: 'Finish Journal', category: 'General', enabled: true, text: 'After the finish, write down what helped and what got in the way. A short note today can become a better race tomorrow.' }
];

const MOVIE_STYLE_CHALLENGES = [
  { id: 'movie-style-01', title: 'Movie-Style Challenge 01', category: 'Movie-Style Quotes', enabled: true, text: 'The captain looked at the broken map, smiled at the storm outside, and told the crew that impossible was only a word people used before breakfast.' },
  { id: 'movie-style-02', title: 'Movie-Style Challenge 02', category: 'Movie-Style Quotes', enabled: true, text: 'She walked into the empty station with one suitcase, three secrets, and the kind of courage that makes a quiet room feel suddenly dangerous.' },
  { id: 'movie-style-03', title: 'Movie-Style Challenge 03', category: 'Movie-Style Quotes', enabled: true, text: 'The old mentor never raised his voice; he simply placed the sword on the table and asked whether fear had earned the right to lead.' },
  { id: 'movie-style-04', title: 'Movie-Style Challenge 04', category: 'Movie-Style Quotes', enabled: true, text: 'When the city lights went dark, the rookie pilot finally understood that the stars had been there the whole time, waiting for someone brave enough to steer.' },
  { id: 'movie-style-05', title: 'Movie-Style Challenge 05', category: 'Movie-Style Quotes', enabled: true, text: 'He did not come back for glory or applause. He came back because one friend was still out there, and that was enough reason for a legend.' },
  { id: 'movie-style-06', title: 'Movie-Style Challenge 06', category: 'Movie-Style Quotes', enabled: true, text: 'The detective studied the muddy footprints, the clean window, and the untouched pie, then announced that someone had worked very hard to look careless.' },
  { id: 'movie-style-07', title: 'Movie-Style Challenge 07', category: 'Movie-Style Quotes', enabled: true, text: 'At the edge of the volcano road, the rivals stopped arguing long enough to realize the bridge behind them had already made the decision.' },
  { id: 'movie-style-08', title: 'Movie-Style Challenge 08', category: 'Movie-Style Quotes', enabled: true, text: 'The princess folded the treaty, handed it to the general, and said peace was not a gift from cowards but a demand from people who survived.' },
  { id: 'movie-style-09', title: 'Movie-Style Challenge 09', category: 'Movie-Style Quotes', enabled: true, text: 'Nobody in the diner believed the stranger could fix the town, which was exactly why he ordered coffee first and saved the speech for later.' },
  { id: 'movie-style-10', title: 'Movie-Style Challenge 10', category: 'Movie-Style Quotes', enabled: true, text: 'The robot learned laughter from a broken television, loyalty from a lost dog, and bravery from a child who refused to leave it behind.' },
  { id: 'movie-style-11', title: 'Movie-Style Challenge 11', category: 'Movie-Style Quotes', enabled: true, text: 'On the final lap, the engine coughed like it knew the odds, but the driver whispered that machines also deserve a chance to believe.' },
  { id: 'movie-style-12', title: 'Movie-Style Challenge 12', category: 'Movie-Style Quotes', enabled: true, text: 'The museum guard had one rule about ancient curses: if the statue starts humming, do not wait for the chorus to explain itself.' },
  { id: 'movie-style-13', title: 'Movie-Style Challenge 13', category: 'Movie-Style Quotes', enabled: true, text: 'She opened the vault and found no treasure, only a letter from her father explaining that the real inheritance was knowing when to walk away.' },
  { id: 'movie-style-14', title: 'Movie-Style Challenge 14', category: 'Movie-Style Quotes', enabled: true, text: 'The villain expected begging, bargaining, maybe a dramatic gasp; what he got instead was a librarian with excellent aim and no patience left.' },
  { id: 'movie-style-15', title: 'Movie-Style Challenge 15', category: 'Movie-Style Quotes', enabled: true, text: 'The last spaceship lifted through the orange clouds while everyone below pretended not to cry, because hope looks better when it is flying.' },
  { id: 'movie-style-16', title: 'Movie-Style Challenge 16', category: 'Movie-Style Quotes', enabled: true, text: 'Two rival chefs faced the royal kitchen, one missing a recipe and the other missing humility, which made dinner more suspenseful than anyone expected.' },
  { id: 'movie-style-17', title: 'Movie-Style Challenge 17', category: 'Movie-Style Quotes', enabled: true, text: 'The mapmaker warned that the shortest road crossed the haunted forest, but the youngest traveler asked whether the ghosts had ever tried directions.' },
  { id: 'movie-style-18', title: 'Movie-Style Challenge 18', category: 'Movie-Style Quotes', enabled: true, text: 'He held the tiny music box to the microphone, and across the battlefield every soldier remembered the home they were supposed to return to.' },
  { id: 'movie-style-19', title: 'Movie-Style Challenge 19', category: 'Movie-Style Quotes', enabled: true, text: 'The submarine sank into black water as calmly as a secret, carrying five strangers who would have to become a crew before morning.' },
  { id: 'movie-style-20', title: 'Movie-Style Challenge 20', category: 'Movie-Style Quotes', enabled: true, text: 'Her speech began as a whisper in the rain, but by the final sentence even the thunder seemed polite enough to listen.' },
  { id: 'movie-style-21', title: 'Movie-Style Challenge 21', category: 'Movie-Style Quotes', enabled: true, text: 'The haunted house did not creak because it was old; it creaked because someone inside was very bad at sneaking dramatically.' },
  { id: 'movie-style-22', title: 'Movie-Style Challenge 22', category: 'Movie-Style Quotes', enabled: true, text: 'The boxer stared at the empty gym after midnight and understood that champions are often built when no camera thinks the scene is important.' },
  { id: 'movie-style-23', title: 'Movie-Style Challenge 23', category: 'Movie-Style Quotes', enabled: true, text: 'The time machine worked perfectly once, which was unfortunate because everyone used that one trip to argue about snacks instead of history.' },
  { id: 'movie-style-24', title: 'Movie-Style Challenge 24', category: 'Movie-Style Quotes', enabled: true, text: 'The queen removed her crown before entering the village, not to hide who she was, but to remember who she served.' },
  { id: 'movie-style-25', title: 'Movie-Style Challenge 25', category: 'Movie-Style Quotes', enabled: true, text: 'When the dragon landed on the courthouse roof, the judge sighed, adjusted his glasses, and asked whether the witness planned to give testimony or smoke.' },
  { id: 'movie-style-26', title: 'Movie-Style Challenge 26', category: 'Movie-Style Quotes', enabled: true, text: 'The spy swapped the diamonds for marbles, the passport for a menu, and the getaway car for a bicycle with heroic timing.' },
  { id: 'movie-style-27', title: 'Movie-Style Challenge 27', category: 'Movie-Style Quotes', enabled: true, text: 'The band played one last song as the floodlights failed, proving that some endings need rhythm more than explanations.' },
  { id: 'movie-style-28', title: 'Movie-Style Challenge 28', category: 'Movie-Style Quotes', enabled: true, text: 'He found the missing crown in the bakery window, sitting on a cake that had won third prize and started an international incident.' },
  { id: 'movie-style-29', title: 'Movie-Style Challenge 29', category: 'Movie-Style Quotes', enabled: true, text: 'The soldier looked across the quiet field and realized victory would mean nothing if nobody remembered how much peace had cost.' },
  { id: 'movie-style-30', title: 'Movie-Style Challenge 30', category: 'Movie-Style Quotes', enabled: true, text: 'The alien ambassador tried a peanut butter sandwich, paused for diplomacy, and declared Earth confusing but worth several more meetings.' },
  { id: 'movie-style-31', title: 'Movie-Style Challenge 31', category: 'Movie-Style Quotes', enabled: true, text: 'She chased the train in shoes made for dancing, not running, but determination has never cared much about footwear.' },
  { id: 'movie-style-32', title: 'Movie-Style Challenge 32', category: 'Movie-Style Quotes', enabled: true, text: 'The old pirate gave directions by memory, moonlight, and three insults aimed at a seagull that had apparently betrayed him years before.' },
  { id: 'movie-style-33', title: 'Movie-Style Challenge 33', category: 'Movie-Style Quotes', enabled: true, text: 'The classroom went silent when the new teacher wrote one sentence on the board: courage is homework you cannot copy.' },
  { id: 'movie-style-34', title: 'Movie-Style Challenge 34', category: 'Movie-Style Quotes', enabled: true, text: 'He expected the secret laboratory to contain lasers and alarms; instead it contained a tired scientist, cold pizza, and a button labeled absolutely not.' },
  { id: 'movie-style-35', title: 'Movie-Style Challenge 35', category: 'Movie-Style Quotes', enabled: true, text: 'The orchestra conductor lifted his baton while meteors crossed the sky, because if the world was ending, it might as well keep tempo.' },
  { id: 'movie-style-36', title: 'Movie-Style Challenge 36', category: 'Movie-Style Quotes', enabled: true, text: 'She returned the stolen painting before sunrise and left a note explaining that beauty should not have to live in a basement.' },
  { id: 'movie-style-37', title: 'Movie-Style Challenge 37', category: 'Movie-Style Quotes', enabled: true, text: 'The cowboy rode into town with no hat, no horse, and no explanation, which made his entrance impressive for entirely different reasons.' },
  { id: 'movie-style-38', title: 'Movie-Style Challenge 38', category: 'Movie-Style Quotes', enabled: true, text: 'The child placed a toy rocket on the launch pad and reminded the adults that every serious mission begins by looking silly to someone.' },
  { id: 'movie-style-39', title: 'Movie-Style Challenge 39', category: 'Movie-Style Quotes', enabled: true, text: 'The prince challenged the mirror to tell the truth, and for once the mirror asked whether everyone in the room was emotionally prepared.' },
  { id: 'movie-style-40', title: 'Movie-Style Challenge 40', category: 'Movie-Style Quotes', enabled: true, text: 'They crossed the frozen lake one careful step at a time, learning that trust makes less noise than fear but carries farther.' },
  { id: 'movie-style-41', title: 'Movie-Style Challenge 41', category: 'Movie-Style Quotes', enabled: true, text: 'The newsroom printer jammed at the worst possible moment, so the intern delivered the truth by sprinting down six flights of stairs.' },
  { id: 'movie-style-42', title: 'Movie-Style Challenge 42', category: 'Movie-Style Quotes', enabled: true, text: 'The magician revealed the trick only after saving the town, because wonder is delightful but survival has a stricter schedule.' },
  { id: 'movie-style-43', title: 'Movie-Style Challenge 43', category: 'Movie-Style Quotes', enabled: true, text: 'He opened the letter from the future and found three words underlined twice: pack better shoes.' },
  { id: 'movie-style-44', title: 'Movie-Style Challenge 44', category: 'Movie-Style Quotes', enabled: true, text: 'The mermaid captain studied the storm clouds and decided that land people had invented far too many reasons to panic.' },
  { id: 'movie-style-45', title: 'Movie-Style Challenge 45', category: 'Movie-Style Quotes', enabled: true, text: 'The final door required no key, no password, and no chosen hero; it opened when the team finally stopped arguing and pushed together.' },
  { id: 'movie-style-46', title: 'Movie-Style Challenge 46', category: 'Movie-Style Quotes', enabled: true, text: 'She stood beneath the scoreboard after losing the match and smiled, because tomorrow now had a very specific assignment.' },
  { id: 'movie-style-47', title: 'Movie-Style Challenge 47', category: 'Movie-Style Quotes', enabled: true, text: 'The cave painting was not a warning or a map, but a recipe, which changed the expedition from terrifying to mildly hungry.' },
  { id: 'movie-style-48', title: 'Movie-Style Challenge 48', category: 'Movie-Style Quotes', enabled: true, text: 'The astronaut planted a flag, then a tomato seed, because exploration should leave behind more than proof that someone arrived.' },
  { id: 'movie-style-49', title: 'Movie-Style Challenge 49', category: 'Movie-Style Quotes', enabled: true, text: 'The mayor promised the parade would continue despite the giant footprints, though he did quietly move the marching band indoors.' },
  { id: 'movie-style-50', title: 'Movie-Style Challenge 50', category: 'Movie-Style Quotes', enabled: true, text: 'At sunrise, the team stood beside the repaired airship and agreed that yesterday had been a disaster, but at least it was an educational one.' }
];

const MOVIE_SOURCES = [
  "Original Adventure Film", "Original Mystery Film", "Original Space Film", "Original Sports Film", "Original Fantasy Film",
  "Original Comedy Film", "Original Spy Film", "Original Disaster Film", "Original Courtroom Film", "Original Road Movie"
];

const MOVIE_QUOTE_CHALLENGES = MOVIE_STYLE_CHALLENGES.map((item, index) => ({
  ...item,
  id: item.id.replace("movie-style", "movie"),
  title: `Movie Quote ${String(index + 1).padStart(2, "0")}`,
  category: "Movie Quotes",
  source: MOVIE_SOURCES[index % MOVIE_SOURCES.length],
}));

const BOOK_SOURCES = [
  "Inspired by Harry Potter and the Sorcerer's Stone", "Inspired by Treasure Island", "Inspired by Alice's Adventures in Wonderland", "Inspired by The Secret Garden", "Inspired by The Wonderful Wizard of Oz",
  "Inspired by Little Women", "Inspired by Anne of Green Gables", "Inspired by The Hobbit", "Inspired by The Chronicles of Narnia", "Inspired by A Wrinkle in Time",
  "Inspired by Sherlock Holmes", "Inspired by The Jungle Book", "Inspired by Peter Pan", "Inspired by The Wind in the Willows", "Inspired by Black Beauty",
  "Inspired by Frankenstein", "Inspired by Dracula", "Inspired by The War of the Worlds", "Inspired by Twenty Thousand Leagues Under the Seas", "Inspired by Journey to the Center of the Earth",
  "Inspired by The Call of the Wild", "Inspired by White Fang", "Inspired by Around the World in Eighty Days", "Inspired by The Three Musketeers", "Inspired by Robin Hood",
  "Inspired by The Swiss Family Robinson", "Inspired by The Count of Monte Cristo", "Inspired by Jane Eyre", "Inspired by Pride and Prejudice", "Inspired by Great Expectations",
  "Inspired by Oliver Twist", "Inspired by Moby-Dick", "Inspired by The Odyssey", "Inspired by The Iliad", "Inspired by Don Quixote",
  "Inspired by The Little Prince", "Inspired by Charlotte's Web", "Inspired by Matilda", "Inspired by Charlie and the Chocolate Factory", "Inspired by The Giver",
  "Inspired by The Hunger Games", "Inspired by Percy Jackson", "Inspired by The Lightning Thief", "Inspired by The Book Thief", "Inspired by The Maze Runner",
  "Inspired by The Princess Bride", "Inspired by Watership Down", "Inspired by The Phantom Tollbooth", "Inspired by The Outsiders", "Inspired by A Christmas Carol"
];

const BOOK_LINES = [
  "A young reader opens a forbidden door and discovers that courage can begin with curiosity, even when the hallway beyond is darker than expected.",
  "The map is torn, the weather is turning, and the only sensible plan is to trust the crew member who still remembers how to read the stars.",
  "In a garden that everyone forgot, one stubborn green shoot proves that hidden places can come alive again when someone cares enough to return.",
  "The smallest traveler in the room asks the sharpest question, and suddenly every grown-up has to admit that the impossible rule was only tradition.",
  "A letter arrives at breakfast and changes the shape of the day, reminding the hero that ordinary houses can hide extraordinary invitations.",
  "The old road bends through fog and firelight, where friends learn that loyalty is easier to promise at home than to practice on the journey.",
  "A clever clue waits in plain sight on the dusty shelf, ignored by everyone except the person willing to read the boring label twice.",
  "The sea keeps its secrets under a bright moon, and the captain knows that every treasure has a cost written somewhere in smaller print.",
  "A lonely child finds a key, a question, and a reason to believe that locked rooms sometimes protect wounded hearts rather than treasure.",
  "The final page is not the end of the adventure; it is the place where the reader carries the lesson back into real life."
];

const BOOK_CHALLENGES = BOOK_SOURCES.map((source, index) => ({
  id: `book-${String(index + 1).padStart(2, "0")}`,
  title: `Book Challenge ${String(index + 1).padStart(2, "0")}`,
  category: "Books",
  source,
  enabled: true,
  text: BOOK_LINES[index % BOOK_LINES.length],
}));

const LORD_OF_THE_RINGS_SOURCES = [
  "Inspired by The Fellowship of the Ring", "Inspired by The Two Towers", "Inspired by The Return of the King", "Inspired by The Hobbit", "Inspired by Middle-earth"
];

const LORD_OF_THE_RINGS_LINES = [
  "A small traveler stands at the edge of a road that has carried kings, wanderers, and warnings, then chooses the next step anyway.",
  "The mountain looks impossibly far, but faithful company makes the distance feel less like doom and more like a promise carried together.",
  "In the deep places of the world, courage is not loud; it is the quiet decision to keep the light uncovered for one more turn.",
  "A ranger listens to the wind across the grasslands and understands that hope can move unseen before anyone is ready to name it.",
  "The old tales return when ordinary hands accept an extraordinary burden, proving that history often depends on those who never asked for fame.",
  "Across the river, towers and shadows argue with the morning, but the company presses on because some roads can only be honored by walking them.",
  "A door in the stone remembers a kinder age, waiting for the right word, the right friend, and the patience to look again.",
  "The forest feels ancient enough to judge every footstep, yet even under tangled branches a clear song can keep fear from taking root.",
  "When the horn sounds over the field, every heart must decide whether it belongs to panic or to the hard work of standing firm.",
  "The ring is heavy because temptation always weighs more than metal, especially when it whispers that power can make sacrifice unnecessary."
];

const LORD_OF_THE_RINGS_CHALLENGES = Array.from({ length: 50 }, (_, index) => ({
  id: `lotr-${String(index + 1).padStart(2, "0")}`,
  title: `Lord of the Rings Practice ${String(index + 1).padStart(2, "0")}`,
  category: "Lord of the Rings Quotes",
  source: LORD_OF_THE_RINGS_SOURCES[index % LORD_OF_THE_RINGS_SOURCES.length],
  enabled: true,
  text: LORD_OF_THE_RINGS_LINES[index % LORD_OF_THE_RINGS_LINES.length],
}));

const TYPING_BASICS_LESSONS = [
  { title: "Lesson 01 - Find F and J", text: "fff jjj fff jjj fjf jfj fff jjj fj fj fj jf jf jf" },
  { title: "Lesson 02 - Left Home Keys", text: "aaa sss ddd fff asdf fdsa asdf fdsa sad dad fad add" },
  { title: "Lesson 03 - Right Home Keys", text: "jjj kkk lll ;;; jkl; ;lkj jkl; ;lkj all fall hall" },
  { title: "Lesson 04 - Home Row Outward", text: "f j d k s l a ; f j d k s l a ; fj dk sl a;" },
  { title: "Lesson 05 - Home Row Inward", text: "a ; s l d k f j a; sl dk fj fj dk sl a;" },
  { title: "Lesson 06 - Reach G and H", text: "fff ggg fff gfg jjj hhh jjj hjh fg hj gh gh fg hj" },
  { title: "Lesson 07 - Alternate Hands", text: "fj dk sl ah fj dk sl ah fad had dash flask ask hall" },
  { title: "Lesson 08 - Home Row Words", text: "ask dad fall glad hall salad flask dash half shall" },
  { title: "Lesson 09 - Home Row Rhythm", text: "a sad lad had a flask; a glad lass had a salad;" },
  { title: "Lesson 10 - Home Row Review", text: "asdf jkl; glad falls; a dash; ask a lad; half a salad;" },
  { title: "Lesson 11 - Left Top Keys", text: "qqq www eee rrr qwer rewq qwe wer ert tree were" },
  { title: "Lesson 12 - Right Top Keys", text: "uuu iii ooo ppp uiop poiu you oil pool loop upon" },
  { title: "Lesson 13 - Reach T and Y", text: "fff ttt fff ftf jjj yyy jjj jyj try yet type toy" },
  { title: "Lesson 14 - Top Row Sequence", text: "qwerty uiop qwerty uiop poiuy trewq type your power" },
  { title: "Lesson 15 - Left Top Words", text: "read dear fear free rate water street after great" },
  { title: "Lesson 16 - Right Top Words", text: "you pull oil loop joy poll lily hill until point" },
  { title: "Lesson 17 - Common Top Words", text: "the there they were your four quiet people write" },
  { title: "Lesson 18 - Top and Home", text: "we type with steady hands and read each word first" },
  { title: "Lesson 19 - Top Row Accuracy", text: "quiet writers prefer a slow start to a hurried error" },
  { title: "Lesson 20 - Top Row Review", text: "type every word with light hands; pause and try again" },
  { title: "Lesson 21 - Left Bottom Keys", text: "zzz xxx ccc vvv zxcv vcxz zip wax cave vivid exact" },
  { title: "Lesson 22 - Right Bottom Keys", text: "bbb nnn mmm bnm mnb bin nimble number banana menu" },
  { title: "Lesson 23 - Bottom Row Sequence", text: "zxcvbnm zxcvbnm mnbvcxz zoom cabin mix brave calm" },
  { title: "Lesson 24 - Reach C V and B", text: "dcd fvf fbf cab cave civic vivid brave basic cub" },
  { title: "Lesson 25 - Reach N and M", text: "jnj kmk man name moon nine minimum animal lemon" },
  { title: "Lesson 26 - Left Bottom Words", text: "save face cave exact value civic brave scarf vast" },
  { title: "Lesson 27 - Right Bottom Words", text: "main moon name number lemon banana minimum combine" },
  { title: "Lesson 28 - Three Row Words", text: "quick brown fox jumps over the lazy dog with care" },
  { title: "Lesson 29 - Alphabet Patterns", text: "abc def ghi jkl mno pqr stu vwx yz abcdefghijklmnop" },
  { title: "Lesson 30 - All Letter Review", text: "bright zebras quickly move across the calm valley" },
  { title: "Lesson 31 - Space Control", text: "one two three four five one two three four five" },
  { title: "Lesson 32 - Short Common Words", text: "a an as at be by do go he if in is it me my no of on" },
  { title: "Lesson 33 - Common Word Pairs", text: "in the on the to the of the we can you can I can" },
  { title: "Lesson 34 - First Short Sentence", text: "the red fox can run fast and the blue bird can fly" },
  { title: "Lesson 35 - Sentence Rhythm", text: "keep a calm pace and let each clean word lead onward" },
  { title: "Lesson 36 - Left Shift Capitals", text: "Alice David Frank Grace Alice David Frank Grace" },
  { title: "Lesson 37 - Right Shift Capitals", text: "Peter Quinn Robert Taylor Peter Quinn Robert Taylor" },
  { title: "Lesson 38 - Names and Places", text: "Mia and Noah plan a calm trip from Boston to Denver" },
  { title: "Lesson 39 - Period Practice", text: "Type one clean line. Pause for a breath. Begin again." },
  { title: "Lesson 40 - Comma Practice", text: "Pack a map, a coat, a snack, and a small blue cup." },
  { title: "Lesson 41 - Apostrophe Practice", text: "I can type what's next, and I'll correct what isn't right." },
  { title: "Lesson 42 - Semicolon Practice", text: "Keep the left hand calm; let the right hand reach; continue." },
  { title: "Lesson 43 - Question Practice", text: "Can you find the next key? Will you type it with care?" },
  { title: "Lesson 44 - Exclamation Practice", text: "Great work! Keep your hands light! Finish with control!" },
  { title: "Lesson 45 - Quotation Practice", text: "\"Ready,\" said Mia. \"I can type this line with care.\"" },
  { title: "Lesson 46 - Numbers One to Five", text: "1 2 3 4 5 12345 54321 11 22 33 44 55" },
  { title: "Lesson 47 - Numbers Six to Zero", text: "6 7 8 9 0 67890 09876 66 77 88 99 00" },
  { title: "Lesson 48 - Numbers and Words", text: "I have 2 hands, 10 fingers, 5 goals, and 1 steady pace." },
  { title: "Lesson 49 - Mixed Punctuation", text: "Ready, set, type! Is it clear? Yes; keep going." },
  { title: "Lesson 50 - Beginner Graduation", text: "Calm hands, clear eyes, and steady practice help every new typist grow faster." },
];

const TYPING_BASICS_CHALLENGES = TYPING_BASICS_LESSONS.map((lesson, index) => ({
  id: `typing-basics-${String(index + 1).padStart(2, "0")}`,
  title: lesson.title,
  category: "Typing Basics",
  source: "Dino Type Racer Beginner Course",
  enabled: true,
  text: lesson.text,
}));
const INTERMEDIATE_TYPING_LESSONS = Array.from({ length: 50 }, (_, index) => {
  const lesson = index + 1;
  const patterns = [
    "Clean speed comes from reading ahead, striking the next key once, and letting each finished word carry you smoothly into the next.",
    "Practice mixed reach keys with steady hands: travel from home row to top row, return to center, then move to bottom row without rushing.",
    "Every paragraph asks for rhythm, accuracy, and recovery; correct the slip quickly, breathe once, and keep the sentence moving forward.",
    "Use capital letters, commas, and periods with purpose. The goal is not raw speed, but a pace that survives real writing.",
    "Numbers appear in ordinary text: 3 laps, 12 minutes, 48 steps, and 100 small choices can still become one confident race.",
    "The left hand leads, the right hand answers, and both hands learn to share the work across longer words like careful, garden, and forward.",
    "When the passage grows longer, keep your eyes moving ahead of your fingers so each word feels expected before it arrives.",
    "A good intermediate run feels alert but not frantic; it leaves enough attention for punctuation, spacing, and a clean finish.",
    "Shift between short words and longer words: can, careful, type, practice, road, reliable, focus, and championship all deserve accuracy.",
    "Build the habit of finishing strong, because the final sentence matters as much as the first line after the countdown begins.",
  ];
  return {
    title: `Intermediate ${String(lesson).padStart(2, "0")} - ${["Flow Control", "Mixed Rows", "Recovery", "Real Sentences", "Numbers", "Hand Balance", "Reading Ahead", "Calm Speed", "Word Length", "Strong Finish"][index % 10]}`,
    text: `${patterns[index % patterns.length]} Round ${lesson} adds a little more control without asking your hands to panic.`,
  };
});

const INTERMEDIATE_TYPING_CHALLENGES = INTERMEDIATE_TYPING_LESSONS.map((lesson, index) => ({
  id: `typing-intermediate-${String(index + 1).padStart(2, "0")}`,
  title: lesson.title,
  category: "Typing Intermediate",
  source: "Dino Type Racer Intermediate Course",
  enabled: true,
  text: lesson.text,
}));

const ADVANCED_TYPING_LESSONS = Array.from({ length: 50 }, (_, index) => {
  const lesson = index + 1;
  const patterns = [
    "Accuracy under pressure is a trained skill: read the phrase, commit to the sequence, and refuse to trade clean movement for noise.",
    "Advanced passages mix commas, semicolons, quotes, numbers, and abrupt word lengths; your job is to keep the rhythm organized.",
    "The racer who wins difficult text does not attack every character; they see patterns, reduce wasted motion, and recover before doubt spreads.",
    "Type this like a proofreader with fast shoes: every mark counts, every space matters, and every correction teaches the next attempt.",
    "Complex work rewards a calm system. Hold the line through 7 sharp turns, 24 quick reaches, and one final burst of focus.",
    "Use both Shift keys wisely when Names, Places, and Ideas arrive together; balanced hands keep capitalization from stealing momentum.",
    "Longer sentences demand patience, because the mind wants to jump ahead while the fingers still owe the current word their full attention.",
    "When punctuation clusters appear, slow by a breath instead of a mile; a precise comma is faster than a repaired mistake.",
    "Advanced typing is not a storm of keystrokes. It is controlled speed, clean spacing, and the courage to stay exact while moving fast.",
    "Finish the hard line with the same care that started it: strong racers do not let the last five words become a messy victory lap.",
  ];
  return {
    title: `Advanced ${String(lesson).padStart(2, "0")} - ${["Pressure", "Symbols", "Pattern Sight", "Proof Speed", "Turns", "Shift Control", "Endurance", "Punctuation", "Controlled Speed", "Final Push"][index % 10]}`,
    text: `${patterns[index % patterns.length]} Challenge ${lesson} is built for sharper pacing, cleaner punctuation, and steadier recovery.`,
  };
});

const ADVANCED_TYPING_CHALLENGES = ADVANCED_TYPING_LESSONS.map((lesson, index) => ({
  id: `typing-advanced-${String(index + 1).padStart(2, "0")}`,
  title: lesson.title,
  category: "Typing Advanced",
  source: "Dino Type Racer Advanced Course",
  enabled: true,
  text: lesson.text,
}));
export const STARTER_PASSAGES = [
  ...TYPING_BASICS_CHALLENGES,
  ...INTERMEDIATE_TYPING_CHALLENGES,
  ...ADVANCED_TYPING_CHALLENGES,
  ...GENERAL_CHALLENGES,
  ...MOVIE_QUOTE_CHALLENGES,
  ...BOOK_CHALLENGES,
  ...LORD_OF_THE_RINGS_CHALLENGES,
];