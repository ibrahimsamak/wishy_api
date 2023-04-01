const mongoose = require("mongoose");

const Couponchema = mongoose.Schema(
  {
    coupon: {
      type: String,
      required: [true, "Coupon is required"],
      minlength: [2, "Coupon must be least 2 character"],
      maxlength: [8, "Coupon must be less than 8 character"],
    },
    dt_from: {
      type: Date,
      required: [true, "Coupon start date is required"],
    },
    dt_to: {
      type: Date,
      required: [true, "Coupon end date is required"],
    },
    days: {
      type: Number,
    },
    discount_rate: {
      type: Number,
      required: [true, "Coupon discount is required"],
    },
    isActive: {
      type: Boolean,
    },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    place_id: { type: mongoose.Schema.Types.ObjectId, ref: "place" },
    city_id: { type: mongoose.Schema.Types.ObjectId, ref: "city" },
  },
  { versionKey: false }
);

const coupon = mongoose.model("coupons", Couponchema);
exports.coupon = coupon;
