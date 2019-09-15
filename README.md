# Autotile Shell

This is a fork of the wonderful [Material Shell](https://github.com/PapyElGringo/material-shell). The purpose of this fork is to simplify as much as possible, narrow down configuration, and modify only the Gnome panel.

**WIP**, there are some bugs I'm working out.

## Demo (Outdated)

![Demo GIF](demo.gif)

### Discord for Material Shell (not auto-tile)
Get notified about updates and join me at [https://discord.gg/vBb7D9a](https://discord.gg/vBb7D9a)
#
#### STATUS: BETA (expect bugs!)
#### REQUIRES: gnome-shell >=3.32.0

## Installation
1) Clone the project to the gnome-shell extensions folder:
```bash
git clone https://github.com/Luke-Nukem/material-shell.git ~/.local/share/gnome-shell/extensions/auto-tile@ljones.dev
```
2) Reload GNOME Shell:
  + On X.org: Hit `Alt+F2` and type the command `r`
  + On Wayland: Log out and back in
3) Open `gnome-tweaks` and activate the `Material-shell` extension **OR** enable it using 
```bash
gnome-shell-extension-tool -e auto-tile@ljones.dev
```

## Workflow Hotkeys
Some hotkeys might already be used by GNOME Shell - please check your keybindings first.
#### Desktop navigation
* `Super+W` Navigate to the upper workspace/category.
* `Super+S` Navigate to the lower workspace/category.
* `Super+A` Focus the window at the left of the current window.
* `Super+D` Focus the window at the right of the current window.

#### Window manipulation
* `Super+Q` Kill the current window focused.
* `Super+[MouseDrag]` Move window around.
* `Super+Shift+A` Move the current window to the left.
* `Super+Shift+D` Move the current window to the right.
* `Super+Shift+W` Move the current window to the upper workspace.
* `Super+Shift+S` Move the current window to the lower workspace.

#### Extra Hotkeys
* `Super+Space` Cycle the tiling layout of the current workspace.
* `Super+Escape` Toggle the UI of Material-shell, like a Zen mode.
