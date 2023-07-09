// External Dependancies
const boom = require("boom");
const moment = require("moment");
const cron = require("node-cron");
const async = require("async");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const _ = require("underscore");

// Get Data Models
const { coupon } = require("../models/Coupon");
const { Order } = require("../models/Order");
const { Cart } = require("../models/Cart");
const { package, setting, place } = require("../models/Constant");
const { Users, User_Address } = require("../models/User");
const { Notifications } = require("../models/Notifications");
const { getCurrentDateTime, currentDate } = require("../models/Constant");
const { CONTROLLER_ENUM } = require("../utils/constants");
const { success, errorAPI } = require("../utils/responseApi");
const {
  Product,
  Category,
  Supplier,
  Product_Price,
  Place_Delivery,
} = require("../models/Product");

const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");
const {
  CreateNotificationMultiple,
  CreateGeneralNotification,
  handleError,
} = require("../utils/utils");

// cron job for renting racks
exports.FinishActiveCoupon = async function FinishingHotelReservation() {
  // */1 * * * *
  // 0 0 0 * * *
  cron.schedule(`0 0 * * *`, async () => {
    const coupons = await coupon.find({
      isActive: true,
    });

    async.eachSeries(
      coupons,
      async function updateObject(element, done) {
        var a = moment(element.dt_to);
        var today = moment().tz("Asia/Riyadh");
        var b = moment(element.dt_from);
        var days = today.diff(a, "days");
        if (days >= 0) {
          await coupon.findByIdAndUpdate(
            element._id,
            {
              isActive: false,
            },
            {
              new: true,
            }
          );
        }
      },
      async function allDone(err) {
        //send notification to client to rate
        console.log("running a task every minute");
      }
    );
  });
};

// Get all coupon
exports.getmycoupon = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};
    query["by_id"] = { $eq: req.body.by_id };

    const total = await coupon.find(query).countDocuments();
    const item = await coupon
      .find(query)
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getcoupon = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    const total = await coupon.find(query).countDocuments();
    const item = await coupon
      .find(query)
      .populate("supplier_id")
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.couponusage = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    const total = await Order.find({
      $and: [{ couponCode: req.body.couponCode }, { StatusId: 4 }],
    }).countDocuments();
    const item = await Order.find({
      $and: [{ couponCode: req.body.couponCode }, { StatusId: 4 }],
    })
      .populate("user_id")
      .populate("provider_id")
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// Get single coupon by ID
exports.getSinglecoupon = async (req, reply) => {
  try {
    const sp = await coupon.findById(req.params.id);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: sp,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// Add a new coupon
exports.addcoupon = async (req, reply) => {
  try {
    const prevCoupon = await coupon.findOne({ coupon: req.body.coupon });
    if (prevCoupon) {
      const response = {
        status_code: 400,
        status: false,
        message: "عذرا .. الكوبون مضاف مسبقا",
        items: {},
      };
      reply.send(response);
      return;
    }

    var arr = [];
    var a = moment(req.body.dt_to);
    var b = moment(req.body.dt_from);
    var days = a.diff(b, "days");

    let _coupon = new coupon({
      coupon: req.body.coupon,
      dt_from: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
      dt_to: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
      days: days,
      discount_rate: req.body.discount_rate,
      isActive: true,
      supplier_id: req.body.supplier_id,
      place_id: req.body.place_id,
      city_id: req.body.city_id,
    });
    var _return = handleError(_coupon.validateSync());
    if (_return.length > 0) {
      reply.code(200).send({
        status_code: 400,
        status: false,
        message: _return[0],
        items: _return,
      });
      return;
    }
    let rs = await _coupon.save();

    const object2 = await Users.find({
      $and: [{ isBlock: false }, { fcmToken: { $ne: "" } }],
    });
    // object2.forEach((x) => {
    //   arr.push(x.fcmToken);
    // });

    for await (const x of object2) {
      if (
        Number(x.lat) != -180 &&
        Number(x.lng) != -180 &&
        Number(x.lat) != 180 &&
        Number(x.lng) != 180 &&
        Number(x.lat) != 0 &&
        Number(x.lng) != 0
      ) {
        var PoinInPolygon = await place.find({
          $and: [
            {
              loc: {
                $geoIntersects: {
                  $geometry: {
                    type: "Point",
                    coordinates: [Number(x.lng), Number(x.lat)],
                  },
                },
              },
            },
            { _id: req.body.place_id },
            { isDeleted: false },
          ],
        });
        if (PoinInPolygon.length > 0) {
          arr.push(x);
        }
      }
    }

    let msg = `استخدم كوبون ${req.body.coupon} واحصل على خصم ${Number(
      req.body.discount_rate * 100
    )}% من قيمة التوصيل`;

    var docs = [];
    var supplier = await Supplier.findById(req.body.supplier_id);

    if (arr.length > 0) {
      for await (const doc of arr) {
        let _Notification2 = new Notifications({
          fromId: supplier._id,
          user_id: doc._id,
          title: "عروضات وتخفيضات",
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: 2,
          body_parms: rs.coupon,
          isRead: false,
          fromName: supplier.name,
          toName: doc.name,
        });
        docs.push(_Notification2);
        // _Notification2.save();
      }

      await Notifications.insertMany(docs, (err, _docs) => {
        if (err) {
          return console.error(err);
        } else {
          console.log("Multiple documents inserted to Collection");
        }
      });
      var fcmTokenArray = arr.map((x) => x.fcmToken);
      CreateNotificationMultiple(
        fcmTokenArray,
        "عروضات وتخفيضات",
        msg,
        rs.coupon
      );
    }

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: rs,
    };

    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// delete coupon
exports.deletecoupon = async (req, reply) => {
  const _coupon = await coupon.findByIdAndRemove(req.params.id);
  const response = {
    status_code: 200,
    status: true,
    message: "تمت العملية بنجاح",
    items: [],
  };
  reply.code(200).send(response);
};

// Update an existing adv
exports.updatecoupon = async (req, reply) => {
  try {
    var a = moment(req.body.dt_to);
    var b = moment(req.body.dt_from);
    var days = a.diff(b, "days");

    const _coupon = await coupon.findByIdAndUpdate(
      req.params.id,
      {
        coupon: req.body.coupon,
        dt_from: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
        dt_to: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        discount_rate: req.body.discount_rate,
        days: days,
        supplier_id: req.body.supplier_id,
        place_id: req.body.place_id,
        city_id: req.body.city_id,
      },
      { new: true, runValidators: true },
      function (err, model) {
        var _return = handleError(err);
        if (_return.length > 0) {
          reply.code(200).send({
            status_code: 400,
            status: false,
            message: _return[0],
            items: _return,
          });
          return;
        }
      }
    );
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: _coupon,
    };
    reply.code(200).send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// Check Coupon
exports.checkCouponCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    const tax = await setting.findOne({ code: "TAX" });
    const user_id = req.user._id;

    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var today = moment().tz("Asia/Riyadh");
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var providerArr = [];
    var ar_msg = "";
    var en_msg = "";
    var statusCode = 200;
    var newPlaceId = "";
    var lat = 0.0;
    var lng = 0.0;

    const _sp = await Order.findOne({
      $and: [{ user_id: user_id }, { couponCode: req.body.coupon }],
    });

    const item = await Cart.find({
      $and: [{ user_id: user_id }],
    })
      .sort({ _id: -1 })
      .lean();

    if (item.length == 0) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.EMPTY_CART,
            MESSAGE_STRING_ENGLISH.EMPTY_CART,
            {}
          )
        );
      return;
    }

    for await (const data of item) {
      var ProviderArrIndex = _.findIndex(providerArr, function (_item) {
        return String(_item._id) == String(data.supplier_id);
      });
      if (ProviderArrIndex >= 0) {
        //exsits
        if (data.product_id && data.product_id != "" && data.product_id != 0) {
          var product = await Product.findOne({
            $and: [{ _id: data.product_id }, { isDeleted: false }],
          }).populate("category_id");
          if (product) {
            var productObject = product.toObject();

            var Product_Price_Object = await Product_Price.findOne({
              $and: [
                { place_id: place_id },
                { product_id: data.product_id },
                { supplier_id: supplier_id },
                { isDeleted: false },
              ],
            });

            if (Product_Price_Object) {
              // reply
              //   .code(200)
              //   .send(
              //     errorAPI(
              //       language,
              //       400,
              //       MESSAGE_STRING_ARABIC.ERROR,
              //       MESSAGE_STRING_ENGLISH.ERROR
              //     )
              //   );
              // return;

              var cateogory = {
                _id: productObject.category_id._id,
                name: productObject.category_id[`${language}Name`],
                image: productObject.category_id.image
                  ? productObject.category_id.image
                  : "",
              };
              productObject.category_id = cateogory;
              productObject.discountPrice = Product_Price_Object.discountPrice;
              productObject.discountPriceReplacement =
                Product_Price_Object.discountPriceReplacement;
              productObject.price_for_new = Product_Price_Object.price_for_new;
              productObject.price_for_replacment =
                Product_Price_Object.price_for_replacment;

              delete productObject.arName;
              delete productObject.enName;
              delete productObject.arDescription;
              delete productObject.enDescription;
              productObject.name = product[`${language}Name`];
              productObject.description = product[`${language}Description`];

              productObject.cart_id = data._id;
              productObject.qty = data.qty;
              productObject.Total = data.Total;
              productObject.TotalDiscount = data.TotalDiscount;

              providerArr[ProviderArrIndex].products.push(productObject);
            }
          }
        }
      } else {
        // new
        var provider_data = await Supplier.findOne({
          $and: [
            { _id: data.supplier_id },
            { isDeleted: false },
            { isBlock: false },
          ],
        }).select(["-token", "-password", "-cities"]);

        if (provider_data) {
          providerobject = provider_data.toObject();
          providerobject.products = [];

          if (
            data.product_id &&
            data.product_id != "" &&
            data.product_id != 0
          ) {
            var _product = await Product.findOne({
              $and: [{ _id: data.product_id }, { isDeleted: false }],
            }).populate("category_id");
            if (_product) {
              var productObject = _product.toObject();
              var Product_Price_Object = await Product_Price.findOne({
                $and: [
                  { place_id: place_id },
                  { product_id: data.product_id },
                  { supplier_id: supplier_id },
                  { isDeleted: false },
                ],
              });

              if (Product_Price_Object) {
                var cateogory = {
                  _id: productObject.category_id._id,
                  name: productObject.category_id[`${language}Name`],
                  image: productObject.category_id.image
                    ? productObject.category_id.image
                    : "",
                };
                productObject.category_id = cateogory;
                productObject.discountPrice =
                  Product_Price_Object.discountPrice;
                productObject.discountPriceReplacement =
                  Product_Price_Object.discountPriceReplacement;
                productObject.price_for_new =
                  Product_Price_Object.price_for_new;
                productObject.price_for_replacment =
                  Product_Price_Object.price_for_replacment;

                delete productObject.arName;
                delete productObject.enName;
                delete productObject.arDescription;
                delete productObject.enDescription;
                productObject.name = _product[`${language}Name`];
                productObject.description = _product[`${language}Description`];
                productObject.cart_id = data._id;
                productObject.qty = data.qty;
                productObject.Total = data.Total;
                productObject.TotalDiscount = data.TotalDiscount;

                providerobject.products.push(productObject);
                providerArr.push(providerobject);
              }
            }
          }
        }
      }

      if (Product_Price_Object) {
        if (
          Product_Price_Object.discountPrice &&
          Product_Price_Object.discountPrice != 0
        ) {
          totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
          totalDiscount += Number(
            Product_Price_Object.discountPrice * data.qty
          );
        } else {
          totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
        }

        deliverycost +=
          Number(Product_Price_Object.deliveryCost) * Number(data.qty);
        expresscost +=
          Number(Product_Price_Object.expressCost) * Number(data.qty);
      }
    }

    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery) ;
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery) ;
   
    if (
      String(req.body.is_address_book) == "true" &&
      req.body.address_book &&
      req.body.address_book != ""
    ) {
      var newAddress = await User_Address.findById(req.body.address_book);
      if (newAddress) {
        lat = Number(newAddress.lat);
        lng = Number(newAddress.lng);
        if (newAddress.discount != 0)
          personalDiscount = Number(newAddress.discount);
      } else {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.ERROR,
              MESSAGE_STRING_ENGLISH.ERROR
            )
          );
        return;
      }
    } else {
      lat = Number(req.body.lat);
      lng = Number(req.body.lng);
    }

    if (lat != 0.0 && lng != 0.0) {
      // user delivery address in change
      var PoinInPolygon = await place.find({
        $and: [
          {
            loc: {
              $geoIntersects: {
                $geometry: {
                  type: "Point",
                  coordinates: [lng, lat],
                },
              },
            },
          },
          { isDeleted: false },
        ],
      });
      if (PoinInPolygon.length > 0) {
        if (place_id == PoinInPolygon[0]._id) {
          newPlaceId = place_id;
          // same location don't doing anything .. and get nearest driver in same place and supplier
        } else {
          // change prices to new distination send it with new alert and new prices
          newPlaceId = PoinInPolygon[0]._id;
        }
      } else {
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(deliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

        var returnObject = {
          results: [],
          tax: Number(sub_total_delivery * Number(tax.value)),
          deliveryCost: Number(deliverycost),
          expressCost: Number(expresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(final_total).toFixed(2)),
          final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.DESTINATION_NOT_COVERED,
              MESSAGE_STRING_ENGLISH.DESTINATION_NOT_COVERED,
              returnObject
            )
          );
        return;
      }
    } else {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR,
            MESSAGE_STRING_ENGLISH.ERROR
          )
        );
      return;
    }

    const sp = await coupon.findOne({
      $and: [
        { dt_from: { $lte: today } },
        { dt_to: { $gte: today } },
        { coupon: req.body.coupon },
        { place_id: newPlaceId },
        { isActive: true },
      ],
    });

    // var sub_total = totalPrice - totalDiscount;
    // var final_total =
    //   Number(sub_total * Number(tax.value)) +
    //   Number(sub_total) +
    //   Number(deliverycost);

    if (_sp) {
      var sub_total = totalPrice - totalDiscount;
      let sub_total_delivery = Number(sub_total) + Number(deliverycost);
      let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
      var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
      var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

      var returnObject = {
        results: [],
        tax: Number(sub_total_delivery * Number(tax.value)),
        deliveryCost: Number(deliverycost),
        expressCost: Number(expresscost),
        total_price: Number(parseFloat(totalPrice).toFixed(2)),
        total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
        final_total: Number(parseFloat(final_total).toFixed(2)),
        final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
      };

      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.COUPON_ERROR,
            MESSAGE_STRING_ENGLISH.COUPON_ERROR,
            returnObject
          )
        );
      return;
    } else {
      if (sp) {
        let newDeliverycost = deliverycost //- Number(deliverycost * sp.discount_rate);
        let newExpresscost = expresscost //- Number(expresscost * sp.discount_rate);
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(newDeliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(newExpresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);
        
        var new_final_total = final_total - Number(final_total * sp.discount_rate);
        var new_final_express_total = final_express_total - Number(final_express_total * sp.discount_rate);

        var returnObject = {
          results: [],
          tax: Number(tax.value),
          deliveryCost: Number(newDeliverycost),
          expressCost: Number(newExpresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(new_final_total).toFixed(2)),
          final_express_total: Number(parseFloat(new_final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS,
              returnObject
            )
          );
        return;
      } else {
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(deliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

        var returnObject = {
          results: [],
          tax: Number(sub_total_delivery * Number(tax.value)),
          deliveryCost: Number(deliverycost),
          expressCost: Number(expresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(final_total).toFixed(2)),
          final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.COUPON_ERROR,
              MESSAGE_STRING_ENGLISH.COUPON_ERROR,
              returnObject
            )
          );
        return;
      }
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.checkCouponReplacment = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    const tax = await setting.findOne({ code: "TAX" });
    const user_id = req.user._id;

    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var today = moment().tz("Asia/Riyadh");
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var providerArr = [];
    var ar_msg = "";
    var en_msg = "";
    var statusCode = 200;
    var newPlaceId = "";
    var lat = 0.0;
    var lng = 0.0;

    const _sp = await Order.findOne({
      $and: [{ user_id: user_id }, { couponCode: req.body.coupon }],
    });

    const cart_arr = req.body.items;

    if (cart_arr.length == 0) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.EMPTY_CART,
            MESSAGE_STRING_ENGLISH.EMPTY_CART,
            {}
          )
        );
      return;
    }

    for await (const data of cart_arr) {
      var Product_Price_Object = await Product_Price.findOne({
        $and: [
          { place_id: place_id },
          { supplier_id: supplier_id },
          { product_id: data.product_id },
          { isDeleted: false },
        ],
      });

      if (Product_Price_Object) {
        // reply
        //   .code(200)
        //   .send(
        //     errorAPI(
        //       language,
        //       400,
        //       MESSAGE_STRING_ARABIC.ERROR,
        //       MESSAGE_STRING_ENGLISH.ERROR
        //     )
        //   );
        // return;

        if (
          Product_Price_Object.discountPriceReplacment &&
          Product_Price_Object.discountPriceReplacment != 0
        ) {
          totalPrice +=
            Number(Product_Price_Object.price_for_replacment) * data.qty;
          totalDiscount += Number(
            Product_Price_Object.discountPriceReplacment * data.qty
          );
        } else {
          totalPrice +=
            Number(Product_Price_Object.price_for_replacment) * data.qty;
        }

        deliverycost +=
          Number(Product_Price_Object.deliveryCost) * Number(data.qty);
        expresscost +=
          Number(Product_Price_Object.expressCost) * Number(data.qty);
      }
    }
    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

    if (
      String(req.body.is_address_book) == "true" &&
      req.body.address_book &&
      req.body.address_book != ""
    ) {
      var newAddress = await User_Address.findById(req.body.address_book);
      if (newAddress) {
        lat = Number(newAddress.lat);
        lng = Number(newAddress.lng);
        if (newAddress.discount != 0)
          personalDiscount = Number(newAddress.discount);
      } else {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.ERROR,
              MESSAGE_STRING_ENGLISH.ERROR
            )
          );
        return;
      }
    } else {
      lat = Number(req.body.lat);
      lng = Number(req.body.lng);
    }

    if (lat != 0.0 && lng != 0.0) {
      // user delivery address in change
      var PoinInPolygon = await place.find({
        $and: [
          {
            loc: {
              $geoIntersects: {
                $geometry: {
                  type: "Point",
                  coordinates: [lng, lat],
                },
              },
            },
          },
          { isDeleted: false },
        ],
      });
      if (PoinInPolygon.length > 0) {
        if (place_id == PoinInPolygon[0]._id) {
          newPlaceId = place_id;
          // same location don't doing anything .. and get nearest driver in same place and supplier
        } else {
          // change prices to new distination send it with new alert and new prices
          newPlaceId = PoinInPolygon[0]._id;
        }
      } else {
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(deliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

        var returnObject = {
          results: [],
          tax: Number(sub_total_delivery * Number(tax.value)),
          deliveryCost: Number(deliverycost),
          expressCost : Number(expresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(final_total).toFixed(2)),
          final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.DESTINATION_NOT_COVERED,
              MESSAGE_STRING_ENGLISH.DESTINATION_NOT_COVERED,
              returnObject
            )
          );
        return;
      }
    } else {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR,
            MESSAGE_STRING_ENGLISH.ERROR
          )
        );
      return;
    }

    const sp = await coupon.findOne({
      $and: [
        { dt_from: { $lte: today } },
        { dt_to: { $gte: today } },
        { coupon: req.body.coupon },
        { place_id: newPlaceId },
      ],
    });

    if (_sp) {
      var sub_total = totalPrice - totalDiscount;
      let sub_total_delivery = Number(sub_total) + Number(deliverycost);
      let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
      var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
      var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

      var returnObject = {
        results: [],
        tax: Number(sub_total_delivery * Number(tax.value)),
        deliveryCost: Number(deliverycost),
        expressCost: Number(expresscost),
        total_price: Number(parseFloat(totalPrice).toFixed(2)),
        total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
        final_total: Number(parseFloat(final_total).toFixed(2)),
        final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
      };

      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.COUPON_ERROR,
            MESSAGE_STRING_ENGLISH.COUPON_ERROR,
            returnObject
          )
        );
      return;
    } else {
      if (sp) {
        let newDeliverycost = deliverycost //- Number(deliverycost * sp.discount_rate);
        let newExpresscost = expresscost //- Number(deliverycost * sp.discount_rate);
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(newDeliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(newExpresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);


        var new_final_total = final_total - Number(final_total * sp.discount_rate);
        var new_final_express_total = final_express_total - Number(final_express_total * sp.discount_rate);

        var returnObject = {
          results: [],
          tax: Number(sub_total_delivery * Number(tax.value)),
          deliveryCost: Number(newDeliverycost),
          expressCost: Number(newExpresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(new_final_total).toFixed(2)),
          final_express_total: Number(parseFloat(new_final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS,
              returnObject
            )
          );
        return;
      } else {
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(deliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

        var returnObject = {
          results: [],
          tax: Number(sub_total_delivery * Number(tax.value)),
          deliveryCost: Number(deliverycost),
          expressCost: Number(expresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(final_total).toFixed(2)),
          final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.COUPON_ERROR,
              MESSAGE_STRING_ENGLISH.COUPON_ERROR,
              returnObject
            )
          );
        return;
      }
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};
