Eggs cue reference images (visual-cue pilot)
============================================
Approved, live food-photography images for the Fluffy Scrambled Eggs cook cues.
Referenced by mvp/cues.js -> SCRAMBLED_EGGS.cues[].referenceImage as:

  assets/recipes/eggs/cue-0.png   Butter in a cold pan
  assets/recipes/eggs/cue-1.png   Pour in the eggs
  assets/recipes/eggs/cue-2.png   Gentle folds
  assets/recipes/eggs/cue-3.png   Soft curds forming
  assets/recipes/eggs/cue-4.png   Still glossy & wet
  assets/recipes/eggs/cue-5.png   Take them off early
  assets/recipes/eggs/cue-6.png   "Just set?"  <-- the DONENESS GATE (must be accurate)
  assets/recipes/eggs/cue-7.png   Season & plate

The live app loads these as static files only -- it NEVER calls an image API.
The referenceImage field is optional + graceful: until a file exists here, that
cue renders text-only (no broken image).

To populate them (build-time, run once, by you):
  1.  export OPENAI_API_KEY=sk-...
  2.  node tools/gen-eggs-images.mjs           # generates into tools/eggs-gen/ (staging)
  3.  open tools/eggs-gen/review.html           # review all 8 next to their step text
  4.  regenerate a bad one:  node tools/gen-eggs-images.mjs --only cue-6
      or drop your own photo into tools/eggs-gen/cue-6.png
  5.  copy the approved PNGs here:
        cp tools/eggs-gen/cue-*.png mvp/assets/recipes/eggs/
  6.  commit the approved PNGs (like the logo) and deploy.
