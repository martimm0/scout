/**
 * A photograph is one frame, and one frame can be afforded anything.
 *
 * While the bee is flying Ultra draws sixty pictures a second and spends each
 * one's time carefully. Pressing P asks for a single picture to keep, and that
 * one can be drawn at full resolution with every shortcut switched off: the
 * shading sampled several times over, the lens at full size. It takes a few
 * frames' worth of time, once, under a flash.
 *
 * The camera (`takePhoto`) lives outside the scene and the pipeline lives
 * inside it, so they meet here: the pipeline leaves `take` while it is
 * mounted, and the camera calls it if it is there. `take` draws the still into
 * the canvas and hands back the function that puts the settings right again,
 * to be called once the picture has been copied out.
 */
export const still: { take: (() => () => void) | null } = { take: null };
