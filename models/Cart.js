const mongoose = require("mongoose");
const { getCurrentDateTime, variation } = require("../models/Constant");

const CartSchema = mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    variation_id: { type: mongoose.Schema.Types.ObjectId, ref: "variation" },
    // supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    qty: { type: Number },
    Total: { type: Number },
    TotalDiscount: { type: Number },
    createAt: { type: Date }
  },
  { versionKey: false }
);

CartSchema.index({ user_id: 1 });
const _Cart = mongoose.model("Cart", CartSchema);

exports.Cart = _Cart;
