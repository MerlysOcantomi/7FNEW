import type { BeautyMarketingMessages } from "./types"

/** English catalog for Finesse Marketing. */
export const en = {
  locale: "en",
  brandChip: "Finesse · by Sevenef",
  preview: {
    chip: "Preview · sample data",
    tooltip:
      "Sample data: changes are not saved and nothing is published to your social accounts yet — real connections come later.",
  },
  header: {
    title: "Marketing",
    description:
      "Turn your work into publications. Freya prepares the content, you just approve.",
    uploadCta: "Upload photos",
    weekLabel: "This week",
    mobileTagline: "Your photos, prepared by Freya",
    readyPhotos: (count) => (count === 1 ? "1 photo ready" : `${count} photos ready`),
    scheduledPosts: (count) => (count === 1 ? "1 scheduled" : `${count} scheduled`),
    activeCampaigns: (count) =>
      count === 1 ? "1 active campaign" : `${count} active campaigns`,
  },
  featured: {
    sectionTitle: "Today's post",
    sectionHint: "prepared by Freya",
    freyaPrepared: "prepared the caption",
    goalLabel: "Goal",
    bestTimeLabel: "Best time",
    publishNow: "Publish now",
    schedule: "Schedule",
    edit: "Edit",
    channelPendingNote:
      "The channel connection is still pending. Once approved, the post is ready to go out as soon as you connect your account.",
    approvedState: "Approved · channel connection pending",
    scheduledState: "Scheduled",
    empty: {
      title: "You have no work ready to publish yet.",
      description: "Upload a photo and Freya will create a proposal for you.",
      action: "Upload my first work",
    },
  },
  gallery: {
    sectionTitle: "Your work",
    sectionHint: "recent photos",
    uploadTile: "Upload photos",
    viewAll: "View full gallery →",
    preparePost: "Prepare post",
    preparePostAria: (title) => `Prepare post: ${title}`,
    empty: {
      title: "No photos of your work yet.",
      description: "Upload your first work so Freya can start preparing content.",
      action: "Upload my first work",
    },
  },
  calendar: {
    sectionTitle: "Content calendar",
    sectionHint: "next 7 days",
    mobileToggle: "View content calendar",
    empty: "No posts scheduled for these days.",
    itemKindLabels: {
      post: "Post",
      reel: "Reel",
      story: "Story",
      "campaña": "Campaign",
    },
  },
  freya: {
    name: "Freya",
    role: "creative studio",
    readyForReview: (count) => (count === 1 ? "1 ready" : `${count} ready`),
    empty: "Upload a photo of your latest work and I'll prepare a post proposal for you.",
  },
  campaigns: {
    sectionTitle: "Simple campaigns",
    activeCountHint: (count) => (count === 1 ? "1 active" : `${count} active`),
    approve: "Approve",
    view: "View",
    pause: "Pause",
    resume: "Resume",
    detail: "View details",
    empty: {
      title: "No campaigns for now.",
      description: "Fiona will suggest simple campaigns when she sees an opportunity.",
    },
    audienceFallback: "people",
    transitionToast: (status) => {
      switch (status) {
        case "sugerida":
          return "Campaign suggested."
        case "aprobada":
          return "Campaign approved."
        case "programada":
          return "Campaign scheduled."
        case "activa":
          return "Campaign activated."
        case "pausada":
          return "Campaign paused."
        case "finalizada":
          return "Campaign finished."
      }
    },
  },
  pulse: {
    sectionTitle: "Social pulse",
    sectionHint: "last 7 days",
    channelsPendingNote: "Connect your social accounts to see real data here.",
  },
  upload: {
    title: "Upload photos of a work",
    takePhoto: "Take a photo",
    fromGallery: "Choose from gallery",
    selectHint: "You can select several images at once.",
    clientLabel: "Client (optional)",
    clientPlaceholder: "Maria",
    serviceLabel: "Service performed (optional)",
    servicePlaceholder: "Semi-permanent manicure",
    styleLabel: "Style or treatment (optional)",
    stylePlaceholder: "Rose nude chrome",
    beforeAfterLabel: "It's a before & after",
    notesLabel: "Notes for Freya (optional)",
    notesPlaceholder: "E.g.: highlight the glossy finish…",
    confirm: "Save work",
    cancel: "Cancel",
    errorType: "Only images are allowed.",
    errorEmpty: "Select at least one image.",
    successToast: "Work saved. You can now prepare its post.",
    defaultWorkTitle: "New work",
    removeImageAria: (name) => `Remove ${name}`,
  },
  editPost: {
    title: "Edit post",
    titleLabel: "Title or context",
    captionLabel: "Caption",
    hashtagsLabel: "Hashtags",
    hashtagsHint: "Comma-separated, no # needed.",
    channelLabel: "Channel",
    kindLabel: "Content type",
    goalLabel: "Goal",
    ctaLabel: "Call to action",
    save: "Save changes",
    cancel: "Cancel",
    errorCaption: "The caption cannot be empty.",
    successToast: "Post updated.",
  },
  schedule: {
    title: "Schedule post",
    dateLabel: "Date",
    timeLabel: "Time",
    channelLabel: "Channel",
    confirm: "Schedule",
    cancel: "Cancel",
    errorPast: "Choose a future date and time.",
    successToast: "Post scheduled.",
  },
  publish: {
    approvedToast: "Post approved. It will go out as soon as you connect the channel.",
    proposalNote: "Initial proposal · edit it to your liking",
  },
  errorState: {
    title: "We couldn't load Marketing.",
    description: "Please try again in a few seconds.",
    retry: "Retry",
  },
  a11y: {
    loadingMarketing: "Loading Marketing",
    workPhotoAlt: (title) => `Photo: ${title}`,
    workPhotoFallback: "Photo of the work",
  },
  workStatusLabels: {
    nuevo: "New",
    sin_usar: "Unused",
    preparado: "Prepared",
    programado: "Scheduled",
    publicado: "Published",
  },
  postStatusLabels: {
    borrador: "Draft",
    preparada: "Ready",
    aprobada: "Approved",
    programada: "Scheduled",
    publicada: "Published",
  },
  campaignStatusLabels: {
    sugerida: "Suggested",
    aprobada: "Approved",
    programada: "Scheduled",
    activa: "Active",
    pausada: "Paused",
    finalizada: "Finished",
  },
  channelLabels: {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
  },
  kindLabels: {
    post: "Post",
    reel: "Reel",
    story: "Story",
    carrusel: "Carousel",
  },
  agentLabels: { fiona: "Fiona", freya: "Freya" },
  draftTemplates: {
    fallbackSubject: "work",
    caption: ({ subject, clientName, beforeAfter }) =>
      `${subject}${clientName ? ` for ${clientName}` : ""}, fresh from the studio ✨${
        beforeAfter ? " Real before & after, no filters." : ""
      } Shall we book yours? A few slots left this week 💅`,
    goal: "Attract new clients",
    cta: "Book your appointment",
  },
  demo: {
    works: {
      w1: {
        title: "Rose Nude Chrome · María",
        clientName: "María",
        service: "Semi-permanent manicure",
        style: "Rose nude chrome",
      },
      w2: {
        title: "Floral nail art · Marta",
        clientName: "Marta",
        service: "Nail art",
        style: "Spring floral",
      },
      w3: {
        title: "Baby boomer · Laura",
        clientName: "Laura",
        service: "Semi-permanent manicure",
        style: "Baby boomer",
      },
      w4: {
        title: "Red polish · Andrea",
        clientName: "Andrea",
        service: "Polish",
        style: "Classic red",
      },
      w5: {
        title: "Modern French · Sara",
        clientName: "Sara",
        service: "Manicure",
        style: "Modern French",
      },
    },
    posts: {
      p1: {
        title: "María's Rose Nude Chrome came out picture-perfect.",
        caption:
          "Rose nude with a mirror finish ✨ The shade that works all year round. Shall we book yours? A few slots left this week 💅",
        hashtags: ["RoseNude", "nailsWithStyle", "manicure"],
        goal: "Attract new clients",
        bestTime: "Today 19:00",
        cta: "Book your appointment",
      },
      p2: {
        title: "Marta's floral nail art",
        caption:
          "Flowers that last longer than a bouquet 🌸 Freehand nail art to open the season.",
        hashtags: ["nailart", "floral", "manicure"],
        goal: "Show recent work",
        bestTime: null,
        cta: "Message us for your design",
      },
      p3: {
        title: "Laura's baby boomer",
        caption:
          "The gradient that never fails. Baby boomer with a natural finish for every day ✨",
        hashtags: ["babyBoomer", "naturalNails"],
        goal: "Reach",
        bestTime: null,
        cta: null,
      },
    },
    campaigns: {
      c1: {
        title: "“Summer nails” under way",
        reason: "3 posts scheduled · 480 people reached.",
        audienceLabel: "people reached",
      },
      c2: {
        title: "“Back to colour” for clients who haven't booked in a while",
        reason: "14 clients without a booking for 2+ months · Freya already prepared the pieces.",
        audienceLabel: "clients without a booking for 2+ months",
      },
    },
    pulse: {
      periodLabel: "last 7 days",
      metrics: {
        followers: { label: "Followers", value: "1,240", delta: "+18 this month" },
        reach: { label: "Reach", value: "4.8k", delta: "+32% vs last week" },
        saves: { label: "Saves", value: "96", delta: "+11 today" },
        inquiries: { label: "Enquiries", value: "12", delta: "+3 this week" },
        newClients: { label: "Clients from content", value: "3", delta: "this week" },
      },
      insight:
        "3 new clients wrote this week after seeing a post. Fanny is already looking after them.",
    },
    freyaMessage:
      "María's Rose Nude is ready to publish and there's a reel idea from Laura's baby boomer. Publish today before 19:00 for more reach.",
  },
} satisfies BeautyMarketingMessages
