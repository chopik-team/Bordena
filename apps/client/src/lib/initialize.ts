import { t } from "@bordena/i18n"
import type { Card, Column, Dashboard } from "@bordena/contract"
import { webDb, withDataLock } from "./adapters/web-db"
/** First-run fixture is local and written atomically. Never recreates deleted data. */
export async function initializeWorkspace(): Promise<void> {
  await withDataLock(async () => {
    if (await webDb.get("meta", "bordena:initialized")) return
    const db = await webDb.open()
    const now = Date.now()
    const board: Dashboard = {
      id: "bordena-welcome",
      title: t("Добро пожаловать в Bordena"),
      position: "a0",
      sort: [],
      updatedAt: now,
      deletedAt: null,
    }
    const columns: Column[] = [t("Начало"), t("В работе"), t("Готово")].map(
      (title, index) => ({
        id: `bordena-col-${index}`,
        dashboardId: board.id,
        title,
        position: `a${index}`,
        collapsed: false,
        color: "",
        done: index === 2,
        stamps: {},
        updatedAt: now,
        deletedAt: null,
      })
    )
    const cards: Card[] = [
      {
        title: t("Ваши проекты остаются с вами"),
        body: t(
          "Bordena работает на этом компьютере. **Интернет и аккаунт не нужны.**\n\nСоздавайте доски, добавляйте колонки и перетаскивайте карточки."
        ),
      },
      {
        title: t("Заметки и задачи"),
        body: t(
          "Пишите в Markdown, добавляйте теги и приоритеты.\n\n- [x] Открыть Bordena\n- [ ] Создать свой проект\n- [ ] Сохранить резервную копию\n\nВложения можно прикреплять с этого компьютера."
        ),
      },
      {
        title: t("Сохраните копию"),
        body: t(
          "Нажмите на логотип **Bordena → Настройки Bordena**. Там доступны экспорт и резервные копии.\n\nКопия на другом диске защитит проекты при поломке компьютера."
        ),
      },
    ].map((value, index) => ({
      ...value,
      id: `bordena-card-${index}`,
      columnId: columns[0].id,
      position: `a${index}`,
      number: null,
      deadline: null,
      priority: "",
      tags: [],
      users: [],
      attachments: [],
      stamps: {},
      bodyConflict: null,
      updatedAt: now,
      deletedAt: null,
    }))
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["dashboards", "columns", "cards", "meta"],
        "readwrite",
        { durability: "strict" }
      )
      // Respect any existing Bordena records even before an initialization marker exists.
      const count = tx.objectStore("dashboards").count()
      count.onsuccess = () => {
        if (!count.result) {
          tx.objectStore("meta").put(6, "bordena:model-revision")
          tx.objectStore("dashboards").put(board, board.id)
          for (const col of columns) tx.objectStore("columns").put(col, col.id)
          for (const card of cards) tx.objectStore("cards").put(card, card.id)
        }
        tx.objectStore("meta").put(true, "bordena:initialized")
      }
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () =>
        reject(
          new Error(t("Не удалось создать локальное пространство Bordena"))
        )
    })
  })
}
