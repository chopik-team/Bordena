import { useT } from "@bordena/i18n"
import { Fragment } from "react"
import {
  Avatar,
  AvatarFallback,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@bordena/ui-kit"
import { UserRound } from "lucide-react"
import {
  describeEntry,
  useBoardMembers,
  type HistoryEntry,
} from "@bordena/core"
import { useAuth } from "@/lib/hooks"
import { timeAgo } from "@/lib/time-ago"
import { HistoryPart } from "./history-part"
interface IProps {
  entry: HistoryEntry
}
export function HistoryRow({ entry }: IProps) {
  const t = useT()
  const { authed, userId } = useAuth()
  const { data: roster } = useBoardMembers(entry.boardId, !!authed)
  const members = roster?.members ?? []
  const isMe = entry.userId === null || entry.userId === userId
  const member = members.find((member) => member.userId === entry.userId)
  const name = isMe ? t("Вы") : (member?.username ?? t("Участник"))
  return (
    <li className="flex items-start gap-3 py-2">
      <Avatar className="size-6">
        <AvatarFallback>
          <UserRound className="size-3" />
        </AvatarFallback>
      </Avatar>
      <p className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
        <span className="font-medium text-foreground">{name}</span>
        {describeEntry(entry).map((part, index) => (
          <Fragment key={index}>
            {" "}
            <HistoryPart part={part} members={members} />
          </Fragment>
        ))}
      </p>
      <Tooltip>
        <TooltipTrigger
          render={
            <time
              dateTime={new Date(entry.createdAt).toISOString()}
              className="shrink-0 text-xs leading-6 text-muted-foreground"
            />
          }
        >
          {timeAgo(entry.createdAt)}
        </TooltipTrigger>
        <TooltipContent>
          {new Date(entry.createdAt).toLocaleString()}
        </TooltipContent>
      </Tooltip>
    </li>
  )
}
