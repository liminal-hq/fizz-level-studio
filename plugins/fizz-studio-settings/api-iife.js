if ('__TAURI__' in window) {
var __TAURI_PLUGIN_FIZZ_STUDIO_SETTINGS__ = (function (exports, core, event) {
    'use strict';

    // Typed guest-side functions for the fizz-studio-settings plugin
    //
    // (c) Copyright 2026 Liminal HQ, Scott Morris
    // SPDX-License-Identifier: Apache-2.0 OR MIT
    const PREFIX = 'plugin:fizz-studio-settings|';
    /** Sent to every window after every change; the payload is a `SettingsSnapshot`. */
    const SETTINGS_EVENT = 'settings://changed';
    function cmd(name, args) {
        return core.invoke(`${PREFIX}${name}`, args);
    }
    /** The settings in force and the revision they are at. */
    function getSettings() {
        return cmd('settings_get');
    }
    /**
     * Changes the fields named in `patch`, provided `basedOn` is the revision of the snapshot the
     * caller last saw. Rust merges the patch into what is in force, but refuses a stale revision:
     * the promise rejects with a `SettingsError` of kind `stale` carrying both revisions, and nothing
     * changes. Read `getSettings()` again and retry.
     */
    function updateSettings(patch, basedOn) {
        return cmd('settings_update', { patch, basedOn });
    }
    /** Puts a world's path at the front of the recent list (no duplicates, at most 12). */
    function touchRecent(path) {
        return cmd('recent_touch', { path });
    }
    /** Empties the recent list. */
    function clearRecent() {
        return cmd('recent_clear');
    }
    /**
     * Wraps `listener` so it hears only snapshots newer than everything it has already heard. Events
     * can arrive out of order or twice (a window's own change comes back as an event), and a lower or
     * equal revision is older news than what the window has applied: it is ignored. `since` is the
     * revision already applied, normally that of the `getSettings()` answer the window started from;
     * use -1 to hear everything.
     */
    function newerOnly(since, listener) {
        let latest = since;
        return (snapshot) => {
            if (snapshot.revision <= latest) {
                return;
            }
            latest = snapshot.revision;
            listener(snapshot);
        };
    }
    /**
     * Hears every change from Rust, applying the revision rule of `newerOnly`. Read `getSettings()`
     * first and pass its revision as `since`, so an event that raced the read is not applied twice.
     */
    function onSettingsChanged(listener, since = -1) {
        const hear = newerOnly(since, listener);
        return event.listen(SETTINGS_EVENT, (event) => hear(event.payload));
    }

    exports.SETTINGS_EVENT = SETTINGS_EVENT;
    exports.clearRecent = clearRecent;
    exports.getSettings = getSettings;
    exports.newerOnly = newerOnly;
    exports.onSettingsChanged = onSettingsChanged;
    exports.touchRecent = touchRecent;
    exports.updateSettings = updateSettings;

    return exports;

})({}, __TAURI__.core, __TAURI__.event);
Object.defineProperty(window.__TAURI__, 'fizzStudioSettings', { value: __TAURI_PLUGIN_FIZZ_STUDIO_SETTINGS__ }) }
