import type { GlobalNewMessages } from "../types"

/** French source for the `globalNew` UI namespace. */
export const globalNew: GlobalNewMessages = {
  trigger: "Nouveau",
  title: "Nouveau",
  subtitle: "Créer dans tout votre workspace",
  close: "Fermer le panneau Nouveau",
  groups: {
    capture: "Capture",
    work: "Travail",
    assets: "Ressources",
    vertical: "Métier",
  },
  items: {
    conversation: {
      label: "Nouvelle conversation",
      description: "Ouvre la boîte de réception pour démarrer ou poursuivre le travail",
    },
    manualIntake: {
      label: "Saisie manuelle",
      description: "Capturez des informations libres avec routage par IA",
    },
    request: {
      label: "Nouvelle demande",
      description: "Consultez et gérez les demandes du portail",
    },
    quickNote: {
      label: "Note rapide",
      description: "Capture éclair sous forme de tâche ou de rappel",
    },
    client: {
      label: "Nouveau client",
      description: "Ajoutez un compte ou un prospect",
    },
    project: {
      label: "Nouveau projet",
      description: "Planifiez le travail à livrer",
    },
    task: {
      label: "Nouvelle tâche",
      description: "Suivez le travail d'exécution",
    },
    invoice: {
      label: "Nouvelle facture",
      description: "Facturation et paiements",
    },
    document: {
      label: "Nouveau document",
      description: "Bibliothèque et fichiers structurés",
    },
    upload: {
      label: "Téléverser un fichier",
      description: "Ajoutez des fichiers au workspace",
    },
    contentCampaign: {
      label: "Nouveau contenu / campagne",
      description: "Contenus marketing et campagnes",
    },
  },
}
