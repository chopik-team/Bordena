export interface GuideTopic {
  id: string
  ru: { title: string; body: string }
  en: { title: string; body: string }
}
export const guideTopics: GuideTopic[] = [
  {
    id: "ux-07",
    ru: {
      title: "Bordena W 1.0: навигация и рабочее пространство",
      body: "По умолчанию верхняя полоса вкладок скрыта. Основная навигация — боковая панель и Ctrl+K; Alt+Left / Alt+Right возвращают переходы. Настройки → Интерфейс → Использовать вкладки возвращает совместимый режим без удаления сохранённых вкладок. Доски сохраняют Свободную, Матрицу, Таблицу и Путь к цели. Название и вид находятся рядом; дополнительные действия — в ⋯. Столбцы не имеют высокого пустого фона. Плюс в заголовке создаёт секцию, двойной щелчок по названию переименовывает столбец; Enter сохраняет, Esc отменяет, Ctrl+Z отменяет изменение. Несколько секций в столбце сохраняются. Focus доступен в меню Представление и Ctrl+K; сверху есть Выйти из фокуса. Одна кнопка управляет sidebar/drawer, Ctrl+B не перехватывается у редактора текста. Compact независим от Focus. Цвета карточки и секции постоянно видны; полный Markdown остаётся в редакторе. Bordena.bat запускает только release; при отсутствии EXE показывает ошибку. Для разработки используйте dev.bat.",
    },
    en: {
      title: "Bordena W 1.0: navigation and workspace",
      body: "Tabs are hidden by default. Use the sidebar and Ctrl+K; Alt+Left / Alt+Right navigate history. Settings → Interface → Use tabs restores the compatible tab mode without deleting saved tabs. Boards retain Free, Matrix, Table and Goal Path. Title and view stay together; secondary actions are in ⋯. Lanes have neutral empty space. The header plus adds a section; double-click a lane title to rename it, Enter saves, Escape cancels, Ctrl+Z undoes. Multiple sections remain supported. Focus is in View and Ctrl+K, with an explicit Exit focus command. One button controls sidebar/drawer. Ctrl+B leaves text editors in control. Compact is independent. Card and section colors stay visible; full Markdown remains in the editor. Bordena.bat starts the release only and reports a missing EXE; use dev.bat for development.",
    },
  },
  {
    id: "calendar-start",
    ru: {
      title: "Календарь, год и загруженность",
      body: "В Sidebar есть один пункт Календарь. Внутри страницы откройте Все календари: настройте видимость, цвет, название и календарь для новой записи. Видимость и назначение независимы; Общий календарь переключает все источники без дубликатов. Есть День, Неделя, Месяц, Список и Год. Сегодня и T возвращают текущую дату без сброса фильтров. Стрелки меняют выбранный период; в Списке — 90 дней. Колесо в Месяце переключает месяцы, в Году прокручивает обзор. Год показывает 12 месяцев: название открывает месяц, число — день. График под годом сворачивается. Занятые часы объединяют пересечения; сумма плановых часов и количества задач/событий — отдельные показатели. All-day и сроки не создают часы. Процентов по профилям нет; цветные точки показывают календари дня. Это план, а не фактически отработанное время. Ctrl+N создаёт событие; Esc отменяет перенос. При закрытии изменённого события или календаря выберите Сохранить, Не сохранять или Вернуться к редактированию. Это действует и при выходе из приложения. Пустую или неверную дату нужно исправить перед сохранением. Экспорт и резервная копия дожидаются последней правки карточки.",
    },
    en: {
      title: "Calendar, year and workload",
      body: "The sidebar has one Calendar entry. Inside All calendars manage visibility, colors, names and the new-entry target independently. General toggles all sources without duplicates. Day, Week, Month, List and Year views share filters. Today and T return to the current date without resetting filters. Arrows move the current period, 90 days in List. The month wheel changes months; the year wheel scrolls the overview. Year shows 12 months: click a title for Month or a date for Day. The chart below is collapsible. Busy hours merge overlaps; summed planned hours and task/event counts are separate metrics. All-day items and deadlines do not add hours. There are no availability percentages; colored dots identify each day’s calendars. These are plans, not actual hours worked. Ctrl+N creates an event; Escape cancels a drag. Dismissing a changed event or calendar offers Save, Discard changes or Continue editing, including when quitting. Correct empty or invalid dates before saving. Exports and backups wait for the last pending card edit.",
    },
  },
  {
    id: "calendar-links",
    ru: {
      title: "Рабочие блоки и планирование карточки",
      body: "В карточке откройте Основное и прогресс → Планирование. Редактор существующего блока открывается прямо здесь. Если план есть, используйте Изменить план; новый создаётся только через Добавить ещё рабочий блок. Перенос даты сохраняет локальное начало и длительность, all-day — число календарных дней. Дедлайн карточки независим и не меняется. Форма применяется по Сохранить. Единственный активный блок можно вернуть в незапланированные; при других снимается только выбранный блок. Повторение требует выбора экземпляра или серии. При несохранённых правках предлагаются сохранение, отклонение правок либо возврат в редактор. Карточка, Markdown, файлы и прогресс сохраняются. Ctrl+Z отменяет поддерживаемое изменение вне текстового поля. Фильтры не сбрасываются; после снятия плана можно явно показать нужную задачу. Обычные события без карточки отменяются без обещания возврата задачи.",
    },
    en: {
      title: "Work blocks and card planning",
      body: "Open Basics and progress → Planning in a card. Edit an existing block here without leaving the card. Use Edit plan when a plan exists; Add another work block is explicit. Moving the date retains local start and elapsed duration, or the calendar-day span for all-day blocks. The card deadline is independent. Save applies the form. The last active block can return the task to unscheduled; otherwise only this block is removed. Recurrences require an occurrence/series choice. Unsaved changes offer save, discard or continue editing. The card, Markdown, files and progress remain. Ctrl+Z undoes supported operations outside text fields. Filters are preserved; Show task explicitly reveals the source after unscheduling. Standalone events are cancelled without claiming a task was returned.",
    },
  },
  {
    id: "calendar-recurrence",
    ru: {
      title: "Повторения и часовые пояса",
      body: "В дополнительных полях выберите день, неделю, месяц или год, интервал, дни недели, дату окончания либо количество. Экземпляры вычисляются только в видимом периоде. Можно изменить или отменить один экземпляр либо всю серию. Старые абсолютные моменты не переписываются. Время показано в системной зоне; повторение хранит исходную зону и местный час, all-day сохраняет календарные даты. При смене системной зоны расписание пересчитывается только для отображения; 31-е число пропускает месяцы без такого дня. Невозможное время DST не создаёт экземпляр, повторяющийся осенний час выбирает первое вхождение. Перенос будущей части серии отдельно и автоматический перенос повторяющихся блоков в этой итерации не реализованы; редактируйте конкретный экземпляр вручную.",
    },
    en: {
      title: "Recurrence and time zones",
      body: "In advanced options choose daily, weekly, monthly or yearly repetition, an interval, weekdays, an end date or a count. Occurrences are computed only for the visible period. Edit or cancel one occurrence or the entire series. Absolute timestamps are not rewritten. Timed entries display in the device zone; recurrence keeps its original zone and wall time, while all-day dates stay calendar dates. Changing device zones changes presentation only; the 31st skips months without that date. A nonexistent DST wall time is skipped; an ambiguous autumn hour uses its first occurrence. Editing only the future portion and automatic rescheduling of recurring blocks are not implemented in this iteration; edit an occurrence manually.",
    },
  },
  {
    id: "calendar-availability",
    ru: {
      title: "Свободное планирование задач",
      body: "Профили доступности не нужны. В параметрах доски можно задать календарь по умолчанию. Календарь отдельной карточки или блока имеет приоритет; назначение само по себе не создаёт событие. Цвет исходной карточки сохраняется. В «Незапланированных задачах» задайте длительность и перетащите карточку на дату месяца или время в дне/неделе: рабочий блок сохраняется сразу, дедлайн карточки не меняется. Нажатие на задачу открывает выбор даты и времени, на существующий блок — его редактирование. Список скрывается крестиком и возвращается кнопкой «Незапланированные задачи»; выбор сохраняется. Колесо в месяце переключает месяцы, в дне/неделе и повестке плавно прокручивает содержимое.",
    },
    en: {
      title: "Flexible task scheduling",
      body: "Availability profiles are not needed. Set a default calendar in board options; an explicit card or block assignment takes precedence. Assignment alone does not create an event or change the source card color. In Unscheduled tasks set a duration and drop a card onto a month date or day/week time: the linked block is saved immediately without changing the card deadline. Click a task to choose its date and time, or click an existing block to edit it. Hide the list with its close button and restore it with Unscheduled tasks; the choice persists. The wheel switches months in Month and smoothly scrolls Day, Week and Agenda.",
    },
  },
  {
    id: "calendar-reschedule",
    ru: {
      title: "Умный автоперенос и безопасность",
      body: "По умолчанию выбран ручной режим. Для автопереноса явно включите Smart или Next Day в календаре/блоке, отметьте гибкое время. Поиск выполняется ежедневно 09:00–20:00 по местному времени устройства; учитываются занятые интервалы и срок. Старые профили хранятся для совместимости и не управляют поиском. Завершённые, отменённые, закреплённые и недоступные источники не переносятся. Без подходящего окна блок сохраняется в «Требуется планирование»; исходный дедлайн не меняется. Изменение режима или горизонта поиска разрешает повторную попытку. Автоматические действия используют общий планировщик главного окна и общую историю. Ctrl+Z/Redo доступны, пока последующие изменения совместимы. Windows-напоминания требуют отдельного разрешения в настройках и работают только при запущенной Bordena. Полная резервная копия включает календарь в JSON v6; без календаря сохраняется совместимый JSON v5.",
    },
    en: {
      title: "Smart rescheduling and safety",
      body: "Manual is the default. To allow rescheduling explicitly select Smart or Next Day on a calendar/block, mark the block flexible. Search runs daily 09:00–20:00 in device-local time, respecting busy intervals and due dates. Historical profiles remain in backups but never control the search. Completed, cancelled, pinned and unavailable sources are not moved. Without a suitable slot the block remains in Needs planning; the original deadline is unchanged. Changing the mode or search horizon permits another attempt. Automatic actions use the main window coordinator and shared history. Undo/Redo is available while later edits remain compatible. Windows reminders require separate opt-in and only work while Bordena runs. Full backups include calendar data in JSON v6; exports without calendar data remain compatible JSON v5.",
    },
  },
  {
    id: "calendar-video-example",
    ru: {
      title: "Пример: производство видео",
      body: "Создайте календарь «Видео», доску ролика и карточки сценария, записи и монтажа. Из каждой карточки откройте «Запланировать рабочий блок» и назначьте отдельные сессии. У монтажа может быть несколько блоков. Срок публикации храните в карточке: перенос сессии не переносит публикацию. В недельном виде можно показать видео вместе с личными делами.",
    },
    en: {
      title: "Example: video production",
      body: "Create a Video calendar, a production board and cards for script, recording and editing. Use Schedule a time block from each card to plan separate sessions. Editing can have several blocks. Keep publication due on the card: moving a session never postpones publication. Show video and personal calendars together in week view.",
    },
  },
  {
    id: "calendar-software-example",
    ru: {
      title: "Пример: разработка программы",
      body: "На доске релиза задайте этапы Goal Path и карточки реализации, проверки и документации. В календаре «Разработка» назначьте рабочие блоки, связав их с карточками или этапами. Назначьте цветной календарь доске, закрепите встречу и перетащите задачи на свободное время. Гибкий разовый блок можно явно разрешить переносить, не меняя срок релиза.",
    },
    en: {
      title: "Example: software development",
      body: "On a release board define Goal Path stages and implementation, QA and documentation cards. In Development schedule blocks linked to those cards or stages. Assign a colored calendar to the board, pin a meeting and drag tasks into free time. A flexible one-off block can explicitly allow rescheduling without changing the release deadline.",
    },
  },
  {
    id: "calendar-personal-example",
    ru: {
      title: "Пример: личный распорядок",
      body: "Создайте календари «Личное», «Учёба» и «Дом». Добавьте самостоятельные встречи без досок и повторяющееся занятие по выбранным дням недели. Отмените одно занятие как исключение, сохранив серию. В «Все календари» включите нужные категории; цвета и названия помогают различать пересекающиеся события.",
    },
    en: {
      title: "Example: personal routine",
      body: "Create Personal, Study and Home calendars. Add standalone meetings without boards and a recurring lesson on selected weekdays. Cancel one lesson as an exception while retaining the series. In All calendars enable the categories you want; colors and names distinguish overlapping events.",
    },
  },
  {
    id: "start",
    ru: {
      title: "Начало работы",
      body: "Bordena хранит проекты на этом компьютере и работает без интернета. Откройте меню логотипа для настроек, справки и резервных копий. Новая доска создаётся кнопкой в боковой панели.",
    },
    en: {
      title: "Getting started",
      body: "Bordena stores projects on this computer and works offline. Use the logo menu for settings, help and backups. Create a board with the button in the sidebar.",
    },
  },
  {
    id: "workspaces",
    ru: {
      title: "Рабочие пространства",
      body: "Выберите пространство над списком досок. Через соседнее меню создайте или переименуйте пространство. Пространства разделяют вашу локальную работу; для них не нужны участники и аккаунты. Открытые вкладки и избранное позволяют быстро вернуться к доске другого пространства.",
    },
    en: {
      title: "Workspaces",
      body: "Choose a workspace above the board list. Use the adjacent menu to create or rename one. Workspaces organize local work without members or accounts. Tabs and favorites let you return to boards in other workspaces.",
    },
  },
  {
    id: "projects",
    ru: {
      title: "Проекты и папки",
      body: "Проект — необязательная папка с досками. Создайте его через меню пространства. Переименуйте папку в списке; её меню позволяет переместить или архивировать проект. Удаление папки сохраняет доски. Вложенные папки не поддерживаются.",
    },
    en: {
      title: "Projects and folders",
      body: "A project is an optional folder containing boards. Create one in the workspace menu. Rename it in the list; its menu can move or archive the project. Deleting a folder keeps its boards. Nested folders are not supported.",
    },
  },
  {
    id: "boards",
    ru: {
      title: "Доски и навигация",
      body: "При создании доски выберите название, проект и режим. Вкладки не удаляют доску при закрытии. Звезда добавляет доску в избранное. Ctrl+K ищет доски, проекты и текст карточек; Ctrl+Tab переключает вкладки, если включён режим вкладок. Меню доски позволяет переместить, архивировать или удалить её. Корзина хранит удалённое 14 дней.",
    },
    en: {
      title: "Boards and navigation",
      body: "Choose a name, project and mode when creating a board. Closing a tab does not delete its board. Use the star for favorites. Ctrl+K searches boards, projects and card text; Ctrl+Tab switches tabs when enabled. The board menu can move, archive or delete a board. Trash retains deleted items for 14 days.",
    },
  },
  {
    id: "cards",
    ru: {
      title: "Карточки",
      body: "Добавьте карточку кнопкой секции и откройте её для редактирования. Заголовок, заметки, теги, приоритет и срок сохраняются локально. Карточки можно перетаскивать. Перед закрытием приложения Bordena дожидается сохранения открытых правок.",
    },
    en: {
      title: "Cards",
      body: "Add a card using the section button, then open it to edit. Its title, notes, tags, priority and deadline are saved locally. Drag cards to reorder or move them. Bordena waits for open edits to save before closing.",
    },
  },
  {
    id: "markdown",
    ru: {
      title: "Заметки Markdown",
      body: "В заметках поддерживаются заголовки (#), выделение (**текст**), списки и ссылки. Переключайте просмотр и редактирование в карточке. Пользовательские тексты не переводятся при смене языка интерфейса.",
    },
    en: {
      title: "Markdown notes",
      body: "Notes support headings (#), emphasis (**text**), lists and links. Switch between preview and editing in a card. Changing the interface language never translates your content.",
    },
  },
  {
    id: "checklists",
    ru: {
      title: "Чек-листы",
      body: "Запишите - [ ] задача или - [x] выполнено на отдельной строке заметки. В просмотре отметки можно менять. Чек-лист и позиционная готовность секции независимы.",
    },
    en: {
      title: "Checklists",
      body: "Write - [ ] task or - [x] done on a separate line in a note. Check items in preview. Checklists are independent of positional section progress.",
    },
  },
  {
    id: "sections",
    ru: {
      title: "Секции",
      body: "Свободная доска содержит столбцы, а внутри них — секции с карточками. Добавьте секцию и сразу задайте название. Стрелка сворачивает её целиком. Меню секции содержит цвет, признак выполненных карточек, настройки и удаление с подтверждением.",
    },
    en: {
      title: "Sections",
      body: "A free board contains lanes with card sections. Add a section and name it immediately. The arrow collapses the entire section. Its menu contains color, completed-card behavior, settings and deletion with confirmation.",
    },
  },
  {
    id: "moving",
    ru: {
      title: "Перемещение секции",
      body: "Перетащите свободную область цветной шапки секции. Кнопки и редактирование названия работают отдельно. Переносятся все её карточки, заметки и настройки. С клавиатуры: Tab до шапки, Space, стрелки, Space; Esc отменяет перенос. При закрытии изменённого события или календаря выберите Сохранить, Не сохранять или Вернуться к редактированию. Это действует и при выходе из приложения. Пустую или неверную дату нужно исправить перед сохранением. Экспорт и резервная копия дожидаются последней правки карточки. В меню есть команды выше и ниже; другой столбец можно выбрать в настройках секции. Цвет выбирается непосредственно круглой кнопкой шапки.",
    },
    en: {
      title: "Moving a section",
      body: "Drag the free area of the colored section header. Buttons and title editing work independently. All cards, notes and settings stay with it. Keyboard: Tab to the header, Space, arrow keys, Space; Esc cancels. The menu also provides move up/down commands, and section settings let you choose another lane. The round header swatch opens the color palette directly.",
    },
  },
  {
    id: "free",
    ru: {
      title: "Свободная доска",
      body: "Столбцы помогают размещать независимые секции. В управлении компоновкой можно добавлять и переименовывать столбцы. Секции сохраняют собственный порядок. Для обзора большой доски используйте прокрутку или зажатую среднюю кнопку мыши.",
    },
    en: {
      title: "Free board",
      body: "Lanes hold independent sections. Layout controls can add and rename lanes. Sections retain their own order. Scroll or hold the middle mouse button to explore a large board.",
    },
  },
  {
    id: "matrix",
    ru: {
      title: "Матрица",
      body: "Столбцы матрицы — этапы, строки — состояния. Карточка хранит обе координаты независимо от своей секции. Перетаскивайте карточки между ячейками или выбирайте этап и состояние в карточке. Строку можно свернуть; это не удаляет её карточки.",
    },
    en: {
      title: "Matrix",
      body: "Matrix columns are stages and rows are states. Cards retain both coordinates independently of their free-board section. Drag cards between cells or select a stage and state in the card. Collapsing a row does not delete its cards.",
    },
  },
  {
    id: "progress",
    ru: {
      title: "Готовность секции",
      body: "По умолчанию готовность выключена. В настройках секции выберите ручную готовность или по позиции. Ручная задаётся в карточке от 0 до 100. По позиции: первая карточка 0%, последняя 100%, промежуточные значения равномерны. При одной карточке значение не определено. Позиция не означает выполнение задачи и не перезаписывает ручные проценты.",
    },
    en: {
      title: "Section progress",
      body: "Progress is off by default. In section settings choose manual or positional progress. Manual values range from 0 to 100 in the card. Positional progress gives the first card 0%, the last 100%, with even steps between. One card has no defined value. Position does not mean task completion and never overwrites manual values.",
    },
  },
  {
    id: "modes",
    ru: {
      title: "Переключение режима",
      body: "В верхней части доски выберите свободный режим или матрицу. Перед изменением модели создаётся проверенная локальная копия. ID, заметки, вложения и ручная готовность сохраняются. Вернувшись в свободный режим, вы увидите прежние секции и их размещение.",
    },
    en: {
      title: "Switching modes",
      body: "Choose free or matrix mode above the board. A verified local backup protects model changes. IDs, notes, attachments and manual progress are preserved. Returning to free mode restores the previous sections and their placement.",
    },
  },
  {
    id: "colors",
    ru: {
      title: "Цвета и отображение",
      body: "Цвет секции выбирается в её меню. В настройках компоновки доступны цвета этапов и состояний, а также мягкий оттенок ячеек. В настройках интерфейса выберите тему, плотность, масштаб и анимации. Пользовательские названия остаются без изменений.",
    },
    en: {
      title: "Colors and appearance",
      body: "Choose section colors in their menus. Layout controls provide stage/state colors and subtle cell tinting. Interface settings contain theme, density, zoom and animation options. Your custom names remain unchanged.",
    },
  },
  {
    id: "shortcuts",
    ru: {
      title: "Клавиатура и управление",
      body: "Ctrl+K — поиск; Ctrl+Tab / Ctrl+Shift+Tab — вкладки; Ctrl+B — боковая панель; Ctrl+Z — безопасная отмена изменений; Ctrl+S — сохранить правки; Ctrl+плюс/минус/0 — масштаб. Enter и Space активируют кнопки; Esc закрывает меню. Горячая клавиша быстрой заметки настраивается отдельно.",
    },
    en: {
      title: "Keyboard and controls",
      body: "Ctrl+K: search; Ctrl+Tab / Ctrl+Shift+Tab: tabs; Ctrl+B: sidebar; Ctrl+Z: safely undo supported changes; Ctrl+S: save edits; Ctrl+plus/minus/0: zoom. Enter and Space activate buttons; Esc closes menus. Configure the quick-note shortcut in settings.",
    },
  },
  {
    id: "exchange",
    ru: {
      title: "Экспорт, импорт и восстановление",
      body: "В разделе «Данные» экспортируйте текущую или все доски. С вложениями используется ZIP с проверкой SHA-256, без вложений — JSON. Перед импортом проверьте количество объектов и конфликты ID. Добавление не заменяет существующие ID. Замена всех данных требует полного экспорта и предварительной проверенной копии. JSON v5 сохраняет связи, зеркала, правила, шаблоны, поля и ссылки на внешние файлы; старые форматы v1–v4 читаются.",
    },
    en: {
      title: "Export, import and restore",
      body: "In Data settings export the current board or all boards. Attachments use ZIP with SHA-256 verification; exports without files use JSON. Review object counts and ID conflicts before importing. Adding boards does not replace existing IDs. Replacing all data requires a full export and a verified safety backup. JSON v5 preserves links, mirrors, rules, templates, fields and external file references; older v1–v4 exports remain readable.",
    },
  },
  {
    id: "storage",
    ru: {
      title: "Вложения и локальные данные",
      body: "Прикреплённые файлы копируются в профиль Bordena. Путь профиля и последняя локальная копия доступны в настройках данных. Удаление исходного файла не удаляет вложение. Не переносите отдельные файлы профиля во время работы: используйте полный экспорт ZIP. Сохраняйте внешние копии на другом диске.",
    },
    en: {
      title: "Attachments and local storage",
      body: "Attached files are copied into the Bordena profile. Data settings show its path and the latest local backup. Removing an original file does not remove the attachment. Do not move individual profile files while the app is running; use a full ZIP export. Keep external backups on another drive.",
    },
  },
  {
    id: "linked-boards",
    ru: {
      title: "Связанные доски",
      body: "В карточке раскройте «Связанная доска», выберите локальную доску и режим: переход, переход с прогрессом или с автоматическим этапом. Источник готовности — ручной процент доски, выполненные задачи, оценки этапов либо выбранные карточки/секции. Пустой или незаданный источник показывает причину вместо 0%. Диапазоны 0–100 не должны пересекаться; полное покрытие можно отключить. Этап и явно выбранная секция меняются только по включённому правилу, состояние и ручной процент сохраняются. Связи используют ID, проверяются на циклы и обновляются после сохранения. Удалённая доска остаётся недоступной ссылкой, родительская карточка сохраняется.",
    },
    en: {
      title: "Linked boards",
      body: "Expand Linked board in a card, choose a local board and select navigation, progress or automatic stage movement. Progress comes from an explicit board percentage, completed tasks, stage weights or selected cards/sections. An empty or unset source shows a reason instead of 0%. Ranges from 0 to 100 must not overlap; full coverage can be disabled. Only enabled rules change the stage and an explicitly selected section; state and manual percentage are preserved. ID-based links reject cycles and update after saving. Deleting a board leaves an unavailable link and preserves its parent card.",
    },
  },
  {
    id: "mirrors",
    ru: {
      title: "Зеркала карточек",
      body: "В карточке откройте «Зеркала карточки», выберите целевую доску и секцию. Зеркало хранит ссылку на единственную исходную карточку. Название, заметки, приоритет и процент обновляются из оригинала; перенос зеркала меняет только его положение. В матрице у зеркала собственные этап и состояние. Нажатие открывает оригинал. Удаление зеркала не удаляет исходную задачу; удалённый оригинал отображается как недоступный.",
    },
    en: {
      title: "Card mirrors",
      body: "In a card expand Card mirrors and choose a destination board and section. A mirror refers to one original card. Title, notes, priority and progress update from that original; dragging a mirror changes only its placement. In a matrix its stage and state are independent. Clicking opens the original. Removing a mirror does not delete the task; a deleted original appears unavailable.",
    },
  },
  {
    id: "selection-links",
    ru: {
      title: "Ссылки из выделения",
      body: "Выделите текст в редакторе Markdown и используйте меню выделения: создать задачу или доску, связать с существующей доской/карточкой либо открыть найденную ссылку. После успешного действия выделение становится внутренней ссылкой bordena://board/ID или bordena://card/ID. Если текст успел измениться, Bordena не заменяет новое содержимое. Переход открывает объект в основном интерфейсе; Alt+Left возвращает предыдущий экран.",
    },
    en: {
      title: "Links from selected text",
      body: "Select Markdown editor text to create a task or board, link an existing board/card or open a detected link. A successful action turns the selection into a bordena://board/ID or bordena://card/ID link. If the document changed meanwhile, Bordena preserves the newer text. Navigation opens the object in the main view; Alt+Left returns to the previous screen.",
    },
  },
  {
    id: "changesets",
    ru: {
      title: "Команды Bordena JSON",
      body: "Настройки → Данные → Bordena Changeset JSON применяют локальный файл команд сразу после строгой проверки. Команды используют стабильные ID и expectedUpdatedAt из экспорта; файл не исполняет код и не обращается к сети. Перед применением создаётся проверенная копия, изменения записываются одной транзакцией. Повторный идентичный ID пакета ничего не дублирует. Отмена последнего пакета доступна, пока после него нет новых изменений; иначе восстановите нужную копию явно. Формат и примеры описаны в BORDENA_AI_EXCHANGE_GUIDE.md.",
    },
    en: {
      title: "Bordena JSON commands",
      body: "Settings → Data → Bordena Changeset JSON applies a local command file after strict validation. Commands use stable IDs and expectedUpdatedAt from an export; they execute no code and use no network. A verified backup precedes one atomic transaction. Repeating an identical batch ID creates no duplicates. Undo the latest batch before making further changes, or explicitly restore its backup afterward. BORDENA_AI_EXCHANGE_GUIDE.md describes the format and examples.",
    },
  },
  {
    id: "templates-fields",
    ru: {
      title: "Шаблоны и поля",
      body: "При создании доски доступны десять категорий шаблонов. Примеры карточек добавляются только по выбранной опции. В параметрах доски можно сохранить свой шаблон, импортировать/экспортировать его JSON и добавить поля: текст, число, дата, процент, флажок или список вариантов. Шаблон переносит структуру и определения полей с новыми ID, без реальных связей, вложений и истории. Значения редактируются в карточке; нужные поля можно показать в таблице.",
    },
    en: {
      title: "Templates and fields",
      body: "Board creation offers ten template categories. Sample cards are added only when requested. Board options can save a custom template, import/export its JSON and add text, number, date, percentage, checkbox or option-list fields. Templates copy structure and field definitions with new IDs, without real links, attachments or history. Edit values in a card and show selected fields in the table.",
    },
  },
  {
    id: "local-media",
    ru: {
      title: "Изображения, аудио и внешние файлы",
      body: "Управляемые изображения и MP3/WAV открываются внутри Bordena. Через меню вложения меняйте название/группу, порядок и закрепление. Отвязка сохраняет локальные байты; удаление копии требует подтверждения и проверенного backup. Видео и крупные материалы лучше добавлять ссылкой на локальный файл: путь, проверка наличия, предпросмотр доступных форматов или открытие в Windows. Внешние байты в экспорт не входят; при переносе файла укажите новый путь. Поддержка видеокодека зависит от WebView2.",
    },
    en: {
      title: "Images, audio and external files",
      body: "Managed images and MP3/WAV play inside Bordena. The attachment menu changes name/group, order and pinning. Unlinking keeps local bytes; deleting a managed copy requires confirmation and a verified backup. Link videos and large materials as local external files: stored path, presence check, supported preview or Windows opening. External bytes are excluded from exports; select a new path after moving a file. Video codec support depends on WebView2.",
    },
  },
  {
    id: "deadlines-states",
    ru: {
      title: "Сроки, состояния и уведомления",
      body: "Дата без времени действует до конца локального дня. Дата со временем истекает в указанный момент; явное смещение часового пояса учитывается. Просроченная незавершённая карточка получает мягкий красный контур; отключение анимации и reduced motion убирают пульсацию. В компоновке у состояния есть «Считать выполненным»: явно заданное значение приоритетнее признака секции и не зависит от названия. Старые состояния без настройки используют секцию. Заморозка сама по себе не означает выполнение. Уведомления Windows выключены по умолчанию и проверяются только пока открыто главное окно, без фоновой службы.",
    },
    en: {
      title: "Deadlines, states and notifications",
      body: "A date without time lasts through the local day. A timed deadline expires at that instant and honors an explicit timezone offset. An overdue unfinished card receives a subtle red outline; disabling animations or reduced motion removes pulsing. Layout states have Mark as completed: an explicit value overrides section completion regardless of its name. Legacy states without this setting use their section. Frozen does not automatically mean completed. Windows notifications default to off and check only while the main window is open, with no background service.",
    },
  },
  {
    id: "table-history",
    ru: {
      title: "Таблица, отмена и резервные слоты",
      body: "Таблица — третий вид тех же карточек: поиск, фильтр просрочки, сортировка и редактирование этапа, состояния, приоритета и срока. Настраиваемые поля выбираются отдельно. Ctrl+Z и Ctrl+Shift+Z вне текстового поля отменяют/повторяют поддерживаемые структурные изменения текущего сеанса. Заметки имеют собственную историю редактора; журнал действий сохраняется отдельно. В данных настраивается число автоматических копий: 0/3/5/10 или своё значение; ручные, старые и защитные копии не удаляются этой настройкой. Копии внутри профиля не заменяют внешний экспорт.",
    },
    en: {
      title: "Table, undo and backup slots",
      body: "Table is a third view of the same cards: search, overdue filtering, sorting and editing stage, state, priority and deadline. Choose custom field columns separately. Ctrl+Z and Ctrl+Shift+Z outside text inputs undo/redo supported structural edits in this session. Notes have their editor history; durable activity is kept separately. Data settings retain 0/3/5/10 or a custom number of automatic backups; manual, legacy and checkpoint copies are excluded from pruning. In-profile backups do not replace external exports.",
    },
  },
  {
    id: "calendar-text",
    ru: {
      title: "Календарь и даты в тексте",
      body: "Нажмите поле срока: выберите день в календаре, при необходимости включите время и нажмите «Применить». Сегодня, завтра и через неделю доступны одной кнопкой. Дата без времени действует до конца дня; время хранится с локальным смещением часового пояса. В редакторе нажмите правой кнопкой на слово или выделение (с клавиатуры Shift+F10): привяжите дату к слову, вставьте новую дату в пустом месте или отдельно измените срок карточки. В просмотре нажмите подчеркнутую дату для изменения или удаления привязки. Слово и остальной текст сохраняются. Дата в заметке не меняет срок карточки автоматически. Esc отменяет неподтверждённый выбор; вставка отменяется обычным Ctrl+Z редактора. Привязки входят в Markdown и экспорт.",
    },
    en: {
      title: "Calendar and text dates",
      body: "Click a deadline, choose a calendar day, optionally enable time and press Apply. Today, tomorrow and next week are one click away. Date-only deadlines last through the day; timed values retain the local timezone offset. Right-click a word or selection in the editor (Shift+F10 on the keyboard) to attach a date, insert one at an empty caret or separately edit the card deadline. In preview, click an underlined date to change it or remove its attachment while preserving the word and surrounding text. A text date never silently changes the card deadline. Escape cancels a draft; ordinary editor Ctrl+Z undoes insertion. Anchors are stored in Markdown and included in exports.",
    },
  },
  {
    id: "goal-path",
    ru: {
      title: "Путь к цели",
      body: "Создайте доску с компоновкой «Путь к цели» или нажмите значок маршрута на существующей доске. Добавляйте, переименовывайте и переставляйте этапы в настройках пути. Прикрепляйте обычные карточки; их Markdown, чек-листы и файлы сохраняются. Удаление этапа из маршрута не удаляет карточки или ось матрицы.",
    },
    en: {
      title: "Goal Path",
      body: "Create a board with Goal Path layout or choose the route icon on an existing board. Add, rename and reorder steps in path settings. Attach ordinary cards with their Markdown, checklists and files intact. Removing a route step does not delete cards or its matrix axis.",
    },
  },
  {
    id: "goal-progress",
    ru: {
      title: "Готовность цели и порядок этапов",
      body: "Выберите ручной процент, завершённые обязательные этапы либо собственную метрику. Ручное значение сохраняется при смене режима. Этапы можно проходить свободно, возвращаться к ним и пропускать необязательные. Строгий порядок включается отдельно. Пустой набор обязательных этапов не считается автоматически завершённым.",
    },
    en: {
      title: "Goal progress and step order",
      body: "Choose manual progress, completed required steps or your own metric. The manual value survives mode changes. Visit steps freely, return to earlier ones and skip optional steps. Enable strict ordering explicitly. No required steps means unset progress, never automatic completion.",
    },
  },
  {
    id: "goal-metrics",
    ru: {
      title: "Собственные метрики",
      body: "Задайте название, старт, цель, единицу и направление метрики. Текущее значение можно изменять отдельно либо записью измерения с выбранной датой. Измерение задним числом меняет текущий показатель только при включённом «Сделать текущим значением». История и график отображают ваши значения без нормативов или советов.",
    },
    en: {
      title: "Your own metrics",
      body: "Define a name, start, target, unit and direction. Edit the current value directly or record a dated measurement. Backdated measurements affect the current value only with Use as current value checked. History and the chart show your own values without norms or advice.",
    },
  },
  {
    id: "deadline-actions",
    ru: {
      title: "Действия по сроку",
      body: "Срок по умолчанию только подсвечивается. В карточке раскройте «Автоматизация» → «Действие по сроку», задайте действие и сохраните. Завершённые и архивные задачи пропускаются без отдельных разрешений. Общий таймер проверяет ближайший срок; после закрытия Bordena пропущенные события проверятся при следующем запуске. Неизменённый срок выполняется один раз.",
    },
    en: {
      title: "Deadline Actions",
      body: "Deadlines are highlighted by default. In a card open Automation → Deadline Action, choose an action and save. Completed and archived tasks are skipped unless explicitly allowed. One scheduler watches the nearest deadline. Events missed while Bordena was closed are checked at next start. An unchanged deadline runs once.",
    },
  },
  {
    id: "conditional-actions",
    ru: {
      title: "Правила Если → Тогда",
      body: "Добавьте правило в автоматизации карточки: срок, непустой чек-лист, явные 100%, обязательные этапы цели, собственная метрика или диапазон связанной доски. Действие меняет секцию, этап, состояние, явный процент, завершает этап цели либо пишет историю. Сохранение явно включает правило. Правило можно отключить, приостановить или удалить. Конфликты назначений не двигают карточку.",
    },
    en: {
      title: "If → Then rules",
      body: "Add a card rule based on deadline, a nonempty checklist, explicit 100%, required goal steps, your metric or linked progress range. Actions assign section, stage, state or manual progress, complete a goal step or log history. Saving explicitly enables a rule; disable, pause or remove it later. Conflicting assignments do not move the card.",
    },
  },
  {
    id: "planning-templates",
    ru: {
      title: "Шаблоны целей и отмена",
      body: "В общем каталоге доступны 19 структур целей для личных проектов, учёбы, видео, разработки и музыки. Новые копии получают собственные ID и не наследуют фактические измерения. Примеры и их правила включаются отдельно. Автоматические действия входят в общую историю. Ctrl+Z вне редактора отменяет последнее структурное действие и сохраняет поздний текст; несовместимая ручная правка блокирует отмену. Событие после Undo не выполняется повторно.",
    },
    en: {
      title: "Goal templates and undo",
      body: "The shared catalog includes 19 goal structures for personal projects, study, video, software and music. Copies get fresh IDs and never inherit actual measurements. Examples and their rules require separate opt-in. Automation uses shared history. Ctrl+Z outside the editor undoes the last structural action while preserving later text; conflicting manual edits block undo. An undone event does not fire again.",
    },
  },
]

