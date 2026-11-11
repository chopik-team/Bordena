const EDITABLE =
  "input,textarea,select,[contenteditable],.cm-editor,[data-no-pan],button,a"

/** No React updates on movement. Native capture keeps middle-button gestures out of card DnD. */
export function installBoardPan(surface: HTMLElement): () => void {
  let gesture:
    | {
        id: number
        x: number
        y: number
        left: number
        top: number
        vertical: HTMLElement
        selection: string
        snap: string
      }
    | undefined
  const end = () => {
    if (!gesture) return
    const old = gesture
    gesture = undefined
    document.documentElement.style.userSelect = old.selection
    surface.style.scrollSnapType = old.snap
    surface.removeAttribute("data-panning")
    if (surface.hasPointerCapture?.(old.id))
      surface.releasePointerCapture(old.id)
  }
  const safeTarget = (target: EventTarget | null) =>
    target instanceof Element && !target.closest(EDITABLE)
  const start = (e: PointerEvent) => {
    if (
      document.documentElement.dataset.panning === "off" ||
      e.button !== 1 ||
      (e.buttons & 1) !== 0 ||
      surface.dataset.boardDragging === "true" ||
      !safeTarget(e.target)
    )
      return
    e.preventDefault()
    e.stopPropagation()
    end()
    let vertical = surface
    for (
      let el = e.target as HTMLElement | null;
      el && el !== surface;
      el = el.parentElement
    ) {
      if (
        el.scrollHeight > el.clientHeight &&
        /auto|scroll/.test(getComputedStyle(el).overflowY)
      ) {
        vertical = el
        break
      }
    }
    gesture = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: surface.scrollLeft,
      top: vertical.scrollTop,
      vertical,
      selection: document.documentElement.style.userSelect,
      snap: surface.style.scrollSnapType,
    }
    document.documentElement.style.userSelect = "none"
    surface.style.scrollSnapType = "none"
    surface.setAttribute("data-panning", "true")
    try {
      surface.setPointerCapture(e.pointerId)
    } catch {
      /* Window listeners still finish a gesture when capture is unavailable. */
    }
  }
  const move = (e: PointerEvent) => {
    if (!gesture || gesture.id !== e.pointerId) return
    if (!(e.buttons & 4)) {
      end()
      return
    }
    e.preventDefault()
    surface.scrollLeft = gesture.left + gesture.x - e.clientX
    gesture.vertical.scrollTop = gesture.top + gesture.y - e.clientY
  }
  const up = (e: PointerEvent) => {
    if (gesture?.id === e.pointerId) end()
  }
  const mouse = (e: MouseEvent) => {
    if (e.button === 1 && safeTarget(e.target)) e.preventDefault()
  }
  const hidden = () => {
    if (document.hidden) end()
  }
  surface.addEventListener("pointerdown", start, true)
  surface.addEventListener("mousedown", mouse, true)
  surface.addEventListener("auxclick", mouse, true)
  surface.addEventListener("lostpointercapture", end)
  window.addEventListener("pointermove", move, { passive: false })
  window.addEventListener("pointerup", up)
  window.addEventListener("pointercancel", up)
  window.addEventListener("blur", end)
  document.addEventListener("visibilitychange", hidden)
  return () => {
    end()
    surface.removeEventListener("pointerdown", start, true)
    surface.removeEventListener("mousedown", mouse, true)
    surface.removeEventListener("auxclick", mouse, true)
    surface.removeEventListener("lostpointercapture", end)
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    window.removeEventListener("pointercancel", up)
    window.removeEventListener("blur", end)
    document.removeEventListener("visibilitychange", hidden)
  }
}
