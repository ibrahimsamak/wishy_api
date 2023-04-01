const mongoose = require("mongoose");
const { number } = require("@hapi/joi");

const Advschema = mongoose.Schema(
  {
    arTitle: {
      type: String,
      required: [true, "Arabic title is required"],
    },
    enTitle: {
      type: String,
      required: [true, "English title is required"],
    },
    arDescription: {
      type: String,
    },
    enDescription: {
      type: String,
    },
    image: {
      type: String,
    },
    expiry_date: {
      type: Date,
      required: [true, "Advs expire date is required"],
    },
    ads_for: {
      type: Number,
      required: [true, "Advs type is required"],
    },
    createAt: {
      type: Date,
    },
    is_ads_redirect_to_store: {
      type: Boolean,
    },
    url: {
      type: String,
    },
    store_id: {
      type: String,
    },
    product_id: {
      type: String,
    },
    is_ads_have_expiry_date: {
      type: Boolean,
    },
    by: {
      type: String,
    },
    isApprove: {
      type: Boolean,
    },
    isActive: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

const Adv = mongoose.model("advs", Advschema);

exports.Adv = Adv;
