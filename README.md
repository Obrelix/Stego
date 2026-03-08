# STEGO — Hidden in Plain Sight

A client-side steganography tool that hides encrypted messages inside images by modifying the least significant bits of pixel data — invisible to the naked eye.

## Features

- **LSB Steganography** — Embeds data in the least significant bit of each RGB channel (1 bit per channel, 3 bits per pixel)
- **AES-256-GCM Encryption** — Messages are encrypted with a passphrase before embedding, using PBKDF2 key derivation (100k iterations)
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript using only browser-native APIs (Canvas, Web Crypto)
- **Fully Client-Side** — No server, no uploads, no data leaves your browser
- **Single File** — The entire application is one self-contained `index.html`

## Usage

Open `index.html` in any modern browser.

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

The tool modifies the least significant bit of each R, G, and B byte in the image pixels. A 4-byte length header is embedded first, followed by the AES-256-GCM encrypted payload (which includes a random salt and IV for each encode). The output is always lossless PNG — lossy formats like JPEG would destroy the hidden data.

**Capacity:** approximately `(width x height x 3) / 8 - 4` bytes per image.

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
