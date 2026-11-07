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
    /** Sent to every window when a level's locked layers change; the payload is a `LevelLayers`. */
    const LEVEL_LAYERS_EVENT = 'level://layers';
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
     * Makes a new level and opens it. A Fizz 1 level is the file `<folder>/<id>.fizz`; a Fizz 2 level
     * is a world project `<folder>/<id>/`. The target is fixed here. An existing file or folder rejects
     * with a `LevelError` of kind `invalid`, and nothing is written.
     */
    function createLevel(request) {
        return cmd('level_create', { request });
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
    /** The recovery copies a session that did not close cleanly left behind, for levels not open now. */
    function listRecovery() {
        return cmd('recovery_list');
    }
    /**
     * Opens the level a recovery copy is of with the recovered text as unsaved changes (author
     * `recovered`). The copy is kept until the level is saved or closed.
     */
    function restoreRecovery(id) {
        return cmd('recovery_restore', { id });
    }
    /** Deletes a recovery copy. */
    function discardRecovery(id) {
        return cmd('recovery_discard', { id });
    }
    /**
     * The words a level script can use, documented, from the language in Rust. The Palette lists the
     * tiles, items and enemies among them, and the Script panel's completion offers all of them.
     */
    function languageWords() {
        return cmd('language_words');
    }
    /**
     * The script line (counted from 1) of the last statement that changed the cell `x`, `y` of an open
     * level, or `null` when no statement did.
     */
    function levelCellLine(id, x, y) {
        return cmd('level_cell_line', { id, x, y });
    }
    /**
     * The changes Claude proposed for an open level that the person has not yet accepted or rejected,
     * read from the level's `<level>.studio.json` sidecar and spread into cells. Read-only.
     */
    function levelGhosts(id) {
        return cmd('level_ghosts', { id });
    }
    /**
     * The current snapshot of an open level, for a window that did not open it, such as a panel torn
     * off into a window of its own. Rejects with a `LevelError` of kind `not_open` for an unknown id.
     */
    function levelSnapshot(id) {
        return cmd('level_snapshot', { id });
    }
    /** The layers of an open level that are locked. */
    function levelLayers(id) {
        return cmd('level_layers', { id });
    }
    /**
     * Locks or unlocks a layer of an open level, and keeps the choice in the level's sidecar. A locked
     * layer refuses every change to it, from the person and from Claude alike. Rejects with a
     * `LevelError` of kind `invalid` for a word that is not a layer, and `io` when the sidecar cannot be
     * rewritten (the lock is then left as it was).
     */
    function setLayerLocked(id, layer, locked) {
        return cmd('level_set_layer_locked', { id, layer, locked });
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
    /** Hears when a level's locked layers change, whichever window changed them. */
    function onLevelLayers(listener) {
        return event.listen(LEVEL_LAYERS_EVENT, (event) => listener(event.payload));
    }

    exports.LEVEL_CHANGED_EVENT = LEVEL_CHANGED_EVENT;
    exports.LEVEL_CONFLICT_EVENT = LEVEL_CONFLICT_EVENT;
    exports.LEVEL_LAYERS_EVENT = LEVEL_LAYERS_EVENT;
    exports.applyEdit = applyEdit;
    exports.closeLevel = closeLevel;
    exports.createLevel = createLevel;
    exports.discardRecovery = discardRecovery;
    exports.endStep = endStep;
    exports.languageWords = languageWords;
    exports.levelCellLine = levelCellLine;
    exports.levelGhosts = levelGhosts;
    exports.levelLayers = levelLayers;
    exports.levelSnapshot = levelSnapshot;
    exports.listRecovery = listRecovery;
    exports.newerOnly = newerOnly;
    exports.onLevelChanged = onLevelChanged;
    exports.onLevelConflict = onLevelConflict;
    exports.onLevelLayers = onLevelLayers;
    exports.openLevel = openLevel;
    exports.openProject = openProject;
    exports.redo = redo;
    exports.restoreRecovery = restoreRecovery;
    exports.saveLevel = saveLevel;
    exports.setLayerLocked = setLayerLocked;
    exports.undo = undo;

    return exports;

})({}, __TAURI__.core, __TAURI__.event);
Object.defineProperty(window.__TAURI__, 'fizzStudioWorlds', { value: __TAURI_PLUGIN_FIZZ_STUDIO_WORLDS__ }) }
