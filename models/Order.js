const mongoose = require("mongoose");
const { getCurrentDateTime } = require("../models/Constant");

const Orderschema = mongoose.Schema(
  {
    Order_no: { type: String, required: false },
    Tax: { type: Number },
    DeliveryCost: { type: Number },
    Total: { type: Number, required: false },
    TotalDiscount: { type: Number },
    Admin_Total: { type: Number, required: false },
    provider_Total: { type: Number, required: false },
    NetTotal: { type: Number, required: false },
    StatusId: { type: Number },
    createAt: { type: Date },
    dt_date: { type: Date },
    dt_time: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
    couponCode: { type: String },
    PaymentType: { type: Number },
    OrderType: { type: Number },
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "employees" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    items: {
      type: [
        {
          product_id: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
          qty: { type: Number },
          Total: { type: Number },
          TotalDiscount: { type: Number },
          createAt: { type: Date },
        },
      ],
    },
    notes: { type: String },
    place_id: { type: mongoose.Schema.Types.ObjectId, ref: "place" },
    is_address_book: { type: Boolean },
    address_book: { type: String },
    isExpress:{type:Boolean}
  },
  { versionKey: false }
);

const RateSchema = mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    employee_id: { type: mongoose.Schema.Types.ObjectId, ref: "employees" },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    rate_from_user_to_provider: { type: Number },
    note_from_user_to_provider: { type: String },
    createAt: { type: Date },
    type: { type: Number },
  },
  { versionKey: false }
);

const PaymentSchema = mongoose.Schema(
  {
    no: { type: String },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    to: { type: String },
    amount: { type: Number },
    createAt: { type: Date },
    type: { type: String },
  },
  { versionKey: false }
);

Orderschema.index({ user_id: 1, StatusId: 1 });
Orderschema.index({ createAt: 1 });

RateSchema.index({ createAt: 1 });
RateSchema.index({ Order_no: 1 });

// Orderschema.index({ "supplier": 1 })
// Orderschema.index({ by_user_id: 1, StatusId: 1 });

const Order = mongoose.model("Order", Orderschema);
const Rate = mongoose.model("Rate", RateSchema);
const Payment = mongoose.model("Payment", PaymentSchema);

exports.Order = Order;
exports.Rate = Rate;
exports.Payment = Payment;
