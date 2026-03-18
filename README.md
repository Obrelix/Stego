# STEGO — Hidden in Plain Sight

A client-side steganography suite that hides encrypted messages and files inside images by modifying the least significant bits of pixel data — invisible to the naked eye.

**[Try it live](https://obrelix.github.io/Stego/)**

## Features

### Core Steganography
- **LSB Steganography** — Embeds data in the least significant bits of RGB channels with configurable depth (1–3 bits per channel)
- **AES-256-GCM Encryption** — All payloads are encrypted with a passphrase before embedding, using PBKDF2 key derivation (100k iterations, SHA-256)
- **File Embedding** — Hide arbitrary files (not just text) with preserved filename and MIME type
- **Scatter Mode** — PRNG-randomized bit distribution across the image to resist statistical analysis (xorshift128 + Fisher-Yates shuffle)

### Advanced Options
- **Configurable Bit Depth** — Choose 1, 2, or 3 LSBs per channel to trade imperceptibility for capacity
- **Selective Channels** — Toggle R, G, B independently for fine-grained control
- **v2 Header Format** — Magic-byte header with embedded flags (depth, channels, scatter) for automatic decode settings detection
- **Legacy Compatibility** — Auto-detects and decodes v1 (original 4-byte header) payloads

### Analysis Tools
- **Post-Encode Analysis** — PSNR (dB) and SSIM metrics to quantify visual impact
- **Before/After Comparison** — Interactive slider overlay of original vs. steganographed image
- **LSB Plane Visualization** — Standalone Analyze mode renders the least significant bit plane of any image
- **Password Strength Meter** — Real-time entropy estimation during passphrase input

### Design
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript using only browser-native APIs (Canvas, Web Crypto)
- **Fully Client-Side** — No server, no uploads, no data leaves your browser
- **CRT/Hacker Aesthetic** — Retro terminal-inspired UI with scanline effects, neon accents, and monospace typography
- **Drag-and-Drop** — Drop images directly into any mode's drop zone or use the file picker
- **Real-Time Capacity Meter** — Visual feedback with color-coded warnings (yellow at 75%, red at 95%)

## Usage

Open [the hosted app](https://obrelix.github.io/Stego/) or serve locally:

```sh
# Any of these work:
npx serve .
python -m http.server
# or VS Code Live Server extension
```

Then open `http://localhost:<port>` in a browser.

### Encode

1. Drop or select a carrier image
2. *(Optional)* Expand **Advanced Settings** to adjust bit depth, channels, or enable scatter mode
3. Choose **Text** or **File** payload type
4. Enter your secret message or select a file to embed
5. Enter a passphrase
6. Click **Encode** and download the output PNG

### Decode

1. Switch to **Decode** mode
2. Drop or select the steganographed PNG image
3. Enter the same passphrase used during encoding
4. Click **Decode** to reveal the hidden text or download the embedded file

### Analyze

1. Switch to **Analyze** mode
2. Drop or select any image
3. View the LSB plane visualization — no passphrase needed

## How It Works

The tool modifies the least significant bits of each R, G, and B byte in the image pixels. The **v2 format** embeds a magic-byte header followed by a flags byte (encoding bit depth, active channels, and scatter mode), a 4-byte big-endian payload length, and the AES-256-GCM encrypted payload (which includes a random 16-byte salt and 12-byte IV for each encode).

When **scatter mode** is enabled, a PRNG seed is derived from the passphrase and used to shuffle the embedding order of pixel slots via Fisher-Yates, making the payload distribution uniform across the image rather than sequential from the top-left corner.

The output is always lossless PNG — lossy formats like JPEG would destroy the hidden data.

**Capacity** depends on settings: approximately `(width × height × active_channels × depth) / 8` bytes minus header overhead.

## Architecture

The app uses ES modules across separate files — no inline JS or CSS in `index.html`:

```
index.html               HTML shell — loads js/main.js as module entry point
css/styles.css           CRT/hacker-themed UI with scanlines and glow effects
css/components.css       Advanced settings, comparison slider, metrics display
js/config.js             CONFIG object — all constants (crypto, stego, capacity, output)
js/state.js              APP_STATE object — all mutable runtime state
js/utils.js              Pure functions: formatBytes, capacity calc (v1 & v2)
js/crypto.js             AES-256-GCM encrypt/decrypt, PBKDF2 key derivation, scatter seed
js/stego.js              v2 LSB embedding/extraction with version detection & v1 fallback
js/stego-header.js       v2 outer header: magic bytes + flags + length
js/stego-bits.js         Low-level bit read/write — configurable depth & channel mask
js/scatter.js            PRNG scatter order: xorshift128 + Fisher-Yates shuffle
js/payload.js            v2 inner payload serialization — text & file payloads with metadata
js/ui.js                 Mode switching, validation, status bar, capacity meter
js/image.js              Image loading, drag-and-drop, canvas setup
js/settings.js           Advanced settings UI — depth slider, channel toggles, scatter
js/password-strength.js  Password strength estimation (entropy-based scoring)
js/analyze.js            Post-encode analysis UI + standalone Analyze mode
js/visualize.js          LSB plane rendering, before/after comparison slider
js/main.js               Entry point — encode/decode/analyze actions, event wiring, init()
```

**Three logical layers** (no circular dependencies):

1. **Config & State** — `config.js`, `state.js` (leaf modules, no imports)
2. **Crypto & Steganography** — `crypto.js`, `stego.js`, `stego-header.js`, `stego-bits.js`, `scatter.js`, `payload.js`, `utils.js`, `password-strength.js`
3. **UI & Analytics** — `main.js` (sole entry point), `ui.js`, `image.js`, `settings.js`, `analyze.js`, `visualize.js`

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
