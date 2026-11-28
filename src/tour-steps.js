// Match each target to a data-tour attribute. Order here is the order in the tour.
export const projectTour = [
  {
    target: "project-switcher",
    screen: 1,
    title: "Projekte",
    text: "Beginnen Sie mit dem Seminarthema. Der Entwurf bleibt in diesem Browser. Unter „Projekte“ wechseln Sie den Entwurf oder legen einen neuen an.",
  },
  {
    target: "save-online",
    screen: 1,
    reveal: true,
    online: true,
    title: "Online speichern",
    text: "Speichern Sie das Projekt einmal online. Danach werden Änderungen automatisch synchronisiert. Den Speicherstand sehen Sie unter der Überschrift.",
  },
  {
    target: "project-workshop",
    fallbackTarget: "project-archive",
    archive: true,
    online: true,
    title: "Projekt einem Workshop zuordnen",
    text: "Treten Sie über den Einladungslink einem Workshop bei. Unter „Projekte verwalten“ können Sie dann das aktuelle Projekt zuordnen.",
  },
  {
    target: "project-archive",
    archive: true,
    offline: true,
    title: "Projekte verwalten",
    text: "Hier finden Sie Ihre Entwürfe auf diesem Gerät. Sie können Projekte als JSON herunterladen oder wieder importieren.",
  },
  {
    target: "learning",
    screen: 2,
    title: "Lernerlebnisse",
    text: "Wählen Sie aus, was die Teilnehmenden im Spiel erleben und dabei lernen sollen.",
  },
  {
    target: "mechanics",
    screen: 3,
    title: "Mechaniken",
    text: "Wählen Sie Spielmechaniken, die zu Ihren Lernerlebnissen passen.",
  },
  {
    target: "priority",
    screen: 4,
    title: "Übersicht",
    text: "Sortieren Sie die Mechaniken nach Priorität und wählen Sie aus, welche ins Arbeitsblatt kommen.",
  },
  {
    target: "worksheet-menu",
    fallbackTarget: "worksheet-entry",
    screen: 5,
    title: "Arbeitsblatt",
    text: "Öffnen oder erstellen Sie das Arbeitsblatt aus Ihrer Auswahl. Im Menü „Arbeitsblatt“ können Sie später Blätter wechseln oder weitere anlegen.",
  },
  {
    target: "add-card",
    fallbackTarget: ["edit-worksheet", "worksheet-menu", "worksheet-entry"],
    screen: 5,
    title: "Karte hinzufügen",
    text: "Gehen Sie im Arbeitsblatt zum passenden Kartentyp und wählen Sie „Karte hinzufügen“. Im Selbststudium öffnen Sie bei Bedarf zuerst „Arbeitsblatt bearbeiten“.",
  },
  {
    target: "print-cards",
    fallbackTarget: ["card-menu", "worksheet-menu", "worksheet-entry"],
    reveal: true,
    screen: 5,
    title: "Karten drucken",
    text: "Sobald eine Karte da ist, öffnen Sie „Karten → Karten drucken“. Dort wählen Sie Karten und Druckeinstellungen. Das ganze Blatt drucken Sie über „Arbeitsblatt drucken“.",
  },
];

export const adminTour = [
  {
    target: "admin-workshops",
    section: "workshops",
    title: "Workshops",
    text: "Legen Sie einen Workshop an und teilen Sie den Einladungslink oder QR-Code. Pro Workshop können Sie eine Inhaltsfassung für neue Projekte wählen.",
  },
  {
    target: "admin-projects",
    section: "projects",
    title: "Online-Projekte",
    text: "Hier finden Sie die online gespeicherten Projekte. Mit „Workshops zuordnen“ verknüpfen Sie ein Projekt mit einem Workshop.",
  },
  {
    target: "admin-members",
    section: "members",
    title: "Mitglieder",
    text: "Wählen Sie einen Workshop aus, um seine Mitglieder zu verwalten und die Moderation zu vergeben.",
  },
  {
    target: "admin-submissions",
    section: "submissions",
    title: "Abgaben",
    text: "Hier finden Sie die an die Workshopmoderation eingereichten Arbeitsblätter. Sie können sie als JSON oder Markdown herunterladen und als gesichtet markieren.",
  },
];
