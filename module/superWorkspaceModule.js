const { Clutter, St, Meta, Shell } = imports.gi;
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Tweener = imports.ui.tweener;

const { AppsManager } = Me.imports.superWorkspace.appsManager;
const {
    SuperWorkspaceManager,
} = Me.imports.superWorkspace.superWorkspaceManager;
const { ShellVersionMatch } = Me.imports.utils.compatibility;

const { WINDOW_ANIMATION_TIME } = imports.ui.windowManager;
/* exported SuperWorkspaceModule */
var SuperWorkspaceModule = class SuperWorkspaceModule {
    constructor() {
        this.workspaceManager = global.workspace_manager;
        this.enabled = false;
        this.signals = [];
        Main.wm.getWindowClone = function(metaWindow) {
            let windowActor = metaWindow.get_compositor_private();
            let actorClone = new Clutter.Clone({
                source: windowActor,
            });

            let constraint = new Clutter.BindConstraint({
                source: windowActor,
                coordinate: Clutter.BindCoordinate.ALL,
            });

            actorClone.add_constraint(constraint);
            return actorClone;
        };
    }

    enable() {
        global.superWorkspaceManager = new SuperWorkspaceManager(
            AppsManager.groupAppsByCategory(AppsManager.getApps()),
        );
        this.currentSuperWorkspace = global.superWorkspaceManager.getActiveSuperWorkspace();

        this.signals.push({
            from: global.display,
            id: global.display.connect('in-fullscreen-changed', () => {
                Main.layoutManager.monitors.forEach(monitor => {
                    let superWorkspace;
                    if (Main.layoutManager.primaryIndex === monitor.index) {
                        superWorkspace = global.superWorkspaceManager.getActiveSuperWorkspace();
                    } else {
                        superWorkspace = global.superWorkspaceManager.getSuperWorkspacesOfMonitorIndex(
                            monitor.index,
                        )[0];
                    }
                    superWorkspace.updateUI();
                });
            }),
        });

        this.signals.push({
            from: this.workspaceManager,
            id: this.workspaceManager.connect(
                'active-workspace-changed',
                () => {
                    let newSuperWorkspace = global.superWorkspaceManager.getActiveSuperWorkspace();
                    this.currentSuperWorkspace.uiVisible = false;
                    this.currentSuperWorkspace.updateUI();
                    this.currentSuperWorkspace = newSuperWorkspace;
                    this.currentSuperWorkspace.uiVisible = true;
                    this.currentSuperWorkspace.updateUI();
                    global.superWorkspaceManager.tilingIcon.gicon =
                this.currentSuperWorkspace.tilingLayout.icon;
                },
            ),
        });

        this.signals.push({
            from: global.display,
            id: global.display.connect('window-created', (_, metaWindow) => {
                global.superWorkspaceManager.onNewWindow(metaWindow);
            }),
        });

        this._listenToDispatchWindow();

        this.signals.push({
            from: Shell.AppSystem.get_default(),
            id: Shell.AppSystem.get_default().connect(
                'installed-changed',
                () => {
                    this.dispatchApps();
                },
            ),
        });

        this.signalMonitorId = Main.layoutManager.connect(
            'monitors-changed',
            () => {
                global.superWorkspaceManager.destroy();
                global.superWorkspaceManager = new SuperWorkspaceManager(
                    AppsManager.groupAppsByCategory(AppsManager.getApps()),
                );
                this.currentSuperWorkspace = global.superWorkspaceManager.getActiveSuperWorkspace();
            },
        );
    }

    disable() {
        this.signals.forEach(signal => {
            signal.from.disconnect(signal.id);
        });
        this.signals = [];
        global.superWorkspaceManager.destroy();
        delete global.superWorkspaceManager;

        Main.layoutManager.disconnect(this.signalMonitorId);
    }

    /*
   ** Connect to windows events and redispatch windows in workspacesEnhancer
   */
    _listenToDispatchWindow() {
        for (let w = 0; w < this.workspaceManager.n_workspaces; w++) {
            let workspace = this.workspaceManager.get_workspace_by_index(w);
            this.listenWorkspaceEventToDispatch(workspace);
        }

        this.signals.push({
            from: this.workspaceManager,
            id: this.workspaceManager.connect(
                'workspace-added',
                (_, workspace) => {
                    this.listenWorkspaceEventToDispatch(workspace);
                },
            ),
        });

        this.signals.push({
            from: global.display,
            id: global.display.connect(
                'window-entered-monitor',
                (display, monitorIndex, window) => {
                    //Ignore unHandle window and window on primary screens
                    global.superWorkspaceManager.windowEnteredMonitor(
                        window,
                        monitorIndex,
                    );
                },
            ),
        });

        this.signals.push({
            from: global.display,
            id: global.display.connect(
                'window-left-monitor',
                (display, monitorIndex, window) => {
                    /*
            //Ignore unHandle window and window on primary screens
            global.superWorkspaceManager.windowLeftMonitor(
                window,
                monitorIndex
            ); */
                },
            ),
        });
    }

    listenWorkspaceEventToDispatch(workspace) {
        this.signals.push({
            from: workspace,
            id: workspace.connect('window-added', (workspace, window) => {
                global.superWorkspaceManager.windowEnteredWorkspace(
                    window,
                    workspace,
                );
            }),
        });

        // noinspection JSUnusedLocalSymbols
        this.signals.push({
            from: workspace,
            id: workspace.connect('window-removed', (workspace, window) => {
                /* global.superWorkspaceManager.windowLeftWorkspace(
            window,
            workspace
        ); */
            }),
        });
    }
};
