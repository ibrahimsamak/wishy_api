const mongoose = require("mongoose");
const { getCurrentDateTime } = require("../models/Constant");

const Orderschema = mongoose.Schema(
  {
    title: { type: String },
    f_lat: { type: Number },
    f_lng: { type: Number },
    t_lat: { type: Number },
    t_lng: { type: Number },
    max_price: { type: Number },
    min_price: { type: Number },
    price: { type: Number },
    f_address: { type: String },
    t_address: { type: String },
    order_no: { type: String, required: false },
    tax: { type: Number },
    deliveryCost: { type: Number },
    total: { type: Number, required: false },
    totalDiscount: { type: Number },
    netTotal: { type: Number, required: false },
    status: { type: String },
    createAt: { type: Date },
    dt_date: { type: Date },
    dt_time: { type: String },
    is_repeated: { type: Boolean },
    days: { type: [String] },
    couponCode: { type: String },
    paymentType: { type: Number },
    orderType: { type: Number },
    max_passenger: { type: Number },
    passengers:{type:[ {type: mongoose.Schema.Types.ObjectId, ref: "Users"} ]},
    offers:{type:[{
      user: {type: mongoose.Schema.Types.ObjectId, ref: "Users"},
      f_address: { type: String },
      t_address: { type: String },
      f_lat: { type: Number },
      f_lng: { type: Number },
      t_lat: { type: Number },
      t_lng: { type: Number },
      price: { type: Number },
      notes: { type: String },
      status: { type: String },
      dt_date: { type: Date },
      dt_time: { type: String },
    }]},
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    notes: { type: String },
    canceled_note: { type: String },
  },
  { versionKey: false }
);

const RateSchema = mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    driver_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    rate_from_user: { type: Number },
    note_from_user: { type: String },
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

const PaymentTransactionsSchema = mongoose.Schema(
  {
    order_no: { type: String },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    // admin: { type: String },
    total: { type: Number },
    createAt: { type: Date },
    paymentType: { type: String, enum: ["Cash", "Online", "Wallet"] },
    details: { type: String },
  },
  { versionKey: false }
);
PaymentTransactionsSchema.index({ provider_id: 1 });
PaymentTransactionsSchema.index({ employee_id: 1 });
PaymentTransactionsSchema.index({ createAt: 1 });

Orderschema.index({ user_id: 1, StatusId: 1 });
Orderschema.index({ createAt: 1 });

RateSchema.index({ createAt: 1 });
RateSchema.index({ Order_no: 1 });

// Orderschema.index({ "supplier": 1 })
// Orderschema.index({ by_user_id: 1, StatusId: 1 });

const Order = mongoose.model("Order", Orderschema);
const Rate = mongoose.model("Rate", RateSchema);
const Payment = mongoose.model("Payment", PaymentSchema);
const Transactions = mongoose.model("Transactions", PaymentTransactionsSchema);

exports.Order = Order;
exports.Rate = Rate;
exports.Payment = Payment;
exports.Transactions = Transactions
