# STEGO v2 — Comprehensive Improvement Design

## Context

STEGO is a zero-dependency, client-side LSB steganography web tool with AES-256-GCM encryption and a CRT/hacker-themed UI. The current version supports text-only payloads with fixed 1-bit LSB embedding across all RGB channels.

This design adds four major capability areas: file embedding, advanced steganography options, steganalysis/visualization tools, and UX polish — while maintaining full backward compatibility with existing encoded images.

---

## 1. Payload Wire Format (v2)

### Problem

The current format only supports text. There's no way to embed files, and stego parameters (depth, channels) are hardcoded. The decoder needs to know stego settings before extraction, but those settings must also travel with the payload.

### Solution: Two-Tier Header

**Outer header** — unencrypted, embedded sequentially in the first pixels' LSBs (always 1-bit, all RGB channels, so the decoder can always read it):

```
Offset  Size  Field
0       2     Magic bytes: 0x53 0x54 ("ST")
2       1     Stego flags byte
3       1     Reserved (0x00)
4       4     Encrypted payload length (big-endian uint32)
```

Total: 8 bytes (vs current 4-byte length-only header).

**Stego flags byte layout:**

```
Bit 0-1: LSB depth (00=1-bit, 01=2-bit, 10=3-bit, 11=reserved)
Bit 2:   Red channel enabled
Bit 3:   Green channel enabled
Bit 4:   Blue channel enabled
Bit 5:   Scatter mode (0=sequential, 1=PRNG-scattered)
Bit 6-7: Reserved
```

**Inner payload** — the plaintext that gets encrypted:

```
Offset  Size  Field
0       1     Version: 0x02
1       1     Payload type: 0x01=text, 0x02=file
2       ...   Type-specific data
```

For text payloads (type 0x01):
```
2       N     Raw UTF-8 text bytes
```

For file payloads (type 0x02):
```
2       2     Filename length (big-endian uint16)
4       N     UTF-8 filename
4+N     2     MIME type length (big-endian uint16)
6+N     M     UTF-8 MIME type
6+N+M   4     File data length (big-endian uint32)
10+N+M  L     Raw file bytes
```

### Backward Compatibility

On decode, the extractor reads the first 2 bytes using legacy settings (1-bit, all RGB, sequential). If they match `0x53 0x54`, it's a v2 payload — read the rest of the 8-byte outer header, then use the stego flags to extract the encrypted payload body. Otherwise, reinterpret the first 4 bytes as a legacy big-endian length header and extract using legacy 1-bit sequential mode.

The magic bytes `0x53 0x54` as a legacy length would mean a payload > 1.39 GB — impossible in a browser canvas — so false positives are impossible.

### Capacity Formula

```
v1: floor(W * H * 3 / 8) - 4
v2: floor(W * H * activeChannels * depth / 8) - 8
```

Where `activeChannels` = count of enabled channels (1–3), `depth` = 1–3.

---

## 2. Advanced Steganography

### 2.1 Configurable LSB Depth

Users choose 1-bit (most imperceptible), 2-bit, or 3-bit (maximum capacity) via a slider.

Bit manipulation per channel sample:
```javascript
// Clear lowest `depth` bits, set to payload bits
const mask = (0xFF << depth) & 0xFF;
pixel[ch] = (pixel[ch] & mask) | payloadBits;
```

### 2.2 Channel Selection

Toggle buttons for R, G, B. At least one must be active. During embedding, skip channels whose bit is not set in the channel mask:

The `channelMask` parameter is a pre-extracted 3-bit value (bits 2–4 of the flags byte, right-shifted): `const channelMask = (flagsByte >> 2) & 0x07`. This gives R=bit0, G=bit1, B=bit2 within the mask.

```javascript
// channelMask is pre-extracted: (flagsByte >> 2) & 0x07
function isChannelActive(byteIndex, channelMask) {
  const ch = byteIndex % 4; // 0=R, 1=G, 2=B, 3=A
  if (ch === 3) return false; // always skip alpha
  return (channelMask >> ch) & 1;
}
```

### 2.3 Randomized Scatter

Instead of writing bits sequentially from pixel 0, generate a permutation of all eligible channel slot indices using a PRNG seeded from the passphrase.

**Seed derivation:** Derive from the same PBKDF2 call used for the AES key, using a different salt suffix (`salt + "scatter"`). This avoids the asymmetry of a raw SHA-256 hash (which would be trivially brute-forceable, unlike the PBKDF2-stretched AES key). Alternatively, run a second PBKDF2 with `info="stego-scatter"` and the same iteration count. Take the first 16 bytes as the PRNG seed.

**Security note:** Scatter mode adds steganographic obscurity (makes statistical detection harder), not additional cryptographic secrecy. The data is already AES-256-GCM encrypted. The PRNG seed protects the bit placement pattern, not the payload content.

**PRNG:** xorshift128 — fast, deterministic, well-studied. Not cryptographic (doesn't need to be — the data is already AES-encrypted).

**Permutation:** Fisher-Yates shuffle of the array `[0, 1, 2, ..., totalSlots-1]` where `totalSlots = W * H * activeChannels`. Bits are written/read at `slots[shuffledIndex]` instead of `slots[i]`.

**Performance note:** For a 10MP image with 3 channels, the slot array has ~30M entries. This is feasible but uses ~120MB of memory. For images larger than 10MP, show a warning. Future optimization: Feistel-based on-the-fly permutation to avoid materializing the array.

**Critical invariant:** The outer 8-byte header is ALWAYS written sequentially in the first pixels (1-bit, all RGB) so the decoder can read it without knowing the scatter seed. Only the payload body after the header uses scattered positions.

**Scatter slot range:** The header occupies `8 bytes × 8 bits = 64` channel slot positions (sequential, from slot 0). The Fisher-Yates permutation is applied ONLY to slots `[64..totalSlots-1]` — the header slots are excluded from the permutable range. This ensures the scattered payload never overwrites header data. Both encoder and decoder must use the same excluded range.

**Bit reader reset:** When the decoder reads the first 2 bytes to check for the magic `0x53 0x54`, and then falls back to legacy mode, it must re-read from slot 0. Since `readBitsFromPixels` is a pure function over `imageData.data` (no stateful cursor), calling it twice with different parameters is harmless.

### 2.4 File Organization

Split current `stego.js` (117 lines) into:
- **`js/stego.js`** — public API (`embedPayload`, `extractPayload`), capacity calc, orchestration (~150 lines)
- **`js/stego-header.js`** — v2 outer header read/write, magic byte detection, legacy fallback (~60 lines)
- **`js/stego-bits.js`** — low-level bit read/write with configurable depth and channel mask (~100 lines)
- **`js/scatter.js`** — xorshift128 PRNG, seed derivation via Web Crypto, Fisher-Yates shuffle (~80 lines)

---

## 3. File Embedding

### Encode Flow

1. User toggles payload type to "File"
2. File picker or drag-and-drop accepts any file
3. UI shows: filename, size, MIME type, whether it fits in capacity
4. On encode: `serializeFilePayload(filename, mimeType, fileBytes)` → encrypt → embed

### Decode Flow

1. Extract + decrypt → `deserializePayload()` detects type
2. For file: show metadata (filename, size, type) + "Download File" button
3. Download triggers `URL.createObjectURL(new Blob([data], { type: mimeType }))` with the original filename

### crypto.js Changes

Add generic byte-level functions alongside existing string convenience wrappers:
- `encryptPayload(data: Uint8Array, passphrase: string) → Promise<Uint8Array>`
- `decryptPayload(data: Uint8Array, passphrase: string) → Promise<Uint8Array>`
- `deriveScatterSeed(passphrase: string, salt: Uint8Array) → Promise<Uint8Array>` (PBKDF2-derived 16 bytes for PRNG seed, using `salt + "scatter"` to differentiate from the AES key derivation)

Existing `encryptMessage`/`decryptMessage` become thin wrappers around these.

**Important:** All length header parsing must use `DataView.getUint32(offset, false)` (big-endian) instead of manual bit-shifting, to avoid signed int32 overflow on payloads > 2GB. The existing `parseLengthHeader` in `utils.js` uses `(h[0] << 24) | ...` which produces a signed result — update it to use `DataView` or apply `>>> 0`.

---

## 4. Steganalysis & Visualization

### 4.1 LSB Plane Visualization

Extract only the least significant bit of each RGB channel, scale to 0 or 255, render to a canvas. This creates a high-contrast black/white image showing the bit pattern. Hidden data appears as structured noise in the region where it's embedded.

### 4.2 PSNR (Peak Signal-to-Noise Ratio)

```
MSE = (1 / (W * H * 3)) * Σ(original[i] - encoded[i])²
PSNR = 10 * log10(255² / MSE) dB
```

Typical values: ~51 dB for 1-bit LSB, ~44 dB for 2-bit, ~38 dB for 3-bit.

### 4.3 SSIM (Structural Similarity Index)

Standard SSIM with 8x8 sliding window. Constants: `C1 = (0.01 × 255)²`, `C2 = (0.03 × 255)²`. Compute per-channel, average across channels.

For performance: chunk computation with `setTimeout(0)` to avoid blocking UI. Show progress indicator during calculation. Optionally compute on a downsampled version for quick preview.

### 4.4 Before/After Comparison

A slider-based "wipe" comparison — two canvases overlaid, user drags a divider left/right to reveal original vs encoded. This clearly shows that changes are imperceptible.

### 4.5 Standalone Analyze Mode

A third tab alongside Encode/Decode. Load any image and view its LSB plane without needing a passphrase. Useful for inspecting suspicious images.

### File Organization

- **`js/analysis.js`** — PSNR and SSIM computation (~100 lines)
- **`js/visualize.js`** — LSB plane rendering, comparison slider setup (~80 lines)

---

## 5. UX Polish

### 5.1 Password Strength Meter

Evaluate passphrase based on: length, character diversity (lowercase, uppercase, digits, symbols), estimated entropy. Map to 5 levels: Weak / Fair / Good / Strong / Very Strong. Display as a colored bar below the passphrase input (red → green gradient).

**File:** `js/password-strength.js` (~50 lines)

### 5.2 Progress Indicator

A callback-based progress reporter. Exports `createProgressReporter(elementId)` which returns a `{ report(current, total), reset() }` object. The factory accepts a DOM element ID, keeping the module's API explicit about its DOM coupling. The stego encode/decode loop calls `reporter.report(current, total)` which updates the CSS width of the progress bar element. Also used during SSIM computation.

**File:** `js/progress.js` (~40 lines)

### 5.3 Copy to Clipboard

For decoded text messages, add a "Copy" button that uses `navigator.clipboard.writeText()`. Visual feedback: button text briefly changes to "Copied!" with a green flash.

### 5.4 Keyboard Accessibility

- `role` and `aria-label` on all interactive elements
- `aria-live="polite"` on the status bar for screen reader announcements
- Visible focus outlines (`:focus-visible`) on all focusable elements
- `tabindex` management on the mode toggle buttons
- Keyboard-operable file drop zones (Enter/Space to trigger file picker)

### 5.5 Batch Operations

A "Batch" mode or multi-file drop zone. Upload multiple images + one passphrase + one message/file. Encode all sequentially. Show per-file progress and results list with individual download buttons.

**File:** `js/batch.js` (~80 lines)

### 5.6 CSS Split

Current `css/styles.css` (~496 lines) stays as base styles. New component styles go in `css/components.css` (~200 lines), linked as a second stylesheet in `index.html`.

---

## 6. File Organization Summary

### New Files

| File | Purpose | Est. Lines |
|------|---------|------------|
| `js/payload.js` | v2 payload serialize/deserialize | ~90 |
| `js/stego-header.js` | v2 outer header read/write, legacy fallback | ~60 |
| `js/stego-bits.js` | Configurable bit read/write | ~100 |
| `js/scatter.js` | xorshift128 PRNG + Fisher-Yates | ~80 |
| `js/analysis.js` | PSNR, SSIM computation | ~100 |
| `js/visualize.js` | LSB plane, comparison slider | ~80 |
| `js/password-strength.js` | Strength scoring | ~50 |
| `js/progress.js` | Progress reporting | ~40 |
| `js/batch.js` | Batch encode/decode | ~80 |
| `css/components.css` | New UI component styles | ~200 |

### Modified Files

| File | Changes |
|------|---------|
| `js/config.js` | Add v2 format, scatter, analysis, password constants; remove `LSB_MASK` (replaced by dynamic computation from depth); update `TOTAL_OVERHEAD` to 54 bytes (salt(16) + iv(12) + authTag(16) + outerHeader(8) + innerVersion(1) + innerType(1)) |
| `js/state.js` | Add settings, filePayload, progress, batch state, `encode.encodedImageData` for PSNR/SSIM comparison |
| `js/stego.js` | Refactor to use stego-bits.js, add v2 header, legacy fallback |
| `js/crypto.js` | Add byte-level encrypt/decrypt, scatter seed derivation |
| `js/utils.js` | Add v2 header helpers, updated capacity calculation |
| `js/ui.js` | Advanced settings panel, strength meter, progress bar, copy button |
| `js/image.js` | Store original image data for comparison, file payload handling |
| `js/main.js` | Rewire for v2 payloads, analyze mode, batch wiring |
| `index.html` | Advanced settings panel, file picker, analysis section, ARIA |
| `css/styles.css` | Minor additions, link to components.css |

### Import Dependency Graph (no circular deps)

```
config.js, state.js                    (leaf modules)
utils.js                             ← config
password-strength.js                 ← config
progress.js                          (no imports — factory accepts DOM element ID)
scatter.js                           ← config, crypto
stego-header.js                      ← config
stego-bits.js                        ← config
payload.js                           ← config
analysis.js                          ← config
visualize.js                         ← config, state
crypto.js                            ← config
stego.js                             ← config, utils, stego-header, stego-bits, scatter
ui.js                                ← config, state, utils, password-strength, progress
image.js                             ← state, utils, ui
batch.js                             ← state, crypto, stego, payload, progress, ui
main.js                              ← all others (entry point)
```

**Architecture note:** `main.js` calls `stego.js` to get raw encrypted bytes, then calls `payload.js` to deserialize the inner payload (text vs file). `stego.js` does NOT import `payload.js` — the orchestration layer (`main.js`) bridges them. This keeps `stego.js` focused on bit-level embedding/extraction only.

---

## 7. Implementation Phases

### Phase 1: Foundation (Internal Refactors)
1. Update `config.js` with new constants (remove `LSB_MASK`, update `TOTAL_OVERHEAD` to 54)
2. Update `state.js` with new state properties (including `encode.encodedImageData`)
3. Create `js/payload.js` — payload serialization/deserialization
4. Add `encryptPayload`/`decryptPayload` to `crypto.js`; fix `parseLengthHeader` to use `DataView.getUint32` or `>>> 0`
5. Create `js/stego-header.js` — v2 outer header read/write, magic byte detection, legacy fallback
6. Create `js/stego-bits.js` — extract and generalize bit read/write from stego.js
7. Refactor `js/stego.js` to use stego-header.js and stego-bits.js
8. Update `js/utils.js` with new capacity formula

**Verify:** Encode with v2 format → decode with v2 code. Load a legacy-encoded image → decode succeeds with backward compat path.

### Phase 2: Advanced Steganography
1. Create `js/scatter.js` — PRNG and permutation generation
2. Integrate scatter mode into stego.js (conditional on flags)
3. Wire configurable depth and channel selection into stego-bits.js
4. Add advanced settings panel to `index.html` and `ui.js`
5. Update `main.js` to pass stego settings through encode/decode

**Verify:** Encode with 2-bit depth, R+B channels only, scatter on → decode correctly. Try various combinations.

### Phase 3: File Embedding
1. Add payload type toggle (text/file) to encode UI
2. Add file picker + drag-and-drop for file payloads
3. Update encode flow in main.js to serialize file payloads
4. Update decode flow to detect file type and offer download
5. Update capacity meter to reflect file size + metadata overhead

**Verify:** Embed a PDF → extract and open it. Embed text → extract as text. Decode a legacy-encoded image → still works.

### Phase 4: Steganalysis & Visuals
1. Create `js/analysis.js` — PSNR, SSIM
2. Create `js/visualize.js` — LSB plane rendering, comparison slider
3. Store original image data during encode in APP_STATE
4. Add analysis panel to encode result section in UI
5. Add standalone "Analyze" mode tab

**Verify:** PSNR ~51 dB for 1-bit LSB on a test image. LSB plane shows structured data in embedded region. Comparison slider works smoothly.

### Phase 5: UX Polish
1. Create `js/password-strength.js` + wire into UI
2. Create `js/progress.js` + integrate into encode/decode loops
3. Add copy-to-clipboard for decoded text
4. Add ARIA attributes and keyboard navigation throughout
5. Create `js/batch.js` + batch UI
6. Create `css/components.css` + split/link styles

**Verify:** Keyboard-only navigation works end-to-end. Progress bar updates during large image encode. Batch mode encodes 3 images sequentially.

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Backward compat breakage | Users lose access to old images | Magic bytes `0x53 0x54` are unambiguous — impossible as a legacy length for browser-feasible payloads. Extensive testing with legacy images. |
| Scatter array memory (30M+ entries for 10MP) | OOM or UI freeze | Warn for images >10MP. Future: Feistel-based on-the-fly permutation. |
| SSIM blocks UI thread | Unresponsive page | Chunked computation with `setTimeout(0)`. Progress indicator. Optional downsampled preview. |
| File payloads exceed capacity | User frustration | Validate file size vs capacity immediately on selection. Clear error messaging. |
| Code quality rules violated (200 lines/file) | Inconsistency with project standards | Pre-planned file splits. Each new module has a clear, bounded responsibility. |
| CSS grows too large | Maintenance burden | Split into base + components stylesheets from the start. |

---

## 9. Verification Plan

### End-to-End Testing

1. **Text encode/decode (v2):** Type a message → encode → download PNG → reload in decode → verify message matches
2. **Legacy decode:** Take an image encoded with current v1 code → decode with new code → verify it works
3. **File embed:** Select a 100KB PDF → encode → download PNG → reload → decode → download file → verify file opens correctly
4. **Advanced stego:** Set 2-bit depth, R+G only, scatter on → encode text → decode with same settings → verify
5. **Analysis:** After encoding, check PSNR is displayed (~51 dB for 1-bit), LSB plane shows data, comparison slider works
6. **Capacity:** Load a 800x600 image → verify capacity updates when changing depth/channels → try to embed a file that's too large → verify error
7. **Password strength:** Type progressively stronger passwords → verify meter updates in real-time
8. **Batch:** Drop 3 images → encode all with same message → verify all produce downloadable PNGs
9. **Keyboard nav:** Tab through entire UI → verify all controls are reachable and operable
10. **Cross-browser:** Test in Chrome, Firefox, Safari (Web Crypto API support varies slightly)
