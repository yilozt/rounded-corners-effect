// imports.gi
import * as GObject from 'gi://GObject'
import * as Meta from 'gi://Meta'
import * as Shell from 'gi://Shell'

// local modules
import { loadShader } from '../utils/io.js'
import * as types from '../utils/types.js'

// types
import * as Clutter from 'gi://Clutter'
import { shell_version } from '../utils/ui.js'

// --------------------------------------------------------------- [end imports]

// Load fragment shader of rounded corners effect.
const { declarations, code } = loadShader (
  import.meta.url,
  'shader/rounded_corners.frag'
)

/** Location of uniform variants of rounded corners effect */
class Uniforms {
  bounds = 0
  clip_radius = 0
  exponent = 0
  inner_bounds = 0
  inner_clip_radius = 0
  pixel_step = 0
  border_width = 0
  border_color = 0
}

export const RoundedCornersEffect = GObject.registerClass (
  {},
  class Effect extends Shell.GLSLEffect {
    /**
     * Location of uniforms variants in shader, Cache those location
     * when shader has been setup in `vfunc_build_pipeline()`, sot that
     * avoid to yse `this.get_uniform_location()` to query too much times.
     */
    static uniforms: Uniforms = new Uniforms ()

    /**
     * Collect location of uniform variants, only used when added shader
     * snippet to effect.
     */
    private _init_uniforms () {
      Effect.uniforms = {
        bounds: 0,
        clip_radius: 0,
        exponent: 0,
        inner_bounds: 0,
        inner_clip_radius: 0,
        pixel_step: 0,
        border_width: 0,
        border_color: 0,
      }
      Object.keys (Effect.uniforms).forEach ((k) => {
        if (!Effect.uniforms || Effect.uniforms[k as keyof Uniforms] !== 0)
          return
        Effect.uniforms[k as keyof Uniforms] = this.get_uniform_location (k)
      })
    }

    vfunc_build_pipeline (): void {
      const type = Shell.SnippetHook.FRAGMENT
      this.add_glsl_snippet (type, declarations, code, false)
    }

    vfunc_paint_target (node: Clutter.PaintNode, ctx: Clutter.PaintContext) {
      // Reset to default blend string.
      this.get_pipeline ()?.set_blend (
        'RGBA = ADD(SRC_COLOR, DST_COLOR*(1-SRC_COLOR[A]))'
      )
      super.vfunc_paint_target (node, ctx)
    }

    /**
     * Used to update uniform variants of shader
     * @param corners_cfg   - Rounded corners settings of window
     * @param bounds_cfg - Outer bounds of rounded corners
     */
    update_uniforms (
      scale_factor: number,
      corners_cfg: types.RoundedCornersCfg,
      outer_bounds: types.Bounds,
      border: {
        width: number
        color: [number, number, number, number]
      } = { width: 0, color: [0, 0, 0, 0] },
      pixel_step?: [number, number]
    ) {
      const border_width = border.width * scale_factor
      const border_color = border.color

      const outer_radius = corners_cfg.border_radius * scale_factor
      const { padding, smoothing } = corners_cfg

      const bounds = [
        outer_bounds.x1 + padding.left * scale_factor,
        outer_bounds.y1 + padding.top * scale_factor,
        outer_bounds.x2 - padding.right * scale_factor,
        outer_bounds.y2 - padding.bottom * scale_factor,
      ]

      const inner_bounds = [
        bounds[0] + border_width,
        bounds[1] + border_width,
        bounds[2] - border_width,
        bounds[3] - border_width,
      ]

      let inner_radius = outer_radius - border_width
      if (inner_radius < 0.001) {
        inner_radius = 0.0
      }

      if (!pixel_step) {
        const actor = this.actor
        pixel_step = [1 / actor.get_width (), 1 / actor.get_height ()]

        // For wayland clients in Gnome 43.1, we can't get correct buffer size
        // from Meta.WindowActor to calculate pixel step, but its first child
        // offers correct one.
        if (
          shell_version () >= 43.1 &&
          actor instanceof Meta.WindowActor &&
          actor.first_child?.first_child
        ) {
          const { width, height } = actor.first_child.first_child
          pixel_step = [1 / (width * scale_factor), 1 / (height * scale_factor)]
        }
      }

      // Setup with squircle shape
      let exponent = smoothing * 10.0 + 2.0
      let radius = outer_radius * 0.5 * exponent
      const max_radius = Math.min (bounds[3] - bounds[0], bounds[4] - bounds[1])
      if (radius > max_radius) {
        exponent *= max_radius / radius
        radius = max_radius
      }
      inner_radius *= radius / outer_radius

      this._init_uniforms ()

      const location = Effect.uniforms
      this.set_uniform_float (location.bounds, 4, bounds)
      this.set_uniform_float (location.inner_bounds, 4, inner_bounds)
      this.set_uniform_float (location.pixel_step, 2, pixel_step)
      this.set_uniform_float (location.border_width, 1, [border_width])
      this.set_uniform_float (location.exponent, 1, [exponent])
      this.set_uniform_float (location.clip_radius, 1, [radius])
      this.set_uniform_float (location.border_color, 4, border_color)
      this.set_uniform_float (location.inner_clip_radius, 1, [inner_radius])
      this.queue_repaint ()
    }
  }
)
