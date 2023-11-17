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
  },
  { versionKey: false }
);


const CouponUsageSchema = mongoose.Schema(
  {
    coupon: { type: String },
    dt_date: { type: Date },   
    amount: { type: Number },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },

  },
  { versionKey: false }
);


const coupon = mongoose.model("coupons", Couponchema);
const coupon_usage = mongoose.model("coupons_usage", CouponUsageSchema);

exports.coupon = coupon;
exports.coupon_usage = coupon_usage;
