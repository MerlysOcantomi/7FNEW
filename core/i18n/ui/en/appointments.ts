import type { AppointmentsMessages } from "../types"

/**
 * English source for the `appointments` namespace — the Finesse Beauty
 * appointment experience over the shared Calendar Engine. Beauty vocabulary
 * only; day/week/month/today/nav labels come from `calendar.*` and
 * save/cancel/edit/close from `common.*`. Born localized in all five locales.
 */
export const appointments: AppointmentsMessages = {
  title: "Appointments",
  subtitle: "Your bookings, hour by hour",
  new: "New appointment",
  count: (count) => (count === 1 ? "1 appointment" : `${count} appointments`),
  appointment: "Appointment",
  fields: {
    client: "Client",
    service: "Service",
    professional: "Professional",
    date: "Date",
    time: "Time",
    duration: "Duration",
    notes: "Notes",
    when: "When",
  },
  phase: {
    past: "Past",
    current: "In progress",
    upcoming: "Upcoming",
  },
  durationLabel: (minutes) => {
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
  },
  openSlot: "Open slot",
  conflict: "Time conflict",
  conflictHint: "Overlaps another appointment",
  detail: {
    heading: "Appointment details",
    openClient: "Open client",
    noClient: "No client linked",
    noService: "No service",
    noNotes: "No notes",
    noEnd: "No end time",
  },
  form: {
    createHeading: "New appointment",
    editHeading: "Edit appointment",
    rescheduleHeading: "Reschedule appointment",
    clientLabel: "Client",
    clientPlaceholder: "Select a client",
    serviceLabel: "Service",
    servicePlaceholder: "Select a service",
    customServiceLabel: "Custom service",
    dateLabel: "Date",
    timeLabel: "Start time",
    durationLabel: "Duration (minutes)",
    notesLabel: "Note",
    notesPlaceholder: "Optional note",
    submitCreate: "Create appointment",
    submitSave: "Save changes",
    submitting: "Saving…",
    clientRequired: "Select a client",
    serviceRequired: "Choose or type a service",
    dateRequired: "Pick a date",
    timeRequired: "Pick a start time",
    conflictWarning: "This time overlaps another appointment.",
    noServicesYet: "No services configured yet.",
    manageServices: "Manage services",
    noClientsYet: "No clients yet.",
    addClient: "Add a client",
  },
  actions: {
    reschedule: "Reschedule",
    cancel: "Cancel appointment",
    cancelConfirmHeading: "Cancel this appointment?",
    cancelConfirmBody: "This frees the slot and removes the booking. This cannot be undone.",
    open: "Open",
  },
  toast: {
    created: "Appointment created",
    updated: "Appointment updated",
    rescheduled: "Appointment rescheduled",
    cancelled: "Appointment cancelled",
    error: "Something went wrong. Please try again.",
  },
  states: {
    loading: "Loading appointments…",
    emptyTitle: "No appointments yet",
    emptyBody: "Book your first appointment to start your agenda.",
    emptyCreate: "New appointment",
    emptyDayTitle: "No appointments this day",
    emptyDayBody: "This day is open — a clean block to book.",
    errorTitle: "Couldn't load appointments",
    errorBody: "There was a problem loading your agenda.",
    retry: "Try again",
  },
  aria: {
    previousPeriod: "Previous period",
    nextPeriod: "Next period",
    goToday: "Go to today",
    openAppointment: (title) => `Open appointment: ${title}`,
    closeDetail: "Close details",
    closeForm: "Close form",
  },
}
