// Match each target to a data-tour attribute. Order here is the order in the tour.
export const projectTour = [
  {
    target: "project-switcher",
    title: "Projekte",
    text: "Ihre Änderungen werden auf diesem Gerät im Browser gespeichert. Unter „Projekte“ wechseln Sie den Entwurf oder legen einen neuen an.",
  },
  {
    target: "save-online",
    reveal: true,
    online: true,
    title: "Online speichern",
    text: "Speichern Sie das Projekt mit Ihrem Konto online. Danach können Sie es auch auf anderen Geräten unter „Online-Projekte“ öffnen.",
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
