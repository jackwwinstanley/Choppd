# Scan benchmark — ground truth

Drop 5–6 real photos here (01-normal-fridge.jpg, 02-dark.jpg, 03-blurry.jpg,
04-near-empty.jpg, 05-pantry.jpg, 06-non-food.jpg) plus ground-truth.md:
one section per filename, a bullet list of every food item actually visible.
Then tools/scan-bench/run.mjs measures recall/precision per pipeline variant
(old single-call, Haiku-per-photo, ladder, straight Sonnet). Recall is the
star metric; uncertain-tier hits count (the ghost chip recovers them).
Acceptance: ≥85% recall on the normal fridge + strictly better than baseline
on every photo.

