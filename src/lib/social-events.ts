// CURSUS HONORUM — passive-income social events. A pool of 100 short scenarios
// (55 positive / 35 negative / 10 neutral) rolled when a delegation of
// gladiators is sent to court Rome's high society. `{g}` is replaced with
// the attending gladiator(s), naturally joined ("Marcus", "Marcus and
// Quintus", "Marcus, Quintus, and Titus").
//
// Reward scaling (enforced by the caller in game.functions.ts, not here):
//  - positive denarii/reputation/xp amounts below are PER ATTENDING GLADIATOR
//  - negative denarii/reputation amounts are FLAT regardless of party size
//  - "injury" always lands on exactly one random attendee, never the whole party
//  - "gear" grants one free gear-tier upgrade to each attending gladiator
export type SocialTone = "positive" | "negative" | "neutral";
export type SocialOutcomeKind = "denarii" | "reputation" | "xp" | "gear" | "injury" | "none";

export type SocialEvent = {
  id: string;
  tone: SocialTone;
  text: string;
  outcome: SocialOutcomeKind;
  amount?: number; // denarii/reputation/xp base amount, or injury hours
};

export const SOCIAL_EVENTS: SocialEvent[] = [
  // ---------------- POSITIVE (55) ----------------
  { id: "pos-01", tone: "positive", text: "You and {g} attend a senator's wedding for a small exhibition bout. The crowd adores it.", outcome: "denarii", amount: 100 },
  { id: "pos-02", tone: "positive", text: "A wealthy widow takes a liking to {g}'s fighting spirit and sends a gift to your ludus.", outcome: "denarii", amount: 85 },
  { id: "pos-03", tone: "positive", text: "{g} is asked to carry the standard in a triumphal parade through the Forum. The crowd roars approval.", outcome: "reputation", amount: 8 },
  { id: "pos-04", tone: "positive", text: "A provincial governor hosts {g} at a banquet and speaks well of your ludus to his peers.", outcome: "reputation", amount: 6 },
  { id: "pos-05", tone: "positive", text: "{g} wins a friendly wager against a rival lanista's champion at the baths.", outcome: "denarii", amount: 75 },
  { id: "pos-06", tone: "positive", text: "A retired centurion, impressed by {g}'s bearing, gifts a fine piece of armor.", outcome: "gear" },
  { id: "pos-07", tone: "positive", text: "The priests of Jupiter bless {g} before a temple dedication — the crowd showers coin.", outcome: "denarii", amount: 95 },
  { id: "pos-08", tone: "positive", text: "{g} is the toast of a Saturnalia feast, feted long into the night.", outcome: "reputation", amount: 5 },
  { id: "pos-09", tone: "positive", text: "A merchant, grateful for {g} scaring off a thief, pays handsomely.", outcome: "denarii", amount: 110 },
  { id: "pos-10", tone: "positive", text: "{g} demonstrates technique for a school of young patricians — the tutor pays well.", outcome: "denarii", amount: 85 },
  { id: "pos-11", tone: "positive", text: "{g} catches the eye of an arms dealer, who gifts a piece of new gear outright.", outcome: "gear" },
  { id: "pos-12", tone: "positive", text: "A poet composes verses in {g}'s honor after a chance meeting in the Forum.", outcome: "reputation", amount: 7 },
  { id: "pos-13", tone: "positive", text: "{g} helps carry a shrine in a religious procession and is rewarded by the college of priests.", outcome: "denarii", amount: 80 },
  { id: "pos-14", tone: "positive", text: "An old veteran recognizes {g}'s style and shares a trick passed down from his own trainer.", outcome: "xp", amount: 55 },
  { id: "pos-15", tone: "positive", text: "{g} is asked to spar for the amusement of visiting Greek dignitaries. They pay in silver.", outcome: "denarii", amount: 120 },
  { id: "pos-16", tone: "positive", text: "A patrician's son begs {g} for fighting lessons — his father pays generously.", outcome: "denarii", amount: 135 },
  { id: "pos-17", tone: "positive", text: "{g} wins the crowd's favor at a chariot-race intermission bout.", outcome: "reputation", amount: 6 },
  { id: "pos-18", tone: "positive", text: "The Vestals send a blessing and a purse to {g} after a temple visit.", outcome: "denarii", amount: 85 },
  { id: "pos-19", tone: "positive", text: "{g} is gifted a ceremonial helmet after impressing a magistrate at his inauguration.", outcome: "gear" },
  { id: "pos-20", tone: "positive", text: "A rich widow commissions a bust of {g} — and pays the ludus for the honor.", outcome: "denarii", amount: 170 },
  { id: "pos-21", tone: "positive", text: "{g} out-drinks and out-charms a table of off-duty legionaries, who pass the hat.", outcome: "denarii", amount: 70 },
  { id: "pos-22", tone: "positive", text: "{g} is asked to referee a dispute between two market stalls — both sides tip generously.", outcome: "denarii", amount: 75 },
  { id: "pos-23", tone: "positive", text: "A traveling philosopher praises {g}'s discipline before an audience of nobles.", outcome: "reputation", amount: 9 },
  { id: "pos-24", tone: "positive", text: "{g} performs a flawless drill for the City Watch, who reward the display.", outcome: "denarii", amount: 95 },
  { id: "pos-25", tone: "positive", text: "An armorer, testing a new design, fits {g} with prototype gear free of charge.", outcome: "gear" },
  { id: "pos-26", tone: "positive", text: "{g} is the guest of honor at a guild dinner and leaves with a full purse.", outcome: "denarii", amount: 130 },
  { id: "pos-27", tone: "positive", text: "A grateful farmer, saved from bandits by {g}'s reputation alone, sends produce and coin.", outcome: "denarii", amount: 85 },
  { id: "pos-28", tone: "positive", text: "{g} spars with an off-duty praetorian, who's impressed enough to recommend your ludus.", outcome: "reputation", amount: 8 },
  { id: "pos-29", tone: "positive", text: "A shipping magnate, entertaining guests, pays {g} well for an after-dinner bout.", outcome: "denarii", amount: 145 },
  { id: "pos-30", tone: "positive", text: "{g} is asked to bless a new ship's launch for luck — sailors are generous with coin.", outcome: "denarii", amount: 80 },
  { id: "pos-31", tone: "positive", text: "The aediles hire {g} to keep order at a crowded festival — and pay on top of the honor.", outcome: "denarii", amount: 100 },
  { id: "pos-32", tone: "positive", text: "A visiting king's envoy is so taken with {g} that he sends a gift of fine steel.", outcome: "gear" },
  { id: "pos-33", tone: "positive", text: "{g} trains alongside a champion from another ludus, and both learn from it.", outcome: "xp", amount: 60 },
  { id: "pos-34", tone: "positive", text: "A grateful client, whose debt {g} helped collect peacefully, pays a bonus.", outcome: "denarii", amount: 95 },
  { id: "pos-35", tone: "positive", text: "{g} is cheered through the streets after a chance encounter with an adoring crowd.", outcome: "reputation", amount: 7 },
  { id: "pos-36", tone: "positive", text: "An elderly senator, reminiscing about his youth, gifts {g} his old but well-made blade.", outcome: "gear" },
  { id: "pos-37", tone: "positive", text: "{g} wins a footrace at a local festival on a dare, much to everyone's delight.", outcome: "denarii", amount: 70 },
  { id: "pos-38", tone: "positive", text: "A theater troupe hires {g} to appear in a staged battle scene — the pay is excellent.", outcome: "denarii", amount: 125 },
  { id: "pos-39", tone: "positive", text: "{g} is asked to stand guard at a wealthy household's feast and is tipped well.", outcome: "denarii", amount: 85 },
  { id: "pos-40", tone: "positive", text: "The College of Augurs declares {g}'s presence a good omen — offerings follow.", outcome: "reputation", amount: 6 },
  { id: "pos-41", tone: "positive", text: "{g} charms a visiting delegation from Egypt, who leave gifts for your ludus.", outcome: "denarii", amount: 110 },
  { id: "pos-42", tone: "positive", text: "A grateful mother, whose son {g} once protected, sends a home-cooked feast and coin.", outcome: "denarii", amount: 75 },
  { id: "pos-43", tone: "positive", text: "{g} is asked to escort a bride to her wedding for luck — the family pays handsomely.", outcome: "denarii", amount: 85 },
  { id: "pos-44", tone: "positive", text: "An old rival lanista, humbled in friendly sparring, pays his respects — and his coin.", outcome: "denarii", amount: 100 },
  { id: "pos-45", tone: "positive", text: "{g} demonstrates footwork for a school of dancers, who are delighted and generous.", outcome: "denarii", amount: 70 },
  { id: "pos-46", tone: "positive", text: "A visiting Spartan trader, impressed by discipline, gifts {g} well-forged greaves.", outcome: "gear" },
  { id: "pos-47", tone: "positive", text: "{g} is cheered at the games as a crowd favorite returns to form.", outcome: "reputation", amount: 8 },
  { id: "pos-48", tone: "positive", text: "A magistrate settles a dispute in your ludus's favor after meeting {g} personally.", outcome: "reputation", amount: 10 },
  { id: "pos-49", tone: "positive", text: "{g} helps a lost child find her family in the Forum crowds — the grateful parents pay well.", outcome: "denarii", amount: 80 },
  { id: "pos-50", tone: "positive", text: "A wine merchant, celebrating a good harvest, toasts {g} generously.", outcome: "denarii", amount: 75 },
  { id: "pos-51", tone: "positive", text: "{g} sparks a bidding war between two patrons eager to sponsor your ludus.", outcome: "denarii", amount: 215 },
  { id: "pos-52", tone: "positive", text: "The crowd at a minor festival mistakes {g} for a famous champion — and pays like it.", outcome: "denarii", amount: 85 },
  { id: "pos-53", tone: "positive", text: "{g} is gifted a fine cloak and boots by an admiring textile merchant.", outcome: "gear" },
  { id: "pos-54", tone: "positive", text: "A retired gladiator, now a trainer, shares hard-won wisdom with {g}.", outcome: "xp", amount: 65 },
  { id: "pos-55", tone: "positive", text: "{g} is the subject of gossip in all the best circles this week — for once, good gossip.", outcome: "reputation", amount: 9 },

  // ---------------- NEGATIVE (35) ----------------
  { id: "neg-01", tone: "negative", text: "{g} is pickpocketed in the crowded Forum.", outcome: "denarii", amount: 90 },
  { id: "neg-02", tone: "negative", text: "A drunken brawl breaks out at the tavern and {g} takes a nasty blow.", outcome: "injury", amount: 8 },
  { id: "neg-03", tone: "negative", text: "{g} insults a magistrate's wife by accident — word spreads.", outcome: "reputation", amount: 6 },
  { id: "neg-04", tone: "negative", text: "{g} loses a wager against a smooth-talking gambler.", outcome: "denarii", amount: 110 },
  { id: "neg-05", tone: "negative", text: "A rival lanista spreads unflattering rumors about your ludus after meeting {g}.", outcome: "reputation", amount: 8 },
  { id: "neg-06", tone: "negative", text: "{g} is thrown from a borrowed horse while showing off for a crowd.", outcome: "injury", amount: 10 },
  { id: "neg-07", tone: "negative", text: "A merchant overcharges {g} for goods, and the ludus foots the bill.", outcome: "denarii", amount: 80 },
  { id: "neg-08", tone: "negative", text: "{g} is caught in a sudden downpour and catches a chill.", outcome: "injury", amount: 6 },
  { id: "neg-09", tone: "negative", text: "An argument over dice turns ugly, and {g} nurses a bruise.", outcome: "injury", amount: 7 },
  { id: "neg-10", tone: "negative", text: "{g} is publicly mocked by a rival's champion at a feast.", outcome: "reputation", amount: 5 },
  { id: "neg-11", tone: "negative", text: "A cutpurse relieves {g} of coin meant for the ludus.", outcome: "denarii", amount: 100 },
  { id: "neg-12", tone: "negative", text: "{g} trips during a demonstration bout, to the crowd's amusement.", outcome: "reputation", amount: 4 },
  { id: "neg-13", tone: "negative", text: "A corrupt tax collector shakes down your ludus after spotting {g} in town.", outcome: "denarii", amount: 130 },
  { id: "neg-14", tone: "negative", text: "{g} gets into a shouting match with a market vendor over a bad deal.", outcome: "reputation", amount: 5 },
  { id: "neg-15", tone: "negative", text: "A jealous suitor challenges {g} to an unsanctioned duel and lands a good hit.", outcome: "injury", amount: 9 },
  { id: "neg-16", tone: "negative", text: "{g} is swindled by a fake soothsayer promising good fortune.", outcome: "denarii", amount: 70 },
  { id: "neg-17", tone: "negative", text: "An overzealous fan crowds {g} and knocks them down some stairs.", outcome: "injury", amount: 5 },
  { id: "neg-18", tone: "negative", text: "{g}'s boasting at a tavern is overheard — and repeated, unkindly, all over town.", outcome: "reputation", amount: 7 },
  { id: "neg-19", tone: "negative", text: "A bad batch of wine at a feast leaves {g} sick for days.", outcome: "injury", amount: 6 },
  { id: "neg-20", tone: "negative", text: "{g} is blamed for a brawl they didn't start and fined by the local aediles.", outcome: "denarii", amount: 100 },
  { id: "neg-21", tone: "negative", text: "A rival ludus's fans heckle {g} mercilessly at a public event.", outcome: "reputation", amount: 6 },
  { id: "neg-22", tone: "negative", text: "{g} slips on wet stones chasing a runaway cart.", outcome: "injury", amount: 8 },
  { id: "neg-23", tone: "negative", text: "A moneylender calls in an old debt {g} didn't know about.", outcome: "denarii", amount: 120 },
  { id: "neg-24", tone: "negative", text: "{g} loses a friendly sparring match badly, and word gets around.", outcome: "reputation", amount: 5 },
  { id: "neg-25", tone: "negative", text: "A street performer's monkey steals coin right out of {g}'s hand.", outcome: "denarii", amount: 60 },
  { id: "neg-26", tone: "negative", text: "{g} is caught in a stampede when a festival crowd panics.", outcome: "injury", amount: 11 },
  { id: "neg-27", tone: "negative", text: "An unscrupulous merchant sells {g} counterfeit coin.", outcome: "denarii", amount: 90 },
  { id: "neg-28", tone: "negative", text: "{g} offends a priest by laughing during a solemn rite.", outcome: "reputation", amount: 8 },
  { id: "neg-29", tone: "negative", text: "A bar fight nobody remembers starting leaves {g} worse for wear.", outcome: "injury", amount: 12 },
  { id: "neg-30", tone: "negative", text: "{g} is talked into a bad investment by a smooth stranger.", outcome: "denarii", amount: 150 },
  { id: "neg-31", tone: "negative", text: "A rival lanista bribes a bard to compose an unflattering song about {g}.", outcome: "reputation", amount: 9 },
  { id: "neg-32", tone: "negative", text: "{g} twists an ankle dancing badly at a festival.", outcome: "injury", amount: 5 },
  { id: "neg-33", tone: "negative", text: "A pack of stray dogs chases {g} through the market, to everyone's amusement but yours.", outcome: "reputation", amount: 4 },
  { id: "neg-34", tone: "negative", text: "{g} is overcharged for repairs after a wagon 'accident.'", outcome: "denarii", amount: 85 },
  { id: "neg-35", tone: "negative", text: "A heckler in the crowd rattles {g} so badly the story spreads for days.", outcome: "reputation", amount: 6 },

  // ---------------- NEUTRAL (10) ----------------
  { id: "neu-01", tone: "neutral", text: "{g} attends a long, dull banquet. Nothing of note happens.", outcome: "none" },
  { id: "neu-02", tone: "neutral", text: "{g} spends the day at the baths. Pleasant, uneventful.", outcome: "none" },
  { id: "neu-03", tone: "neutral", text: "A festival crowd barely notices {g} amid bigger spectacles.", outcome: "none" },
  { id: "neu-04", tone: "neutral", text: "{g} delivers a message across town and returns without incident.", outcome: "none" },
  { id: "neu-05", tone: "neutral", text: "{g} watches a chariot race from the cheap seats. A fine afternoon, nothing more.", outcome: "none" },
  { id: "neu-06", tone: "neutral", text: "{g} haggles at the market and settles on a fair price for nothing in particular.", outcome: "none" },
  { id: "neu-07", tone: "neutral", text: "A quiet evening at a friend's house. {g} returns unremarked.", outcome: "none" },
  { id: "neu-08", tone: "neutral", text: "{g} sits through a magistrate's lengthy speech in the Forum.", outcome: "none" },
  { id: "neu-09", tone: "neutral", text: "{g} wanders the markets, buys nothing, sees nothing worth telling.", outcome: "none" },
  { id: "neu-10", tone: "neutral", text: "A minor festival comes and goes with {g} in the crowd, unnoticed.", outcome: "none" },
];
