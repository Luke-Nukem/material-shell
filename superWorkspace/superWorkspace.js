const { Clutter, GLib, St } = imports.gi;
const Signals = imports.signals;
const Main = imports.ui.main;
const Background = imports.ui.background;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const { MaximizeLayout } = Me.imports.tilingManager.tilingLayouts.maximize;
const { debounce } = Me.imports.utils.index;
const WindowUtils = Me.imports.utils.windows;
const { CategorizedAppCard } = Me.imports.widget.categorizedAppCard;

const { Stack } = Me.imports.widget.layout;

const EMIT_DEBOUNCE_DELAY = 100;

var SuperWorkspace = class SuperWorkspace {
    constructor(
        superWorkspaceManager,
        categoryKey,
        category,
        apps,
        monitor,
        visible
    ) {
        this.superWorkspaceManager = superWorkspaceManager;
        this.categoryKey = categoryKey;
        this.category = category;
        this.monitor = monitor;
        this.apps = apps;
        this.bgShown = false;
        this.monitorIsPrimary =
        monitor.index === Main.layoutManager.primaryIndex;
        this.windows = [];
        this.uiVisible = visible;
        let previousLayout =
        Me.stateManager.getState(
            `${this.categoryKey}_${this.monitor.index}`
        ) || MaximizeLayout.key;
        const Layout = global.tilingManager.getLayoutByKey(previousLayout);
        this.tilingLayout = new Layout(this);
        this.frontendContainer = new St.Widget();

        this.frontendContainer.set_position(this.monitor.x, this.monitor.y);

        // Only emit window changed after EMIT_DEBOUNCE_DELAY ms without call
        // This prevents multiple tiling on window add for instance
        this.emitWindowsChangedDebounced = debounce(
            this.emitWindowsChanged,
            EMIT_DEBOUNCE_DELAY
        );

        this.backgroundContainer = new St.Widget();

        this.bgManager = new Background.BackgroundManager({
            container: this.backgroundContainer,
            monitorIndex: this.monitor.index,
            vignette: false
        });

        this.categorizedAppCard = new CategorizedAppCard(this.category, apps);
        this.backgroundStackLayout = new Stack({
            x: monitor.x,
            y: monitor.y,
            width: monitor.width,
            height: monitor.height,
            // This St.Bin fix an Incredible Bug which the source is Unknown that make the AppCard to fill his parent when clicking on app icon SOMETIMES.
            // Since the St.Bin take the size of the AppCard the bug is invisible...
            children: [new St.Bin({ child: this.categorizedAppCard })]
        });
        this.backgroundContainer.add_child(this.backgroundStackLayout);

        this.windowFocused = null;

        this.focusEventId = global.display.connect(
            'notify::focus-window',
            () => {
                let windowFocused = global.display.focus_window;
                if (!this.windows.includes(windowFocused)) {
                    return;
                }

                /*
           If the current superWorkspace focused window actor is inaccessible it's mean that this notify is the was automatically made by gnome-shell to try to focus previous window
           We want to prevent this in order to handle it ourselves to select the next one instead of the previous.
          */
                if (
                    this.windowFocused &&
              !this.windowFocused.get_compositor_private()
                ) {
                    return;
                }

                if (windowFocused.is_attached_dialog()) {
                    windowFocused = windowFocused.get_transient_for();
                }
                this.onFocus(windowFocused);
            }
        );

        this.loadedSignalId = Me.connect(
            'extension-loaded',
            this.handleExtensionLoaded.bind(this)
        );
        Main.layoutManager._backgroundGroup.add_child(this.backgroundContainer);
        Main.layoutManager.uiGroup.add_child(this.frontendContainer);
        this.updateUI();
    }

    destroy() {
        if (this.frontendContainer) this.frontendContainer.destroy();
        if (this.backgroundContainer) this.backgroundContainer.destroy();
        global.display.disconnect(this.focusEventId);
        global.display.disconnect(this.workAreaChangedId);
        Me.disconnect(this.loadedSignalId);
        this.tilingLayout.onDestroy();
        this.destroyed = true;
    }

    addWindow(window) {
        if (this.windows.indexOf(window) >= 0) return;

        window.superWorkspace = this;
        window.connect('focus', () => {
        });
        WindowUtils.updateTitleBarVisibility(window);
        const oldWindows = [...this.windows];
        this.windows.push(window);
        /*  // Focusing window if the window comes from a drag and drop
    // or if there's no focused window
    if (window.grabbed || !this.windowFocused) {
    } */

        this.onFocus(window);

        this.emitWindowsChangedDebounced(this.windows, oldWindows);
    }

    removeWindow(window) {
        let windowIndex = this.windows.indexOf(window);
        if (windowIndex === -1) return;

        const oldWindows = [...this.windows];

        this.windows.splice(windowIndex, 1);
        // If there's no more focused window on this workspace focus the last one
        if (window === this.windowFocused) {
            this.focusLastWindow();
        }
        this.emitWindowsChangedDebounced(this.windows, oldWindows);
    }

    swapWindows(firstWindow, secondWindow) {
        const firstIndex = this.windows.indexOf(firstWindow);
        const secondIndex = this.windows.indexOf(secondWindow);
        const oldWindows = [...this.windows];
        this.windows[firstIndex] = secondWindow;
        this.windows[secondIndex] = firstWindow;
        this.emitWindowsChanged(this.windows, oldWindows);
    }

    focusNext() {
        let windowFocusIndex = this.windows.indexOf(this.windowFocused);
        if (windowFocusIndex === this.windows.length - 1) {
            return;
        }
        this.windows[windowFocusIndex + 1].activate(global.get_current_time());
    }

    focusPrevious() {
        let windowFocusIndex = this.windows.indexOf(this.windowFocused);
        if (windowFocusIndex === 0) {
            return;
        }
        this.windows[windowFocusIndex - 1].activate(global.get_current_time());
    }

    onFocus(windowFocused) {
        if (windowFocused === this.windowFocused) {
            return;
        }
        const oldFocusedWindow = this.windowFocused;
        this.windowFocused = windowFocused;
        this.indexFocused = this.windows.indexOf(this.windowFocused);
        this.emit(
            'window-focused-changed',
            this.windowFocused,
            oldFocusedWindow
        );
    }

    nextTiling(direction) {
        this.tilingLayout.onDestroy();
        const Layout = global.tilingManager.getNextLayout(
            this.tilingLayout,
            direction
        );
        this.tilingLayout = new Layout(this);
        Me.stateManager.setState(
            `${this.categoryKey}_${this.monitor.index}`,
            this.tilingLayout.constructor.key
        );

        global.superWorkspaceManager.tilingIcon.gicon = this.tilingLayout.icon;
        this.tilingLayout.onTile();
    }

    updateUI() {
        this.frontendContainer.visible = this.uiVisible;
        this.backgroundContainer.visible = this.uiVisible;
    }

    revealBackground() {
      if (!this.bgShow) {
        this.bgShown = true;
        this.windows.forEach(window => {
          window.minimize();
        });

        global.stage.set_key_focus(this.categorizedAppCard);
        this.backgroundSignals = [];
        let signalId = global.stage.connect('notify::key-focus', () => {
          let focus = global.stage.get_key_focus();
          if (focus !== this.categorizedAppCard) {
            this.unRevealBackground();
          }
        });
        this.backgroundSignals.push({from: global.stage, id: signalId});

        /*signalId = this.categorizedAppCard.connect(
            'clicked', () => {
              if (this.bgShown) {
                this.unRevealBackground();
                this.bgShow = false;
              }
            }
        );
        this.backgroundSignals.push({
          from: this.categorizedAppCard,
          id: signalId
        });*/
      }
    }

    unRevealBackground() {
      if (this.bgShow) {
        this.bgShown = false;
        this.windows.forEach(window => {
          window.unminimize();
        });
        this.backgroundSignals.forEach(signal => {
          signal.from.disconnect(signal.id);
        });
        this.backgroundSignals = [];
      }
    }

    emitWindowsChanged(newWindows, oldWindows, debouncedArgs) {
    // In case of direct call check if it has _debouncedArgs
        if (debouncedArgs) {
            // Get first debounced oldWindows
            const firstOldWindows = debouncedArgs[0][1];
            // And compare it with the new newWindows
            if (
                newWindows.length === firstOldWindows.length &&
          newWindows.every((window, i) => firstOldWindows[i] === window)
            ) {
                // If it's the same, the changes have compensated themselves
                // So in the end nothing happened:

                return;
            }
            oldWindows = firstOldWindows;
        }

        if (!this.destroyed) {
            // Make it async to prevent concurrent debounce calls
            if (debouncedArgs) {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this.emit('windows-changed', newWindows, oldWindows);
                });
            } else {
                this.emit('windows-changed', newWindows, oldWindows);
            }
        }
    }

    isDisplayed() {
        if (this.monitor.index !== Main.layoutManager.primaryIndex) {
            return true;
        } else {
            return (
                this === this.superWorkspaceManager.getActiveSuperWorkspace()
            );
        }
    }

    focusLastWindow() {
        if (this.windows.length) {
            let lastWindow =
          this.windows[this.indexFocused] || this.windows.slice(-1)[0];

            this.onFocus(lastWindow);
        } else {
            this.onFocus(null);
        }
    }

    handleExtensionLoaded() {
        this.windows.map(metaWindow => metaWindow.get_compositor_private()).
        filter(window => window).
        forEach(window => {
            this.isDisplayed() ? window.show() : window.hide();
        });

        this.focusLastWindow();
    }
};
Signals.addSignalMethods(SuperWorkspace.prototype);
