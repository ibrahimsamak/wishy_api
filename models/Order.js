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
    Status: { type: String },
    createAt: { type: Date },
    dt_date: { type: Date },
    dt_time: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
    couponCode: { type: String },
    PaymentType: { type: String },
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
    canceled_note: { type: String },
    // place_id: { type: mongoose.Schema.Types.ObjectId, ref: "place" },
    is_address_book: { type: Boolean },
    address_book: { type: mongoose.Schema.Types.ObjectId, ref: "user_address" },
    isExpress:{type:Boolean}

  },
  { versionKey: false }
);


const RateSchema = mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    // supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "supplier" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    rate_from_user: { type: Number },
    note_from_user: { type: String },
    products: {
      type: [
        {
          product_id: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
          rate: { type: Number },
          note: { type: String },
        },
      ],
    },
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
