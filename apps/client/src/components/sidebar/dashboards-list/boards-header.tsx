import { useUiFlag } from "@/lib/ui-state"
import { useT } from "@bordena/i18n"
import { Button, SidebarGroupLabel } from "@bordena/ui-kit"
import { Folder } from "lucide-react"
import { usePreferences } from "@/lib/preferences"
import { useOrganizationAction } from "@/lib/hooks/use-organization"
import { createProject } from "@/lib/workspaces"
import { CreateItemMenu } from "@/components/navigation/create-item-menu"
interface IProps {
  onFolderCreated: (id: string) => void
}
export function BoardsHeader({ onFolderCreated }: IProps) {
  const t = useT()
  const [collapsed, setCollapsed] = useUiFlag("collapsed:boards")
  const { workspaceId } = usePreferences()
  const { mutate: createFolder } = useOrganizationAction()
  return (
    <SidebarGroupLabel className="mb-1 gap-1 rounded-none pr-0">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(!collapsed)}
        className="flex-1 text-left text-sm"
      >
        {t("Мои доски")}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("Новая папка")}
        className="text-muted-foreground"
        onClick={() =>
          createFolder(async () => {
            const id = await createProject(t("Новый проект"), workspaceId)
            onFolderCreated(id)
          })
        }
      >
        <Folder />
      </Button>
      <CreateItemMenu
        label={t("Создать доску или календарь")}
        className="text-muted-foreground"
      />
    </SidebarGroupLabel>
  )
}
