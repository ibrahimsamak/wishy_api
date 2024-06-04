const Joi = require("@hapi/joi");
Joi.objectId = require("joi-objectid")(Joi);

const { date, string, boolean } = require("@hapi/joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Joigoose = require("joigoose")(mongoose);
const { getCurrentDateTime } = require("../models/Constant");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
  getMessageOnLanguage,
} = require("../utils/constants");
var currentLanguage = "en";

const UserSchema = mongoose.Schema(
  {
    full_name: {
      type: String,
    },
    phone_number: {
      type: String,
    },
    email: {
      type: String,
    },
    password: {
      type: String,
    },
    image: {
      type: String,
    },
    address: {
      type: String,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    createAt: {
      type: Date,
      default: getCurrentDateTime(),
    },
    verify_code: {
      type: String,
    },
    isVerify: {
      type: Boolean,
      default: false,
    },
    isBlock: {
      type: Boolean,
      default: false,
    },
    wallet: {
      type: Number,
      default: 0,
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
    streetName:{
      type: String,
      default: "",
    },
    floorNo:{
      type: String,
      default: "",
    },
    buildingNo:{
      type: String,
      default: "",
    },
    flatNo:{
      type: String,
      default: ""
    },
    rate:{
      type: Number ,
      default: 0,
    },
    by:{
      type: String,
      default: ""
    },
  },
  { versionKey: false }
);

const UserAddressSchema = mongoose.Schema(
  {
    title: {
      type: String,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    address: {
      type: String,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    streetName:{
      type: String,
      default: "",
    },
    floorNo:{
      type: String,
      default: "",
    },
    buildingNo:{
      type: String,
      default: "",
    },
    flatNo:{
      type: String,
      default: ""
    },
    type:{
      type: String,
      default: ""
    },
    createAt: {
      type: Date,
      default: getCurrentDateTime(),
    },
    discount: {
      type: Number,
    },
  },
  { versionKey: false }
);

// function validateUsers(u, header) {
//   currentLanguage = header;
//   return joiSchema.validate(u, {
//     abortEarly: false,
//     allowUnknown: true,
//     stripUnknown: true,
//   });
// }

function validatieUsers(body) {
  for (var p in UserSchema.paths) {
    if (!body.phone_number && p == "phone_number")
      UserSchema.path(p).required(true);
    if (body.phone_number && p == "phone_number") {
      UserSchema.path(p).minlength(12);
      UserSchema.path(p).maxlength(12);
    }
    // if (body.full_name == null && p == "full_name") {
    //   UserSchema.path(p).required(true);
    //   UserSchema.path(p).minlength(3);
    // }
  }
}

function getErrors(error) {
  // language = language;
  let errorArray = [];
  var message = "";
  if (error) {
    if (error.errors["full_name"]) {
      message +=
        getMessageOnLanguage(
          VALIDATION_MESSAGE_ARABIC.NAME_REQUIRED,
          VALIDATION_MESSAGE_ENGLISH.NAME_REQUIRED,
          getLanguage()
        ) + ", ";
    }

    if (error.errors["email"]) {
      if (error.errors["email"].kind == "required") {
        message +=
          getMessageOnLanguage(
            VALIDATION_MESSAGE_ARABIC.EMAIL_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.EMAIL_REQUIRED,
            getLanguage()
          ) + ", ";
      }
      if (error.errors["email"].kind == "match") {
        message +=
          getMessageOnLanguage(
            VALIDATION_MESSAGE_ARABIC.VALID_EMAIL_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.VALID_EMAIL_REQUIRED,
            getLanguage()
          ) + ", ";
      }
    }

    if (error.errors["phone_number"]) {
      if (error.errors["phone_number"].kind == "required") {
        message +=
          getMessageOnLanguage(
            VALIDATION_MESSAGE_ARABIC.PHONE_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.PHONE_REQUIRED,
            getLanguage()
          ) + ", ";
      }
      if (
        error.errors["phone_number"].kind == "maxlength" ||
        error.errors["phone_number"].kind == "minlength"
      ) {
        message +=
          getMessageOnLanguage(
            VALIDATION_MESSAGE_ARABIC.PHONE_MAX,
            VALIDATION_MESSAGE_ENGLISH.PHONE_MAX,
            getLanguage()
          ) + ", ";
      }
    }

    return message;
  } else {
    return null;
  }
}

let language;
const setLanguage = (val) => {
  language = val;
};
const getLanguage = () => language;

const UnCoveredSchema = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    user_type: {
      type: String,
    },
    address: {
      type: String,
    },
    lng: {
      type: Number,
    },
    lat: {
      type: Number,
    },
    createAt: {
      type: Date,
      default: getCurrentDateTime(),
    },
  },
  { versionKey: false }
);

const ComnpanySchema = mongoose.Schema(
  {
    company_name: {
      type: String,
    },
    phone_number: {
      type: String,
    },
    email: {
      type: String,
    },
    address: {
      type: String,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    createAt: {
      type: Date,
      default: getCurrentDateTime(),
    },
  },
  { versionKey: false }
);

const WishGroupSchema = mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    name:{ type: String },
    createAt: { type: Date },
  },
  { versionKey: false }
);

const WishSchema = mongoose.Schema(
  {
    title: { type: String },
    description: { type: String },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: "wish_group" },
    total: { type: Number },
    all_pays: { type: Number },
    isShare: { type: Boolean },
    type: { type: String },
    pays: {
      type: [
        {
          user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
          total: { type: Number },
          createAt: { type: Date },
        },
      ],
    },
    isComplete: { type: Boolean, default: false },
    createAt: { type: Date },
    finishAt: { type: Date }
  },
  { versionKey: false }
);

const ReminderSchema = mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    title: { type: String },
    date: { type: String },
    before: { type:Number },
    createAt: { type: Date },
  },
  { versionKey: false }
);
const VIPSchema = mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: "event" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    gender: { type: String },
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
    date: { type: String },
    time: { type: String },
    note: { type: String },
    images: {
      type: [{ type: String }]
    },
    reciver_phone:{type: String},
    extra_note: { type: String },
    total: { type: Number },
    isNeedOffer: { type: Boolean },
    offer: { type: Number },
    createAt: { type: Date },
  },
  { versionKey: false }
);
const ProductRequestSchema = mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
    title: { type: String },
    note: { type: String },
    images: {
      type: [{ type: String }],
    },
    total: { type: Number },
    name: { type: String},
    iban: { type: String},
    createAt: { type: Date },
    createAt: { type: Date },
  },
  { versionKey: false }
);


const FriendSchema = mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    friend_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    createAt: {
      type: Date,
      default: getCurrentDateTime(),
    },
  },
  { versionKey: false }
);

FriendSchema.index({ user_id: 1 });
WishSchema.index({ user_id: 1 });
WishGroupSchema.index({ user_id: 1 })
ReminderSchema.index({ user_id: 1 })

const Wish = mongoose.model("wish", WishSchema);
const WishGroup = mongoose.model("wish_group", WishGroupSchema);
const Users = mongoose.model("Users", UserSchema);
const Companies = mongoose.model("Companies", ComnpanySchema);
const User_Address = mongoose.model("user_address", UserAddressSchema);
const User_Uncovered = mongoose.model("user_uncovered", UnCoveredSchema);
const Reminder = mongoose.model("reminder", ReminderSchema);
const VIP = mongoose.model("vip", VIPSchema);
const ProductRequest = mongoose.model("product_request", ProductRequestSchema);
const Friend = mongoose.model("friend", FriendSchema);

exports.Users = Users;
exports.Companies = Companies;
exports.User_Address = User_Address;
exports.User_Uncovered = User_Uncovered;
exports.Wish = Wish;
exports.WishGroup = WishGroup;
exports.Reminder = Reminder;
exports.VIP = VIP;
exports.ProductRequest = ProductRequest;
exports.Friend = Friend;

exports.validateUsers = validatieUsers;
exports.getErrors = getErrors;
exports.setLanguage = setLanguage;
exports.getLanguage = getLanguage;
