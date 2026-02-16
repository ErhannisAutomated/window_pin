// Window Pin - GNOME Shell Extension (GNOME 45+)
// Saves and restores which workspace each window is on.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const DBUS_IFACE = `<node>
  <interface name="org.gnome.Shell.Extensions.WindowPin">
    <method name="SaveState">
      <arg type="s" direction="out" name="result"/>
    </method>
    <method name="RestoreState">
      <arg type="s" direction="out" name="result"/>
    </method>
    <method name="ShowState">
      <arg type="s" direction="out" name="result"/>
    </method>
  </interface>
</node>`;

export default class WindowPinExtension extends Extension {
    enable() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBUS_IFACE, this);
        this._dbusImpl.export(
            Gio.DBus.session,
            '/org/gnome/Shell/Extensions/WindowPin'
        );
    }

    disable() {
        this._dbusImpl.unexport();
        this._dbusImpl = null;
    }

    _stateDir() {
        return GLib.build_filenamev([GLib.get_user_cache_dir(), 'window-pin']);
    }

    _stateFile() {
        return GLib.build_filenamev([this._stateDir(), 'state.json']);
    }

    _normalWindows() {
        const out = [];
        for (const actor of global.get_window_actors()) {
            const w = actor.get_meta_window();
            if (w.get_window_type() !== Meta.WindowType.NORMAL) continue;
            if (w.is_skip_taskbar()) continue;
            out.push(w);
        }
        return out;
    }

    // ---- DBus methods ----

    SaveState() {
        const windows = this._normalWindows().map(w => ({
            wm_class: w.get_wm_class() || '',
            title: w.get_title() || '',
            workspace: w.get_workspace().index(),
        }));

        GLib.mkdir_with_parents(this._stateDir(), 0o755);
        GLib.file_set_contents(
            this._stateFile(),
            JSON.stringify(windows, null, 2)
        );

        const lines = windows.map(
            w => `  [ws ${w.workspace}] ${w.wm_class}: ${w.title}`
        );
        return `Saved ${windows.length} window(s)\n${lines.join('\n')}`;
    }

    RestoreState() {
        let raw;
        try {
            const [, data] = GLib.file_get_contents(this._stateFile());
            raw = data instanceof Uint8Array
                ? new TextDecoder().decode(data)
                : String(data);
        } catch {
            return 'No saved state found. Run window-pin-save first.';
        }

        let saved;
        try {
            saved = JSON.parse(raw);
        } catch (e) {
            return `Corrupt state file: ${e.message}`;
        }
        if (!saved.length) return 'Saved state is empty.';

        // Ensure enough workspaces exist
        const maxWs = Math.max(...saved.map(w => w.workspace));
        const wm = global.workspace_manager;
        while (wm.get_n_workspaces() <= maxWs)
            wm.append_new_workspace(false, global.get_current_time());

        const current = this._normalWindows();
        const matchedSaved = new Set();
        const matchedCur = new Set();
        const actions = [];

        // Pass 1 - exact match on class + title
        for (let s = 0; s < saved.length; s++) {
            for (let c = 0; c < current.length; c++) {
                if (matchedCur.has(c)) continue;
                const w = current[c];
                if (
                    w.get_wm_class() === saved[s].wm_class &&
                    w.get_title() === saved[s].title
                ) {
                    if (w.get_workspace().index() !== saved[s].workspace) {
                        w.change_workspace_by_index(
                            saved[s].workspace,
                            false
                        );
                        actions.push(
                            `  ${saved[s].wm_class}: "${saved[s].title}" -> ws ${saved[s].workspace}`
                        );
                    }
                    matchedSaved.add(s);
                    matchedCur.add(c);
                    break;
                }
            }
        }

        // Pass 2 - match by class only (handles changed titles, e.g.
        // VSCode showing a different open file)
        for (let s = 0; s < saved.length; s++) {
            if (matchedSaved.has(s)) continue;
            for (let c = 0; c < current.length; c++) {
                if (matchedCur.has(c)) continue;
                const w = current[c];
                if (w.get_wm_class() === saved[s].wm_class) {
                    if (w.get_workspace().index() !== saved[s].workspace) {
                        w.change_workspace_by_index(
                            saved[s].workspace,
                            false
                        );
                        actions.push(
                            `  ${saved[s].wm_class}: "${w.get_title()}" -> ws ${saved[s].workspace} (class match)`
                        );
                    }
                    matchedSaved.add(s);
                    matchedCur.add(c);
                    break;
                }
            }
        }

        if (!actions.length)
            return 'All windows already on their saved workspaces.';
        return `Moved ${actions.length} window(s):\n${actions.join('\n')}`;
    }

    ShowState() {
        const windows = this._normalWindows();
        const lines = windows.map(w =>
            `  [ws ${w.get_workspace().index()}] ${w.get_wm_class()}: ${w.get_title()}`
        );
        return `${windows.length} window(s):\n${lines.join('\n')}`;
    }
}
