# test-assets/

Fixtures for native simulator verification (Maestro / native-verify harness).

## fridge-test.jpg
A **placeholder** fridge image (900×675) for the fridge-scan sim flow
(`.maestro/scan-library.yaml`). It's a valid JPEG so `xcrun simctl addmedia booted
test-assets/fridge-test.jpg` works and the library-pick → preview path can be
exercised — but it is NOT a real fridge, so a live Sonnet vision scan against it will
find little/nothing.

**Before running the opt-in LIVE SCAN block**, replace it with a real fridge photo
(same filename) so the one paid call returns meaningful ingredients. The default flow
stops at the picker (zero paid calls), so the placeholder is fine for the crash-
regression assertion.
