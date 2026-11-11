# Происхождение Bordena

Bordena — самостоятельная программа CHOPIK Team, основанная на исходниках
Doska: https://github.com/romenkova/doska.

Исходный commit: `72dfc55fd5a8f41fb06449c0eda3b0bce83dc562`.
Doska: Copyright (c) 2026 Margarita Romenkova, MIT.
Автор Bordena: Станислав Смирнов (Stanislav Smirnov), CHOPIK Team.
Изменения Bordena: Copyright (c) 2026 Stanislav Smirnov, CHOPIK Team, MIT.
Полный текст и исходное уведомление сохранены в LICENSE.

Никакой связи, одобрения или сопровождения Bordena автором Doska не заявляется.
Код Kanri не использовался.

Изменения: независимые Tauri/Cargo/NSIS identity; локальный host HTTP и Files;
отдельные IndexedDB и WebView2 profile; импорт/экспорт и резервные копии;
русские надписи, собственная стартовая доска, меню логотипа; отключены серверные
точки входа, автообновления и PWA. Неиспользуемые upstream модули вынесены в отдельный обратимый архив,
но в Windows-продукт включается только достижимая desktop/client dependency graph.
Старые CI перенесены в docs/upstream/workflows как неисполняемые reference-файлы:
они публиковали серверные образы и релизы Doska, что неприемлемо для Bordena.

Логотип предоставлен пользователем 16.10.2026, исходное имя:
`Глянцевая 3D-эмблема B с папками.png`.
SHA256: `f804d74a4a50fce3c9d5a949a7eb6f90e5bfb1997fcb902d2f054b6a7190881e`.
Оригинальный PNG сохранён без изменений в assets/bordena-logo.png.
Иконки созданы штатной командой Tauri icon. Логотип не заимствован из Doska;
его предоставление не означает автоматического перелицензирования сторонних прав под MIT.

Подробности зависимостей и шрифтов: docs/THIRD_PARTY_LICENSES.md.

