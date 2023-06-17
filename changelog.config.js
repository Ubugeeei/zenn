module.exports = {
  disableEmoji: false,
  maxMessageLength: 128,
  minMessageLength: 2,
  format: "{type}: {emoji}{subject}",
  list: [
    "write",
    "update",
    "typo",
    "link",
    "style",
    "tweak",
    "other",
    "milestone",
  ],
  questions: ["type", "subject"],
  scopes: [],
  types: {
    write: {
      description: "online book writing (new writing)",
      value: "write",
      emoji: "📜",
    },
    update: {
      description: "update online book content",
      value: "update",
      emoji: "📝",
    },
    typo: {
      description: "typo fix",
      value: "typo",
      emoji: "📌",
    },
    link: {
      description: "update link",
      value: "link",
      emoji: "🔗",
    },
    style: {
      description: "update book styles (format, order, etc.)",
      value: "style",
      emoji: "✨",
    },
    tweak: {
      description: "tweak",
      value: "tweak",
      emoji: "🔧",
    },
    other: {
      description: "other changes",
      value: "other",
      emoji: "🔹",
    },
    milestone: {
      description: "update milestone",
      value: "milestone",
      emoji: "🏁",
    },
  },
};
