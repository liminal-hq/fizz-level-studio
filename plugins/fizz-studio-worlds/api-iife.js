if ('__TAURI__' in window) {
var __TAURI_PLUGIN_FIZZ_STUDIO_WORLDS__ = (function (exports, core, event) {
    'use strict';

    // Typed guest-side functions for the fizz-studio-worlds plugin
    //
    // (c) Copyright 2026 Liminal HQ, Scott Morris
    // SPDX-License-Identifier: Apache-2.0 OR MIT
    const PREFIX = 'plugin:fizz-studio-worlds|';
    /** Sent to every window after every change to an open level; the payload is a `LevelSnapshot`. */
    const LEVEL_CHANGED_EVENT = 'level://changed';
    /** Sent to every window when an outside edit collides with unsaved changes; the payload is a `LevelConflict`. */
    const LEVEL_CONFLICT_EVENT = 'level://conflict';
    function cmd(name, args) {
        return core.invoke(`${PREFIX}${name}`, args);
    }
    /** Opens a folder and lists its level files. */
    function openProject(path) {
        return cmd('project_open', { path });
    }
    /** Opens a level file as a session this app is the writer of, and starts watching its folder. */
    function openLevel(path) {
        return cmd('level_open', { path });
    }
    /**
     * Appends an edit, provided `basedOn` is the revision of the snapshot the caller drew. A stale
     * revision rejects with a `LevelError` of kind `stale` carrying both revisions, and nothing changes.
     * Edits that follow each other with the same `mergeKey` undo as one step until `endStep`.
     */
    function applyEdit(id, edit, basedOn, mergeKey) {
        return cmd('level_apply', { id, edit, basedOn, mergeKey: mergeKey ?? null });
    }
    /** Ends the stroke in progress, so the next edit starts a new step. */
    function endStep(id) {
        return cmd('level_end_step', { id });
    }
    /** Undoes the last step, provided `basedOn` is the revision the caller drew. */
    function undo(id, basedOn) {
        return cmd('level_undo', { id, basedOn });
    }
    /** Redoes the last undone step, provided `basedOn` is the revision the caller drew. */
    function redo(id, basedOn) {
        return cmd('level_redo', { id, basedOn });
    }
    /** Writes the level to its file atomically. */
    function saveLevel(id) {
        return cmd('level_save', { id });
    }
    /** Closes the level and stops watching its folder. Unsaved changes are dropped. */
    function closeLevel(id) {
        return cmd('level_close', { id });
    }
    /**
     * Wraps `listener` so it hears only snapshots newer than what it has applied for that level.
     * Events can arrive out of order or twice (a window's own edit comes back as an event), and a
     * revision at or below the one already applied for the same level id is older news: it is ignored.
     * `applied` maps a level id to the revision the window already shows, normally from the
     * `openLevel` or `applyEdit` answer; the wrapper keeps it up to date as snapshots arrive, and the
     * caller may set an entry when it applies an answer itself.
     */
    function newerOnly(applied, listener) {
        return (snapshot) => {
            const revision = Number(snapshot.revision);
            const latest = applied.get(snapshot.id);
            if (latest !== undefined && revision <= latest) {
                return;
            }
            applied.set(snapshot.id, revision);
            listener(snapshot);
        };
    }
    /** Hears every change to every open level, applying the revision rule of `newerOnly`. */
    function onLevelChanged(listener, applied = new Map()) {
        const hear = newerOnly(applied, listener);
        return event.listen(LEVEL_CHANGED_EVENT, (event) => hear(event.payload));
    }
    /** Hears when an outside edit cannot be merged with unsaved changes. */
    function onLevelConflict(listener) {
        return event.listen(LEVEL_CONFLICT_EVENT, (event) => listener(event.payload));
    }

    exports.LEVEL_CHANGED_EVENT = LEVEL_CHANGED_EVENT;
    exports.LEVEL_CONFLICT_EVENT = LEVEL_CONFLICT_EVENT;
    exports.applyEdit = applyEdit;
    exports.closeLevel = closeLevel;
    exports.endStep = endStep;
    exports.newerOnly = newerOnly;
    exports.onLevelChanged = onLevelChanged;
    exports.onLevelConflict = onLevelConflict;
    exports.openLevel = openLevel;
    exports.openProject = openProject;
    exports.redo = redo;
    exports.saveLevel = saveLevel;
    exports.undo = undo;

    return exports;

})({}, __TAURI__.core, __TAURI__.event);
Object.defineProperty(window.__TAURI__, 'fizzStudioWorlds', { value: __TAURI_PLUGIN_FIZZ_STUDIO_WORLDS__ }) }
