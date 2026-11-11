/** The `-cut-` marker: a short dashed rule pinned to the body's right edge,
 *  taking no vertical space of its own. */
export function MdCutDivider() {
  return (
    <span className="absolute right-0 block h-0 w-[60px] border-t-2 border-dashed border-border before:absolute before:top-[-0.4rem] before:right-[18px] before:bg-card before:font-mono before:text-[0.8rem] before:leading-[0.8] before:text-border before:content-['cut']" />
  )
}
