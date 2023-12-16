const Joi = require("@hapi/joi");
Joi.objectId = require("joi-objectid")(Joi);

const { date, string } = require("@hapi/joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Joigoose = require("joigoose")(mongoose);
const { getCurrentDateTime } = require("./Constant");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");

const employeeSchema = mongoose.Schema(
  {
    full_name: {
      type: String,
      required: [true, "name is required"],
    },
    phone_number: {
      type: String,
      required: [true, "phone number is required"],
    },
    email: {
      type: String,
      required: [true, "email is required"],
      match: [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,3}$/, "Invalid email"],
    },
    password: {
      type: String,
      required: [true, "password is required"],
    },
    image: {
      type: String,
    },
    address: {
      type: String,
    },
    createAt: {
      type: Date,
      default: getCurrentDateTime(),
    },
    isBlock: {
      type: Boolean,
      default: false,
    },
    isVerify: {
      type: Boolean,
    },
    isEnableNotifications: {
      type: Boolean,
    },
    token: {
      type: String,
    },
    fcmToken: {
      type: String,
    },
    os: {
      type: String,
    },
    verify_code: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
    },
    isAvailable: {
      type: Boolean,
    },
    rate: {
      type: Number,
      default: 0
    },
    supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: "supervisor", required: [true, "supervisor is required"], },
    supplier_id: { type: mongoose.Schema.Types.ObjectId, ref: "supplier"}
  },
  { versionKey: false }
);

const employee = mongoose.model("employees", employeeSchema);
exports.employee = employee;
