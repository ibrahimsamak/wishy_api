const mongoose = require("mongoose");

const Notificationschema = mongoose.Schema(
  {
    fromId: {
      type: String,
    },
    user_id: {
      type: String,
    },
    fromName: {
      type: String,
    },
    toName: {
      type: String,
    },
    title: {
      type: String,
    },
    msg: {
      type: String,
    },
    dt_date: {
      type: Date,
    },
    type: {
      type: Number,
    },
    body_parms: {
      type: String,
    },
    isRead: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

Notificationschema.index({ user_id: 1, isRead: 1 });
const Notifications = mongoose.model("Notification", Notificationschema);

exports.Notifications = Notifications;
