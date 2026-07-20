import type { GlobalNewMessages } from "../types"

/** Italian source for the `globalNew` UI namespace. */
export const globalNew: GlobalNewMessages = {
  trigger: "Nuovo",
  title: "Nuovo",
  subtitle: "Crea in tutto il tuo workspace",
  close: "Chiudi il pannello Nuovo",
  groups: {
    capture: "Acquisizione",
    work: "Lavoro",
    assets: "Risorse",
    vertical: "Settore",
  },
  items: {
    conversation: {
      label: "Nuova conversazione",
      description: "Apre la posta per iniziare o proseguire il lavoro",
    },
    manualIntake: {
      label: "Inserimento manuale",
      description: "Acquisisci informazioni libere con smistamento via IA",
    },
    request: {
      label: "Nuova richiesta",
      description: "Rivedi e gestisci le richieste del portale",
    },
    quickNote: {
      label: "Nota rapida",
      description: "Acquisizione veloce come attività o promemoria",
    },
    client: {
      label: "Nuovo cliente",
      description: "Aggiungi un account o un potenziale cliente",
    },
    project: {
      label: "Nuovo progetto",
      description: "Pianifica il lavoro da consegnare",
    },
    task: {
      label: "Nuova attività",
      description: "Segui il lavoro operativo",
    },
    invoice: {
      label: "Nuova fattura",
      description: "Fatturazione e incassi",
    },
    document: {
      label: "Nuovo documento",
      description: "Libreria e file strutturati",
    },
    upload: {
      label: "Carica file",
      description: "Aggiungi file al workspace",
    },
    contentCampaign: {
      label: "Nuovo contenuto / campagna",
      description: "Contenuti di marketing e campagne",
    },
  },
}
