const mongoose = require("mongoose");
const { number, date, boolean } = require("@hapi/joi");

const Productschema = mongoose.Schema(
  {
    arName: {
      type: String,
      required: [true, "arabic name is required"],
    },
    enName: {
      type: String,
      required: [true, "english name is required"],
    },
    arDescription: {
      type: String,
    },
    enDescription: {
      type: String,
    },
    rate: {
      type: Number,
    },
    price_for_replacment: {
      type: Number,
    },
    price_for_new: {
      type: Number,
    },
    discountPrice: {
      type: Number,
    },
    image: {
      type: String,
    },
    createat: {
      type: Date,
    },
    isNewProduct: {
      type: Boolean,
    },
    isReplacement: {
      type: Boolean,
    },
    sort: {
      type: Number,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: [true, "category is required"],
    },
    supplier_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "supplier",
    },
    sort: {
      type: Number,
      default: 0
    },
    isDeleted: {
      type: Boolean,
    },
  },
  { versionKey: false }
);

const schema = mongoose.Schema({
  arName: {
    type: String,
    required: [true, "arabic name is required"],
  },
  enName: {
    type: String,
    required: [true, "english name is required"],
  },
  image: {
    type: String,
  },
  isDeleted: {
    type: Boolean,
  },
  sort: {
    type: Number,
  },
});

const Supplierschema = mongoose.Schema({
  name: {
    type: String,
    required: [true, "name is required"],
  },
  image: {
    type: String,
  },
  details: {
    type: String,
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
  rate: {
    type: Number,
  },
  isDeleted: {
    type: Boolean,
    default:false
  },
  isBlock: {
    type: Boolean,
  },
  orderPercentage: { type: Number },
  cities: [{ type: mongoose.Schema.Types.ObjectId, ref: "city"}],
});

const ProductPlacePriceSchema = mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "product",
    required: [true, "product is required"],
  },
  place_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "place",
    required: [true, "place is required"],
  },
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "supplier",
    required: [true, "supplier is required"],
  },
  city_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "city",
    required: [true, "city is required"],
  },
  price_for_new: {
    type: Number,
    required: [true, "price for new is required"],
  },
  price_for_replacment: {
    type: Number,
    required: [true, "price for replacment is required"],
  },
  discountPrice: {
    type: Number,
  },
  discountPriceReplacment: {
    type: Number,
  },
  deliveryCost: {
    type: Number,
    required: [true, "delivery cost is required"],
  },
  expressCost: {
    type: Number,
    required: [true, "Express delivery cost is required"],
  },
  createAt: {
    type: Date,
  },
  isDeleted: {
    type: Boolean,
  },
});

const PlaceDeliverySchema = mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "supplier",
    required: [true, "supplier is required"],
  },
  place_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "place",
    required: [true, "place is required"],
  },
  city_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "city",
    required: [true, "city is required"],
  },
  isDeleted:{
    type:Boolean,
    default:false
  }
});

// PlaceDeliverySchema.index({ _id: 1 });
Productschema.index({ category_id: 1 });
ProductPlacePriceSchema.index({ product_id: 1 });

const Category = mongoose.model("category", schema);
const Supplier = mongoose.model("supplier", Supplierschema);
const Product = mongoose.model("product", Productschema);
const product_price = mongoose.model("product_price", ProductPlacePriceSchema);
const Place_Delivery = mongoose.model("place_deliveries", PlaceDeliverySchema);

exports.Category = Category;
exports.Supplier = Supplier;
exports.Product = Product;
exports.Product_Price = product_price;
exports.Place_Delivery = Place_Delivery;
