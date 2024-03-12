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

// var users = new Schema(Joigoose.convert(joiSchema));
const Users = mongoose.model("Users", UserSchema);
const Companies = mongoose.model("Companies", ComnpanySchema);
const User_Address = mongoose.model("user_address", UserAddressSchema);
const User_Uncovered = mongoose.model("user_uncovered", UnCoveredSchema);

exports.Users = Users;
exports.Companies = Companies;
exports.User_Address = User_Address;
exports.User_Uncovered = User_Uncovered;
exports.validateUsers = validatieUsers;
exports.getErrors = getErrors;
exports.setLanguage = setLanguage;
exports.getLanguage = getLanguage;
// var joiSchema = Joi.object()
//   .keys({
//     phone_number: Joi.string()
//       .length(12)
//       .empty()
//       .required()
//       .error((errors) => {
//         errors.forEach((err) => {
//           console.log(err.code);
//           switch (err.code) {
//             case "any.required":
//             case "string.base":
//             case "string.empty":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.PHONE_REQUIRED;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.PHONE_REQUIRED;
//               }
//               break;
//             case "string.length":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.PHONE_MAX;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.PHONE_MAX;
//               }
//               break;
//             default:
//               break;
//           }
//         });
//         return errors;
//       }),
//     os: Joi.string()
//       .required()
//       .empty()
//       .error((errors) => {
//         errors.forEach((err) => {
//           switch (err.code) {
//             case "any.required":
//             case "string.base":
//             case "string.empty":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.OS_REQUIRED;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.OS_REQUIRED;
//               }
//               break;
//             default:
//               break;
//           }
//         });
//         return errors;
//       }),
//     lat: Joi.number()
//       .required()
//       .empty()
//       .error((errors) => {
//         errors.forEach((err) => {
//           switch (err.code) {
//             case "any.required":
//             case "number.base":
//             case "number.empty":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.LAT_REQUIRED;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.LAT_REQUIRED;
//               }
//               break;
//             default:
//               break;
//           }
//         });
//         return errors;
//       }),
//     lng: Joi.number()
//       .required()
//       .empty()
//       .error((errors) => {
//         errors.forEach((err) => {
//           console.log(err.code);
//           switch (err.code) {
//             case "any.required":
//             case "number.base":
//             case "number.empty":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.LNG_REQUIRED;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.LNG_REQUIRED;
//               }
//               break;
//             default:
//               break;
//           }
//         });
//         return errors;
//       }),
//     fcmToken: Joi.string()
//       .required()
//       .empty()
//       .error((errors) => {
//         errors.forEach((err) => {
//           switch (err.code) {
//             case "any.required":
//             case "string.base":
//             case "string.empty":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.FCMTOKEN_REQUIRED;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.FCMTOKEN_REQUIRED;
//               }
//               break;
//             default:
//               break;
//           }
//         });
//         return errors;
//       }),
//     address: Joi.string()
//       .required()
//       .empty()
//       .error((errors) => {
//         errors.forEach((err) => {
//           switch (err.code) {
//             case "any.required":
//             case "string.base":
//             case "string.empty":
//               if (currentLanguage == LANGUAGE_ENUM.EN) {
//                 err.message = VALIDATION_MESSAGE_ENGLISH.ADDRESS_REQUIRED;
//               } else {
//                 err.message = VALIDATION_MESSAGE_ARABIC.ADDRESS_REQUIRED;
//               }
//               break;
//             default:
//               break;
//           }
//         });
//         return errors;
//       }),
//   })
//   .unknown(true);
