const mongoose = require("mongoose");
const { getCurrentDateTime } = require("../models/Constant");

const Orderschema = mongoose.Schema(
  {
    payment_id: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    price: { type: Number },
    order_no: { type: String, required: false },
    tax: { type: Number },
    total: { type: Number, required: false },
    admin_total: { type: Number, required: false },
    provider_total: { type: Number, required: false },
    new_total: { type: Number, required: false, default: 0 },
    new_tax: { type: Number, required: false, default: 0 },
    totalDiscount: { type: Number },
    netTotal: { type: Number, required: false },
    status: { type: String },
    createAt: { type: Date },
    period: { type: Number },
    dt_date: { type: Date },
    dt_time: { type: String },
    couponCode: { type: String },
    paymentType: { type: String },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: "category"},
    sub_category_id: { type: mongoose.Schema.Types.ObjectId, ref: "subcategory"} ,
    extra:{type:[ {type: mongoose.Schema.Types.ObjectId, ref: "subcategory"} ]},
    user: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "supervisor" },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "employees" },
    address: { type: mongoose.Schema.Types.ObjectId, ref: "user_address" },
    place: { type: mongoose.Schema.Types.ObjectId, ref: "place" },
    notes: { type: String },
    canceled_note: { type: String },
    update_code: { type: String, default:"" },
    loc: {
      type: { type: String },
      coordinates: {type:[Number]},
    },
  },
  { versionKey: false }
);


const RateSchema = mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    driver_id: { type: mongoose.Schema.Types.ObjectId, ref: "employees" },
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
    type: { type: String },
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

Orderschema.index({ loc: "2dsphere" });
Orderschema.index({ user_id: 1, status: 1 });
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
