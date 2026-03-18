# STEGO — Hidden in Plain Sight

A client-side steganography tool that hides encrypted messages inside images by modifying the least significant bits of pixel data — invisible to the naked eye.

**[Try it live](https://obrelix.github.io/Stego/)**

## Features

- **LSB Steganography** — Embeds data in the least significant bit of each RGB channel (1 bit per channel, 3 bits per pixel)
- **AES-256-GCM Encryption** — Messages are encrypted with a passphrase before embedding, using PBKDF2 key derivation (100k iterations, SHA-256)
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript using only browser-native APIs (Canvas, Web Crypto)
- **Fully Client-Side** — No server, no uploads, no data leaves your browser
- **CRT/Hacker Aesthetic** — Retro terminal-inspired UI with scanline effects, neon accents, and monospace typography
- **Drag-and-Drop** — Drop images directly into the browser or use the file picker
- **Real-Time Capacity Meter** — Visual feedback showing how much of the image's capacity your message uses

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
2. Type your secret message
3. Enter a passphrase
4. Click **Encode Message** and download the output PNG

### Decode

1. Switch to **Decode** mode
2. Drop or select the steganographed PNG image
3. Enter the same passphrase used during encoding
4. Click **Decode Message** to reveal the hidden text

## How It Works

The tool modifies the least significant bit of each R, G, and B byte in the image pixels. A 4-byte big-endian length header is embedded first, followed by the AES-256-GCM encrypted payload (which includes a random 16-byte salt and 12-byte IV for each encode). The output is always lossless PNG — lossy formats like JPEG would destroy the hidden data.

**Capacity:** approximately `(width x height x 3) / 8 - 4` bytes per image.

## Architecture

The app uses ES modules across separate files — no inline JS or CSS in `index.html`:

```
index.html          HTML shell — loads js/main.js as module entry point
css/styles.css      CRT/hacker-themed UI with scanlines and glow effects
js/config.js        CONFIG object — all constants (crypto, stego, capacity, output)
js/state.js         APP_STATE object — all mutable runtime state
js/utils.js         Pure functions: formatBytes, length headers, capacity calc
js/crypto.js        AES-256-GCM encrypt/decrypt via Web Crypto API
js/stego.js         1-bit LSB embedding/extraction across R, G, B channels
js/ui.js            Mode switching, validation, status bar, capacity meter
js/image.js         Image loading, drag-and-drop, canvas setup
js/main.js          Entry point — encode/decode actions, event wiring, init()
```

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
