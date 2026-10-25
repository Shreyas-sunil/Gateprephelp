/** Message pools. lib/motivation.ts picks one based on recorded data — never claims progress that isn't there. */

export const GENERAL_MESSAGES = [
  "One more problem. One more step toward IISc.",
  "Your cat has no idea what a semaphore is. You do. Probably. Let's check.",
  "Today's mission: make one weak topic less weak.",
  "Even the tiniest paws climb the tallest mountains.",
  "Read the question twice. Then once more for the word NOT.",
  "An MSQ is four true/false questions wearing a trench coat.",
  "Slow scratchpad, fast marks.",
  "Write the reason you got it wrong. That's the part that compounds.",
  "Pick the hardest topic on today's list and give it the first hour.",
  "A clean Gantt chart is a small, honest joy.",
  "Cats nap. You revise. Both are part of the system.",
  "Tag bits, index bits, offset bits. Count twice.",
  "Small sample sizes lie. Keep logging.",
  "The virtual calculator is slower than you think. Practise on it today.",
];

export const START_MESSAGES = [
  "Blank slate. Mark the topics you already know and the dashboard will start telling the truth.",
  "Nothing logged yet — which means nothing to undo. Start with one topic.",
  "Your cat is curious what you'll study first.",
];

export const RECOVERY_MESSAGES = [
  "A missed day is a gap, not a verdict. Pick one task and restart the clock.",
  "Welcome back. Move yesterday's unfinished tasks to today — or let them go.",
  "The streak resets; your knowledge doesn't. One focused session today.",
];

export const BAD_MOCK_MESSAGES = [
  "A bad mock is diagnostic data, not a prediction of your future.",
  "Every lost mark in that mock now has an address. Go fix one.",
  "Low score, high information. Run the post-mock audit before the next test.",
];

export const STREAK_MESSAGES = [
  "{n} days in a row. Your cat is pretending not to be impressed.",
  "{n}-day streak on record. Keep it gentle — rest is allowed.",
];

export const IMPROVED_MOCK_MESSAGES = ["Your latest mock improved by {n} marks over the previous one.", "+{n} marks since your last mock. Note what changed."];

export const STUDY_CHALLENGES = [
  "Solve 5 PYQs from your weakest topic without checking solutions for 7 minutes each.",
  "Rewrite one error-notebook rule from memory.",
  "Do one full NAT calculation using only a virtual calculator.",
  "Explain one concept aloud to your cat in under two minutes.",
  "Clear every revision item due today.",
  "Re-solve one question you got wrong last week.",
  "Draw the closure-property table from memory.",
  "Compute tag/index/offset bits for a cache config you invent.",
];
