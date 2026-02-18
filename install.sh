#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXT_UUID="window-pin@local"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$EXT_UUID"

# Check GNOME Shell version
if ! command -v gnome-shell &>/dev/null; then
    echo "gnome-shell not found. This extension requires GNOME Shell 45+." >&2
    exit 1
fi

GNOME_VER=$(gnome-shell --version | grep -oP '\d+' | head -1)
if [ "$GNOME_VER" -lt 45 ] 2>/dev/null; then
    echo "GNOME Shell $GNOME_VER detected. This extension requires 45+." >&2
    echo "Ubuntu 24.04+ ships GNOME 46." >&2
    exit 1
fi

# Install extension files
echo "Installing extension to $EXT_DIR ..."
mkdir -p "$EXT_DIR"
cp "$SCRIPT_DIR/extension/metadata.json" "$EXT_DIR/"
cp "$SCRIPT_DIR/extension/extension.js"  "$EXT_DIR/"

# Install CLI scripts
echo "Installing scripts to ~/.local/bin ..."
mkdir -p "$HOME/.local/bin"
cp "$SCRIPT_DIR/window-pin-save"    "$HOME/.local/bin/"
cp "$SCRIPT_DIR/window-pin-restore" "$HOME/.local/bin/"
chmod +x "$HOME/.local/bin/window-pin-save" "$HOME/.local/bin/window-pin-restore"

# Enable the extension
echo "Enabling extension ..."
gnome-extensions enable "$EXT_UUID" 2>/dev/null || true

echo ""
echo "Done!  You may need to log out and back in (or press Alt+F2, type 'r',"
echo "then Enter — X11 only) for the extension to load."
echo ""
echo "Once active:"
echo "  window-pin-save      Save current window layout"
echo "  window-pin-restore   Restore windows to saved workspaces"
echo ""
echo "Make sure ~/.local/bin is in your PATH."
echo "If you get an error about not being connected, try"
echo "gnome-extensions enable \"$EXT_UUID\" 2>/dev/null || true"
