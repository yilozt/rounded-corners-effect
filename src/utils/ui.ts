// imports.gi
import * as Meta           from '@gi/Meta'

// gnome modules
import { openPrefs }       from '@imports/misc/extensionUtils'

// local modules
import { load }            from '@me/utils/io'
import { _log, _logError } from '@me/utils/log'
import { constants }       from '@me/utils/constants'

// types
import { global }          from '@global'
import * as types          from '@me/utils/types'
import { Actor }           from '@gi/Clutter'

// --------------------------------------------------------------- [end imports]

export const computeWindowContentsOffset = (
    meta_window: Meta.Window
): [number, number, number, number] => {
    const bufferRect = meta_window.get_buffer_rect ()
    const frameRect = meta_window.get_frame_rect ()
    return [
        frameRect.x - bufferRect.x,
        frameRect.y - bufferRect.y,
        frameRect.width - bufferRect.width,
        frameRect.height - bufferRect.height,
    ]
}

export enum AppType {
    LibHandy,
    LibAdwaita,
    Other,
}

/**
 * Query application type for a Meta.Window, used to skip add rounded
 * corners effect to some window.
 * @returns Application Type: LibHandy | LibAdwaita | Other
 */
export const getAppType = (meta_window: Meta.Window) => {
    try {
        // May cause Permission error
        const contents = load (`/proc/${meta_window.get_pid ()}/maps`)
        if (contents.match (/libhandy-1.so/)) {
            return AppType.LibHandy
        } else if (contents.match (/libadwaita-1.so/)) {
            return AppType.LibAdwaita
        } else {
            return AppType.Other
        }
    } catch (e) {
        _logError (e as Error)
        return AppType.Other
    }
}

/**
 * Get scale factor of a Meta.window, if win is undefined, return
 * scale factor of current monitor
 */
export const WindowScaleFactor = (win?: Meta.Window) => {
    const monitor = win
        ? win.get_monitor ()
        : global.display.get_current_monitor ()
    return global.display.get_monitor_scale (monitor)
}

type BackgroundMenu = {
    _getMenuItems: () => { label?: { text: string } }[]
    addAction: (label: string, action: () => void) => void
    moveMenuItem(item: { label?: { text: string } }, index: number): void
}
type BackgroundExtra = {
    _backgroundMenu: BackgroundMenu
}

/**
 * Add Item into background menu, now we can open preferences page by right
 * click in background
 * @param menu - BackgroundMenu to add
 */
export const AddBackgroundMenuItem = (menu: BackgroundMenu) => {
    for (const item of menu._getMenuItems ()) {
        if (item.label?.text === constants.ITEM_LABEL) {
            return
        }
    }

    menu.addAction (constants.ITEM_LABEL, () => {
        try {
            openPrefs ()
        } catch (err) {
            openPrefs ()
        }
    })
}

/** Find all Background menu, then add a item for open preferences into menu */
export const SetupBackgroundMenu = () => {
    for (const _bg of global.window_group.first_child.get_children ()) {
        const menu = (_bg as typeof _bg & BackgroundExtra)._backgroundMenu
        AddBackgroundMenuItem (menu)
    }
}

export const RestoreBackgroundMenu = () => {
    const remove_menu_item = (menu: BackgroundMenu) => {
        const items = menu._getMenuItems ()

        for (const i of items) {
            if (i?.label?.text === constants.ITEM_LABEL) {
                (i as Actor).destroy ()
                break
            }
        }
    }

    for (const _bg of global.window_group.first_child.get_children ()) {
        const menu = (_bg as typeof _bg & BackgroundExtra)._backgroundMenu
        remove_menu_item (menu)
        _log ('Added Item of ' + menu + 'Removed')
    }
}

/** Choice Rounded Corners Settings for window  */
export const ChoiceRoundedCornersCfg = (
    global_cfg: types.RoundedCornersCfg,
    custom_cfg_list: {
        [wm_class_instance: string]: types.RoundedCornersCfg
    },
    win: Meta.Window
) => {
    const k = win.get_wm_class_instance ()
    if (k == null || !custom_cfg_list[k] || !custom_cfg_list[k].enabled) {
        return global_cfg
    }

    const custom_cfg = custom_cfg_list[k]
    // Need to skip border radius item from custom settings
    custom_cfg.border_radius = global_cfg.border_radius
    return custom_cfg
}

/**
 * Decide whether windows should have rounded corners when it has been
 * maximized & fullscreen according to RoundedCornersCfg
 */
export function ShouldHasRoundedCorners (
    win: Meta.Window,
    cfg: types.RoundedCornersCfg
): boolean {
    let should_has_rounded_corners = false

    const maximized = win.maximized_horizontally || win.maximized_vertically
    const fullscreen = win.fullscreen

    should_has_rounded_corners =
        (!maximized && !fullscreen) ||
        (maximized && cfg.keep_rounded_corners.maximized) ||
        (fullscreen && cfg.keep_rounded_corners.fullscreen)

    return should_has_rounded_corners
}
