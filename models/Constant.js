const mongoose = require("mongoose");
const moment = require("moment-timezone");
const { number, string, date } = require("@hapi/joi");

const complainsSchema = mongoose.Schema(
  {
    details: {
      type: String,
    },
    dt_date: {
      type: Date,
    },
    full_name: {
      type: String,
    },
    email: {
      type: String,
    },
    phone_number: {
      type: String,
    },
  },
  { versionKey: false }
);

const countrySchema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
    isDeleted: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

const specialSchema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
    image:{
      type: String,
      required: [true, "image is required"],
    },
    isDeleted: {
      type: Boolean,
    },
    type: {
      type: String,
    },
  },
  { versionKey: false }
);


const generalSchema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
  },
  { versionKey: false }
);

const tokenschema = mongoose.Schema(
  {
    supplier_id: {
      type: String,
    },
    token_id: {
      type: String,
    },
  },
  { versionKey: false }
);

const Socialschema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
    data: {
      type: String,
    },
  },
  { versionKey: false }
);

const settings = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
    },
    code: {
      type: String,
      required: [true, "code is required"],
    },
    max: {
      type: String,
      required: [true, "max is required"],
    },
    min: {
      type: String,
      required: [true, "min is required"],
    },
    value: {
      type: String,
      required: [true, "value is required"],
    },
  },
  { versionKey: false }
);

const walletsettings = mongoose.Schema(
  {
    max: {
      type: Number,
      required: [true, "max is required"],
    },
    min: {
      type: Number,
      required: [true, "min is required"],
    },
    value: {
      type: Number,
      required: [true, "value is required"],
    },
    //1: cash
    //2: online
    //3: wallet
    type: {
      type: Number,
      required: [true, "type is required"],
    },
  },
  { versionKey: false }
);

const delivery_timeSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
    },
    isSort: {
      type: Number,
      required: false,
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "supplier is required"],
    },
    isDeleted: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

const update = mongoose.Schema(
  {
    isAndroid: {
      type: String,
    },
    isIOS: {
      type: String,
    },
    isProvider: {
      type: String,
    },
  },
  { versionKey: false }
);

const StaticPageSchema = mongoose.Schema(
  {
    Type: {
      type: String,
    },
    arTitle: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enTitle: {
      type: String,
      required: [true, "english name is required"],
    },
    arContent: {
      type: String,
    },
    enContent: {
      type: String,
    },
    type: { type: String },
  },
  { versionKey: false }
);

const welcomeSchema = mongoose.Schema(
  {
    icon: {
      type: String,
    },
    enTitle: {
      type: String,
      required: [true, "english name is required"],
    },
    arTitle: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enDescription: {
      type: String,
    },
    arDescription: {
      type: String,
    },
    isDriver: {
      type: Boolean,
      required: [true, "type is required"],
    },
  },
  { versionKey: false }
);

// const mysettings = mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: true,
//     },
//     max: {
//       type: String,
//     },
//     min: {
//       type: String,
//     },
//     value: {
//       type: String,
//     },
//     provider_id: { type: mongoose.Schema.Types.ObjectId, ref: "providers" },
//   },
//   { versionKey: false }
// );

const schema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
    country_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "countries",
      required: [true, "country  is required"],
    },
    isDeleted: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

const PlacesSchema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
    city_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "city",
      required: [true, "city name is required"],
    },
    loc: {
      type: { type: String },
      coordinates: [],
    },
    cord: {
      type: [
        {
          lat: { type: Number },
          lng: { type: Number },
        },
      ],
    },
    isDeleted: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

PlacesSchema.index({ loc: "2dsphere" });

const TimesSchema = mongoose.Schema(
  {
    from: {
      type: String,
    },
    to: {
      type: String,
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "supplier",
    },
    isDeleted: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

const VariationSchema = mongoose.Schema(
  {
    regular_price: { type: Number },
    image: { 
     type: {
        name: { type: String }
      } 
    },
    attributes: {
          type: [
            {
              option: { type: String },
            },
          ],
    },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "product" },
  },
  { versionKey: false }
);

const AttributeSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    slug: {
      type: String,
    },
    type: {
      type: String,
    },
    order_by: {
      type: String,
    },
    has_archives:{
      type: Boolean,
    }
  },
  { versionKey: false }
);

const AttributeTermsSchema = mongoose.Schema(
  {
    name: {
      type: String,
    },
    attribute_id:{
      type: mongoose.Schema.Types.ObjectId, ref: "attribute",
    }
  },
  { versionKey: false }
);


const updates = mongoose.model("updates", update);
const setting = mongoose.model("settings", settings);
const SocialOption = mongoose.model("SocialOption", Socialschema);
const ContactOption = mongoose.model("ContactOption", Socialschema);
const city = mongoose.model("city", schema);
const place = mongoose.model("place", PlacesSchema);
const country = mongoose.model("countries", countrySchema);
const special = mongoose.model("special", specialSchema);
const delivery_time = mongoose.model("deliveryTime", delivery_timeSchema);
const tokens = mongoose.model("tokens", tokenschema);
const StaticPage = mongoose.model("staticpage", StaticPageSchema);
const complains = mongoose.model("complains", complainsSchema);
const weolcomes = mongoose.model("welcomes", welcomeSchema);
const ComplainsType = mongoose.model("ComplainsType", generalSchema);
const walletsetting = mongoose.model("walletsettings", walletsettings);
const type = mongoose.model("type", generalSchema);
const language = mongoose.model("language", generalSchema);
const times = mongoose.model("times", TimesSchema);
const event = mongoose.model("event", countrySchema);

const variation = mongoose.model("variation", VariationSchema);
const attribute = mongoose.model("attribute", AttributeSchema);
const attribute_terms = mongoose.model("attribute_terms", AttributeTermsSchema);


function getCurrentDateTime() {
  // var utc = new Date();
  // var current = utc.setHours(utc.getHours() + 3);
  var current = moment().tz("Asia/Riyadh");
  return current;
}

function currentDate(date) {
  // var utc = new Date(date);
  var current = moment(date).tz("Asia/Riyadh"); //utc.setHours(utc.getHours() + 3);
  return current;
}


exports.variation = variation;
exports.attribute = attribute;
exports.attribute_terms = attribute_terms;

exports.update = updates;
exports.delivery_time = delivery_time;
exports.setting = setting;
exports.city = city;
exports.place = place;
exports.ContactOption = ContactOption;
exports.SocialOption = SocialOption;
exports.StaticPage = StaticPage;

exports.tokens = tokens;
exports.complains = complains;
exports.welcome = weolcomes;
exports.ComplainsType = ComplainsType;
exports.walletsettings = walletsetting;
exports.country = country;
exports.type = type;
exports.languages = language;
exports.times = times;
exports.special = special;
exports.event = event;

exports.getCurrentDateTime = getCurrentDateTime;
exports.currentDate = currentDate;