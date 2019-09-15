const { Clutter, GObject, St } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();
/* exported MatButton */
var MatButton = GObject.registerClass(
    {
        Signals: {
            clicked: {
                param_types: [GObject.TYPE_INT]
            }
        }
    },
    class MatButton extends St.Widget {
        _init(params = {}) {
            this.actorContainer = new St.Bin(params);
            super._init({
                reactive: true
            });

            this.add_child(this.actorContainer);
            this.add_style_class_name('mat-button');

            this.connect('event', (actor, event) => {
                let eventType = event.type();
                if (
                    [
                        Clutter.EventType.BUTTON_PRESS,
                        Clutter.EventType.TOUCH_BEGIN
                    ].indexOf(eventType) > -1
                ) {
                    this.pressed = true;
                } else if (
                    [
                        Clutter.EventType.BUTTON_RELEASE,
                        Clutter.EventType.TOUCH_END
                    ].indexOf(eventType) > -1
                ) {
                    if (this.pressed) {
                        this.emit('clicked', event.get_button());
                        this.pressed = false;
                    }
                } else if (eventType === Clutter.EventType.LEAVE) {
                    this.pressed = false;
                }
            });
        }

        /**
       * Just the child width but taking into account the slided out part
       */
        vfunc_get_preferred_width(forHeight) {
            return this.actorContainer.vfunc_get_preferred_width(forHeight);
        }

        /**
       * Just the child height but taking into account the slided out part
       */
        vfunc_get_preferred_height(forWidth) {
            return this.actorContainer.vfunc_get_preferred_height(forWidth);
        }

        set_child(child) {
            this.actorContainer.set_child(child);
        }
    }
);
