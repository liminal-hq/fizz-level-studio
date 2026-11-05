if ('__TAURI__' in window) {
var __TAURI_PLUGIN_FIZZ_STUDIO_HOST__ = (function (exports, core) {
    'use strict';

    // Exposes typed guest-side wrappers for the fizz-studio-host plugin
    //
    // (c) Copyright 2026 Liminal HQ, Scott Morris
    // SPDX-License-Identifier: Apache-2.0 OR MIT
    const PREFIX = 'plugin:fizz-studio-host|';
    /** What the game host can draw and run. */
    function getHostStatus() {
        return core.invoke(`${PREFIX}host_status`);
    }
    const HEADER_LENGTH = 13;
    const FLAG_PALETTE = 1;
    const PALETTE_LENGTH = 256 * 3;
    /**
     * Reads one message from the raw bytes the host sends (little-endian revision, width, height, a
     * flags byte, the 768-byte palette when the flag is set, then the pixels). Throws on bytes that are
     * not a whole message, never guessing.
     */
    function decodeFrame(buffer) {
        if (buffer.byteLength < HEADER_LENGTH)
            throw new Error('The frame message is shorter than its header.');
        const view = new DataView(buffer);
        const revision = view.getBigUint64(0, true);
        const width = view.getUint16(8, true);
        const height = view.getUint16(10, true);
        const flags = view.getUint8(12);
        if ((flags & ~FLAG_PALETTE) !== 0)
            throw new Error(`The frame message sets unknown flags ${flags}.`);
        let at = HEADER_LENGTH;
        let palette = null;
        if ((flags & FLAG_PALETTE) !== 0) {
            if (buffer.byteLength < at + PALETTE_LENGTH)
                throw new Error('The frame message is shorter than its palette.');
            palette = new Uint8Array(buffer, at, PALETTE_LENGTH);
            at += PALETTE_LENGTH;
        }
        const pixelLength = width * height;
        if (buffer.byteLength < at + pixelLength)
            throw new Error('The frame message is shorter than its pixels.');
        return { revision, width, height, palette, pixels: new Uint8Array(buffer, at, pixelLength) };
    }
    /**
     * Streams synthetic 320 by 200 indexed frames from the host, for measuring the stream. `onFrame`
     * gets each decoded message as it arrives; the promise resolves with what the host reports sending.
     * The frames are test data and look nothing like the game's.
     */
    function streamSyntheticFrames(options, onFrame) {
        const channel = new core.Channel();
        channel.onmessage = (buffer) => onFrame(decodeFrame(buffer));
        return core.invoke(`${PREFIX}host_stream_synthetic`, {
            frames: options.frames,
            fps: options.fps,
            paletteEvery: options.paletteEvery,
            onFrame: channel,
        });
    }

    exports.decodeFrame = decodeFrame;
    exports.getHostStatus = getHostStatus;
    exports.streamSyntheticFrames = streamSyntheticFrames;

    return exports;

})({}, __TAURI__.core);
Object.defineProperty(window.__TAURI__, 'fizzStudioHost', { value: __TAURI_PLUGIN_FIZZ_STUDIO_HOST__ }) }
