import { useT } from "@bordena/i18n"
import { useState } from "react"
import { Button } from "@bordena/ui-kit"
import { Search } from "lucide-react"
import { SearchModal } from "../../search"
export function SearchButton({ boardId }: { boardId: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("Поиск карточек")}
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>
      <SearchModal open={open} onOpenChange={setOpen} boardId={boardId} />
    </>
  )
}
