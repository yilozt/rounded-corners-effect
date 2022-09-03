// imports.gi
import * as GObject           from '@gi/GObject'
import * as Gdk               from '@gi/Gdk'
import * as Gio               from '@gi/Gio'

// local modules
import { settings }           from '@me/utils/settings'
import { SchemasKeys }        from '@me/utils/settings'
import { connections }        from '@me/utils/connections'
import { list_children }      from '@me/utils/prefs'
import { _log }               from '@me/utils/log'
import { RoundedCornersItem } from '@me/preferences/widgets/rounded_corners_item'
import { EditShadowWindow }   from '@me/preferences/widgets/edit_shadow_window'
import { ResetDialog }        from '@me/preferences/widgets/reset_dialog'

// types
import * as Gtk               from '@gi/Gtk'
import { Me }                 from '@global'

// --------------------------------------------------------------- [end imports]

export const General = GObject.registerClass (
    {
        Template: `file://${Me.path}/preferences/pages/general.ui`,
        GTypeName: 'RoundedWindowCornersPrefsGeneral',

        // Widgets export from template ui
        InternalChildren: [
            'global_settings_preferences_group',
            'enable_log_switch',
            'skip_libadwaita_app_switch',
            'skip_libhandy_app_switch',
            'border_width_ajustment',
            'border_color_button',
            'edit_shadow_row',
            'applications_group',
            'reset_preferences_btn',
        ],
    },
    class extends Gtk.Box {
        // Those properties come from 'InternalChildren'
        private _global_settings_preferences_group !: Gtk.ListBox
        private _enable_log_switch                 !: Gtk.Switch
        private _skip_libhandy_app_switch          !: Gtk.Switch
        private _skip_libadwaita_app_switch        !: Gtk.Switch
        private _border_width_ajustment            !: Gtk.Adjustment
        private _border_color_button               !: Gtk.ColorButton
        private _edit_shadow_row                   !: Gtk.ListBoxRow
        private _applications_group                !: Gtk.ListBox
        private _reset_preferences_btn             !: Gtk.Button

        private config_items                       !: _Items

        _init () {
            super._init ()

            this.config_items = new RoundedCornersItem ()

            this.build_ui ()

            connections
                .get ()
                .connect (
                    settings ().g_settings,
                    'changed',
                    (settings: Gio.Settings, key: string) =>
                        this._on_settings_changed (key)
                )

            settings ().bind (
                'debug-mode',
                this._enable_log_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT
            )
            settings ().bind (
                'skip-libadwaita-app',
                this._skip_libadwaita_app_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT
            )
            settings ().bind (
                'skip-libhandy-app',
                this._skip_libhandy_app_switch,
                'active',
                Gio.SettingsBindFlags.DEFAULT
            )
            settings ().bind (
                'border-width',
                this._border_width_ajustment,
                'value',
                Gio.SettingsBindFlags.DEFAULT
            )

            const color = settings ().border_color
            this._border_color_button.rgba = new Gdk.RGBA ({
                red: color[0],
                green: color[1],
                blue: color[2],
                alpha: color[3],
            })

            connections
                .get ()
                .connect (this._border_color_button, 'color-set', (source) => {
                    const color = source.get_rgba ()
                    settings ().border_color = [
                        color.red,
                        color.green,
                        color.blue,
                        color.alpha,
                    ]
                })

            // Handler active event for BoxList
            connections
                .get ()
                .connect (
                    this._global_settings_preferences_group,
                    'row-activated',
                    (box: Gtk.ListBox, row: Gtk.ListBoxRow) => {
                        if (row == this.config_items._paddings_row) {
                            this.config_items.update_revealer ()
                        }
                    }
                )

            connections
                .get ()
                .connect (
                    this._applications_group,
                    'row-activated',
                    (box: Gtk.ListBox, row: Gtk.ListBoxRow) => {
                        if (row === this._edit_shadow_row) {
                            this._show_edit_shadow_window_cb ()
                        }
                    }
                )

            connections
                .get ()
                .connect (this._reset_preferences_btn, 'clicked', () => {
                    new ResetDialog ().show ()
                })
        }

        vfunc_root (): void {
            super.vfunc_root ()
            const win = this.root as Gtk.Window

            // Disconnect all signal when close prefs
            win.connect ('close-request', () => {
                _log ('Disconnect Signals')
                connections.get ().disconnect_all ()
                connections.del ()
            })
        }

        private build_ui () {
            list_children (this.config_items).forEach ((i) => {
                this.config_items.remove (i)
                this._global_settings_preferences_group.append (i)
            })
            // Bind Variants
            this.config_items.cfg = settings ().global_rounded_corner_settings
            this.config_items.watch ((cfg) => {
                settings ().global_rounded_corner_settings = cfg
            })
        }

        // ---------------------------------------------------- [signal handler]

        /** Called when click 'Window Shadow' action row */
        _show_edit_shadow_window_cb () {
            const root = this.root as Gtk.Window
            const win = new EditShadowWindow ()
            win.application = root.application
            win.present ()
            root.hide ()
            win.connect ('close-request', () => {
                root.show ()
                win.destroy ()
            })
        }

        /** Update UI when settings changed  */
        private _on_settings_changed (key: string) {
            switch (key as SchemasKeys) {
            case 'border-color':
                {
                    const color = settings ().border_color
                    this._border_color_button.rgba = new Gdk.RGBA ({
                        red: color[0],
                        green: color[1],
                        blue: color[2],
                        alpha: color[3],
                    })
                }
                break
            case 'border-width':
                this._border_width_ajustment.value = settings ().border_width
                break
            case 'global-rounded-corner-settings':
                this.config_items.cfg =
                        settings ().global_rounded_corner_settings
                break
            default:
            }
        }
    }
)

type _Items = InstanceType<typeof RoundedCornersItem>
