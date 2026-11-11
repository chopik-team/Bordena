/** Smooth discrete mouse-wheel steps without React renders or persistent state. */
export function installSmoothWheel(surface: HTMLElement): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
  const duration = 140
  let frame = 0,
    origin = 0,
    target = 0,
    started = 0,
    previous = 0
  const allowed = () =>
    !reduced.matches && document.documentElement.dataset.animations !== "off"
  const cancel = () => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }
  const animate = (now: number) => {
    if (!allowed() || Math.abs(surface.scrollTop - previous) > 2) {
      cancel()
      return
    }
    const progress = Math.max(0, Math.min(1, (now - started) / duration))
    const limit = Math.max(0, surface.scrollHeight - surface.clientHeight)
    surface.scrollTop = Math.max(
      0,
      Math.min(limit, origin + (target - origin) * (1 - (1 - progress) ** 3))
    )
    previous = surface.scrollTop
    if (progress < 1 && Math.abs(previous - target) > 0.5)
      frame = requestAnimationFrame(animate)
    else {
      surface.scrollTop = Math.min(limit, target)
      frame = 0
    }
  }
  const wheel = (event: WheelEvent) => {
    const element = event.target instanceof Element ? event.target : null
    if (
      event.defaultPrevented ||
      !event.cancelable ||
      !allowed() ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
      !event.deltaY ||
      element?.closest(
        'input,textarea,select,[contenteditable="true"],.cm-editor'
      )
    ) {
      cancel()
      return
    }
    // Fine pixel deltas already supply native high-resolution touchpad motion.
    if (event.deltaMode === 0 && Math.abs(event.deltaY) < 40) {
      cancel()
      return
    }
    for (
      let child = element;
      child && child !== surface;
      child = child.parentElement
    ) {
      if (
        child.scrollHeight > child.clientHeight &&
        /auto|scroll/.test(getComputedStyle(child).overflowY)
      ) {
        cancel()
        return
      }
    }
    const unit =
      event.deltaMode === 1
        ? parseFloat(getComputedStyle(surface).lineHeight) || 16
        : event.deltaMode === 2
          ? surface.clientHeight
          : 1
    const delta = event.deltaY * unit
    const current = surface.scrollTop
    const continuing =
      frame &&
      Math.abs(current - previous) <= 2 &&
      Math.sign(target - current) === Math.sign(delta)
    const next = Math.max(
      0,
      Math.min(
        surface.scrollHeight - surface.clientHeight,
        (continuing ? target : current) + delta
      )
    )
    if (next === current) {
      cancel()
      return
    }
    event.preventDefault()
    cancel()
    origin = previous = current
    target = next
    started = performance.now()
    frame = requestAnimationFrame(animate)
  }
  surface.addEventListener("wheel", wheel, { passive: false })
  surface.addEventListener("pointerdown", cancel, true)
  surface.addEventListener("keydown", cancel, true)
  window.addEventListener("blur", cancel)
  reduced.addEventListener("change", cancel)
  return () => {
    cancel()
    surface.removeEventListener("wheel", wheel)
    surface.removeEventListener("pointerdown", cancel, true)
    surface.removeEventListener("keydown", cancel, true)
    window.removeEventListener("blur", cancel)
    reduced.removeEventListener("change", cancel)
  }
}

/** Month grids navigate periods; one wheel gesture must not skip many months. */
export function installMonthWheel(
  surface: HTMLElement,
  step: (direction: number) => void
): () => void {
  let total = 0,
    direction = 0,
    last = -Infinity,
    consumed = false
  const wheel = (event: WheelEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (
      event.defaultPrevented ||
      !event.cancelable ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      !event.deltaY ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
      target?.closest(
        'input,textarea,select,[contenteditable="true"],.cm-editor'
      )
    )
      return
    const sign = Math.sign(event.deltaY),
      now = performance.now()
    if (now - last > 180 || sign !== direction) {
      total = 0
      consumed = false
    }
    last = now
    direction = sign
    event.preventDefault()
    if (consumed) return
    total +=
      Math.abs(event.deltaY) *
      (event.deltaMode === 1
        ? 20
        : event.deltaMode === 2
          ? surface.clientHeight
          : 1)
    if (total >= 60) {
      consumed = true
      step(sign)
    }
  }
  surface.addEventListener("wheel", wheel, { passive: false })
  return () => surface.removeEventListener("wheel", wheel)
}
