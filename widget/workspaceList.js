const { Clutter, GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Me = ExtensionUtils.getCurrentExtension();
const { MatButton } = Me.imports.widget.button;
const { WorkspaceCategories } = Me.imports.superWorkspace.workspaceCategories;
const { ShellVersionMatch } = Me.imports.utils.compatibility;

var DropPlaceholder = GObject.registerClass(
    {
        Signals: {
            'drag-dropped': {},
            'drag-over': {}
        }
    },
    class DropPlaceholder extends St.Widget {
        _init(targetClass) {
            super._init();
            this.targetClass = targetClass;
            this.set_style('background:rgba(255,255,255,0.1)');
            this._delegate = this;
        }

        handleDragOver(source) {
            if (!(source instanceof this.targetClass)) {
                return DND.DragMotionResult.NO_DROP;
            }
            this.emit('drag-over');
            return DND.DragMotionResult.MOVE_DROP;
        }

        acceptDrop(source) {
            if (!(source instanceof this.targetClass)) {
                return false;
            }
            this.emit('drag-dropped');
            return true;
        }

        resize(rect) {
            this.width = rect.width;
            this.height = rect.height;
        }
    }
);

/* exported WorkspaceList */
var WorkspaceList = GObject.registerClass(
    class WorkspaceList extends St.Widget {
        _init(superWorkspaceManager) {
            super._init({
                clip_to_allocation: true
            });

            this.superWorkspaceManager = superWorkspaceManager;

            this.buttonList = new St.BoxLayout({ });

            this.connect('destroy', this._onDestroy.bind(this));

            this.add_child(this.buttonList);
            this.dropPlaceholder = new DropPlaceholder(WorkspaceButton);
            this.dropPlaceholder.connect('drag-dropped', () => {
                this.tempDragData.workspaceButton.reparent(this.buttonList);
            });
            this.dropPlaceholder.connect('drag-over', () => {
                this.tempDragData.draggedOverByChild = true;
            });

            for (let categoryKey of this.superWorkspaceManager.categoryKeyOrderedList) {
                let category = WorkspaceCategories[categoryKey];
                let workspaceButton = new WorkspaceButton(
                    this.superWorkspaceManager,
                    categoryKey,
                    category
                );
                workspaceButton._draggable.connect('drag-begin', () => {
                    let workspaceButtonIndex = this.superWorkspaceManager.categoryKeyOrderedList.indexOf(
                        workspaceButton.categoryKey
                    );
                    this.tempDragData = {
                        workspaceButton: workspaceButton,
                        initialIndex: workspaceButtonIndex
                    };
                    this.dropPlaceholder.resize(workspaceButton);
                    this.buttonList.add_child(this.dropPlaceholder);
                    this.buttonList.set_child_at_index(
                        this.dropPlaceholder,
                        workspaceButtonIndex
                    );
                });

                workspaceButton._draggable.connect('drag-cancelled', () => {
                    delete this.tempDragData.draggedOver;
                    delete this.tempDragData.draggedBefore;
                    this.buttonList.set_child_at_index(
                        this.dropPlaceholder,
                        this.tempDragData.initialIndex
                    );
                });

                workspaceButton._draggable.connect(
                    'drag-end',
                    this._onDragEnd.bind(this)
                );

                workspaceButton.connect('drag-over', (_, before) => {
                    this.tempDragData.draggedOverByChild = true;
                    this._onDragOver(workspaceButton, before);
                    //this.buttonList.set_child_before(this.dropPlaceholder, this.tempDragData.draggedBefore ? index : index + 1);
                });

                workspaceButton.connect('drag-dropped', () => {
                    this.tempDragData.workspaceButton.reparent(this.buttonList);
                });
                this.buttonList.add_child(workspaceButton);
            }

            this.workspaceSignal = global.workspace_manager.connect(
                'active-workspace-changed',
                () => {
                    this.activeButtonForIndex(
                        this.superWorkspaceManager.categoryKeyOrderedList[
                      global.workspace_manager.get_active_workspace_index()
                        ]
                    );
                }
            );

            this.activeButtonForIndex(
                this.superWorkspaceManager.categoryKeyOrderedList[
                global.workspace_manager.get_active_workspace_index()
                ]
            );
        }

        handleDragOver() {
            if (!this.tempDragData.draggedOverByChild) {
                let workspaceButton =
              this.items[this.items.length - 1] ===
              this.tempDragData.workspaceButton
                  ? this.items[this.items.length - 2]
                  : this.items[this.items.length - 1];
                this._onDragOver(workspaceButton, false);
            } else {
                this.tempDragData.draggedOverByChild = false;
            }

            return DND.DragMotionResult.MOVE_DROP;
        }

        _onDragEnd() {
            this.buttonList.remove_child(this.dropPlaceholder);
            if (this.tempDragData.draggedOver) {
                let toIndex = this.superWorkspaceManager.categoryKeyOrderedList.indexOf(
                    this.tempDragData.draggedOver.categoryKey
                );
                if (this.tempDragData.draggedBefore) {
                    this.buttonList.set_child_at_index(
                        this.tempDragData.workspaceButton,
                        toIndex -
                (this.tempDragData.initialIndex < toIndex ? 1 : 0)
                    );

                    this.superWorkspaceManager.setWorkspaceBefore(
                        this.tempDragData.workspaceButton.categoryKey,
                        this.tempDragData.draggedOver.categoryKey
                    );
                } else {
                    this.buttonList.set_child_at_index(
                        this.tempDragData.workspaceButton,
                        toIndex +
                (this.tempDragData.initialIndex < toIndex ? 0 : 1)
                    );
                    this.superWorkspaceManager.setWorkspaceAfter(
                        this.tempDragData.workspaceButton.categoryKey,
                        this.tempDragData.draggedOver.categoryKey
                    );
                }
                //this.buttonList.set_child_at_index(this.tempDragData.item, this.tempDragData.draggedBefore ? index : index + 1);
            } else {
                this.buttonList.set_child_at_index(
                    this.tempDragData.workspaceButton,
                    this.tempDragData.initialIndex
                );
            }
            delete this.tempDragData;
        }

        _onDragOver(workspaceButton, before) {
            this.tempDragData.draggedOver = workspaceButton;
            this.tempDragData.draggedBefore = before;
            this.dropPlaceholder.resize(this.tempDragData.workspaceButton);
            let dropPlaceholderIndex = this.buttonList.get_children().
            indexOf(this.dropPlaceholder);
            let workspaceButtonIndex = this.buttonList.get_children().
            indexOf(workspaceButton);
            let toIndex =
            dropPlaceholderIndex < workspaceButtonIndex
                ? workspaceButtonIndex - 1
                : workspaceButtonIndex;
            if (this.tempDragData.draggedBefore) {
                this.buttonList.set_child_at_index(
                    this.dropPlaceholder,
                    toIndex
                );
            } else {
                this.buttonList.set_child_at_index(
                    this.dropPlaceholder,
                    toIndex + 1
                );
            }
        }

        activeButtonForIndex(categoryKey) {
            if (this.buttonActive) {
                if (
                    this.buttonActive.actorContainer.has_style_class_name(
                        'active'
                    )
                ) {
                    this.buttonActive.actorContainer.remove_style_class_name(
                        'active'
                    );
                }
            }
            this.buttonActive = this.getButtonFromCategoryKey(categoryKey);
            this.buttonActive.actorContainer.add_style_class_name('active');
            let scaleFactor = St.ThemeContext.get_for_stage(
                global.stage).scale_factor;
        }

        getButtonFromCategoryKey(categoryKey) {
            return this.buttonList.get_children().find(workspaceButton => {
                return workspaceButton.categoryKey === categoryKey;
            });
        }

        _onDestroy() {
            global.workspace_manager.disconnect(this.workspaceSignal);
        }
    }
);

var WorkspaceButton = GObject.registerClass(
    {
        Signals: {
            'drag-dropped': {},
            'drag-over': {
                param_types: [GObject.TYPE_BOOLEAN]
            }
        }
    },
    class InnerWorkspaceButton extends MatButton {
        _init(superWorkspaceManager, categoryKey, category) {
            let icon = new St.Icon({
                gicon: category.icon,
                style_class: 'workspace-icon'
            });
            super._init({
                child: icon,
                style_class: 'workspace-button'
            });
            this._delegate = this;

            this.superWorkspaceManager = superWorkspaceManager;
            this.categoryKey = categoryKey;
            this.connect('clicked', () => {
                global.workspace_manager.get_workspace_by_index(
                    this.superWorkspaceManager.categoryKeyOrderedList.indexOf(
                        this.categoryKey
                    )
                ).activate(global.get_current_time());
            });

            this.mouseData = {
                pressed: false,
                dragged: false,
                originalCoords: null,
                originalSequence: null
            };

            this.connect('event', (actor, event) => {
                let eventType = event.type();
                if (
                    [
                        Clutter.EventType.BUTTON_PRESS,
                        Clutter.EventType.TOUCH_BEGIN
                    ].indexOf(eventType) > -1
                ) {
                    this.mouseData.pressed = true;
                    this.mouseData.originalCoords = event.get_coords();
                    this.mouseData.originalSequence = event.get_event_sequence();
                } else if (
                    [
                        Clutter.EventType.MOTION,
                        Clutter.EventType.TOUCH_UPDATE
                    ].indexOf(eventType) > -1
                ) {
                    if (this.mouseData.pressed && !this.mouseData.dragged) {
                        let coords = event.get_coords();
                        let scaleFactor = St.ThemeContext.get_for_stage(
                            global.stage
                        ).scale_factor;
                        if (
                            Math.abs(
                                this.mouseData.originalCoords[0] - coords[0]
                            ) >
                  48 * scaleFactor &&
                  !this.mouseData.dragged
                        ) {
                            this.mouseData.dragged = true;
                            this._draggable.startDrag(
                                this.mouseData.originalCoords[0],
                                this.mouseData.originalCoords[1],
                                global.get_current_time(),
                                this.mouseData.originalSequence
                            );
                        }
                    }
                } else if (
                    [
                        Clutter.EventType.BUTTON_RELEASE,
                        Clutter.EventType.TOUCH_END
                    ].indexOf(eventType) > -1
                ) {
                    this.mouseData.pressed = false;
                    this.mouseData.dragged = false;
                } else if (eventType === Clutter.EventType.LEAVE) {
                    if (this.mouseData.pressed && !this.mouseData.dragged) {
                        this.mouseData.dragged = true;
                        this._draggable.startDrag(
                            this.mouseData.originalCoords[0],
                            this.mouseData.originalCoords[1],
                            global.get_current_time(),
                            this.mouseData.originalSequence
                        );
                    }
                }
            });

            this.initDrag();
        }

        initDrag() {
            this._draggable = DND.makeDraggable(this, {
                restoreOnSuccess: false,
                manualMode: true
            });

            this._draggable.connect('drag-end', () => {
                this.mouseData.pressed = false;
                this.mouseData.dragged = false;
            });
        }

        handleDragOver(source, actor, x, y) {
            if (!(source instanceof WorkspaceButton)) {
                return DND.DragMotionResult.NO_DROP;
            }
            this.emit('drag-over', y < this.height / 2);
            return DND.DragMotionResult.MOVE_DROP;
        }

        acceptDrop(source) {
            if (!(source instanceof WorkspaceButton)) {
                return false;
            }
            this.emit('drag-dropped');
            return true;
        }
    }
);
