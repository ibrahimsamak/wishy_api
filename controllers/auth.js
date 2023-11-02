const jwt = require("jsonwebtoken");
const config = require("config");
const { Users } = require("../models/User");
const { Admin } = require("../models/Admin");
const { getCurrentDateTime, place } = require("../models/Constant");
const { success, errorAPI } = require("../utils/responseApi");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");
const { employee } = require("../models/Employee");
const { Supplier } = require("../models/Product");

let ADMIN_URL_ID = {
  DASHBOARD: "Home",
  MYPROFILE: "Profile",
  MYNOTIFICATIONS: "Mynotifications",
  MYMESSAGES: "Mymessages",
  //Settings
  SETTINGS: "Settings",
  WALLET: "Wallet",
  WELCOME: "Welcome",
  TYPES: "Types",
  CATEGORY: "Category",
  SUBCATEGORY: "SubCategory",
  CITY: "City",
  SIZE: "Size",
  STATIC: "Static",
  CONTACT: "Contact",
  COMPLAINS: "Complains",
  //Advs
  ADS: "Ads",
  COUPON: "Coupon",
  //users
  USER: "User",
  STORES: "Store",
  ADMINS: "Admins",
  //Orders
  ORDERS: "Orders",
  MAP: "Map",
  USERRATE: "UsersRate",
  PROVIDERRATE: "ProvidersRate",
  //Payments
  ORDEREARNING: "OrderEarning",
  TRANSACTION: "Transaction",
  //Notifications
  EMAILS: "emails",
  SMS: "sms",
  NOTIFICATIONS: "Notifications",
  //Stores Data
  EMPLOYEE: "العاملين",
  SERVICES: "الخدمات",
  PRODUCTS: "المنتجات",
};

let ADMIN_URL_STRINGS = {
  DASHBOARD: "الرئيسية",
  MYPROFILE: "الملف الشخصي",
  MYNOTIFICATIONS: "طلبات مزودين الخدمات",
  MYMESSAGES: "الرسائل",
  //Settings
  SETTINGS: "الاعدادات العامة",
  WALLET: "اعدادات المحفظة",
  WELCOME: "الشاشات الترحيبية",
  TYPES: "انواع المزودين",
  CATEGORY: "التصنيفات الرئيسية",
  SUBCATEGORY: "التصنيفات الفرعية",
  CITY: "المدن",
  SIZE: "الأحجام",
  STATIC: "الصفحات الثابتة",
  CONTACT: "معلومات التواصل",
  COMPLAINS: "الشكاوي",
  //Advs
  ADS: "الاعلانات والعروض",
  COUPON: "الكوبونات",
  //users
  USER: "المستخدمين",
  STORES: "مزودين الخدمات",
  ADMINS: "مستخدمين النظام",
  //Orders
  ORDERS: "الطلبات",
  MAP: "خريطة الطلبات",
  USERRATE: "تقييمات العملاء",
  PROVIDERRATE: "تقييمات السائقين ومزودين الخدمات",
  //Payments
  ORDEREARNING: "أرشيف الحركات المالية",
  TRANSACTION: "المستحقات والمدفوعات",
  //Notifications
  EMAILS: "الايميلات",
  SMS: "الرسائل النصية",
  NOTIFICATIONS: "التنبيهات",
  //Stores Data
  EMPLOYEE: "Employee",
  SERVICES: "Services",
  PRODUCTS: "Products",
};

exports.getToken = async (request, reply, done) => {
  const language = request.headers["accept-language"] ? request.headers["accept-language"] : "ar";
  // var place_id = request.headers["place"];
  // if (place_id) {
  //   var places = await place.findById(place_id);
  //   if (!places) {
  //     const response = errorAPI(
  //       language,
  //       400,
  //       MESSAGE_STRING_ARABIC.WORNG_PLACE_ID,
  //       MESSAGE_STRING_ENGLISH.WORNG_PLACE_ID
  //     );
  //     done(response);
  //   }
  //   if (places.isDeleted == true) {
  //     const response = errorAPI(
  //       language,
  //       400,
  //       MESSAGE_STRING_ARABIC.WARNING,
  //       MESSAGE_STRING_ENGLISH.WARNING
  //     );
  //     done(response);
  //   }
  // }
  // var supplier_id = request.headers["supplier"];
  // if (supplier_id) {
  //   var Suppliers = await Supplier.findById(supplier_id);
  //   if (!Suppliers) {
  //     const response = errorAPI(
  //       language,
  //       400,
  //       MESSAGE_STRING_ARABIC.ERROR,
  //       MESSAGE_STRING_ENGLISH.ERROR
  //     );
  //     done(response);
  //   }
  //   if (Suppliers.isBlock == true || Suppliers.isDeleted == true) {
  //     const response = errorAPI(
  //       language,
  //       400,
  //       MESSAGE_STRING_ARABIC.WARNING,
  //       MESSAGE_STRING_ENGLISH.WARNING
  //     );
  //     done(response);
  //   }
  // }

  const token = request.headers["token"];
  if (!token) {
    const response = errorAPI(
      language,
      430,
      MESSAGE_STRING_ARABIC.ACCESS_DENIED,
      MESSAGE_STRING_ENGLISH.ACCESS_DENIED
    );
    done(response);
  }
  try {
    const decoded = jwt.verify(token, config.get("jwtPrivateKey"));
    request.user = decoded;
    if (request.user.userType == USER_TYPE.GUEST) {
      // guest uer only for few request reach
      if (
        String(request.raw.url).includes("home/get") ||
        String(request.raw.url).includes("category/get") ||
        String(request.raw.url).includes("category/search") ||
        String(request.raw.url).includes("category/list") ||
        String(request.raw.url).includes("uncovered/add") ||
        String(request.raw.url).includes("supplier/get")
      ) {
        // done();
      } else {
        const response = errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.PLEASE_LOGIN,
          MESSAGE_STRING_ENGLISH.PLEASE_LOGIN,
          []
        );
        done(response);
      }
    } else {
      let _users = await Users.findById(request.user._id);
      let _employee = await employee.findById(request.user._id);
      if (_users) {
        if (_users.isBlock) {
          const response = errorAPI(
            language,
            405,
            MESSAGE_STRING_ARABIC.USER_BLOCK,
            MESSAGE_STRING_ENGLISH.USER_BLOCK,
            []
          );
          done(response);
        }
        if (!_users.isVerify) {
          const response = errorAPI(
            language,
            410,
            MESSAGE_STRING_ARABIC.USER_VERIFY,
            MESSAGE_STRING_ENGLISH.USER_VERIFY,
            {}
          );
          done(response);
        }
      } else if (_employee) {
        if (_employee.isBlock) {
          const response = errorAPI(
            language,
            405,
            MESSAGE_STRING_ARABIC.USER_BLOCK,
            MESSAGE_STRING_ENGLISH.USER_BLOCK,
            []
          );
          done(response);
        }
        if (!_employee.isVerify) {
          const response = errorAPI(
            language,
            410,
            MESSAGE_STRING_ARABIC.USER_VERIFY,
            MESSAGE_STRING_ENGLISH.USER_VERIFY,
            {}
          );
          done(response);
        }
      } else {
        const response = errorAPI(
          language,
          420,
          MESSAGE_STRING_ARABIC.USER_NOT_FOUND,
          MESSAGE_STRING_ENGLISH.USER_NOT_FOUND,
          []
        );
        done(response);
      }
    }
  } catch (ex) {
    const response = errorAPI(
      language,
      430,
      MESSAGE_STRING_ARABIC.INVALID_TOKEN,
      MESSAGE_STRING_ENGLISH.INVALID_TOKEN,
      []
    );
    done(response);
  }
};

exports.getAdminToken = async (request, reply, done) => {
  const token = request.headers["token"];
  const page = request.headers["page"];
  const operation = request.headers["operation"];
  if (!token) {
    const response = {
      status_code: 410,
      status: false,
      message:
        "Access denied. No token provided. Please logout and login again",
    };
    done(response);
  }
  try {
    const decoded = jwt.verify(token, config.get("jwtPrivateKey"));
    request.user = decoded;
    let _provider = await Supplier.findById(request.user._id);
    let _admin = await Admin.findById(request.user._id);
    if (_admin) {
    }

    if (_provider) {
      if (_provider.isBlock) {
        const response = {
          status_code: 400,
          status: false,
          message: "عذرا هذا الحساب محظور من قبل الادارة",
        };
        done(response);
      }
    }
    // done();
    // if (request.user.userType == USER_TYPE.ADMIN) {
    // } else if (request.user.userType == USER_TYPE.PROVIDER) {
    // } else {
    // }
  } catch (ex) {
    const response = {
      status_code: 410,
      status: false,
      message:
        "Access denied. No token provided. Please logout and login again",
    };
    done(response);
  }
};

function getPageName(name) {
  var pageName = "";
  switch (name) {
    case ADMIN_URL_ID.PRODUCTS:
      pageName = ADMIN_URL_STRINGS.PRODUCTS;
      break;
    case ADMIN_URL_ID.SERVICES:
      pageName = ADMIN_URL_STRINGS.SERVICES;
      break;
    case ADMIN_URL_ID.EMPLOYEE:
      pageName = ADMIN_URL_STRINGS.EMPLOYEE;
      break;
    case ADMIN_URL_ID.SETTINGS:
      pageName = ADMIN_URL_STRINGS.SETTINGS;
      break;
    case ADMIN_URL_ID.WALLET:
      pageName = ADMIN_URL_STRINGS.WALLET;
      break;
    case ADMIN_URL_ID.WELCOME:
      pageName = ADMIN_URL_STRINGS.WELCOME;
      break;
    case ADMIN_URL_ID.TYPES:
      pageName = ADMIN_URL_STRINGS.TYPES;
      break;
    case ADMIN_URL_ID.CATEGORY:
      pageName = ADMIN_URL_STRINGS.CATEGORY;
      break;
    case ADMIN_URL_ID.SUBCATEGORY:
      pageName = ADMIN_URL_STRINGS.SUBCATEGORY;
      break;
    case ADMIN_URL_ID.CITY:
      pageName = ADMIN_URL_STRINGS.CITY;
      break;
    case ADMIN_URL_ID.SIZE:
      pageName = ADMIN_URL_STRINGS.SIZE;
      break;
    case ADMIN_URL_ID.STATIC:
      pageName = ADMIN_URL_STRINGS.STATIC;
      break;
    case ADMIN_URL_ID.CONTACT:
      pageName = ADMIN_URL_STRINGS.CONTACT;
      break;
    case ADMIN_URL_ID.COMPLAINS:
      pageName = ADMIN_URL_STRINGS.COMPLAINS;
      break;
    case ADMIN_URL_ID.MYPROFILE:
      pageName = ADMIN_URL_STRINGS.MYPROFILE;
      break;
    case ADMIN_URL_ID.MYMESSAGES:
      pageName = ADMIN_URL_STRINGS.MYMESSAGES;
      break;
    case ADMIN_URL_ID.MYNOTIFICATIONS:
      pageName = ADMIN_URL_STRINGS.MYNOTIFICATIONS;
      break;
    case ADMIN_URL_ID.ADS:
      pageName = ADMIN_URL_STRINGS.ADS;
      break;
    case ADMIN_URL_ID.COUPON:
      pageName = ADMIN_URL_STRINGS.COUPON;
      break;
    case ADMIN_URL_ID.USER:
      pageName = ADMIN_URL_STRINGS.USER;
      break;
    case ADMIN_URL_ID.STORES:
      pageName = ADMIN_URL_STRINGS.STORES;
      break;
    case ADMIN_URL_ID.ADMINS:
      pageName = ADMIN_URL_STRINGS.ADMINS;
      break;
    case ADMIN_URL_ID.ORDERS:
      pageName = ADMIN_URL_STRINGS.ORDERS;
      break;
    case ADMIN_URL_ID.MAP:
      pageName = ADMIN_URL_STRINGS.MAP;
      break;
    case ADMIN_URL_ID.USERRATE:
      pageName = ADMIN_URL_STRINGS.USERRATE;
      break;
    case ADMIN_URL_ID.PROVIDERRATE:
      pageName = ADMIN_URL_STRINGS.PROVIDERRATE;
      break;
    case ADMIN_URL_ID.EMAILS:
      pageName = ADMIN_URL_STRINGS.EMAILS;
      break;
    case ADMIN_URL_ID.SMS:
      pageName = ADMIN_URL_STRINGS.SMS;
      break;
    case ADMIN_URL_ID.NOTIFICATIONS:
      pageName = ADMIN_URL_STRINGS.NOTIFICATIONS;
      break;
    case ADMIN_URL_ID.ORDEREARNING:
      pageName = ADMIN_URL_STRINGS.ORDEREARNING;
      break;
    case ADMIN_URL_ID.TRANSACTION:
      pageName = ADMIN_URL_STRINGS.TRANSACTION;
      break;
    default:
      break;
  }
  return pageName;
}
